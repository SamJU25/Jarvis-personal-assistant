import { ConfirmationPreview } from "@/components/confirmations/confirmation-preview";
import { JarvisCore } from "@/components/jarvis/jarvis-core";
import { StatePreviewControls } from "@/components/jarvis/state-preview-controls";
import { TranscriptPanel } from "@/components/jarvis/transcript-panel";
import type { CoreState } from "@/lib/shell/shell-types";
import type { PendingConfirmation } from "@/lib/contracts/confirmation";

export function CenterStage({
  state,
  transcript,
  response,
  isRunning,
  isLive,
  onStateChange,
  pendingConfirmation,
  onConfirm,
  onCancel,
  isExecutingConfirmation,
}: {
  state: CoreState;
  transcript?: string | null;
  response: string;
  isRunning: boolean;
  isLive: boolean;
  onStateChange: (state: CoreState) => void;
  pendingConfirmation?: PendingConfirmation | null;
  onConfirm?: () => void;
  onCancel?: () => void;
  isExecutingConfirmation?: boolean;
}) {
  return (
    <main className="center-stage">
      <div className="state-heading">
        <span className="state-pulse" aria-hidden="true" />
        <p>{state} · {isLive ? "application state" : state === "idle" ? "ready" : "visual preview"}</p>
      </div>
      <div className="core-stage">
        <JarvisCore state={state} />
      </div>
      <TranscriptPanel transcript={transcript} response={response} />
      {state === "confirmation" && pendingConfirmation ? (
        <ConfirmationPreview
          confirmation={pendingConfirmation}
          onConfirm={onConfirm}
          onCancel={onCancel}
          isExecuting={isExecutingConfirmation}
        />
      ) : null}
      <StatePreviewControls state={state} disabled={isRunning} onChange={onStateChange} />
    </main>
  );
}
