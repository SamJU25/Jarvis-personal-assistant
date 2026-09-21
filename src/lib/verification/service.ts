import { randomUUID } from "node:crypto";
import type {
  VerificationRequest,
  VerificationResult,
} from "@/lib/contracts/verification";
import type { AgentTask, TaskState } from "@/lib/contracts/task";
import { VerificationRegistry, getVerificationRegistry } from "./registry";

export interface VerificationServiceOptions {
  registry?: VerificationRegistry;
  defaultTimeoutMs?: number;
}

const DEFAULT_VERIFICATION_TIMEOUT_MS = 5_000;

export class TaskTracker {
  private readonly tasks = new Map<string, AgentTask>();
  private readonly runToTask = new Map<string, string>();

  createTask(runId: string, toolId?: string): AgentTask {
    const id = `task-${randomUUID()}`;
    const now = new Date().toISOString();
    const task: AgentTask = {
      id,
      runId,
      state: "queued",
      createdAt: now,
      updatedAt: now,
      toolId,
    };
    this.tasks.set(id, task);
    this.runToTask.set(runId, id);
    return task;
  }

  getTask(id: string): AgentTask | undefined {
    const task = this.tasks.get(id);
    if (task) return task;
    const fromRun = this.runToTask.get(id);
    return fromRun ? this.tasks.get(fromRun) : undefined;
  }

  getTaskByRunId(runId: string): AgentTask | undefined {
    const id = this.runToTask.get(runId);
    return id ? this.tasks.get(id) : undefined;
  }

  updateState(
    taskId: string,
    state: TaskState,
    extra?: Partial<Omit<AgentTask, "id" | "runId" | "createdAt">>
  ): AgentTask | undefined {
    const task = this.getTask(taskId);
    if (!task) return undefined;

    // Terminal state protection: cancelled tasks cannot be resurrected into executing, verifying, or completed
    if (task.state === "cancelled" && (state === "completed" || state === "executing" || state === "verifying")) {
      return task;
    }

    task.state = state;
    task.updatedAt = new Date().toISOString();
    if (extra?.currentAction !== undefined) task.currentAction = extra.currentAction;
    if (extra?.toolId !== undefined) task.toolId = extra.toolId;
    if (extra?.verificationStatus !== undefined) task.verificationStatus = extra.verificationStatus;
    if (extra?.finalResult !== undefined) task.finalResult = extra.finalResult;
    if (extra?.error !== undefined) task.error = extra.error;

    return task;
  }

  clear(): void {
    this.tasks.clear();
    this.runToTask.clear();
  }
}

export class VerificationService {
  private readonly registry: VerificationRegistry;
  private readonly defaultTimeoutMs: number;
  public readonly taskTracker: TaskTracker;

  constructor(options?: VerificationServiceOptions) {
    this.registry = options?.registry ?? getVerificationRegistry();
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? DEFAULT_VERIFICATION_TIMEOUT_MS;
    this.taskTracker = new TaskTracker();
  }

  /**
   * Verifies the outcome of a tool execution.
   * Enforces a bounded timeout and never re-triggers the underlying write.
   */
  async verify(
    request: VerificationRequest,
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<VerificationResult> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const strategy = this.registry.get(request.toolId);

    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<VerificationResult>((resolve) => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        resolve({
          runId: request.runId,
          taskId: request.taskId,
          toolId: request.toolId,
          status: "failed",
          verifiedAt: new Date().toISOString(),
          evidence: [],
          reason: `Verification timed out after ${timeoutMs}ms.`,
          error: "timeout",
        });
      }, timeoutMs);
    });

    // Link parent signal if present
    if (options?.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        return {
          runId: request.runId,
          taskId: request.taskId,
          toolId: request.toolId,
          status: "failed",
          verifiedAt: new Date().toISOString(),
          evidence: [],
          reason: "Verification cancelled by caller.",
          error: "cancelled",
        };
      }
      options.signal.addEventListener(
        "abort",
        () => {
          abortController.abort();
        },
        { once: true }
      );
    }

    try {
      const verificationPromise = strategy.verify(request, {
        signal: abortController.signal,
        timeoutMs,
      });

      const result = await Promise.race([verificationPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      // Update task tracker if taskId or runId exists
      const task = request.taskId
        ? this.taskTracker.getTask(request.taskId)
        : this.taskTracker.getTaskByRunId(request.runId);

      if (task) {
        this.taskTracker.updateState(task.id, result.status === "passed" ? "completed" : "failed", {
          verificationStatus: result.status,
          error: result.status === "failed" ? result.reason : undefined,
        });
      }

      return result;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : "Verification execution failed.";
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: new Date().toISOString(),
        evidence: [],
        reason: `Verification error: ${message}`,
        error: message,
      };
    }
  }
}

// Global singleton for application runtime
const globalForVerificationService = globalThis as unknown as {
  _verificationService?: VerificationService;
};

export const verificationService =
  globalForVerificationService._verificationService ?? new VerificationService();

if (process.env.NODE_ENV !== "production") {
  globalForVerificationService._verificationService = verificationService;
}

export function getVerificationService(): VerificationService {
  return verificationService;
}
