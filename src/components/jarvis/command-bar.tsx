import type { FormEvent } from "react";
import { Icon } from "@/components/ui/icon";

export interface CommandBarProps {
  value: string;
  notice: string | null;
  isRunning: boolean;
  isListening?: boolean;
  isSpeaking?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onVoiceToggle?: () => void;
}

export function CommandBar({
  value,
  notice,
  isRunning,
  isListening = false,
  isSpeaking = false,
  onChange,
  onSubmit,
  onCancel,
  onVoiceToggle,
}: CommandBarProps) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  const hintText = isSpeaking
    ? "JARVIS is speaking · Start speaking or click mic to interrupt"
    : isListening
    ? "Listening for voice input · Speak your command…"
    : isRunning
    ? "Reasoning through request…"
    : "Local voice & text ready · Offline capable";

  const micLabel = isListening
    ? "Stop listening"
    : isSpeaking
    ? "Interrupt and speak"
    : "Start voice input";

  return (
    <div className="command-region">
      <form className="command-bar" onSubmit={submit}>
        <button
          className={`icon-button ${isListening ? "active pulse" : ""}`}
          type="button"
          onClick={onVoiceToggle}
          aria-label={micLabel}
          title={micLabel}
          aria-pressed={isListening}
        >
          <Icon name="mic" />
        </button>
        <label className="command-input">
          <span className="sr-only">Command JARVIS</span>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={isListening ? "Listening…" : "Ask JARVIS anything…"}
            autoComplete="off"
            disabled={isRunning}
            suppressHydrationWarning
          />
        </label>
        <kbd>Enter</kbd>
        <button
          className="send-button"
          type="submit"
          disabled={isRunning || !value.trim()}
          aria-label="Send command"
        >
          <Icon name="arrow" />
        </button>
        <button
          className="icon-button stop-button"
          type="button"
          disabled={!isRunning && !isSpeaking}
          onClick={onCancel}
          aria-label={isRunning ? "Stop reasoning" : isSpeaking ? "Stop speaking" : "Nothing to stop"}
          title={isRunning ? "Stop reasoning" : isSpeaking ? "Stop speaking" : "Nothing to stop"}
        >
          <Icon name="pause" />
        </button>
      </form>
      {notice ? (
        <p className="command-notice" role="status">
          {notice}
        </p>
      ) : (
        <p className="command-hint">{hintText}</p>
      )}
    </div>
  );
}
