import type { ActivityItem, IntelligencePresentation, ShellAction, ShellState } from "@/lib/shell/shell-types";
import type { ResultCard } from "@/lib/contracts/result";

export function formatAssistantTurn(result: { speech: string; cards?: readonly ResultCard[] }): string {
  const parts: string[] = [result.speech];
  if (result.cards && result.cards.length > 0) {
    const cardSnippets = result.cards.slice(0, 4).map((card) => {
      switch (card.type) {
        case "note":
          return `[Note: ${card.title}] (${card.path})\n${card.excerpt}`;
        case "email":
          return `[Email from ${card.sender}: ${card.subject}]\n${card.preview}`;
        case "meeting":
          return `[Meeting: ${card.title} at ${card.time}]\nAttendees: ${card.attendees.join(", ")}\nFocus: ${card.focus.join(", ")}`;
        case "calendar":
          return `[Calendar: ${card.date}]\n${card.events.map((e) => `- ${e.time}: ${e.title} (${e.detail})`).join("\n")}`;
        case "document":
          return `[Document: ${card.title}]\n${card.summary}`;
        case "research":
          return `[Research: ${card.topic}]\n${card.findings.join("; ")}`;
        case "insight":
        case "action":
        case "generic":
          return `[${card.title}]: ${"body" in card ? card.body : "detail" in card ? card.detail : ""}`;
        case "source":
          return `[Source: ${card.title}] (${card.sourceType}: ${card.location})`;
        default:
          return "[Card]";
      }
    });
    parts.push(`\nContext:\n${cardSnippets.join("\n\n")}`);
  }
  const combined = parts.join("\n").trim();
  return combined.length > 1500 ? `${combined.slice(0, 1497)}...` : combined;
}

export const initialShellState: ShellState = {
  coreState: "idle", selectedScenarioId: "overview", commandText: "", activeTab: "activity", notice: null,
  activeRunId: null, runStatus: "idle", submittedCommand: null, events: [], result: null, runMeta: null, error: null, conversation: [],
  pendingConfirmation: null,
};

export function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case "coreStateChanged": return state.runStatus === "running" ? state : { ...state, coreState: action.state, notice: null };
    case "scenarioSelected": return state.runStatus === "running" ? state : { ...state, selectedScenarioId: action.scenarioId, coreState: action.state, notice: null, result: null, error: null, runMeta: null, runStatus: "idle", pendingConfirmation: null };
    case "commandTextChanged": return { ...state, commandText: action.value, notice: null };
    case "intelligenceTabChanged": return { ...state, activeTab: action.tab };
    case "runRequested": return { ...state, activeRunId: action.runId, runStatus: "running", coreState: "thinking", submittedCommand: action.command, commandText: "", notice: null, events: [], result: null, error: null, runMeta: null, activeTab: "activity", pendingConfirmation: null };
    case "runEventReceived": {
      if (action.runId !== state.activeRunId) return state;
      let coreState = state.coreState;
      const pendingConfirmation = state.pendingConfirmation;
      if (action.event.type === "tool_started" || action.event.type === "verification_started") {
        coreState = "executing";
      } else if (
        action.event.type === "tool_completed" ||
        action.event.type === "tool_failed" ||
        action.event.type === "verification_completed"
      ) {
        coreState = "thinking";
      } else if (action.event.type === "confirmation_required") {
        coreState = "confirmation";
      }
      return { ...state, coreState, pendingConfirmation, events: [...state.events, action.event] };
    }
    case "runResultReceived": {
      if (action.runId !== state.activeRunId) return state;
      if (state.runStatus === "cancelled") return state;
      const assistantContent = formatAssistantTurn(action.result);
      const conversation = [...state.conversation, { role: "user" as const, content: state.submittedCommand ?? "" }, { role: "assistant" as const, content: assistantContent }].filter((message) => message.content).slice(-12);
      const pendingConfirmation = action.result.confirmation ?? (action.result.state === "waiting_for_approval" ? state.pendingConfirmation : null);
      const coreState = action.result.state === "waiting_for_approval" ? "confirmation" : action.result.state === "failed" ? "error" : "idle";
      return { ...state, activeRunId: null, runStatus: action.result.state === "failed" ? "failed" : "complete", coreState, pendingConfirmation, result: action.result, runMeta: action.meta, error: null, conversation, activeTab: action.result.cards.length ? "results" : "activity", notice: null };
    }
    case "runFailed": return action.runId !== state.activeRunId ? state : { ...state, activeRunId: null, runStatus: "failed", coreState: "error", error: action.error, notice: action.error.message, pendingConfirmation: null };
    case "runCancelled": return action.runId !== state.activeRunId ? state : { ...state, activeRunId: null, runStatus: "cancelled", coreState: "idle", notice: "The reasoning request was cancelled.", pendingConfirmation: null };
    case "confirmationReceived": return { ...state, pendingConfirmation: action.confirmation, coreState: "confirmation" };
    case "confirmationCleared": return { ...state, pendingConfirmation: null, coreState: state.coreState === "confirmation" ? "idle" : state.coreState };
    case "ttsPlaybackStarted": return { ...state, coreState: "speaking" };
    case "ttsPlaybackFinished": return state.coreState === "speaking" ? { ...state, coreState: "idle" } : state;
    case "listeningStarted": return { ...state, coreState: "listening" };
    case "listeningStopped": return state.coreState === "listening" ? { ...state, coreState: "idle" } : state;
    case "bargeInTriggered": return { ...state, coreState: "listening", notice: null };
    case "noticeCleared": return { ...state, notice: null };
    case "shellReset": return initialShellState;
  }
}

export function createPresentation(state: ShellState): IntelligencePresentation {
  if (!state.result && state.runStatus !== "running" && !state.error) {
    return {
      title: "Activity",
      activity: [],
      cards: [],
      sources: [],
      isSample: false,
      isLive: false,
    };
  }
  const activity: ActivityItem[] = state.events.map((event, index) => {
    const isFailed =
      event.type === "tool_failed" ||
      event.type === "skill_failed" ||
      (event.type === "verification_completed" && event.label.toLowerCase().includes("failed"));
    return {
      id: event.id,
      system: "Agent",
      message: event.label,
      status: isFailed ? "failed" : index === state.events.length - 1 && state.runStatus === "running" ? "running" : "complete",
    };
  });
  if (state.error) activity.push({ id: "run-error", system: "Agent", message: state.error.message, status: "failed" });
  return {
    title: state.result?.title ?? (state.runStatus === "running" ? "Reasoning" : "Request failed"),
    activity,
    cards: state.result?.cards ?? [],
    sources: state.result?.sources ?? [],
    isSample: false,
    isLive: Boolean(state.result),
  };
}
