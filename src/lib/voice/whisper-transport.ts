import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readWhisperConfig, type WhisperConfig } from "@/lib/voice/config";

export interface TranscriptionResult {
  transcript: string;
  isFinal: boolean;
  durationMs?: number;
}

export interface WhisperTransport {
  transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    signal?: AbortSignal
  ): Promise<TranscriptionResult>;
}

export class HttpWhisperTransport implements WhisperTransport {
  constructor(private readonly config: WhisperConfig) {}

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    signal?: AbortSignal
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    // Try OpenAI-compatible endpoint first (/v1/audio/transcriptions), then fallback to whisper.cpp (/inference)
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", blob, "recording.wav");
    formData.append("model", this.config.modelPath || "whisper");
    formData.append("language", this.config.language);
    formData.append("response_format", "json");

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/v1/audio/transcriptions`, {
        method: "POST",
        body: formData,
        signal,
      });

      if (!response.ok && response.status === 404) {
        // Fallback to whisper.cpp native /inference endpoint
        const inferenceFormData = new FormData();
        inferenceFormData.append("file", blob, "recording.wav");
        inferenceFormData.append("language", this.config.language);
        inferenceFormData.append("threads", String(this.config.threads));
        inferenceFormData.append("response_format", "json");

        response = await fetch(`${this.config.baseUrl}/inference`, {
          method: "POST",
          body: inferenceFormData,
          signal,
        });
      }
    } catch (err: unknown) {
      if (signal?.aborted) {
        throw new Error("Transcription request cancelled");
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Whisper server unreachable at ${this.config.baseUrl}: ${message}`);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Whisper transcription failed with status ${response.status}: ${errText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    let transcript = "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      transcript = (data.text || data.transcript || "").trim();
    } else {
      transcript = (await response.text()).trim();
    }

    return {
      transcript,
      isFinal: true,
      durationMs: Date.now() - startTime,
    };
  }
}

export class CliWhisperTransport implements WhisperTransport {
  constructor(private readonly config: WhisperConfig) {}

  async transcribe(
    audioBuffer: Buffer,
    _mimeType: string,
    signal?: AbortSignal
  ): Promise<TranscriptionResult> {
    if (!this.config.executablePath) {
      throw new Error("Whisper CLI executable path is not configured");
    }

    const startTime = Date.now();
    const tempFilePath = join(tmpdir(), `jarvis-stt-${randomUUID()}.wav`);

    try {
      // Ephemeral audio write
      await writeFile(tempFilePath, audioBuffer);

      const args: string[] = ["-f", tempFilePath, "--no-timestamps"];
      if (this.config.modelPath) {
        args.push("-m", this.config.modelPath);
      }
      if (this.config.language) {
        args.push("-l", this.config.language);
      }
      if (this.config.threads) {
        args.push("-t", String(this.config.threads));
      }

      const output = await new Promise<string>((resolve, reject) => {
        const child = spawn(this.config.executablePath!, args, {
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });

        const timer = setTimeout(() => {
          child.kill();
          reject(new Error(`Whisper CLI process timed out after ${this.config.timeoutMs}ms`));
        }, this.config.timeoutMs);

        if (signal) {
          signal.addEventListener("abort", () => {
            child.kill();
            clearTimeout(timer);
            reject(new Error("Transcription request cancelled"));
          });
        }

        child.on("error", (err) => {
          clearTimeout(timer);
          reject(new Error(`Failed to execute Whisper CLI: ${err.message}`));
        });

        child.on("close", (code) => {
          clearTimeout(timer);
          if (code === 0) {
            resolve(stdout);
          } else {
            reject(new Error(`Whisper CLI exited with code ${code}: ${stderr.slice(0, 500)}`));
          }
        });
      });

      return {
        transcript: output.trim(),
        isFinal: true,
        durationMs: Date.now() - startTime,
      };
    } finally {
      // Ephemeral privacy guarantee: immediately clean up temporary audio file
      await unlink(tempFilePath).catch(() => {});
    }
  }
}

export function createWhisperTransport(configOverride?: Partial<WhisperConfig>): WhisperTransport {
  const config = { ...readWhisperConfig(), ...configOverride };
  if (config.transport === "cli") {
    return new CliWhisperTransport(config);
  }
  return new HttpWhisperTransport(config);
}
