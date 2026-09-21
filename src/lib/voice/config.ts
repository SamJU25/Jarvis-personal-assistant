import { access } from "node:fs/promises";
import type { KokoroStatus, VoiceStatus, WhisperStatus } from "@/lib/contracts/voice";

export interface WhisperConfig {
  baseUrl: string;
  executablePath?: string;
  modelPath?: string;
  vadModelPath?: string;
  language: string;
  threads: number;
  timeoutMs: number;
  transport: "http" | "cli";
}

export interface KokoroConfig {
  baseUrl: string;
  model: string;
  voice: string;
  speed: number;
  timeoutMs: number;
}

const DEFAULT_WHISPER_URL = "http://localhost:8080";
const DEFAULT_WHISPER_LANGUAGE = "en";
const DEFAULT_WHISPER_THREADS = 4;
const DEFAULT_TIMEOUT_MS = 15_000;

const DEFAULT_KOKORO_URL = "http://localhost:8880";
const DEFAULT_KOKORO_MODEL = "kokoro";
const DEFAULT_KOKORO_VOICE = "af_heart";
const DEFAULT_KOKORO_SPEED = 1.0;

function isLocalhost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

export function readWhisperConfig(env: Partial<NodeJS.ProcessEnv> = process.env): WhisperConfig {
  const url = env.JARVIS_WHISPER_BASE_URL?.trim() || env.JARVIS_WHISPER_URL?.trim() || DEFAULT_WHISPER_URL;
  if (!isLocalhost(url)) {
    throw new Error(`JARVIS_WHISPER_URL must be a valid local URL, got: ${url}`);
  }

  const threads = env.JARVIS_WHISPER_THREADS ? Number.parseInt(env.JARVIS_WHISPER_THREADS, 10) : DEFAULT_WHISPER_THREADS;
  if (Number.isNaN(threads) || threads < 1 || threads > 64) {
    throw new Error(`JARVIS_WHISPER_THREADS must be an integer between 1 and 64`);
  }

  const executablePath = env.JARVIS_WHISPER_EXECUTABLE?.trim() || undefined;
  const modelPath = env.JARVIS_WHISPER_MODEL_PATH?.trim() || undefined;
  const vadModelPath = env.JARVIS_WHISPER_VAD_MODEL_PATH?.trim() || undefined;
  const language = env.JARVIS_WHISPER_LANGUAGE?.trim().toLowerCase() || DEFAULT_WHISPER_LANGUAGE;
  const transport = executablePath ? "cli" : "http";

  return {
    baseUrl: url.replace(/\/+$/, ""),
    executablePath,
    modelPath,
    vadModelPath,
    language,
    threads,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    transport,
  };
}

export function readKokoroConfig(env: Partial<NodeJS.ProcessEnv> = process.env): KokoroConfig {
  const url = env.JARVIS_KOKORO_BASE_URL?.trim() || env.JARVIS_KOKORO_URL?.trim() || DEFAULT_KOKORO_URL;
  if (!isLocalhost(url)) {
    throw new Error(`JARVIS_KOKORO_BASE_URL must be a valid local URL, got: ${url}`);
  }

  const speed = env.JARVIS_KOKORO_SPEED ? Number.parseFloat(env.JARVIS_KOKORO_SPEED) : DEFAULT_KOKORO_SPEED;
  if (Number.isNaN(speed) || speed < 0.25 || speed > 4.0) {
    throw new Error(`JARVIS_KOKORO_SPEED must be a number between 0.25 and 4.0`);
  }

  return {
    baseUrl: url.replace(/\/+$/, ""),
    model: env.JARVIS_KOKORO_MODEL?.trim() || DEFAULT_KOKORO_MODEL,
    voice: env.JARVIS_KOKORO_VOICE?.trim() || DEFAULT_KOKORO_VOICE,
    speed,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

export async function checkWhisperStatus(
  override?: Partial<WhisperConfig>
): Promise<{ status: WhisperStatus; configured: boolean; model?: string; language?: string; transport: "http" | "cli" | "none" }> {
  try {
    const config = { ...readWhisperConfig(), ...override };

    if (config.transport === "cli") {
      if (!config.executablePath) {
        return { status: "Not configured", configured: false, transport: "none" };
      }
      try {
        await access(config.executablePath);
      } catch {
        return { status: "Unavailable", configured: true, transport: "cli" };
      }
      if (config.modelPath) {
        try {
          await access(config.modelPath);
        } catch {
          return { status: "Model unavailable", configured: true, transport: "cli" };
        }
      }
      return {
        status: "Available",
        configured: true,
        model: config.modelPath ? "configured" : undefined,
        language: config.language,
        transport: "cli",
      };
    }

    // HTTP transport check
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_500);
    try {
      // whisper.cpp server health or root endpoint
      const res = await fetch(`${config.baseUrl}/health`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }).catch(() => null);

      clearTimeout(timer);
      if (res && (res.ok || res.status === 404)) {
        // Many whisper.cpp servers return 200 or 404 on /health but are alive
        return {
          status: "Available",
          configured: true,
          language: config.language,
          transport: "http",
        };
      }
      return {
        status: "Unavailable",
        configured: Boolean(process.env.JARVIS_WHISPER_URL),
        transport: "http",
      };
    } catch {
      clearTimeout(timer);
      return {
        status: "Unavailable",
        configured: Boolean(process.env.JARVIS_WHISPER_URL),
        transport: "http",
      };
    }
  } catch {
    return {
      status: "Invalid configuration",
      configured: false,
      transport: "none",
    };
  }
}

export async function checkKokoroStatus(
  override?: Partial<KokoroConfig>
): Promise<{ status: KokoroStatus; configured: boolean; model?: string; voice?: string; speed?: number }> {
  try {
    const config = { ...readKokoroConfig(), ...override };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_500);

    try {
      // Kokoro FastAPI server has /v1/models or /v1/audio/voices or docs
      const res = await fetch(`${config.baseUrl}/v1/models`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }).catch(() => null);

      clearTimeout(timer);
      if (res && res.ok) {
        return {
          status: "Available",
          configured: true,
          model: config.model,
          voice: config.voice,
          speed: config.speed,
        };
      }

      // If /v1/models returned 404, check base or root
      if (res && (res.status === 404 || res.status === 405)) {
        return {
          status: "Available",
          configured: true,
          model: config.model,
          voice: config.voice,
          speed: config.speed,
        };
      }

      return {
        status: "Unavailable",
        configured: Boolean(process.env.JARVIS_KOKORO_BASE_URL),
        model: config.model,
        voice: config.voice,
      };
    } catch {
      clearTimeout(timer);
      return {
        status: "Unavailable",
        configured: Boolean(process.env.JARVIS_KOKORO_BASE_URL),
        model: config.model,
        voice: config.voice,
      };
    }
  } catch {
    return {
      status: "Invalid configuration",
      configured: false,
    };
  }
}

export async function getVoiceStatus(): Promise<VoiceStatus> {
  const [whisper, kokoro] = await Promise.all([
    checkWhisperStatus(),
    checkKokoroStatus(),
  ]);

  let overallStatus: VoiceStatus["status"] = "Unavailable";
  if (whisper.status === "Available" && kokoro.status === "Available") {
    overallStatus = "Available";
  } else if (whisper.status === "Available" || kokoro.status === "Available") {
    overallStatus = "Partial";
  } else if (whisper.status === "Not configured" && kokoro.status === "Not configured") {
    overallStatus = "Not configured";
  }

  return {
    status: overallStatus,
    whisper: {
      status: whisper.status,
      configured: whisper.configured,
      model: whisper.model,
      language: whisper.language,
      transport: whisper.transport,
    },
    kokoro: {
      status: kokoro.status,
      configured: kokoro.configured,
      model: kokoro.model,
      voice: kokoro.voice,
      speed: kokoro.speed,
    },
    microphone: {
      status: "Available",
    },
    speaker: {
      status: "Available",
    },
  };
}
