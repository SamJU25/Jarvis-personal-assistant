import { spawn } from "node:child_process";
import { stat, access, constants } from "node:fs/promises";
import path from "node:path";

export type GoogleStatus =
  | "Available"
  | "Not configured"
  | "Unauthenticated"
  | "Unavailable"
  | "Invalid configuration";

export interface GoogleConfigStatus {
  status: GoogleStatus;
  configured: boolean;
}

export function getGwsExecutablePath(): string | null {
  const envPath = process.env.JARVIS_GWS_EXECUTABLE;
  if (envPath && envPath.trim()) {
    return envPath.trim();
  }
  return null;
}

export async function checkGoogleStatus(
  executableOverride?: string | null
): Promise<GoogleConfigStatus> {
  const explicitPath = executableOverride !== undefined ? executableOverride : getGwsExecutablePath();

  // If not explicitly configured, check if gws is on PATH by default
  const targetExecutable = explicitPath || "gws";

  if (!explicitPath) {
    // If no path is configured, test if "gws" is runnable on the system
    const probe = await probeGwsExecutable("gws");
    if (!probe.runnable) {
      return { status: "Not configured", configured: false };
    }
    return probe.authenticated
      ? { status: "Available", configured: true }
      : { status: "Unauthenticated", configured: true };
  }

  // Explicit path was configured. Check if the path actually exists and is executable
  try {
    const isAbsolute = path.isAbsolute(targetExecutable);
    if (isAbsolute) {
      const info = await stat(/*turbopackIgnore: true*/ targetExecutable);
      if (!info.isFile()) {
        return { status: "Invalid configuration", configured: true };
      }
      await access(targetExecutable, constants.X_OK | constants.R_OK).catch(() =>
        access(targetExecutable, constants.R_OK)
      );
    }
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "ENOENT") {
      return { status: "Unavailable", configured: true };
    }
    return { status: "Invalid configuration", configured: true };
  }

  // Run health/auth check
  const probe = await probeGwsExecutable(targetExecutable);
  if (!probe.runnable) {
    return { status: probe.error === "timeout" ? "Unavailable" : "Unavailable", configured: true };
  }

  if (!probe.authenticated) {
    return { status: "Unauthenticated", configured: true };
  }

  return { status: "Available", configured: true };
}

interface ProbeResult {
  runnable: boolean;
  authenticated: boolean;
  error?: string;
}

function probeGwsExecutable(executable: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    let child;
    try {
      child = spawn(executable, ["auth", "status"], {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      return resolve({ runnable: false, authenticated: false, error: "spawn_failed" });
    }

    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore
      }
      resolve({ runnable: false, authenticated: false, error: "timeout" });
    }, 5_000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.once("error", (err: unknown) => {
      clearTimeout(timer);
      const code = (err as { code?: string }).code;
      resolve({ runnable: false, authenticated: false, error: code ?? "error" });
    });

    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        // Check if stdout contains indicators of authenticated session
        const lower = (stdout + " " + stderr).toLowerCase();
        if (
          lower.includes("not authenticated") ||
          lower.includes("unauthenticated") ||
          lower.includes("not logged in") ||
          lower.includes("no credentials") ||
          lower.includes("auth login")
        ) {
          return resolve({ runnable: true, authenticated: false });
        }
        return resolve({ runnable: true, authenticated: true });
      }

      // Check if output indicates executable ran but was unauthenticated
      const lower = (stdout + " " + stderr).toLowerCase();
      if (
        lower.includes("unauthenticated") ||
        lower.includes("not authenticated") ||
        lower.includes("not logged in") ||
        lower.includes("no credentials") ||
        lower.includes("login") ||
        lower.includes("auth")
      ) {
        return resolve({ runnable: true, authenticated: false });
      }

      // If code non-zero and no auth indicator, could be unknown flag or failure
      return resolve({ runnable: false, authenticated: false, error: "exit_code_" + code });
    });
  });
}
