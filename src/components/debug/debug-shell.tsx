"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProviderStatus } from "@/lib/agent/use-provider-status";
import type { DebugSnapshot } from "@/lib/contracts/diagnostics";

const PIPELINE_STAGES = [
  { id: "RUN", label: "RUN" },
  { id: "PROVIDER", label: "PROVIDER" },
  { id: "SKILL", label: "SKILL" },
  { id: "TOOLS", label: "TOOLS" },
  { id: "CONFIRMATION", label: "CONFIRMATION" },
  { id: "VERIFICATION", label: "VERIFICATION" },
  { id: "VOICE", label: "VOICE" },
  { id: "RESULT", label: "FINAL RESULT" },
] as const;

export function DebugShell() {
  const provider = useProviderStatus();
  const [snapshot, setSnapshot] = useState<DebugSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [eventFilter, setEventFilter] = useState<"all" | "error" | "warn" | "info">("all");
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    const loadSnapshot = () => {
      fetch("/api/debug", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: DebugSnapshot) => {
          if (!ignore) {
            setSnapshot(data);
            setLastRefreshed(new Date().toLocaleTimeString());
            setLoading(false);
          }
        })
        .catch(() => {
          if (!ignore) setLoading(false);
        });
    };

    loadSnapshot();

    if (!autoRefresh) {
      return () => {
        ignore = true;
      };
    }

    const interval = setInterval(loadSnapshot, 3000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [autoRefresh, refreshTrigger]);

  const activeRun = snapshot?.activeRun;
  const recentRuns = snapshot?.recentRuns ?? [];
  const events = snapshot?.events ?? [];
  const totals = snapshot?.totals ?? { runs: 0, successes: 0, failures: 0, cancelled: 0, confirmations: 0, verifications: 0 };
  const recentVoice = snapshot?.recentVoice ?? [];

  const filteredEvents = events.filter((e) => {
    if (eventFilter === "all") return true;
    return e.level === eventFilter;
  });

  return (
    <main className="debug-page max-w-7xl mx-auto px-4 py-8 font-mono text-xs text-[#edf5f7]">
      {/* Header */}
      <header className="subpage-header mb-8 border-b border-[#bbdae9]/10 pb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-[#8de2f2] hover:underline mb-4 font-sans"
        >
          &larr; Return to JARVIS
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-widest text-[#8de2f2] uppercase font-sans font-semibold">
              Phase 11 Observability Expansion · Read-Only Diagnostics
            </p>
            <h1 className="text-2xl md:text-3xl font-light tracking-tight text-white font-sans mt-1">
              Debug Shell
            </h1>
            <p className="text-xs text-[#60727a] font-sans mt-1">
              Sanitized runtime diagnostics & formal task lifecycle. Raw secrets, tokens, prompts, audio, and absolute paths are never displayed or stored.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#60727a]">
              {lastRefreshed ? `Updated ${lastRefreshed}` : loading ? "Loading..." : "Idle"}
            </span>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded text-[11px] font-sans border transition ${
                autoRefresh
                  ? "bg-[#8de2f2]/10 border-[#8de2f2]/40 text-[#8de2f2]"
                  : "bg-white/5 border-white/10 text-[#9aabb2]"
              }`}
            >
              Auto-refresh: {autoRefresh ? "On (3s)" : "Off"}
            </button>
            <button
              type="button"
              onClick={() => setRefreshTrigger((p) => p + 1)}
              className="px-3 py-1.5 rounded text-[11px] font-sans bg-[#8de2f2]/20 hover:bg-[#8de2f2]/30 border border-[#8de2f2]/50 text-[#8de2f2] transition"
            >
              Refresh Now
            </button>
          </div>
        </div>
      </header>

      {/* Totals Banner */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <div className="p-3.5 rounded-lg bg-[#0d141b]/80 border border-[#bbdae9]/10">
          <div className="text-[10px] text-[#60727a] uppercase font-sans tracking-wider">Total Runs</div>
          <div className="text-xl font-bold text-white mt-1">{totals.runs}</div>
        </div>
        <div className="p-3.5 rounded-lg bg-[#0d141b]/80 border border-[#bbdae9]/10">
          <div className="text-[10px] text-emerald-400 uppercase font-sans tracking-wider">Successes</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{totals.successes}</div>
        </div>
        <div className="p-3.5 rounded-lg bg-[#0d141b]/80 border border-[#bbdae9]/10">
          <div className="text-[10px] text-rose-400 uppercase font-sans tracking-wider">Failures</div>
          <div className="text-xl font-bold text-rose-400 mt-1">{totals.failures}</div>
        </div>
        <div className="p-3.5 rounded-lg bg-[#0d141b]/80 border border-[#bbdae9]/10">
          <div className="text-[10px] text-slate-400 uppercase font-sans tracking-wider">Cancelled</div>
          <div className="text-xl font-bold text-slate-400 mt-1">{totals.cancelled}</div>
        </div>
        <div className="p-3.5 rounded-lg bg-[#0d141b]/80 border border-[#bbdae9]/10">
          <div className="text-[10px] text-[#8de2f2] uppercase font-sans tracking-wider">Confirmations</div>
          <div className="text-xl font-bold text-[#8de2f2] mt-1">{totals.confirmations}</div>
        </div>
        <div className="p-3.5 rounded-lg bg-[#0d141b]/80 border border-[#bbdae9]/10">
          <div className="text-[10px] text-indigo-400 uppercase font-sans tracking-wider">Verifications</div>
          <div className="text-xl font-bold text-indigo-400 mt-1">{totals.verifications}</div>
        </div>
      </section>

      {/* Task Lifecycle Pipeline */}
      <section className="mb-8 p-5 rounded-xl bg-[#0d141b]/90 border border-[#8de2f2]/20 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#bbdae9]/10 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-sans font-semibold text-white tracking-wide">
              EXECUTION PIPELINE
            </h2>
            <p className="text-[11px] text-[#60727a] font-sans">
              RUN &rarr; PROVIDER &rarr; SKILL &rarr; TOOLS &rarr; CONFIRMATION &rarr; VERIFICATION &rarr; VOICE &rarr; FINAL RESULT
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider ${
              activeRun
                ? "bg-[#8de2f2]/20 text-[#8de2f2] border border-[#8de2f2]/40 animate-pulse"
                : "bg-white/5 text-[#60727a] border border-white/10"
            }`}
          >
            {activeRun ? `ACTIVE RUN: ${activeRun.state}` : "IDLE"}
          </span>
        </div>

        {/* Pipeline Stages Visualizer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isCurrent =
              activeRun &&
              ((stage.id === "RUN" && (activeRun.state === "queued" || activeRun.state === "planning")) ||
                (stage.id === "PROVIDER" && activeRun.state === "planning") ||
                (stage.id === "SKILL" && activeRun.skill?.selected) ||
                (stage.id === "TOOLS" && activeRun.state === "executing") ||
                (stage.id === "CONFIRMATION" && activeRun.state === "waiting_for_approval") ||
                (stage.id === "VERIFICATION" && activeRun.state === "verifying") ||
                (stage.id === "RESULT" && (activeRun.state === "completed" || activeRun.state === "failed" || activeRun.state === "cancelled")));
            return (
              <div
                key={stage.id}
                className={`p-2.5 rounded text-center border transition ${
                  isCurrent
                    ? "bg-[#8de2f2]/20 border-[#8de2f2] text-white font-bold"
                    : "bg-[#05080b]/60 border-[#bbdae9]/10 text-[#60727a]"
                }`}
              >
                <div className="text-[9px] text-[#60727a]">{idx + 1}</div>
                <div className="text-[10px] font-sans font-medium mt-0.5">{stage.label}</div>
              </div>
            );
          })}
        </div>

        {/* Active Run Breakdown */}
        {activeRun ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-[11px]">
            {/* Run Identity & Timing */}
            <div className="p-3.5 rounded bg-[#05080b]/70 border border-[#bbdae9]/10">
              <div className="text-[#8de2f2] font-sans font-semibold mb-2">RUN & TASK</div>
              <div className="space-y-1 text-[#9aabb2]">
                <div><span className="text-[#60727a]">Run ID:</span> {activeRun.runId}</div>
                <div><span className="text-[#60727a]">Task ID:</span> {activeRun.taskId ?? "None"}</div>
                <div><span className="text-[#60727a]">State:</span> <span className="text-white font-semibold">{activeRun.state}</span></div>
                <div><span className="text-[#60727a]">Outcome:</span> {activeRun.outcome}</div>
                <div><span className="text-[#60727a]">Started:</span> {new Date(activeRun.timing.startedAt).toLocaleTimeString()}</div>
                <div><span className="text-[#60727a]">Duration:</span> {activeRun.timing.durationMs ?? 0}ms</div>
                <div className="pt-1 text-white truncate"><span className="text-[#60727a]">Req:</span> {activeRun.requestSummary}</div>
              </div>
            </div>

            {/* Provider & Skill */}
            <div className="p-3.5 rounded bg-[#05080b]/70 border border-[#bbdae9]/10">
              <div className="text-[#8de2f2] font-sans font-semibold mb-2">PROVIDER & SKILL</div>
              <div className="space-y-1 text-[#9aabb2]">
                <div><span className="text-[#60727a]">Provider:</span> {activeRun.provider?.provider ?? "None"}</div>
                <div><span className="text-[#60727a]">Model:</span> {activeRun.provider?.model ?? "Default"}</div>
                <div><span className="text-[#60727a]">Provider Duration:</span> {activeRun.provider?.timing.durationMs ?? 0}ms</div>
                <div><span className="text-[#60727a]">Skill Selected:</span> {activeRun.skill ? activeRun.skill.skillId : "None"}</div>
                {activeRun.skill?.timing && (
                  <div><span className="text-[#60727a]">Skill Duration:</span> {activeRun.skill.timing.durationMs}ms</div>
                )}
                {activeRun.provider?.safeSummary && (
                  <div className="pt-1 text-[#8de2f2]"><span className="text-[#60727a]">Summary:</span> {activeRun.provider.safeSummary.detail}</div>
                )}
              </div>
            </div>

            {/* Confirmation & Verification */}
            <div className="p-3.5 rounded bg-[#05080b]/70 border border-[#bbdae9]/10">
              <div className="text-[#8de2f2] font-sans font-semibold mb-2">CONFIRMATION & VERIFICATION</div>
              <div className="space-y-1 text-[#9aabb2]">
                <div>
                  <span className="text-[#60727a]">Confirmation:</span>{" "}
                  {activeRun.confirmation ? (
                    <span className="text-amber-400 font-semibold">{activeRun.confirmation.state} ({activeRun.confirmation.toolId})</span>
                  ) : (
                    "None"
                  )}
                </div>
                <div>
                  <span className="text-[#60727a]">Verification:</span>{" "}
                  {activeRun.verification ? (
                    <span className={activeRun.verification.outcome === "success" ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                      {activeRun.verification.strategy} ({activeRun.verification.outcome})
                    </span>
                  ) : (
                    "None"
                  )}
                </div>
                {activeRun.verification?.timing && (
                  <div><span className="text-[#60727a]">Verification Duration:</span> {activeRun.verification.timing.durationMs}ms</div>
                )}
                {activeRun.failure && (
                  <div className="pt-1 text-rose-400">
                    <span className="text-[#60727a]">Failure Code:</span> {activeRun.failure.code}
                    <div className="text-[10px] text-rose-300 truncate">{activeRun.failure.message}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Tools Executed */}
            {activeRun.tools.length > 0 && (
              <div className="md:col-span-2 lg:col-span-3 p-3.5 rounded bg-[#05080b]/70 border border-[#bbdae9]/10">
                <div className="text-[#8de2f2] font-sans font-semibold mb-2">
                  TOOLS EXECUTED ({activeRun.tools.length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {activeRun.tools.map((t) => (
                    <div key={t.id} className="p-2 rounded bg-black/40 border border-white/5 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{t.toolId}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          t.outcome === "success" ? "bg-emerald-950 text-emerald-300" : "bg-rose-950 text-rose-300"
                        }`}>
                          {t.outcome}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#60727a]">
                        Permission: <span className="text-[#9aabb2]">{t.permission}</span> · Duration: {t.timing.durationMs}ms
                      </div>
                      {t.inputSummary && (
                        <div className="text-[10px] text-[#9aabb2] truncate">Input: {t.inputSummary.detail}</div>
                      )}
                      {t.outputSummary && (
                        <div className="text-[10px] text-[#9aabb2] truncate">Output: {t.outputSummary.detail}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-[#60727a] font-sans text-xs">
            No active run executing right now. Trigger an action from JARVIS to inspect real-time pipeline execution.
          </div>
        )}
      </section>

      {/* Execution History & Voice Diagnostics (2-col grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Recent Execution History (Max 50) */}
        <section className="lg:col-span-2 p-5 rounded-xl bg-[#0d141b]/80 border border-[#bbdae9]/10">
          <div className="flex items-center justify-between border-b border-[#bbdae9]/10 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-sans font-semibold text-white tracking-wide">
                EXECUTION HISTORY
              </h2>
              <p className="text-[11px] text-[#60727a] font-sans">
                Bounded in-memory history (last {recentRuns.length}/50 runs). Oldest evicted FIFO.
              </p>
            </div>
            <span className="text-[11px] text-[#8de2f2]">{recentRuns.length} recorded</span>
          </div>

          {recentRuns.length === 0 ? (
            <div className="py-8 text-center text-[#60727a] font-sans text-xs">
              No completed runs recorded yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {recentRuns.slice().reverse().map((run) => (
                <div
                  key={run.runId}
                  className="p-3 rounded bg-[#05080b]/60 border border-white/5 hover:border-[#8de2f2]/30 transition text-[11px]"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-white truncate max-w-[65%]">
                      {run.requestSummary}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-[#60727a]">{run.durationMs}ms</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                          run.outcome === "success"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                            : run.outcome === "cancelled"
                            ? "bg-slate-900 text-slate-400 border border-slate-700/40"
                            : "bg-rose-950 text-rose-400 border border-rose-800/40"
                        }`}
                      >
                        {run.outcome}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-[#60727a] mt-1.5 pt-1.5 border-t border-white/5">
                    <div>Run: <span className="text-[#9aabb2]">{run.runId.slice(0, 8)}...</span></div>
                    <div>Provider: <span className="text-[#9aabb2]">{run.providerSummary ?? "N/A"}</span></div>
                    <div>Skill: <span className="text-[#9aabb2]">{run.skillSummary ?? "None"}</span></div>
                    <div>Tools: <span className="text-[#9aabb2]">{run.toolSummaries.length}</span></div>
                  </div>
                  {run.verificationSummary && (
                    <div className="text-[10px] text-indigo-300 mt-1">
                      Verification: {run.verificationSummary}
                    </div>
                  )}
                  {run.failureSummary && (
                    <div className="text-[10px] text-rose-400 mt-1">
                      Failure: {run.failureSummary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Safe Voice Subsystem Diagnostics (Phase 8 Verified Runtime) */}
        <section className="p-5 rounded-xl bg-[#0d141b]/80 border border-[#bbdae9]/10 flex flex-col">
          <div className="border-b border-[#bbdae9]/10 pb-3 mb-4">
            <h2 className="text-sm font-sans font-semibold text-white tracking-wide">
              VOICE OBSERVABILITY
            </h2>
            <p className="text-[11px] text-[#60727a] font-sans">
              Phase 8 verified local runtime. Ephemeral in-memory only. Zero audio persistence.
            </p>
          </div>

          <div className="mb-3 p-2.5 rounded bg-emerald-950/30 border border-emerald-800/30 text-[10px] text-emerald-300">
            Microphone &rarr; Whisper &rarr; AgentRuntime &rarr; Kokoro &rarr; Speaker
          </div>

          {recentVoice.length === 0 ? (
            <div className="py-8 text-center text-[#60727a] font-sans text-xs flex-1 flex items-center justify-center">
              No voice transactions recorded yet. Use the microphone in JARVIS to see live speech diagnostics.
            </div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 flex-1">
              {recentVoice.slice().reverse().map((v, i) => (
                <div
                  key={`${v.operation}-${i}`}
                  className="p-2.5 rounded bg-[#05080b]/60 border border-white/5 text-[11px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white capitalize">{v.operation}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        v.outcome === "success"
                          ? "bg-emerald-950 text-emerald-300"
                          : "bg-rose-950 text-rose-300"
                      }`}
                    >
                      {v.interrupted ? "Interrupted" : v.outcome}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#60727a] mt-1 flex justify-between">
                    <span>Duration: {v.timing.durationMs}ms</span>
                    <span>Stale Discarded: {v.staleAudioDiscarded ? "Yes" : "No"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Diagnostic Event Stream (Max 200 events) */}
      <section className="mb-8 p-5 rounded-xl bg-[#0d141b]/80 border border-[#bbdae9]/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#bbdae9]/10 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-sans font-semibold text-white tracking-wide">
              STRUCTURED DIAGNOSTIC EVENT STREAM
            </h2>
            <p className="text-[11px] text-[#60727a] font-sans">
              Real-time sanitized application events (last {events.length}/200 events, oldest evicted FIFO).
            </p>
          </div>
          <div className="flex items-center gap-1.5 font-sans text-[11px]">
            <span className="text-[#60727a] mr-1">Filter:</span>
            {(["all", "error", "warn", "info"] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setEventFilter(lvl)}
                className={`px-2 py-0.5 rounded uppercase text-[10px] transition ${
                  eventFilter === lvl
                    ? "bg-[#8de2f2] text-black font-semibold"
                    : "bg-white/5 text-[#9aabb2] hover:bg-white/10"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="py-8 text-center text-[#60727a] font-sans text-xs">
            No diagnostic events matching filter.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
            {filteredEvents.slice().reverse().map((ev) => (
              <div
                key={ev.id}
                className="p-2 rounded bg-[#05080b]/50 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wide flex-shrink-0 ${
                      ev.level === "error"
                        ? "bg-rose-950 text-rose-400 border border-rose-800/40"
                        : ev.level === "warn"
                        ? "bg-amber-950 text-amber-400 border border-amber-800/40"
                        : "bg-cyan-950 text-[#8de2f2] border border-cyan-800/40"
                    }`}
                  >
                    {ev.level}
                  </span>
                  <span className="text-[#8de2f2] font-semibold text-[10px] flex-shrink-0">
                    [{ev.type}]
                  </span>
                  <span className="text-[#9aabb2] truncate">{ev.message}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[#60727a] flex-shrink-0">
                  {ev.durationMs !== undefined && <span>{ev.durationMs}ms</span>}
                  {ev.runId && <span>run:{ev.runId.slice(0, 6)}</span>}
                  <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* System Subsystems & Security Baseline */}
      <section className="p-5 rounded-xl bg-[#0d141b]/80 border border-[#bbdae9]/10">
        <div className="border-b border-[#bbdae9]/10 pb-3 mb-4">
          <h2 className="text-sm font-sans font-semibold text-white tracking-wide">
            SUBSYSTEMS & SECURITY BASELINE
          </h2>
          <p className="text-[11px] text-[#60727a] font-sans">
            Verified integration states and security policy controls.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-3 rounded bg-[#05080b]/50 border border-white/5">
            <div className="text-[10px] text-[#60727a] uppercase font-sans">Reasoning Provider</div>
            <div className="text-white font-medium mt-0.5">{provider.provider} ({provider.model})</div>
            <div className="text-[10px] text-[#9aabb2] mt-1">Status: {provider.authenticated ? "Authenticated" : provider.available ? "Ready" : "Unavailable"}</div>
          </div>
          <div className="p-3 rounded bg-[#05080b]/50 border border-white/5">
            <div className="text-[10px] text-[#60727a] uppercase font-sans">Obsidian Vault</div>
            <div className="text-white font-medium mt-0.5">{provider.obsidian?.status ?? "Not configured"}</div>
            <div className="text-[10px] text-[#9aabb2] mt-1">Strict vault path containment enforced</div>
          </div>
          <div className="p-3 rounded bg-[#05080b]/50 border border-white/5">
            <div className="text-[10px] text-[#60727a] uppercase font-sans">Google Workspace</div>
            <div className="text-white font-medium mt-0.5">{provider.google?.status ?? "Not configured"}</div>
            <div className="text-[10px] text-[#9aabb2] mt-1">Safe GWS wrapper · Drafts only (no send_email)</div>
          </div>
          <div className="p-3 rounded bg-[#05080b]/50 border border-white/5">
            <div className="text-[10px] text-[#60727a] uppercase font-sans">Persistent Memory</div>
            <div className="text-white font-medium mt-0.5">{provider.memory?.status ?? "Not configured"}</div>
            <div className="text-[10px] text-[#9aabb2] mt-1">SQLite native storage · Secret rejection active</div>
          </div>
          <div className="p-3 rounded bg-[#05080b]/50 border border-white/5">
            <div className="text-[10px] text-[#60727a] uppercase font-sans">Write Confirmation (Phase 9)</div>
            <div className="text-amber-400 font-medium mt-0.5">Application-Owned</div>
            <div className="text-[10px] text-[#9aabb2] mt-1">Single-use tokens · 60s TTL · Replay protected</div>
          </div>
          <div className="p-3 rounded bg-[#05080b]/50 border border-white/5">
            <div className="text-[10px] text-[#60727a] uppercase font-sans">Formal Verification (Phase 10)</div>
            <div className="text-indigo-400 font-medium mt-0.5">Application-Owned</div>
            <div className="text-[10px] text-[#9aabb2] mt-1">Deterministic checks · Model assertions ignored</div>
          </div>
        </div>
      </section>
    </main>
  );
}
