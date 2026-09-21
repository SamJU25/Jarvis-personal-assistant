import { ActivityList } from "@/components/activity/activity-list";
import { RendererRegistry } from "@/components/cards/renderer-registry";
import type { Source } from "@/lib/contracts/result";
import type { IntelligencePresentation, IntelligenceTab } from "@/lib/shell/shell-types";

const tabs: { id: IntelligenceTab; label: string }[] = [
  { id: "activity", label: "Activity" },
  { id: "results", label: "Results" },
  { id: "sources", label: "Sources" },
];

export function IntelligencePanel({
  presentation,
  tab,
  onTabChange,
}: {
  presentation: IntelligencePresentation;
  tab: IntelligenceTab;
  onTabChange: (tab: IntelligenceTab) => void;
}) {
  return (
    <aside className="intelligence-panel" aria-label="Intelligence panel">
      <div className="intelligence-header">
        <div>
          <p className="section-label">Intelligence</p>
          <h2>{presentation.title}</h2>
        </div>
        {presentation.isLive ? (
          <div className="live-notice" role="status">
            <span />Live provider response
          </div>
        ) : null}
      </div>
      <div className="intelligence-tabs" role="tablist" aria-label="Intelligence views">
        {tabs.map((item) => (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            onClick={() => onTabChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="intelligence-content"
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "activity" ? <ActivityList items={presentation.activity} /> : null}
        {tab === "results" ? (
          presentation.cards.length === 0 ? (
            <div className="empty-state">
              <p>No results yet</p>
            </div>
          ) : (
            <div className="results-list">
              {presentation.cards.map((card) => (
                <RendererRegistry key={card.id} card={card} />
              ))}
            </div>
          )
        ) : null}
        {tab === "sources" ? <SourceList sources={presentation.sources} /> : null}
      </div>
    </aside>
  );
}

function SourceList({ sources }: { sources: readonly Source[] }) {
  if (sources.length === 0) {
    return (
      <div className="empty-state">
        <p>No sources yet</p>
      </div>
    );
  }
  return (
    <ol className="source-list">
      {sources.map((source, index) => (
        <li key={source.id}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>{source.title}</strong>
            <p>{source.kind} · {source.location}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
