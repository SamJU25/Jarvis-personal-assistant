import { describe, expect, it } from "vitest";
import { AgentEventBus } from "@/lib/agent/event-bus";
import type { AgentApiFrame } from "@/lib/contracts/agent-api";

describe("AgentEventBus", () => {
  it("delivers frames to run-specific subscribers", () => {
    const bus = new AgentEventBus();
    const runId = "test-run-1";
    const received: AgentApiFrame[] = [];

    const unsubscribe = bus.subscribe(runId, (frame) => {
      received.push(frame);
    });

    const frame1: AgentApiFrame = {
      type: "delta",
      text: "Hello ",
    };
    const frame2: AgentApiFrame = {
      type: "delta",
      text: "world!",
    };

    bus.publish(runId, frame1);
    bus.publish(runId, frame2);
    bus.publish("other-run", { type: "delta", text: "ignored" });

    expect(received.length).toBe(2);
    expect(received[0]).toEqual(frame1);
    expect(received[1]).toEqual(frame2);

    unsubscribe();

    bus.publish(runId, { type: "delta", text: "after unsubscribe" });
    expect(received.length).toBe(2);
  });

  it("replays buffered frames when new listener subscribes", () => {
    const bus = new AgentEventBus();
    const runId = "test-run-replay";

    bus.publish(runId, { type: "delta", text: "chunk 1" });
    bus.publish(runId, { type: "delta", text: "chunk 2" });

    const received: AgentApiFrame[] = [];
    bus.subscribe(runId, (frame) => {
      received.push(frame);
    });

    expect(received.length).toBe(2);
    expect(received[0]).toEqual({ type: "delta", text: "chunk 1" });
    expect(received[1]).toEqual({ type: "delta", text: "chunk 2" });
  });

  it("supports global subscriptions across all runs", () => {
    const bus = new AgentEventBus();
    const globalFrames: Array<{ runId: string; frame: AgentApiFrame }> = [];

    const unsub = bus.subscribeAll((payload) => {
      globalFrames.push(payload);
    });

    bus.publish("run-a", { type: "delta", text: "A" });
    bus.publish("run-b", { type: "delta", text: "B" });

    expect(globalFrames.length).toBe(2);
    expect(globalFrames[0].runId).toBe("run-a");
    expect(globalFrames[1].runId).toBe("run-b");

    unsub();
  });
});
