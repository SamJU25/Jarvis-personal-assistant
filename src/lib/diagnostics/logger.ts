import {
  type DiagnosticEventType,
  type DiagnosticLevel,
  type DiagnosticOutcome,
  type FailureCode,
} from "@/lib/contracts/diagnostics";
import { getDiagnosticService } from "./service";
import { sanitizeText } from "./sanitizer";

export interface LogMetadata {
  eventType?: DiagnosticEventType;
  runId?: string;
  taskId?: string;
  toolId?: string;
  skillId?: string;
  provider?: string;
  model?: string;
  durationMs?: number;
  state?: string;
  outcome?: DiagnosticOutcome;
  failureCode?: FailureCode;
  error?: unknown;
}

export class StructuredLogger {
  private formatMessage(level: DiagnosticLevel, message: string, meta?: LogMetadata): void {
    const sanitizedMsg = sanitizeText(message);
    const sanitizedError =
      meta?.error instanceof Error
        ? sanitizeText(meta.error.message)
        : typeof meta?.error === "string"
        ? sanitizeText(meta.error)
        : undefined;

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      eventType: meta?.eventType ?? "task_state_changed",
      message: sanitizedMsg,
      runId: meta?.runId,
      taskId: meta?.taskId,
      toolId: meta?.toolId,
      skillId: meta?.skillId,
      provider: meta?.provider,
      model: meta?.model,
      durationMs: meta?.durationMs,
      state: meta?.state,
      outcome: meta?.outcome,
      failureCode: meta?.failureCode,
      error: sanitizedError,
    };

    // Forward to DiagnosticService
    try {
      getDiagnosticService().recordEvent({
        level,
        type: payload.eventType,
        runId: payload.runId,
        taskId: payload.taskId,
        message: payload.message,
        durationMs: payload.durationMs,
        outcome: payload.outcome,
        failureCode: payload.failureCode,
      });
    } catch {
      // Diagnostic logging failure must never crash execution
    }

    if (process.env.NODE_ENV !== "test") {
      const out = JSON.stringify(payload);
      if (level === "error") {
        console.error(out);
      } else if (level === "warn") {
        console.warn(out);
      } else {
        console.log(out);
      }
    }
  }

  debug(message: string, meta?: LogMetadata): void {
    this.formatMessage("debug", message, meta);
  }

  info(message: string, meta?: LogMetadata): void {
    this.formatMessage("info", message, meta);
  }

  warn(message: string, meta?: LogMetadata): void {
    this.formatMessage("warn", message, meta);
  }

  error(message: string, meta?: LogMetadata): void {
    this.formatMessage("error", message, meta);
  }
}

export const logger = new StructuredLogger();
