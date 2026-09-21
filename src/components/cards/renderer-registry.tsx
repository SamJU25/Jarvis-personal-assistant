import type { ResultCard } from "@/lib/contracts/result";

function Frame({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <article className={`result-card ${className}`}><p className="card-label">{label}</p>{children}</article>; }
function Lines({ items }: { items: readonly string[] }) { return <ul className="card-lines">{items.map((item) => <li key={item}>{item}</li>)}</ul>; }

export function RendererRegistry({ card }: { card: ResultCard }) {
  switch (card.type) {
    case "meeting": return <Frame label={card.label} className="meeting-card"><div className="meeting-time">{card.time}</div><div><h3>{card.title}</h3><p>{card.attendees.join(" · ")}</p></div><Lines items={card.focus} /></Frame>;
    case "calendar": return <Frame label={card.label} className="calendar-card"><h3>{card.date}</h3><ol className="timeline">{card.events.map((event) => <li key={`${event.time}-${event.title}`}><time>{event.time}</time><div><strong>{event.title}</strong><span>{event.detail}</span></div></li>)}</ol></Frame>;
    case "email": return <Frame label={card.label} className="email-card"><div className="card-split"><strong>{card.sender}</strong><time>{card.receivedAt}</time></div><h3>{card.subject}</h3><p>{card.preview}</p></Frame>;
    case "note": return <Frame label={card.label} className="note-card"><h3>{card.title}</h3><blockquote>{card.excerpt}</blockquote><div className="card-meta"><span>{card.path}</span><time>{card.modifiedAt}</time></div></Frame>;
    case "insight": return <Frame label={card.label} className="insight-card"><span className="confidence">{card.confidence}</span><h3>{card.title}</h3><p>{card.body}</p></Frame>;
    case "action": return <Frame label={card.label} className="action-card"><span className="action-state">{card.status}</span><h3>{card.title}</h3><p>{card.detail}</p></Frame>;
    case "document": return <Frame label={card.label} className="document-card"><div className="doc-mark">DOC</div><div><h3>{card.title}</h3><p>{card.summary}</p><span className="card-meta">{card.format} · {card.modifiedAt}</span></div></Frame>;
    case "research": return <Frame label={card.label} className="research-card"><h3>{card.topic}</h3><p>{card.summary}</p><Lines items={card.findings} /></Frame>;
    case "source": return <Frame label={card.label} className="source-result"><h3>{card.title}</h3><p>{card.sourceType}</p><code>{card.location}</code></Frame>;
    case "generic": return <Frame label={card.label}><h3>{card.title}</h3><p className="whitespace-pre-wrap font-mono text-xs">{card.body}</p></Frame>;
  }
}
