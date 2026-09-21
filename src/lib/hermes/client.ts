import {
  hermesHealthSchema,
  hermesDetailedHealthSchema,
  hermesCapabilitiesSchema,
  hermesChatCompletionRequestSchema,
  hermesChatCompletionResponseSchema,
  hermesToolsetsResponseSchema,
  hermesRunRequestSchema,
  hermesRunResponseSchema,
  hermesResponseRequestSchema,
  hermesResponseResponseSchema,
  hermesErrorResponseSchema,
  hermesSkillsResponseSchema,
  type HermesHealthResponse,
  type HermesDetailedHealthResponse,
  type HermesCapabilitiesResponse,
  type HermesChatCompletionRequest,
  type HermesChatCompletionResponse,
  type HermesToolsetsResponse,
  type HermesRunRequest,
  type HermesRunResponse,
  type HermesResponseRequest,
  type HermesResponseResponse,
  type HermesSkillsResponse,
  type HermesRunEvent,
} from "@/lib/contracts/hermes";
import { getHermesConfig, type HermesConfig } from "./config";
import {
  HermesApiError,
  HermesAuthError,
  HermesConnectionError,
  HermesMalformedResponseError,
  HermesTimeoutError,
} from "./errors";
import { z } from "zod";

export interface HermesRequestOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Server-only client for interacting with the Hermes agent API server.
 */
export class HermesClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(customConfig?: Partial<HermesConfig>) {
    const base = getHermesConfig();
    this.baseUrl = customConfig?.baseUrl ?? base.baseUrl;
    this.apiKey = customConfig?.apiKey ?? base.apiKey;
    this.timeoutMs = customConfig?.timeoutMs ?? base.timeoutMs;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get basic health status (unauthenticated GET /health).
   */
  async getHealth(options?: HermesRequestOptions): Promise<HermesHealthResponse> {
    return this.request("/health", {
      method: "GET",
      schema: hermesHealthSchema,
      requiresAuth: false,
      ...options,
    });
  }

  /**
   * Get detailed health status (authenticated GET /health/detailed).
   */
  async getDetailedHealth(options?: HermesRequestOptions): Promise<HermesDetailedHealthResponse> {
    return this.request("/health/detailed", {
      method: "GET",
      schema: hermesDetailedHealthSchema,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * Get API server capabilities (authenticated GET /v1/capabilities).
   */
  async getCapabilities(options?: HermesRequestOptions): Promise<HermesCapabilitiesResponse> {
    return this.request("/v1/capabilities", {
      method: "GET",
      schema: hermesCapabilitiesSchema,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * Request a chat completion (authenticated POST /v1/chat/completions).
   */
  async chatCompletion(
    payload: HermesChatCompletionRequest,
    options?: HermesRequestOptions
  ): Promise<HermesChatCompletionResponse> {
    const validatedPayload = hermesChatCompletionRequestSchema.parse(payload);
    return this.request("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(validatedPayload),
      schema: hermesChatCompletionResponseSchema,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * Get available toolsets from the Hermes API server (authenticated GET /v1/toolsets).
   */
  async getToolsets(options?: HermesRequestOptions): Promise<HermesToolsetsResponse> {
    return this.request("/v1/toolsets", {
      method: "GET",
      schema: hermesToolsetsResponseSchema,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * Verify that the effective toolset configuration for api_server is safe.
   * Ensures that dangerous capabilities (terminal execution, arbitrary file writes,
   * code execution, computer use) are NOT enabled.
   */
  async verifyToolSafety(options?: HermesRequestOptions): Promise<{
    safe: boolean;
    dangerousToolsFound: string[];
    enabledToolsets: string[];
  }> {
    const FORBIDDEN_TOOLS = new Set([
      "terminal",
      "execute_code",
      "write_file",
      "patch",
      "computer_use",
    ]);

    const res = await this.getToolsets(options);
    const dangerousFound = new Set<string>();
    const enabledToolsets: string[] = [];

    for (const ts of res.data) {
      if (ts.enabled) {
        enabledToolsets.push(ts.name);
        for (const tool of ts.tools) {
          if (FORBIDDEN_TOOLS.has(tool)) {
            dangerousFound.add(tool);
          }
        }
      }
    }

    const dangerousList = Array.from(dangerousFound);
    return {
      safe: dangerousList.length === 0,
      dangerousToolsFound: dangerousList,
      enabledToolsets,
    };
  }

  /**
   * Start an asynchronous agent run (authenticated POST /v1/runs).
   */
  async createRun(
    payload: HermesRunRequest,
    options?: HermesRequestOptions
  ): Promise<HermesRunResponse> {
    const validatedPayload = hermesRunRequestSchema.parse(payload);
    return this.request("/v1/runs", {
      method: "POST",
      body: JSON.stringify(validatedPayload),
      schema: hermesRunResponseSchema,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * Get pollable status of an agent run (authenticated GET /v1/runs/{run_id}).
   */
  async getRunStatus(
    runId: string,
    options?: HermesRequestOptions
  ): Promise<HermesRunResponse> {
    return this.request(`/v1/runs/${encodeURIComponent(runId)}`, {
      method: "GET",
      schema: hermesRunResponseSchema,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * Stop/interrupt a running agent (authenticated POST /v1/runs/{run_id}/stop).
   */
  async stopRun(
    runId: string,
    options?: HermesRequestOptions
  ): Promise<{ status: string; message?: string }> {
    const stopSchema = z
      .object({
        status: z.string().optional().default("stopped"),
        message: z.string().optional(),
      })
      .passthrough();

    return this.request(`/v1/runs/${encodeURIComponent(runId)}/stop`, {
      method: "POST",
      body: JSON.stringify({}),
      schema: stopSchema,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * Create a stateful multi-turn response (authenticated POST /v1/responses).
   */
  async createResponse(
    payload: HermesResponseRequest,
    options?: HermesRequestOptions
  ): Promise<HermesResponseResponse> {
    const validatedPayload = hermesResponseRequestSchema.parse(payload);
    return this.request("/v1/responses", {
      method: "POST",
      body: JSON.stringify(validatedPayload),
      schema: hermesResponseResponseSchema,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * Get list of installed/active skills (authenticated GET /v1/skills).
   */
  async getSkills(options?: HermesRequestOptions): Promise<HermesSkillsResponse> {
    return this.request("/v1/skills", {
      method: "GET",
      schema: hermesSkillsResponseSchema,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * Inject steering guidance into an active run (authenticated POST /v1/runs/{run_id}/steer).
   */
  async steerRun(
    runId: string,
    input: string,
    options?: HermesRequestOptions
  ): Promise<{ status: string }> {
    const steerSchema = z.object({ status: z.string() }).passthrough();
    return this.request(`/v1/runs/${encodeURIComponent(runId)}/steer`, {
      method: "POST",
      body: JSON.stringify({ input }),
      schema: steerSchema,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * Submit an approval decision for a run paused in waiting_for_approval
   * (authenticated POST /v1/runs/{run_id}/approval).
   */
  async approvalResponse(
    runId: string,
    decision: { decision: "allow" | "deny" | "once" },
    options?: HermesRequestOptions
  ): Promise<{ status: string }> {
    const approvalSchema = z.object({ status: z.string() }).passthrough();
    return this.request(`/v1/runs/${encodeURIComponent(runId)}/approval`, {
      method: "POST",
      body: JSON.stringify(decision),
      schema: approvalSchema,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * Stream live Server-Sent Events (SSE) from an agent run (GET /v1/runs/{run_id}/events).
   */
  async *streamRunEvents(
    runId: string,
    signal?: AbortSignal
  ): AsyncGenerator<HermesRunEvent> {
    const url = `${this.baseUrl}/v1/runs/${encodeURIComponent(runId)}/events`;
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };

    const response = await fetch(url, { headers, signal });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new HermesApiError(response.status, `Failed to stream run events: ${text}`);
    }

    if (!response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "message";

    try {
      while (true) {
        if (signal?.aborted) {
          await reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) {
            // Keepalive comment or empty delimiter line
            continue;
          }

          if (trimmed.startsWith("event:")) {
            currentEvent = trimmed.slice(6).trim();
            continue;
          }

          if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.slice(5).trim();
            let parsedData: unknown = dataStr;
            try {
              parsedData = JSON.parse(dataStr);
            } catch {
              // keep as raw string
            }

            yield {
              event: currentEvent,
              data: parsedData as Record<string, unknown> | string,
              run_id: runId,
            };

            // Terminal event check
            if (
              currentEvent === "run.completed" ||
              currentEvent === "run.failed" ||
              currentEvent === "run.cancelled" ||
              currentEvent === "run.interrupted"
            ) {
              return;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Internal request executor with bounded timeout, authentication injection,
   * safe JSON deserialization, and strict Zod validation.
   */
  private async request<T>(
    path: string,
    options: {
      method: "GET" | "POST" | "PATCH" | "DELETE";
      body?: string;
      schema: z.ZodType<T>;
      requiresAuth?: boolean;
      timeoutMs?: number;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const timeout = options.timeoutMs ?? this.timeoutMs;

    const requestHeaders: Record<string, string> = {
      Accept: "application/json",
      ...options.headers,
    };

    if (options.body) {
      requestHeaders["Content-Type"] = "application/json";
    }

    if (this.apiKey) {
      requestHeaders["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new HermesTimeoutError(timeout));
      }, timeout);
    });

    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        throw new HermesTimeoutError(timeout);
      }
      options.signal.addEventListener("abort", () => {
        controller.abort();
      });
    }

    try {
      const fetchPromise = fetch(url, {
        method: options.method,
        headers: requestHeaders,
        body: options.body,
        signal: controller.signal,
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (response.status === 401 || response.status === 403) {
        let authMessage = "Hermes authentication failed (invalid or missing API key)";
        try {
          const bodyText = await response.text();
          const parsed = JSON.parse(bodyText);
          const errorParsed = hermesErrorResponseSchema.safeParse(parsed);
          if (errorParsed.success && errorParsed.data.error.message) {
            authMessage = errorParsed.data.error.message;
          }
        } catch {
          // ignore parsing error for auth failure body
        }
        throw new HermesAuthError(authMessage, response.status);
      }

      const rawText = await response.text();

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status} ${response.statusText}`;
        let errorType: string | undefined;

        try {
          const parsed = JSON.parse(rawText);
          const errorParsed = hermesErrorResponseSchema.safeParse(parsed);
          if (errorParsed.success) {
            errorMsg = errorParsed.data.error.message;
            errorType = errorParsed.data.error.type;
          }
        } catch {
          if (rawText.trim()) {
            errorMsg = rawText.slice(0, 300);
          }
        }

        throw new HermesApiError(response.status, errorMsg, errorType);
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (parseErr) {
        throw new HermesMalformedResponseError(
          `Failed to parse JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
        );
      }

      const validation = options.schema.safeParse(parsedJson);
      if (!validation.success) {
        const issues = validation.error.issues.map(
          (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`
        );
        throw new HermesMalformedResponseError(
          `Response failed schema validation: ${issues.join("; ")}`,
          issues
        );
      }

      return validation.data;
    } catch (err: unknown) {
      if (
        err instanceof HermesTimeoutError ||
        err instanceof HermesAuthError ||
        err instanceof HermesMalformedResponseError ||
        err instanceof HermesApiError
      ) {
        throw err;
      }

      if (err instanceof DOMException && err.name === "AbortError") {
        if (options.signal?.aborted) {
          const cancelErr = new Error("Request was cancelled");
          cancelErr.name = "AbortError";
          throw cancelErr;
        }
        throw new HermesTimeoutError(timeout);
      }

      if (err instanceof TypeError) {
        throw new HermesConnectionError(err.message, err);
      }

      throw new HermesConnectionError(err instanceof Error ? err.message : String(err), err);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
