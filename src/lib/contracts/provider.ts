import type { AgentEvent } from "@/lib/contracts/event";
import type { ConversationMessage } from "@/lib/contracts/conversation";
import type { SafeRunMeta } from "@/lib/contracts/agent-api";
import type { StructuredResult } from "@/lib/contracts/result";
import type { ToolCallRequest, ToolMetadata } from "@/lib/contracts/tool";
import type { SkillMetadata } from "@/lib/contracts/skill";

export type AgentDecision =
  | { type: "direct"; result: StructuredResult; skillId?: string }
  | { type: "tool_call"; request: ToolCallRequest; skillId?: string };

export interface AgentRequest {
  requestId: string;
  request: string;
  conversation: readonly ConversationMessage[];
  systemInstructions: string;
  availableTools: readonly ToolMetadata[];
  availableSkills: readonly SkillMetadata[];
  requiredOutput: string;
  signal: AbortSignal;
}

export interface AgentRunOutput {
  decision: AgentDecision;
  result?: StructuredResult;
  meta: SafeRunMeta;
}

export interface AgentRun {
  events: AsyncIterable<AgentEvent>;
  result: Promise<AgentRunOutput>;
  cancel: () => Promise<void>;
}

export interface AgentProvider {
  id: string;
  name: string;
  runAgent: (request: AgentRequest) => Promise<AgentRun>;
}

