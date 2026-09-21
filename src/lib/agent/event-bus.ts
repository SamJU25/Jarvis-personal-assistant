import { EventEmitter } from "node:events";
import type { AgentApiFrame } from "@/lib/contracts/agent-api";

export interface BufferedFrame {
  id: string;
  runId: string;
  frame: AgentApiFrame;
  timestamp: number;
}

/**
 * Server-side EventBus multiplexing live agent events to:
 * - Web UI SSE streams
 * - Activity timelines
 * - Settings status updates
 * - Diagnostics telemetry
 * - Voice audio triggers
 */
export class AgentEventBus {
  private static instance?: AgentEventBus;
  private readonly emitter = new EventEmitter();
  private readonly buffers = new Map<string, BufferedFrame[]>();
  private readonly maxBufferSize = 50;
  private readonly bufferTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  static getInstance(): AgentEventBus {
    if (!AgentEventBus.instance) {
      AgentEventBus.instance = new AgentEventBus();
    }
    return AgentEventBus.instance;
  }

  /**
   * Publishes an agent API frame to all listeners subscribed to the runId
   * and all global listeners.
   */
  publish(runId: string, frame: AgentApiFrame): void {
    const buffered: BufferedFrame = {
      id: crypto.randomUUID(),
      runId,
      frame,
      timestamp: Date.now(),
    };

    let runBuf = this.buffers.get(runId);
    if (!runBuf) {
      runBuf = [];
      this.buffers.set(runId, runBuf);
    }
    runBuf.push(buffered);
    if (runBuf.length > this.maxBufferSize) {
      runBuf.shift();
    }

    this.emitter.emit(`run:${runId}`, frame);
    this.emitter.emit("frame", { runId, frame });

    // Periodic cleanup of expired buffers
    this.pruneExpiredBuffers();
  }

  /**
   * Subscribes to frames for a specific run. Replays any already-buffered frames for that run.
   */
  subscribe(
    runId: string,
    listener: (frame: AgentApiFrame) => void,
    options?: { replay?: boolean }
  ): () => void {
    if (options?.replay !== false) {
      const existing = this.buffers.get(runId);
      if (existing) {
        for (const item of existing) {
          try {
            listener(item.frame);
          } catch {
            // Ignore subscriber errors during replay
          }
        }
      }
    }

    const eventName = `run:${runId}`;
    this.emitter.on(eventName, listener);

    return () => {
      this.emitter.off(eventName, listener);
    };
  }

  /**
   * Subscribes to all frames across all runs (e.g. for telemetry, diagnostics, or global timelines).
   */
  subscribeAll(
    listener: (payload: { runId: string; frame: AgentApiFrame }) => void
  ): () => void {
    this.emitter.on("frame", listener);
    return () => {
      this.emitter.off("frame", listener);
    };
  }

  /**
   * Cleans up buffers for completed or cancelled runs.
   */
  clearRun(runId: string): void {
    this.buffers.delete(runId);
  }

  private pruneExpiredBuffers(): void {
    const now = Date.now();
    for (const [runId, list] of this.buffers.entries()) {
      const last = list[list.length - 1];
      if (last && now - last.timestamp > this.bufferTtlMs) {
        this.buffers.delete(runId);
      }
    }
  }
}

export function getAgentEventBus(): AgentEventBus {
  return AgentEventBus.getInstance();
}
