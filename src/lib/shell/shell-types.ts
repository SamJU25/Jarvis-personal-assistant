import type { SafeAgentError } from "@/lib/agent/errors";
import type { SafeRunMeta } from "@/lib/contracts/agent-api";
import type { ConversationMessage } from "@/lib/contracts/conversation";
import type { AgentEvent } from "@/lib/contracts/event";
import type { ResultCard, Source, StructuredResult } from "@/lib/contracts/result";
import type { PendingConfirmation } from "@/lib/contracts/confirmation";

export const coreStates = ["idle", "listening", "thinking", "executing", "speaking", "confirmation", "error"] as const;
export type CoreState = (typeof coreStates)[number];
export type IntelligenceTab = "activity" | "results" | "sources";
export type ActivityStatus = "queued" | "running" | "complete" | "failed";
export type RunStatus = "idle" | "running" | "complete" | "failed" | "cancelled";

export interface ActivityItem { id: string; system: string; message: string; status: ActivityStatus; }
export interface IntelligencePresentation { title: string; activity: readonly ActivityItem[]; cards: readonly ResultCard[]; sources: readonly Source[]; isSample: boolean; isLive?: boolean; }
export interface SampleScenario { kind: "sample"; id: string; name: string; state: CoreState; transcript: string; response: string; activity: readonly ActivityItem[]; cards: readonly ResultCard[]; sources: readonly Source[]; }

export interface ShellState {
  coreState: CoreState;
  selectedScenarioId: string;
  commandText: string;
  activeTab: IntelligenceTab;
  notice: string | null;
  activeRunId: string | null;
  runStatus: RunStatus;
  submittedCommand: string | null;
  events: readonly AgentEvent[];
  result: StructuredResult | null;
  runMeta: SafeRunMeta | null;
  error: SafeAgentError | null;
  conversation: readonly ConversationMessage[];
  pendingConfirmation: PendingConfirmation | null;
}

export type ShellAction =
  | { type: "coreStateChanged"; state: CoreState }
  | { type: "scenarioSelected"; scenarioId: string; state: CoreState }
  | { type: "commandTextChanged"; value: string }
  | { type: "intelligenceTabChanged"; tab: IntelligenceTab }
  | { type: "runRequested"; runId: string; command: string }
  | { type: "runEventReceived"; runId: string; event: AgentEvent }
  | { type: "runResultReceived"; runId: string; result: StructuredResult; meta: SafeRunMeta }
  | { type: "runFailed"; runId: string; error: SafeAgentError }
  | { type: "runCancelled"; runId: string }
  | { type: "ttsPlaybackStarted"; runId: string }
  | { type: "ttsPlaybackFinished"; runId: string }
  | { type: "listeningStarted" }
  | { type: "listeningStopped" }
  | { type: "bargeInTriggered" }
  | { type: "noticeCleared" }
  | { type: "confirmationReceived"; confirmation: PendingConfirmation }
  | { type: "confirmationCleared" }
  | { type: "shellReset" };
