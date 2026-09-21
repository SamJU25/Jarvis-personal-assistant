import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AgentConfig } from "@/lib/agent/config";
import { AgentRuntimeError, mapCommandCodeExitCode } from "@/lib/agent/errors";

const MAX_STDERR_BYTES = 64_000;
const MAX_STDOUT_BYTES = 2_000_000;

export interface TransportResult {
  stdout: AsyncIterable<Uint8Array>;
  exit: Promise<number | null>;
  cancel: () => Promise<void>;
}

export interface CommandCodeTransport {
  start: (input: { prompt: string; config: AgentConfig; signal: AbortSignal }) => Promise<TransportResult>;
}

export class SpawnCommandCodeTransport implements CommandCodeTransport {
  async start({ prompt, config, signal }: { prompt: string; config: AgentConfig; signal: AbortSignal }): Promise<TransportResult> {
    const runtimeDirectory = await mkdtemp(path.join(tmpdir(), "jarvis-agent-"));
    const argumentsList = [config.commandCodeEntry, "-p", "--output-format", "json", "--no-session", "--no-skills", "--skip-onboarding", "--permission-mode", "plan", "--trust", "--max-turns", String(config.maxTurns)];
    if (config.model) argumentsList.push("--model", config.model);

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(config.nodeExecutable, argumentsList, { cwd: runtimeDirectory, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    } catch {
      await rm(runtimeDirectory, { recursive: true, force: true });
      throw new AgentRuntimeError("unavailable");
    }

    let settled = false;
    let cancelled = false;
    let stderrBytes = 0;
    let stdoutBytes = 0;
    const timeout = setTimeout(() => { cancelled = true; terminate(child); }, config.timeoutMs);
    const abort = () => { cancelled = true; terminate(child); };
    signal.addEventListener("abort", abort, { once: true });
    child.stderr.on("data", (chunk: Buffer) => { stderrBytes += chunk.byteLength; if (stderrBytes > MAX_STDERR_BYTES) terminate(child); });
    child.stdin.end(prompt);

    const exit = new Promise<number | null>((resolve, reject) => {
      child.once("error", () => reject(new AgentRuntimeError("unavailable")));
      child.once("close", async (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
        await rm(runtimeDirectory, { recursive: true, force: true });
        if (cancelled) reject(new AgentRuntimeError(signal.aborted ? "cancelled" : "timeout"));
        else resolve(code);
      });
    });

    async function* stdout() {
      for await (const chunk of child.stdout) {
        stdoutBytes += chunk.byteLength;
        if (stdoutBytes > MAX_STDOUT_BYTES) { terminate(child); throw new AgentRuntimeError("malformed_output"); }
        yield new Uint8Array(chunk);
      }
    }

    return {
      stdout: stdout(),
      exit,
      cancel: async () => { if (!settled) { cancelled = true; terminate(child); } },
    };
  }
}

export async function requireSuccessfulExit(exitCode: number | null): Promise<void> {
  if (exitCode !== 0) throw new AgentRuntimeError(mapCommandCodeExitCode(exitCode));
}

function terminate(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
}
