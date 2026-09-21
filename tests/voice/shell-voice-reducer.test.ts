import { describe, expect, it } from "vitest";
import { initialShellState, shellReducer } from "@/lib/shell/shell-reducer";

describe("Voice Shell Reducer Actions", () => {
  it("transitions coreState to speaking when ttsPlaybackStarted is dispatched", () => {
    const state = shellReducer(initialShellState, {
      type: "ttsPlaybackStarted",
      runId: "run-123",
    });
    expect(state.coreState).toBe("speaking");
  });

  it("transitions coreState back to idle when ttsPlaybackFinished is dispatched", () => {
    const speakingState = { ...initialShellState, coreState: "speaking" as const };
    const finishedState = shellReducer(speakingState, {
      type: "ttsPlaybackFinished",
      runId: "run-123",
    });
    expect(finishedState.coreState).toBe("idle");
  });

  it("transitions from speaking directly to listening on bargeInTriggered", () => {
    const speakingState = { ...initialShellState, coreState: "speaking" as const };
    const bargedInState = shellReducer(speakingState, {
      type: "bargeInTriggered",
    });
    expect(bargedInState.coreState).toBe("listening");
  });

  it("handles listeningStarted and listeningStopped actions", () => {
    const listeningState = shellReducer(initialShellState, {
      type: "listeningStarted",
    });
    expect(listeningState.coreState).toBe("listening");

    const stoppedState = shellReducer(listeningState, {
      type: "listeningStopped",
    });
    expect(stoppedState.coreState).toBe("idle");
  });
});
