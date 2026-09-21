export type AgentEventType =
  | "agent_started"
  | "plan_created"
  | "skill_selected"
  | "skill_started"
  | "skill_completed"
  | "skill_failed"
  | "tool_requested"
  | "tool_started"
  | "tool_completed"
  | "tool_failed"
  | "confirmation_required"
  | "agent_synthesizing"
  | "verification_started"
  | "verification_completed"
  | "intent_detected"
  | "intent_routed"
  | "intent_fallback"
  | "specialist_spawned"
  | "specialist_started"
  | "specialist_progress"
  | "specialist_completed"
  | "specialist_failed"
  | "specialist_cancelled"
  | "response_ready"
  | "audio_started"
  | "audio_finished";

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  timestamp: string;
  label: string;
  detail?: Record<string, unknown>;
}
