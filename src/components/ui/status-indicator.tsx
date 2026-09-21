export function StatusIndicator({ label, tone = "muted" }: { label: string; tone?: "muted" | "active" | "warning" }) {
  return <span className={`status-indicator status-${tone}`}><span className="status-dot" aria-hidden="true" />{label}</span>;
}
