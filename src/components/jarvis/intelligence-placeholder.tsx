import { PhaseOneNotice } from "@/components/jarvis/phase-one-notice";

export function IntelligencePlaceholder() {
  return <aside className="intelligence-panel" aria-label="Intelligence panel"><div className="intelligence-header"><div><p className="section-label">Intelligence</p><h2>Activity preview</h2></div><PhaseOneNotice /></div><div className="placeholder-lines" aria-hidden="true"><span /><span /><span /><span /></div></aside>;
}
