import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { useProviderStatus } from "@/lib/agent/use-provider-status";
import type { CoreState } from "@/lib/shell/shell-types";

function formatNow(date: Date) { return { time: new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date), date: new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date) }; }
export function ContextRail({ state }: { state: CoreState }) {
  const [now, setNow] = useState<{ time: string; date: string } | null>(null);
  const provider = useProviderStatus();
  useEffect(() => { const update = () => setNow(formatNow(new Date())); update(); const timer = window.setInterval(update, 30_000); return () => window.clearInterval(timer); }, []);
  const agentStatus = provider.authenticated ? "Authenticated" : provider.available ? "Authentication required" : "Not configured";
  const voiceStatus = provider.voice?.status ?? "Not configured";
  const systems = [{ label: "Agent provider", value: agentStatus }, { label: "Model", value: provider.model }, { label: "Voice", value: voiceStatus }, { label: "Obsidian", value: provider.obsidian?.status ?? "Unavailable in Phase 2" }, { label: "Google", value: provider.google?.status ?? "Unavailable in Phase 2" }, { label: "Memory", value: provider.memory?.status ?? "Not configured" }];
  return <aside className="context-rail" aria-label="System context"><header className="brand"><span className="brand-mark"><i /><i /><i /></span><div><strong>JARVIS</strong><small>Local intelligence interface</small></div></header><div className="time-block" aria-live="off"><time>{now?.time ?? "--:--"}</time><p>{now?.date ?? "Local time"}</p></div><div className="context-section"><p className="section-label">System</p><dl>{systems.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></div><div className="context-section context-state"><p className="section-label">Current state</p><StatusIndicator label={`${state} ${state === "idle" ? "ready" : "active"}`} tone={state === "error" ? "warning" : state === "idle" ? "muted" : "active"} /><p className="skill-line"><span>Current skill</span><strong>No active skill</strong></p></div><nav className="rail-navigation" aria-label="Application"><Link href="/settings"><Icon name="gear" />Settings<Icon name="chevron" /></Link></nav></aside>;
}
