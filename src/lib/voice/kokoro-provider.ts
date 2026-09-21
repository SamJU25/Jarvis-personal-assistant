import { readKokoroConfig, type KokoroConfig } from "@/lib/voice/config";

export interface VoiceOutputResult {
  audioBuffer: Buffer;
  contentType: string;
}

export interface VoiceOutputProvider {
  readonly id: string;
  readonly name: string;
  synthesize(
    text: string,
    options?: { voice?: string; speed?: number },
    signal?: AbortSignal
  ): Promise<VoiceOutputResult>;
}

export class KokoroTTSProvider implements VoiceOutputProvider {
  readonly id = "kokoro";
  readonly name = "Kokoro TTS";

  constructor(private readonly config: KokoroConfig) {}

  async synthesize(
    text: string,
    options?: { voice?: string; speed?: number },
    signal?: AbortSignal
  ): Promise<VoiceOutputResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error("Cannot synthesize empty text");
    }

    const payload = {
      model: this.config.model,
      input: trimmed,
      voice: options?.voice || this.config.voice,
      speed: options?.speed !== undefined ? options.speed : this.config.speed,
      response_format: "wav",
    };

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/v1/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "audio/wav, audio/mpeg, audio/*",
        },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (err: unknown) {
      if (signal?.aborted) {
        throw new Error("TTS synthesis cancelled");
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Kokoro server unreachable at ${this.config.baseUrl}: ${message}`);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Kokoro synthesis failed with status ${response.status}: ${errText}`);
    }

    const arrayBuf = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "audio/wav";

    return {
      audioBuffer: Buffer.from(arrayBuf),
      contentType,
    };
  }
}

export function createKokoroProvider(configOverride?: Partial<KokoroConfig>): KokoroTTSProvider {
  const config = { ...readKokoroConfig(), ...configOverride };
  return new KokoroTTSProvider(config);
}
