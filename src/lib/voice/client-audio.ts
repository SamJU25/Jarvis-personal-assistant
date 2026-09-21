/**
 * Client-side audio capture, text-to-speech playback, and barge-in management.
 * Audio is strictly ephemeral in memory; no recordings are stored.
 */

export interface PlaybackCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  onInterrupted?: () => void;
}

export class SpeechPlaybackManager {
  private activeAudio: HTMLAudioElement | null = null;
  private activeUrl: string | null = null;
  private activeRunId: string | null = null;
  private activeController: AbortController | null = null;
  private isPlayingSpeech = false;

  isPlaying(): boolean {
    return this.isPlayingSpeech;
  }

  getActiveRunId(): string | null {
    return this.activeRunId;
  }

  /**
   * Immediately stops any ongoing speech playback or pending synthesis.
   * Invalidates active run ID so late responses are discarded.
   * This is the core barge-in seam.
   */
  stopPlayback(): void {
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }

    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
        this.activeAudio.src = "";
      } catch {
        // Ignore errors when resetting audio element
      }
      this.activeAudio = null;
    }

    if (this.activeUrl) {
      URL.revokeObjectURL(this.activeUrl);
      this.activeUrl = null;
    }

    this.isPlayingSpeech = false;
    this.activeRunId = null;
  }

  /**
   * Synthesizes and plays speech for a given validated StructuredResult.speech text.
   */
  async playSpeech(
    text: string,
    runId: string,
    callbacks?: PlaybackCallbacks
  ): Promise<void> {
    // Interrupt any previous speech
    this.stopPlayback();

    const trimmed = text.trim();
    if (!trimmed) {
      callbacks?.onEnd?.();
      return;
    }

    this.activeRunId = runId;
    const controller = new AbortController();
    this.activeController = controller;

    try {
      const res = await fetch("/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
        signal: controller.signal,
      });

      // If barge-in happened while synthesis was in flight, discard response immediately
      if (this.activeRunId !== runId || controller.signal.aborted) {
        callbacks?.onInterrupted?.();
        return;
      }

      if (!res.ok) {
        throw new Error(`TTS synthesis returned status ${res.status}`);
      }

      const blob = await res.blob();

      // Check again after blob reading
      if (this.activeRunId !== runId || controller.signal.aborted) {
        callbacks?.onInterrupted?.();
        return;
      }

      const audioUrl = URL.createObjectURL(blob);
      this.activeUrl = audioUrl;

      const audio = new Audio(audioUrl);
      this.activeAudio = audio;

      audio.onplay = () => {
        if (this.activeRunId === runId) {
          this.isPlayingSpeech = true;
          callbacks?.onStart?.();
        }
      };

      audio.onended = () => {
        if (this.activeRunId === runId) {
          this.isPlayingSpeech = false;
          this.cleanup();
          callbacks?.onEnd?.();
        }
      };

      audio.onerror = () => {
        if (this.activeRunId === runId) {
          this.isPlayingSpeech = false;
          this.cleanup();
          callbacks?.onError?.(new Error("Audio playback failed"));
        }
      };

      await audio.play();
    } catch (err) {
      if (controller.signal.aborted || this.activeRunId !== runId) {
        callbacks?.onInterrupted?.();
        return;
      }
      this.cleanup();
      const message = err instanceof Error ? err.message : String(err);
      callbacks?.onError?.(new Error(message));
    }
  }

  private cleanup(): void {
    if (this.activeUrl) {
      URL.revokeObjectURL(this.activeUrl);
      this.activeUrl = null;
    }
    this.activeAudio = null;
    this.activeController = null;
    this.isPlayingSpeech = false;
  }
}

export interface VoiceCaptureCallbacks {
  onListeningStarted?: () => void;
  onListeningStopped?: () => void;
  onTranscribing?: () => void;
  onTranscriptCommitted?: (transcript: string) => void;
  onError?: (error: Error) => void;
  onBargeIn?: () => void;
}

export class MicrophoneCaptureManager {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private isCapturingAudio = false;

  isCapturing(): boolean {
    return this.isCapturingAudio;
  }

  async startListening(callbacks?: VoiceCaptureCallbacks): Promise<boolean> {
    if (this.isCapturingAudio) return true;

    try {
      // Echo protection constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.stream = stream;
      this.chunks = [];

      // Detect supported mime type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });
      this.recorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(this.chunks, { type: mimeType });
        this.chunks = [];

        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
        this.recorder = null;
        this.isCapturingAudio = false;

        callbacks?.onListeningStopped?.();

        if (audioBlob.size > 0) {
          callbacks?.onTranscribing?.();
          await this.transcribeAudio(audioBlob, callbacks);
        }
      };

      recorder.start(250); // collect data in 250ms slices
      this.isCapturingAudio = true;
      callbacks?.onListeningStarted?.();
      return true;
    } catch (err) {
      this.isCapturingAudio = false;
      const message = err instanceof Error ? err.message : String(err);
      callbacks?.onError?.(new Error(`Microphone access error: ${message}`));
      return false;
    }
  }

  stopListening(): void {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }
  }

  private async transcribeAudio(
    audioBlob: Blob,
    callbacks?: VoiceCaptureCallbacks
  ): Promise<void> {
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "voice_input.webm");

      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription server error: ${response.status}`);
      }

      const data = await response.json();
      const transcript = (data.transcript || "").trim();

      if (transcript) {
        callbacks?.onTranscriptCommitted?.(transcript);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      callbacks?.onError?.(new Error(`Transcription failed: ${message}`));
    }
  }
}
