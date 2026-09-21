import { type NextRequest, NextResponse } from "next/server";
import { confirmationRequestSchema } from "@/lib/contracts/confirmation";
import type { ResultCard, Source, StructuredResult } from "@/lib/contracts/result";
import { getConfirmationService } from "@/lib/confirmation/service";
import { getVerificationService } from "@/lib/verification/service";
import { getDiagnosticService } from "@/lib/diagnostics/service";
import { createDefaultToolRegistry } from "@/lib/tools/demo-tools";
import { getIdempotencyService } from "@/lib/tools/idempotency";
import { verificationRegistry } from "@/lib/verification/registry";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = confirmationRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid confirmation request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { confirmationId, action } = parsed.data;
    const confirmationService = getConfirmationService();

    if (action === "cancel") {
      const pending = confirmationService.get(confirmationId);
      confirmationService.cancel(confirmationId);
      const verificationService = getVerificationService();
      const task = pending
        ? (verificationService.taskTracker.getTask(pending.originatingRunId) ??
           verificationService.taskTracker.getTask(confirmationId))
        : undefined;
      if (task) {
        verificationService.taskTracker.updateState(task.id, "cancelled");
      }
      if (pending) {
        const diagService = getDiagnosticService();
        diagService.recordConfirmation(pending.originatingRunId, {
          confirmationId: pending.id,
          runId: pending.originatingRunId,
          taskId: task?.id ?? confirmationId,
          toolId: pending.toolId,
          state: "cancelled",
          createdAt: pending.createdAt,
          expiresAt: pending.expiresAt,
          resolvedAt: new Date().toISOString(),
          outcome: "cancelled",
        });
        diagService.completeRun(pending.originatingRunId, "cancelled");
      }
      return NextResponse.json({
        status: "cancelled",
        confirmationId,
        message: "Action cancelled by user.",
        result: {
          speech: "Action was cancelled.",
          title: "Action Cancelled",
          state: "failed",
          cards: [],
          sources: [],
        },
      });
    }

    const { idempotencyKey: reqIdempotencyKey } = parsed.data;
    const headerIdempotencyKey = request.headers.get("Idempotency-Key") || request.headers.get("X-Idempotency-Key");
    const idempotencyKey = reqIdempotencyKey || headerIdempotencyKey;
    const idempotency = getIdempotencyService();

    if (action === "confirm" && idempotencyKey) {
      const existingCompleted = idempotency.getRecord(idempotencyKey);
      if (existingCompleted && existingCompleted.status === "completed" && existingCompleted.result) {
        return NextResponse.json(existingCompleted.result, {
          headers: { "X-Idempotent-Replay": "true" },
        });
      }
    }

    let authorizedConfirmation;
    try {
      authorizedConfirmation = confirmationService.authorize(confirmationId);
    } catch (authError: unknown) {
      const message = authError instanceof Error ? authError.message : "Authorization failed";
      if (message.includes("expired")) {
        return NextResponse.json(
          { status: "expired", confirmationId, message: "Confirmation has expired." },
          { status: 410 }
        );
      }
      if (message.includes("not found")) {
        return NextResponse.json(
          { status: "failed", confirmationId, message: "Confirmation not found." },
          { status: 404 }
        );
      }
      // Replay or invalid status
      return NextResponse.json(
        {
          status: "failed",
          confirmationId,
          message: "Confirmation has already been used or is no longer valid.",
        },
        { status: 409 }
      );
    }

    const verificationService = getVerificationService();
    const diagService = getDiagnosticService();
    const task =
      verificationService.taskTracker.getTask(authorizedConfirmation.originatingRunId) ??
      verificationService.taskTracker.getTask(authorizedConfirmation.id);

    if (task) {
      verificationService.taskTracker.updateState(task.id, "executing", {
        toolId: authorizedConfirmation.toolId,
        currentAction: authorizedConfirmation.title,
      });
    }
    diagService.recordConfirmation(authorizedConfirmation.originatingRunId, {
      confirmationId: authorizedConfirmation.id,
      runId: authorizedConfirmation.originatingRunId,
      taskId: task?.id ?? authorizedConfirmation.id,
      toolId: authorizedConfirmation.toolId,
      state: "confirmed",
      createdAt: authorizedConfirmation.createdAt,
      expiresAt: authorizedConfirmation.expiresAt,
      resolvedAt: new Date().toISOString(),
      outcome: "success",
    });
    diagService.updateRunState(authorizedConfirmation.originatingRunId, "executing");

    // Execute the exact validated parameters through the ToolRegistry
    const registry = createDefaultToolRegistry();
    const tool = registry.get(authorizedConfirmation.toolId);

    if (!tool) {
      if (task) {
        verificationService.taskTracker.updateState(task.id, "failed", {
          error: `Tool "${authorizedConfirmation.toolId}" is not registered.`,
        });
      }
      return NextResponse.json(
        {
          status: "failed",
          confirmationId,
          message: `Tool "${authorizedConfirmation.toolId}" is not registered.`,
          result: {
            speech: `Tool ${authorizedConfirmation.toolId} is not available.`,
            title: "Execution Error",
            state: "failed",
            cards: [],
            sources: [],
          },
        },
        { status: 500 }
      );
    }

    try {
      const toolStart = performance.now();
      const toolOutput = await tool.execute(authorizedConfirmation.parameters, {
        signal: request.signal,
        callId: authorizedConfirmation.id,
      });
      const toolDurationMs = Math.max(0, Math.round(performance.now() - toolStart));

      const validatedOutput = tool.outputSchema.safeParse(toolOutput);
      if (!validatedOutput.success) {
        diagService.recordTool(authorizedConfirmation.originatingRunId, {
          id: authorizedConfirmation.id,
          runId: authorizedConfirmation.originatingRunId,
          taskId: task?.id ?? authorizedConfirmation.id,
          toolId: tool.id,
          permission: tool.permission,
          state: "failed",
          timing: {
            startedAt: new Date(Date.now() - toolDurationMs).toISOString(),
            durationMs: toolDurationMs,
          },
          outcome: "failure",
          failure: {
            code: "tool_validation_failed",
            message: "Tool produced invalid output.",
            retryable: false,
            source: "tool",
          },
        });
        if (task) {
          verificationService.taskTracker.updateState(task.id, "failed", {
            error: "Tool produced invalid output.",
          });
        }
        return NextResponse.json(
          {
            status: "failed",
            confirmationId,
            message: "Tool produced invalid output.",
            result: {
              speech: "The tool succeeded but returned an unexpected format.",
              title: "Output Validation Error",
              state: "failed",
              cards: [],
              sources: [],
            },
          },
          { status: 502 }
        );
      }

      diagService.recordTool(authorizedConfirmation.originatingRunId, {
        id: authorizedConfirmation.id,
        runId: authorizedConfirmation.originatingRunId,
        taskId: task?.id ?? authorizedConfirmation.id,
        toolId: tool.id,
        permission: tool.permission,
        state: "completed",
        timing: {
          startedAt: new Date(Date.now() - toolDurationMs).toISOString(),
          durationMs: toolDurationMs,
        },
        outcome: "success",
      });

      // Formal Verification Stage (Phase 10)
      if (task) {
        verificationService.taskTracker.updateState(task.id, "verifying");
      }
      diagService.updateRunState(authorizedConfirmation.originatingRunId, "verifying");

      const toolResult = {
        callId: authorizedConfirmation.id,
        toolId: tool.id,
        status: "success" as const,
        output: validatedOutput.data,
      };

      const verStart = performance.now();
      const verificationResult = await verificationService.verify(
        {
          runId: authorizedConfirmation.originatingRunId,
          taskId: task?.id ?? authorizedConfirmation.id,
          toolId: tool.id,
          parameters: authorizedConfirmation.parameters,
          toolResult,
          timestamp: new Date().toISOString(),
        },
        { signal: request.signal }
      );
      const verDurationMs = Math.max(0, Math.round(performance.now() - verStart));

      const verificationStrategyInstance = verificationRegistry.get(
        tool.verificationStrategy || tool.id
      );
      const strategyName =
        verificationStrategyInstance.name ??
        verificationStrategyInstance.id ??
        "VerificationStrategy";

      diagService.recordVerification(authorizedConfirmation.originatingRunId, {
        verificationId: `ver-${authorizedConfirmation.id}`,
        runId: authorizedConfirmation.originatingRunId,
        taskId: task?.id ?? authorizedConfirmation.id,
        toolId: tool.id,
        strategy: strategyName,
        state: "completed",
        timing: {
          startedAt: new Date(Date.now() - verDurationMs).toISOString(),
          durationMs: verDurationMs,
        },
        outcome: verificationResult.status === "passed" ? "success" : "failure",
        failure:
          verificationResult.status !== "passed"
            ? {
                code: "verification_failed",
                message: verificationResult.reason ?? "Verification failed",
                retryable: false,
                source: "verification",
              }
            : undefined,
      });

      if (verificationResult.status !== "passed") {
        const failureReason = verificationResult.reason || "Action could not be verified.";
        const actionName =
          authorizedConfirmation.toolId === "create_note"
            ? "note"
            : authorizedConfirmation.toolId === "create_google_doc"
            ? "Google Doc"
            : "email draft";
        const failureSpeech = `I couldn't verify that the ${actionName} was created. ${failureReason}`;

        if (task) {
          verificationService.taskTracker.updateState(task.id, "failed", {
            verificationStatus: "failed",
            error: failureReason,
          });
        }
        diagService.completeRun(authorizedConfirmation.originatingRunId, "failure", {
          code: "verification_failed",
          message: failureReason,
          retryable: false,
          source: "verification",
        });

        return NextResponse.json(
          {
            status: "failed",
            confirmationId,
            message: failureReason,
            result: {
              speech: failureSpeech,
              title: "Verification Failed",
              state: "failed",
              cards: [],
              sources: [],
            },
          },
          { status: 502 }
        );
      }

      // Format semantic result based on action category
      const params = authorizedConfirmation.parameters as Record<string, string>;
      const out = validatedOutput.data as Record<string, string>;

      let speech = "Action completed and verified successfully.";
      const cards: ResultCard[] = [];
      const sources: Source[] = [];

      if (authorizedConfirmation.toolId === "create_note") {
        const title = params.title || "Note";
        const path = out.path || "Inbox/JARVIS/";
        speech = `Created and verified note "${title}" in your Obsidian vault.`;
        cards.push({
          type: "note",
          id: `note-${authorizedConfirmation.id}`,
          label: "Obsidian Note",
          title,
          excerpt: params.content || "",
          path,
          modifiedAt: out.createdAt || new Date().toISOString(),
        });
        sources.push({
          id: `src-${authorizedConfirmation.id}`,
          title,
          kind: "note",
          location: path,
        });
      } else if (authorizedConfirmation.toolId === "create_google_doc") {
        const title = out.title || params.title || "Document";
        const webLink = out.webLink || "Google Drive";
        speech = `Created and verified Google Doc "${title}".`;
        cards.push({
          type: "document",
          id: `doc-${authorizedConfirmation.id}`,
          label: "Google Doc",
          title,
          summary: (params.content || "").slice(0, 300),
          format: "Google Doc",
          modifiedAt: out.createdAt || new Date().toISOString(),
        });
        sources.push({
          id: `src-${authorizedConfirmation.id}`,
          title,
          kind: "document",
          location: webLink,
        });
      } else if (authorizedConfirmation.toolId === "draft_email") {
        const to = params.to || "";
        const subject = params.subject || "";
        speech = `Created and verified draft email to ${to} regarding "${subject}". No email was sent.`;
        cards.push({
          type: "email",
          id: `email-${authorizedConfirmation.id}`,
          label: "Gmail Draft (Not Sent)",
          sender: "me",
          subject,
          preview: (params.body || "").slice(0, 300),
          receivedAt: out.createdAt || new Date().toISOString(),
        });
        sources.push({
          id: `src-${authorizedConfirmation.id}`,
          title: subject,
          kind: "email",
          location: `Gmail Draft (${out.draftId})`,
        });
      }

      const finalStructuredResult: StructuredResult = {
        speech,
        title: authorizedConfirmation.title,
        state: "complete",
        cards,
        sources,
      };

      if (task) {
        verificationService.taskTracker.updateState(task.id, "completed", {
          verificationStatus: "passed",
          finalResult: finalStructuredResult,
        });
      }
      diagService.completeRun(authorizedConfirmation.originatingRunId, "success");

      const successPayload = {
        status: "success",
        confirmationId,
        message: speech,
        result: finalStructuredResult,
      };

      if (idempotencyKey) {
        idempotency.storeResult(
          idempotencyKey,
          tool.id,
          authorizedConfirmation.parameters,
          successPayload
        );
      }

      return NextResponse.json(successPayload);
    } catch (execError: unknown) {
      const message = execError instanceof Error ? execError.message : "Execution failed";
      if (task) {
        verificationService.taskTracker.updateState(task.id, "failed", { error: message });
      }
      diagService.completeRun(authorizedConfirmation.originatingRunId, "failure", {
        code: "tool_execution_failed",
        message,
        retryable: false,
        source: "tool",
      });
      return NextResponse.json(
        {
          status: "failed",
          confirmationId,
          message,
          result: {
            speech: `Failed to execute action: ${message}`,
            title: "Write Failed",
            state: "failed",
            cards: [],
            sources: [],
          },
        },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
