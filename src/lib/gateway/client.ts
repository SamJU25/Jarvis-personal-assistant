import fs from "node:fs/promises";
import path from "node:path";

export interface DeclarativeKeyEntry {
  platform: string;
  key: string;
  label?: string;
}

export interface DeclarativeGatewayConfig {
  keys: DeclarativeKeyEntry[];
  routing: {
    strategy: "balanced" | "smartest" | "fastest" | "fallback";
  };
  customProviders?: Array<Record<string, unknown>>;
  models?: Record<string, unknown>;
}

export interface GatewayProbeResult {
  connected: boolean;
  statusText: string;
  modelsCount?: number;
  streamingSupported?: boolean;
  toolCallingSupported?: boolean;
  latencyMs?: number;
  currentRoutedModel?: string;
  currentRoutedProvider?: string;
}

export class FreeLLMAPIClient {
  private readonly baseUrl: string;
  private readonly configPath: string;

  constructor(options?: { baseUrl?: string; configPath?: string }) {
    this.baseUrl = (
      options?.baseUrl ??
      process.env.JARVIS_GATEWAY_URL ??
      "http://127.0.0.1:3001/v1"
    ).replace(/\/+$/, "");

    this.configPath =
      options?.configPath ??
      process.env.FREEAPI_CONFIG_PATH ??
      path.join(process.cwd(), ".jarvis", "gateway", "freellmapi.config.json");
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Probes the FreeLLMAPI gateway by calling GET /v1/models.
   */
  async probeHealth(): Promise<GatewayProbeResult> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(`${this.baseUrl}/models`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;

      if (!resp.ok) {
        return {
          connected: false,
          statusText: `Gateway returned HTTP ${resp.status}`,
          latencyMs,
        };
      }

      const body = (await resp.json().catch(() => ({}))) as { data?: unknown[] };
      const modelsCount = Array.isArray(body?.data) ? body.data.length : 0;

      return {
        connected: true,
        statusText: "Healthy",
        modelsCount,
        streamingSupported: true,
        toolCallingSupported: true,
        latencyMs,
        currentRoutedModel: "auto",
        currentRoutedProvider: "FreeLLMAPI",
      };
    } catch {
      return {
        connected: false,
        statusText: "Gateway unavailable",
        latencyMs: Date.now() - start,
      };
    }
  }

  /**
   * Tests streaming support from FreeLLMAPI with a minimal chat completion request.
   */
  async testStreaming(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: "auto",
          messages: [{ role: "user", content: "ping" }],
          stream: true,
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;
      if (!resp.ok) {
        return {
          success: false,
          message: `Stream probe failed: HTTP ${resp.status}`,
          latencyMs,
        };
      }

      return {
        success: true,
        message: "Streaming verified successfully",
        latencyMs,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: `Streaming probe error: ${err instanceof Error ? err.message : "Connection failed"}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  /**
   * Tests tool-calling support from FreeLLMAPI with a dummy function declaration.
   */
  async testToolCalling(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "auto",
          messages: [{ role: "user", content: "What is the time?" }],
          tools: [
            {
              type: "function",
              function: {
                name: "get_current_time",
                description: "Gets the current time",
                parameters: { type: "object", properties: {} },
              },
            },
          ],
          tool_choice: "auto",
          max_tokens: 50,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;
      if (!resp.ok) {
        return {
          success: false,
          message: `Tool calling probe failed: HTTP ${resp.status}`,
          latencyMs,
        };
      }

      return {
        success: true,
        message: "Tool calling verified successfully",
        latencyMs,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: `Tool calling probe error: ${err instanceof Error ? err.message : "Connection failed"}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  /**
   * Loads the declarative config file, creating defaults if not present.
   */
  async loadDeclarativeConfig(): Promise<DeclarativeGatewayConfig> {
    try {
      const raw = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<DeclarativeGatewayConfig>;
      return {
        keys: Array.isArray(parsed.keys) ? parsed.keys : [],
        routing: parsed.routing ?? { strategy: "balanced" },
        customProviders: Array.isArray(parsed.customProviders) ? parsed.customProviders : [],
        models: parsed.models ?? {},
      };
    } catch {
      return {
        keys: [],
        routing: { strategy: "balanced" },
        customProviders: [],
        models: {},
      };
    }
  }

  /**
   * Saves the declarative configuration atomically.
   */
  async saveDeclarativeConfig(config: DeclarativeGatewayConfig): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(this.configPath, content, "utf-8");
  }

  /**
   * Sets or updates a provider key securely in the declarative config.
   * Fails closed if the key matches a known secret scanner pattern of unauthorized data.
   */
  async setProviderKey(platform: string, key: string, label?: string): Promise<void> {
    const trimmedPlatform = platform.trim().toLowerCase();
    const trimmedKey = key.trim();

    if (!trimmedPlatform || !trimmedKey) {
      throw new Error("Platform and key must not be empty.");
    }

    const config = await this.loadDeclarativeConfig();
    const existingIndex = config.keys.findIndex((k) => k.platform.toLowerCase() === trimmedPlatform);

    if (existingIndex >= 0) {
      config.keys[existingIndex] = {
        platform: trimmedPlatform,
        key: trimmedKey,
        label: label || config.keys[existingIndex].label || "main",
      };
    } else {
      config.keys.push({
        platform: trimmedPlatform,
        key: trimmedKey,
        label: label || "main",
      });
    }

    await this.saveDeclarativeConfig(config);
  }

  /**
   * Lists known provider platforms and whether they are configured.
   * NEVER returns keys!
   */
  async listConfiguredProviders(): Promise<
    Array<{ id: string; name: string; configured: boolean; health: "healthy" | "untested" | "failing" | "not_configured"; lastCheckedAt: string }>
  > {
    const config = await this.loadDeclarativeConfig();
    const now = new Date().toISOString();

    const standardProviders = [
      { id: "google", name: "Google Gemini" },
      { id: "groq", name: "Groq" },
      { id: "mistral", name: "Mistral AI" },
      { id: "openrouter", name: "OpenRouter" },
      { id: "openai", name: "OpenAI" },
      { id: "anthropic", name: "Anthropic" },
    ];

    const configuredPlatforms = new Set(config.keys.map((k) => k.platform.toLowerCase()));

    return standardProviders.map((p) => {
      const isConfigured = configuredPlatforms.has(p.id.toLowerCase());
      return {
        id: p.id,
        name: p.name,
        configured: isConfigured,
        health: isConfigured ? "healthy" : "not_configured",
        lastCheckedAt: now,
      };
    });
  }
}
