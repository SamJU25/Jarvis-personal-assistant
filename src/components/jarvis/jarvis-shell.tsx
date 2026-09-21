"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { CenterStage } from "@/components/jarvis/center-stage";
import { CommandBar } from "@/components/jarvis/command-bar";
import { ContextRail } from "@/components/jarvis/context-rail";
import { IntelligencePanel } from "@/components/jarvis/intelligence-panel";
import { readAgentFrames } from "@/lib/agent/client-stream";
import { sampleScenarios } from "@/lib/mock/scenarios";
import { createPresentation, initialShellState, shellReducer } from "@/lib/shell/shell-reducer";
import { MicrophoneCaptureManager, SpeechPlaybackManager } from "@/lib/voice/client-audio";
import { isAffirmativeConfirmation, isNegativeConfirmation } from "@/lib/confirmation/intent";

export function JarvisShell() {
  const [state, dispatch] = useReducer(shellReducer, initialShellState);
  const controllerRef = useRef<AbortController | null>(null);
  const speechPlayerRef = useRef<SpeechPlaybackManager>(new SpeechPlaybackManager());
  const micCaptureRef = useRef<MicrophoneCaptureManager>(new MicrophoneCaptureManager());

  const [isExecutingConfirmation, setIsExecutingConfirmation] = useState(false);

  const presentation = createPresentation(state);
  const isRunning = state.runStatus === "running";
  const isLive = isRunning || Boolean(state.result || state.error);
  const isSpeaking = state.coreState === "speaking";
  const isListening = state.coreState === "listening";

  useEffect(() => {
    const player = speechPlayerRef.current;
    const mic = micCaptureRef.current;
    return () => {
      controllerRef.current?.abort();
      player.stopPlayback();
      mic.stopListening();
    };
  }, []);

  function selectState(nextState: typeof state.coreState) {
    const matchingScenario = sampleScenarios.find((item) => item.state === nextState) ?? sampleScenarios[0];
    dispatch({ type: "scenarioSelected", scenarioId: matchingScenario.id, state: nextState });
  }

  async function handleConfirm() {
    if (!state.pendingConfirmation) return;
    const confirmationId = state.pendingConfirmation.id;
    setIsExecutingConfirmation(true);
    speechPlayerRef.current.stopPlayback();
    try {
      const response = await fetch("/api/agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationId, action: "confirm" }),
      });
      const data = await response.json();
      if (data.result) {
        dispatch({
          type: "runResultReceived",
          runId: confirmationId,
          result: data.result,
          meta: { provider: "JARVIS Application Runtime", model: "confirmed-write", durationMs: 40 },
        });
        if (data.result.speech) {
          speechPlayerRef.current.playSpeech(data.result.speech, confirmationId, {
            onStart: () => dispatch({ type: "ttsPlaybackStarted", runId: confirmationId }),
            onEnd: () => dispatch({ type: "ttsPlaybackFinished", runId: confirmationId }),
            onError: () => dispatch({ type: "ttsPlaybackFinished", runId: confirmationId }),
            onInterrupted: () => dispatch({ type: "ttsPlaybackFinished", runId: confirmationId }),
          }).catch(() => {
            dispatch({ type: "ttsPlaybackFinished", runId: confirmationId });
          });
        }
      } else {
        dispatch({
          type: "runFailed",
          runId: confirmationId,
          error: { code: "unavailable", message: data.message || "Confirmation failed" },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Confirmation failed";
      dispatch({
        type: "runFailed",
        runId: confirmationId,
        error: { code: "unavailable", message: msg },
      });
    } finally {
      setIsExecutingConfirmation(false);
    }
  }

  async function handleCancel() {
    if (!state.pendingConfirmation) return;
    const confirmationId = state.pendingConfirmation.id;
    speechPlayerRef.current.stopPlayback();
    try {
      const response = await fetch("/api/agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationId, action: "cancel" }),
      });
      const data = await response.json();
      if (data.result) {
        dispatch({
          type: "runResultReceived",
          runId: confirmationId,
          result: data.result,
          meta: { provider: "JARVIS Application Runtime", model: "cancelled-write", durationMs: 10 },
        });
      } else {
        dispatch({ type: "confirmationCleared" });
      }
    } catch {
      dispatch({ type: "confirmationCleared" });
    }
  }

  /**
   * Unified submission seam: both typed input and committed voice transcripts
   * route through this exact identical reasoning pipeline.
   */
  async function submitAgentRequest(message: string) {
    const command = message.trim();
    if (!command || isRunning || isExecutingConfirmation) return;

    // Barge-in: interrupt any active speech before starting a new reasoning run
    speechPlayerRef.current.stopPlayback();

    // Check if there is an active pending confirmation
    if (state.pendingConfirmation && state.coreState === "confirmation") {
      if (isAffirmativeConfirmation(command)) {
        await handleConfirm();
        return;
      }
      if (isNegativeConfirmation(command)) {
        await handleCancel();
        return;
      }
      // If neither affirmative nor negative, cancel old confirmation and proceed as new command
      await handleCancel();
    }

    const runId = crypto.randomUUID();
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: "runRequested", runId, command });

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: command, conversation: state.conversation }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) throw new Error("Provider unavailable");

      for await (const frame of readAgentFrames(response.body)) {
        if (frame.type === "event") {
          dispatch({ type: "runEventReceived", runId, event: frame.event });
        }
        if (frame.type === "result") {
          dispatch({ type: "runResultReceived", runId, result: frame.result, meta: frame.meta });

          // Voice Output: Synthesize and play speech from validated StructuredResult.speech
          if (frame.result.speech && frame.result.state !== "failed") {
            speechPlayerRef.current.playSpeech(frame.result.speech, runId, {
              onStart: () => dispatch({ type: "ttsPlaybackStarted", runId }),
              onEnd: () => dispatch({ type: "ttsPlaybackFinished", runId }),
              onError: () => dispatch({ type: "ttsPlaybackFinished", runId }),
              onInterrupted: () => dispatch({ type: "ttsPlaybackFinished", runId }),
            }).catch(() => {
              dispatch({ type: "ttsPlaybackFinished", runId });
            });
          }
        }
        if (frame.type === "error") {
          dispatch({ type: "runFailed", runId, error: frame.error });
        }
      }
    } catch {
      if (controller.signal.aborted) {
        dispatch({ type: "runCancelled", runId });
      } else {
        dispatch({
          type: "runFailed",
          runId,
          error: { code: "unavailable", message: "The reasoning provider is unavailable." },
        });
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }

  function handleVoiceToggle() {
    // Case 1: Currently speaking -> Barge-in! Stop speech, activate microphone immediately
    if (isSpeaking || speechPlayerRef.current.isPlaying()) {
      speechPlayerRef.current.stopPlayback();
      dispatch({ type: "bargeInTriggered" });
      micCaptureRef.current.startListening({
        onListeningStarted: () => dispatch({ type: "listeningStarted" }),
        onListeningStopped: () => dispatch({ type: "listeningStopped" }),
        onTranscriptCommitted: (transcript) => submitAgentRequest(transcript),
        onError: (err) => {
          dispatch({ type: "listeningStopped" });
          dispatch({
            type: "runFailed",
            runId: "voice",
            error: { code: "unavailable", message: err.message },
          });
        },
      });
      return;
    }

    // Case 2: Currently capturing audio -> Stop listening and commit turn
    if (isListening || micCaptureRef.current.isCapturing()) {
      micCaptureRef.current.stopListening();
      dispatch({ type: "listeningStopped" });
      return;
    }

    // Case 3: Idle -> Start listening
    speechPlayerRef.current.stopPlayback();
    dispatch({ type: "listeningStarted" });
    micCaptureRef.current.startListening({
      onListeningStarted: () => dispatch({ type: "listeningStarted" }),
      onListeningStopped: () => dispatch({ type: "listeningStopped" }),
      onTranscriptCommitted: (transcript) => submitAgentRequest(transcript),
      onError: (err) => {
        dispatch({ type: "listeningStopped" });
        dispatch({
          type: "runFailed",
          runId: "voice",
          error: { code: "unavailable", message: err.message },
        });
      },
    });
  }

  function cancel() {
    if (state.pendingConfirmation) {
      handleCancel();
      return;
    }
    const runId = state.activeRunId;
    if (runId) {
      controllerRef.current?.abort();
      dispatch({ type: "runCancelled", runId });
    }
    if (speechPlayerRef.current.isPlaying() || isSpeaking) {
      speechPlayerRef.current.stopPlayback();
      dispatch({ type: "ttsPlaybackFinished", runId: runId ?? "active" });
    }
    if (micCaptureRef.current.isCapturing() || isListening) {
      micCaptureRef.current.stopListening();
      dispatch({ type: "listeningStopped" });
    }
  }

  const [mobileTab, setMobileTab] = useState<"assistant" | "intelligence" | "system">("assistant");

  const transcript = state.submittedCommand;
  const response =
    state.result?.speech ??
    (isRunning
      ? "Reasoning through the request…"
      : state.error?.message ?? "JARVIS is online and ready. Enter a command or use voice to begin.");

  return (
    <div className="app-shell" data-mobile-tab={mobileTab}>
      <div className="mobile-view-tabs" role="tablist" aria-label="Mobile view switcher">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "assistant"}
          className={`mobile-tab-btn ${mobileTab === "assistant" ? "active" : ""}`}
          onClick={() => setMobileTab("assistant")}
        >
          Assistant
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "intelligence"}
          className={`mobile-tab-btn ${mobileTab === "intelligence" ? "active" : ""}`}
          onClick={() => setMobileTab("intelligence")}
        >
          Intelligence
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "system"}
          className={`mobile-tab-btn ${mobileTab === "system" ? "active" : ""}`}
          onClick={() => setMobileTab("system")}
        >
          System
        </button>
      </div>
      <ContextRail state={state.coreState} />
      <CenterStage
        state={state.coreState}
        transcript={transcript}
        response={response}
        isRunning={isRunning}
        isLive={isLive}
        onStateChange={selectState}
        pendingConfirmation={state.pendingConfirmation}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isExecutingConfirmation={isExecutingConfirmation}
      />
      <IntelligencePanel
        presentation={presentation}
        tab={state.activeTab}
        onTabChange={(tab) => dispatch({ type: "intelligenceTabChanged", tab })}
      />
      <CommandBar
        value={state.commandText}
        notice={state.notice}
        isRunning={isRunning}
        isListening={isListening}
        isSpeaking={isSpeaking}
        onChange={(value) => dispatch({ type: "commandTextChanged", value })}
        onSubmit={() => submitAgentRequest(state.commandText)}
        onCancel={cancel}
        onVoiceToggle={handleVoiceToggle}
      />
    </div>
  );
}
