import { describe, expect, it, vi } from "vitest";
import {
  IdempotencyService,
  createOperationKey,
  canonicalizeValue,
} from "@/lib/tools/idempotency";

describe("Phase 06: IdempotencyService", () => {
  it("canonicalizes nested objects and arrays deterministically", () => {
    const raw = { z: 1, a: { y: 2, b: 3 }, arr: [1, 2] };
    const canonical = canonicalizeValue(raw) as Record<string, unknown>;
    expect(Object.keys(canonical)).toEqual(["a", "arr", "z"]);
  });

  it("generates deterministic operation keys regardless of parameter ordering", () => {
    const params1 = { title: "Test Note", content: "Some content", tags: ["a", "b"] };
    const params2 = { content: "Some content", tags: ["a", "b"], title: "Test Note" };

    const key1 = createOperationKey("create_note", params1);
    const key2 = createOperationKey("create_note", params2);

    expect(key1).toBe(key2);
    expect(key1).toMatch(/^op_create_note_[a-f0-9]{24}$/);
  });

  it("differentiates operation keys when parameters or tools differ", () => {
    const key1 = createOperationKey("create_note", { title: "Alpha" });
    const key2 = createOperationKey("create_note", { title: "Beta" });
    const key3 = createOperationKey("create_google_doc", { title: "Alpha" });

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it("executes side effect exactly once and returns cached result on retry", async () => {
    const service = new IdempotencyService();
    const mockExecute = vi.fn().mockResolvedValue({ id: "note-123", title: "Meeting" });

    const key = "test_op_1";
    const params = { title: "Meeting" };

    // First invocation: executes side effect
    const res1 = await service.executeOnce(key, "create_note", params, mockExecute);
    expect(res1.replayed).toBe(false);
    expect(res1.result).toEqual({ id: "note-123", title: "Meeting" });
    expect(mockExecute).toHaveBeenCalledTimes(1);

    // Second invocation (retry): returns cached result without executing side effect
    const res2 = await service.executeOnce(key, "create_note", params, mockExecute);
    expect(res2.replayed).toBe(true);
    expect(res2.result).toEqual({ id: "note-123", title: "Meeting" });
    expect(mockExecute).toHaveBeenCalledTimes(1); // Still 1!
  });

  it("deduplicates concurrent in-flight executions to a single underlying call", async () => {
    const service = new IdempotencyService();
    let resolveExecution!: (val: { docId: string }) => void;
    const pendingPromise = new Promise<{ docId: string }>((res) => {
      resolveExecution = res;
    });

    const mockExecute = vi.fn().mockImplementation(() => pendingPromise);

    const key = "test_concurrent_op";
    const params = { title: "Concurrent Doc" };

    // Fire 3 simultaneous executions
    const p1 = service.executeOnce(key, "create_google_doc", params, mockExecute);
    const p2 = service.executeOnce(key, "create_google_doc", params, mockExecute);
    const p3 = service.executeOnce(key, "create_google_doc", params, mockExecute);

    // Resolve after delay
    resolveExecution({ docId: "doc-999" });

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(r1.result).toEqual({ docId: "doc-999" });
    expect(r2.result).toEqual({ docId: "doc-999" });
    expect(r3.result).toEqual({ docId: "doc-999" });
    expect(r1.replayed).toBe(false);
    expect(r2.replayed).toBe(true);
    expect(r3.replayed).toBe(true);
  });

  it("allows safe retry when previous execution failed", async () => {
    const service = new IdempotencyService();
    let callCount = 0;
    const mockExecute = vi.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error("Temporary network timeout");
      }
      return { success: true, count: callCount };
    });

    const key = "test_retry_op";
    const params = { query: "retry" };

    // First attempt fails
    await expect(
      service.executeOnce(key, "draft_email", params, mockExecute)
    ).rejects.toThrow("Temporary network timeout");

    expect(mockExecute).toHaveBeenCalledTimes(1);

    // Second attempt (safe retry) succeeds
    const res = await service.executeOnce(key, "draft_email", params, mockExecute);
    expect(res.replayed).toBe(false);
    expect(res.result).toEqual({ success: true, count: 2 });
    expect(mockExecute).toHaveBeenCalledTimes(2);

    // Third attempt returns cached result
    const res3 = await service.executeOnce(key, "draft_email", params, mockExecute);
    expect(res3.replayed).toBe(true);
    expect(res3.result).toEqual({ success: true, count: 2 });
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("prunes expired records after TTL has elapsed", async () => {
    const service = new IdempotencyService({ defaultTtlMs: 20 }); // 20ms TTL
    const mockExecute = vi.fn().mockResolvedValue({ status: "ok" });

    const key = "test_ttl_op";
    const params = { a: 1 };

    await service.executeOnce(key, "test_tool", params, mockExecute, 20);
    expect(mockExecute).toHaveBeenCalledTimes(1);

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 40));

    // Calling again after expiry executes again
    await service.executeOnce(key, "test_tool", params, mockExecute, 20);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});
