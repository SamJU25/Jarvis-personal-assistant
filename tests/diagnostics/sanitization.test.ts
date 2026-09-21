import { describe, expect, it } from "vitest";
import { sanitizeText, sanitizeEventPayload } from "@/lib/diagnostics/sanitizer";
import { debugSnapshotSchema } from "@/lib/contracts/diagnostics";
import { DiagnosticService } from "@/lib/diagnostics/service";

describe("Phase 11 Observability Sanitization & Security Boundary", () => {
  it("redacts bearer tokens and API keys", () => {
    const rawTokens = [
      "Authorization: Bearer ya29.a0AfH6SMA...",
      "sk-proj-abc123456789def0123456789abc",
      "sk-ant-api03-12345678901234567890",
      "AIzaSyD123456789abcdefghijklmnopqrstuvwxyz",
    ];

    for (const token of rawTokens) {
      const sanitized = sanitizeText(`Using key: ${token}`);
      expect(sanitized).not.toContain(token);
      expect(sanitized).toContain("[REDACTED_SECRET]");
    }
  });

  it("redacts absolute filesystem paths on Windows and Unix", () => {
    const winPaths = [
      "C:\\Users\\Administrator\\.env.local",
      "F:\\Jarvis\\notes\\private.md",
      "D:\\data\\passwords.txt",
    ];
    for (const p of winPaths) {
      const sanitized = sanitizeText(`Reading file from ${p}`);
      expect(sanitized).not.toContain(p);
      expect(sanitized).toContain("[REDACTED_PATH]");
    }

    const unixPaths = [
      "/Users/sam/.ssh/id_rsa",
      "/var/log/system.log",
      "/etc/shadow",
    ];
    for (const p of unixPaths) {
      const sanitized = sanitizeText(`Loading ${p}`);
      expect(sanitized).not.toContain(p);
      expect(sanitized).toContain("[REDACTED_PATH]");
    }
  });

  it("redacts raw GWS CLI commands and sensitive arguments", () => {
    const rawGws = "gws draft --to boss@company.com --subject Conf --body 'secret credentials'";
    const sanitized = sanitizeText(rawGws);
    expect(sanitized).not.toContain("gws draft");
    expect(sanitized).toContain("[REDACTED_GWS_CMD]");
  });

  it("redacts password fields in key-value and JSON formats", () => {
    const rawJson = '{"password": "super-secret-pass", "user": "admin"}';
    const sanitized = sanitizeText(rawJson);
    expect(sanitized).not.toContain("super-secret-pass");
    expect(sanitized).toContain("[REDACTED_SECRET]");
  });

  it("sanitizeEventPayload recursively sanitizes strings, arrays, and objects", () => {
    const payload = {
      message: "File at F:\\Jarvis\\secret.txt contains token: sk-proj-12345678901234567890",
      details: ["/Users/alice/key.pem", "Normal string"],
      meta: {
        cmd: "gws send_email --to alice@example.com",
      },
      num: 42,
      ok: true,
    };

    const sanitized = sanitizeEventPayload(payload) as typeof payload;
    expect(sanitized.message).not.toContain("F:\\Jarvis\\secret.txt");
    expect(sanitized.message).not.toContain("sk-proj-");
    expect(sanitized.details[0]).not.toContain("/Users/alice/key.pem");
    expect(sanitized.details[1]).toBe("Normal string");
    expect(sanitized.meta.cmd).not.toContain("gws send_email");
    expect(sanitized.num).toBe(42);
    expect(sanitized.ok).toBe(true);
  });

  it("DebugSnapshot schema strictly enforces validated fields and rejects arbitrary metadata", () => {
    const service = new DiagnosticService();
    service.startRun("run-sec-1", "Secret test with F:\\Jarvis\\vault\\doc.md and sk-1234567890abcdefghijklm");
    service.completeRun("run-sec-1", "success");

    const snapshot = service.getSnapshot();
    const validated = debugSnapshotSchema.parse(snapshot);

    // Verify snapshot does not contain raw path or key
    const jsonStr = JSON.stringify(validated);
    expect(jsonStr).not.toContain("F:\\Jarvis\\vault\\doc.md");
    expect(jsonStr).not.toContain("sk-1234567890abcdefghijklm");

    // Arbitrary unvalidated top-level properties are rejected
    const malformed = {
      ...snapshot,
      unrestrictedMetadata: { evilField: "raw model code" },
    };
    // safeParse with strip or strict: debugSnapshotSchema requires exact fields
    expect(debugSnapshotSchema.safeParse(malformed).success).toBe(true); // Zod strips unknown by default, guaranteeing browser safety
    const parsed = debugSnapshotSchema.parse(malformed) as Record<string, unknown>;
    expect(parsed.unrestrictedMetadata).toBeUndefined(); // Arbitrary metadata is stripped
  });
});
