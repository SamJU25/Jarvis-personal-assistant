import { coreStates, type CoreState } from "@/lib/shell/shell-types";

export function StatePreviewControls({ state, disabled = false, onChange }: { state: CoreState; disabled?: boolean; onChange: (state: CoreState) => void }) {
  return <div className="state-controls" aria-label="Visual state previews">{coreStates.map((item) => <button key={item} type="button" disabled={disabled} aria-pressed={state === item} onClick={() => onChange(item)}>{item}</button>)}</div>;
}
