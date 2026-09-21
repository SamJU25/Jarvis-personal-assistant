import { spawn } from "node:child_process";
import { getGwsExecutablePath } from "./config";

export type GoogleErrorCode =
  | "not_configured"
  | "unauthenticated"
  | "unavailable"
  | "timeout"
  | "cancelled"
  | "not_found"
  | "unsupported_format"
  | "invalid_input"
  | "rate_limited"
  | "permission_denied"
  | "execution_failed";

export class GoogleApiError extends Error {
  constructor(
    public readonly code: GoogleErrorCode,
    message: string
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

export interface ExecuteGwsOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  spawnFn?: typeof spawn;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_STDOUT_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_STDERR_BYTES = 64 * 1024; // 64KB

/**
 * Executes a fixed GWS CLI command server-side using argument arrays and shell: false.
 * Strictly prevents shell injection, bounds buffers, enforces timeouts, handles cancellation,
 * and sanitizes all errors so secrets, raw paths, or stack traces never escape.
 */
export async function executeGws(
  args: string[],
  options: ExecuteGwsOptions = {}
): Promise<string> {
  const executable = getGwsExecutablePath() || "gws";
  const spawnProcess = options.spawnFn ?? spawn;

  if (options.signal?.aborted) {
    throw new GoogleApiError("cancelled", "Google Workspace request was cancelled.");
  }

  return new Promise<string>((resolve, reject) => {
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let killed = false;

    let child;
    try {
      child = spawnProcess(/*turbopackIgnore: true*/ executable, args, {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "ENOENT") {
        return reject(
          new GoogleApiError(
            "unavailable",
            "Google Workspace CLI is not installed or not found on the system."
          )
        );
      }
      return reject(
        new GoogleApiError("execution_failed", "Failed to start Google Workspace process.")
      );
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      killed = true;
      try {
        child.kill();
      } catch {
        // ignore
      }
      reject(new GoogleApiError("timeout", "Google Workspace request timed out."));
    }, timeoutMs);

    const onAbort = () => {
      killed = true;
      try {
        child.kill();
      } catch {
        // ignore
      }
      clearTimeout(timer);
      reject(new GoogleApiError("cancelled", "Google Workspace request was cancelled."));
    };

    if (options.signal) {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdoutBuffer.length < MAX_STDOUT_BYTES) {
        stdoutBuffer += chunk.toString("utf8");
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderrBuffer.length < MAX_STDERR_BYTES) {
        stderrBuffer += chunk.toString("utf8");
      }
    });

    child.once("error", (err: unknown) => {
      clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener("abort", onAbort);
      if (killed) return;

      const code = (err as { code?: string }).code;
      if (code === "ENOENT") {
        return reject(
          new GoogleApiError(
            "unavailable",
            "Google Workspace CLI is not installed or not found on the system."
          )
        );
      }
      reject(
        new GoogleApiError("execution_failed", "An error occurred while executing Google Workspace CLI.")
      );
    });

    child.once("close", (code) => {
      clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener("abort", onAbort);
      if (killed) return;

      if (code === 0) {
        return resolve(stdoutBuffer);
      }

      // Map non-zero exit codes to sanitized safe errors
      const combined = (stderrBuffer + "\n" + stdoutBuffer).toLowerCase();

      if (
        combined.includes("not authenticated") ||
        combined.includes("unauthenticated") ||
        combined.includes("no credentials") ||
        combined.includes("not logged in") ||
        combined.includes("auth login")
      ) {
        return reject(
          new GoogleApiError(
            "unauthenticated",
            "Google Workspace is unauthenticated. Please run authentication setup outside JARVIS."
          )
        );
      }

      if (
        combined.includes("not found") ||
        combined.includes("404") ||
        combined.includes("entitynotfound")
      ) {
        return reject(new GoogleApiError("not_found", "The requested Google resource was not found."));
      }

      if (
        combined.includes("rate limit") ||
        combined.includes("quota exceeded") ||
        combined.includes("429")
      ) {
        return reject(
          new GoogleApiError(
            "rate_limited",
            "Google Workspace rate limit or quota exceeded. Please try again later."
          )
        );
      }

      if (
        combined.includes("permission denied") ||
        combined.includes("forbidden") ||
        combined.includes("403")
      ) {
        return reject(
          new GoogleApiError(
            "permission_denied",
            "Access to the requested Google Workspace resource was denied."
          )
        );
      }

      if (combined.includes("invalid") || combined.includes("bad request") || combined.includes("400")) {
        return reject(
          new GoogleApiError("invalid_input", "Invalid query or parameters for Google Workspace request.")
        );
      }

      return reject(
        new GoogleApiError("execution_failed", "Google Workspace request failed with non-zero exit code.")
      );
    });
  });
}
