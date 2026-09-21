import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HermesClient,
  HermesApiError,
  HermesAuthError,
  HermesConnectionError,
  HermesMalformedResponseError,
  HermesTimeoutError,
} from "@/lib/hermes";

describe("HermesClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("Health Check", () => {
    it("successfully retrieves health status on 200 OK", async () => {
      const mockHealth = {
        status: "ok",
        platform: "hermes-agent",
        version: "0.21.3",
      };

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockHealth), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const client = new HermesClient({ baseUrl: "http://127.0.0.1:8642" });
      const result = await client.getHealth();

      expect(result).toEqual(mockHealth);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:8642/health",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Accept: "application/json",
          }),
        })
      );
    });

    it("throws HermesApiError when health returns 500", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "Internal server crash", type: "server_error" },
          }),
          {
            status: 500,
            statusText: "Internal Server Error",
            headers: { "Content-Type": "application/json" },
          }
        )
      );

      const client = new HermesClient({ baseUrl: "http://127.0.0.1:8642" });
      await expect(client.getHealth()).rejects.toThrow(HermesApiError);
    });
  });

  describe("Authentication", () => {
    it("attaches Bearer token when apiKey is configured", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "ready",
            gateway_state: "idle",
            platform: "hermes-agent",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const client = new HermesClient({
        baseUrl: "http://127.0.0.1:8642",
        apiKey: "valid-secret-token-32ch",
      });

      await client.getDetailedHealth();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:8642/health/detailed",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer valid-secret-token-32ch",
          }),
        })
      );
    });

    it("throws HermesAuthError on HTTP 401 with gateway error message", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                message: "Invalid gateway API key (API_SERVER_KEY)",
                type: "gateway_auth_error",
              },
            }),
            {
              status: 401,
              statusText: "Unauthorized",
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const client = new HermesClient({
        baseUrl: "http://127.0.0.1:8642",
        apiKey: "wrong-key",
      });

      await expect(client.getDetailedHealth()).rejects.toThrow(HermesAuthError);

      try {
        await client.getDetailedHealth();
      } catch (err) {
        expect(err).toBeInstanceOf(HermesAuthError);
        const authErr = err as HermesAuthError;
        expect(authErr.status).toBe(401);
        expect(authErr.message).toContain("Invalid gateway API key");
        // Verify secret token is NOT leaked in error
        expect(authErr.message).not.toContain("wrong-key");
      }
    });

    it("throws HermesAuthError on HTTP 403 Forbidden", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("Forbidden", { status: 403, statusText: "Forbidden" })
      );

      const client = new HermesClient({
        baseUrl: "http://127.0.0.1:8642",
        apiKey: "forbidden-key",
      });

      await expect(client.getDetailedHealth()).rejects.toThrow(HermesAuthError);
    });
  });

  describe("Request Success", () => {
    it("successfully retrieves capabilities", async () => {
      const mockCapabilities = {
        object: "hermes.api_server.capabilities",
        platform: "hermes-agent",
        model: "hermes-agent",
        auth: { type: "bearer", required: true },
        features: {
          chat_completions: true,
          responses_api: true,
          run_submission: true,
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockCapabilities), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const client = new HermesClient({
        baseUrl: "http://127.0.0.1:8642",
        apiKey: "valid-key-32ch",
      });

      const res = await client.getCapabilities();
      expect(res.object).toBe("hermes.api_server.capabilities");
      expect(res.features?.chat_completions).toBe(true);
    });

    it("successfully completes chat completion request", async () => {
      const mockChatResponse = {
        id: "chatcmpl-test-123",
        object: "chat.completion",
        created: 1710000000,
        model: "hermes-agent",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Hello! I am Hermes.",
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockChatResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const client = new HermesClient({
        baseUrl: "http://127.0.0.1:8642",
        apiKey: "valid-key-32ch",
      });

      const res = await client.chatCompletion({
        model: "hermes-agent",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(res.id).toBe("chatcmpl-test-123");
      expect(res.choices[0].message.content).toBe("Hello! I am Hermes.");
    });
  });

  describe("Malformed Response Handling", () => {
    it("throws HermesMalformedResponseError when server returns invalid JSON", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("<!DOCTYPE html><html><body>Not JSON</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      );

      const client = new HermesClient({ baseUrl: "http://127.0.0.1:8642" });
      await expect(client.getHealth()).rejects.toThrow(HermesMalformedResponseError);
    });

    it("throws HermesMalformedResponseError when schema validation fails", async () => {
      // Missing required choices array
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "chatcmpl-invalid",
            model: "hermes-agent",
            choices: [], // violates .min(1)
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const client = new HermesClient({
        baseUrl: "http://127.0.0.1:8642",
        apiKey: "valid-key",
      });

      await expect(
        client.chatCompletion({
          model: "hermes-agent",
          messages: [{ role: "user", content: "Test" }],
        })
      ).rejects.toThrow(HermesMalformedResponseError);
    });
  });

  describe("Timeout Handling", () => {
    it("throws HermesTimeoutError when request exceeds deadline", async () => {
      globalThis.fetch = vi.fn().mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            const signal = options?.signal;
            if (signal) {
              signal.addEventListener("abort", () => {
                const err = new DOMException("The operation was aborted.", "AbortError");
                reject(err);
              });
            }
          })
      );

      const client = new HermesClient({
        baseUrl: "http://127.0.0.1:8642",
        timeoutMs: 50,
      });

      await expect(client.getHealth()).rejects.toThrow(HermesTimeoutError);
    });
  });

  describe("Connection Failure", () => {
    it("throws HermesConnectionError when network is unreachable / ECONNREFUSED", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

      const client = new HermesClient({ baseUrl: "http://127.0.0.1:8642" });
      await expect(client.getHealth()).rejects.toThrow(HermesConnectionError);
    });
  });
});
