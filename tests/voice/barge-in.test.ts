import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpeechPlaybackManager } from "@/lib/voice/client-audio";

describe("Voice Playback and Barge-in", () => {
  const originalFetch = globalThis.fetch;
  const originalAudio = globalThis.Audio;
  const originalURL = globalThis.URL;

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/test-audio");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.Audio = originalAudio;
    globalThis.URL = originalURL;
  });

  it("stops playback immediately and invalidates active run ID on barge-in", () => {
    const manager = new SpeechPlaybackManager();

    // Mock an active audio element
    const mockAudio = {
      pause: vi.fn(),
      currentTime: 10,
      src: "blob:test",
      onplay: null,
      onended: null,
      onerror: null,
    };
    (manager as unknown as { activeAudio: unknown }).activeAudio = mockAudio;
    (manager as unknown as { activeRunId: string }).activeRunId = "run-1";
    (manager as unknown as { isPlayingSpeech: boolean }).isPlayingSpeech = true;

    manager.stopPlayback();

    expect(mockAudio.pause).toHaveBeenCalled();
    expect(mockAudio.currentTime).toBe(0);
    expect(mockAudio.src).toBe("");
    expect(manager.isPlaying()).toBe(false);
    expect(manager.getActiveRunId()).toBeNull();
  });

  it("discards stale audio when interrupted while synthesis is in flight", async () => {
    const manager = new SpeechPlaybackManager();
    const onStart = vi.fn();
    const onInterrupted = vi.fn();

    let resolveFetch: (value: Response) => void;
    globalThis.fetch = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );

    // Start playing speech for run-1
    const playPromise = manager.playSpeech("Hello user", "run-1", {
      onStart,
      onInterrupted,
    });

    expect(manager.getActiveRunId()).toBe("run-1");

    // Barge-in occurs while fetch is still waiting!
    manager.stopPlayback();
    expect(manager.getActiveRunId()).toBeNull();

    // Now the server response finally arrives
    resolveFetch!(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "audio/wav" },
      })
    );

    await playPromise;

    // Audio should NOT have started playing because it was stale
    expect(onStart).not.toHaveBeenCalled();
    expect(onInterrupted).toHaveBeenCalled();
  });

  it("invalidates previous run when a new run begins", async () => {
    const manager = new SpeechPlaybackManager();

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "audio/wav" },
      })
    );

    // Mock Audio constructor
    const playMock = vi.fn().mockResolvedValue(undefined);
    class MockAudio {
      play = playMock;
      pause = vi.fn();
      src = "";
      currentTime = 0;
      onplay = null;
      onended = null;
      onerror = null;
    }
    globalThis.Audio = MockAudio as unknown as typeof Audio;

    await manager.playSpeech("First speech", "run-1");
    expect(manager.getActiveRunId()).toBe("run-1");

    // Start second speech
    await manager.playSpeech("Second speech", "run-2");
    expect(manager.getActiveRunId()).toBe("run-2");
  });
});
