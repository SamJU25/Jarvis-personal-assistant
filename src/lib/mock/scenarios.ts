import { resultCardSchema, sourceSchema } from "@/lib/contracts/result";
import type { SampleScenario } from "@/lib/shell/shell-types";

const cards = [
  { id: "meeting-1", type: "meeting", label: "Next meeting", title: "Product review", time: "10:30", attendees: ["Maya Chen", "Noah Williams"], focus: ["Launch readiness", "Open design decisions"] },
  { id: "calendar-1", type: "calendar", label: "Tomorrow", date: "Tuesday, September 22", events: [{ time: "10:30", title: "Product review", detail: "Studio · 45 min" }, { time: "14:00", title: "Research block", detail: "Focus time · 90 min" }] },
  { id: "email-1", type: "email", label: "Recent correspondence", sender: "Maya Chen", subject: "Review notes", preview: "I added the unresolved launch questions to the working document.", receivedAt: "Today · 08:42" },
  { id: "note-1", type: "note", label: "Second brain", title: "Launch narrative", excerpt: "Lead with the result, then explain the system behind it.", path: "Projects/JARVIS/Launch narrative.md", modifiedAt: "Yesterday" },
  { id: "insight-1", type: "insight", label: "Synthesis", title: "One decision is blocking two workstreams", body: "The launch date depends on closing the same design review mentioned in the meeting note and email.", confidence: "inferred" },
  { id: "action-1", type: "action", label: "Proposed action", title: "Prepare review brief", detail: "Collect the open decisions into a concise read-only briefing.", status: "proposed" },
  { id: "document-1", type: "document", label: "Working document", title: "Launch readiness", format: "Google Doc preview", summary: "Milestones, owners, risks, and unresolved decisions.", modifiedAt: "Today · 09:15" },
  { id: "research-1", type: "research", label: "Research cluster", topic: "Agentic interface patterns", summary: "Three recurring principles appear across the sample material.", findings: ["State should be observable", "Actions require clear authority", "Detail belongs in structured views"] },
  { id: "source-card-1", type: "source", label: "Source reference", title: "Launch narrative", sourceType: "Obsidian note preview", location: "Projects/JARVIS/Launch narrative.md" },
  { id: "generic-1", type: "generic", label: "Context", title: "Phase 1 preview", body: "This content demonstrates presentation only. No external system was queried." },
].map((card) => resultCardSchema.parse(card));

const sources = [
  { id: "source-1", title: "Product review", kind: "calendar", location: "Sample calendar data" },
  { id: "source-2", title: "Review notes", kind: "email", location: "Sample email data" },
  { id: "source-3", title: "Launch narrative", kind: "note", location: "Sample note data" },
].map((source) => sourceSchema.parse(source));

const baseActivity = [
  { id: "activity-1", system: "Calendar", message: "Finding the next meeting…", status: "complete" as const },
  { id: "activity-2", system: "Gmail", message: "Reviewing recent correspondence…", status: "running" as const },
  { id: "activity-3", system: "Obsidian", message: "Searching previous notes…", status: "queued" as const },
  { id: "activity-4", system: "Drive", message: "Sample source unavailable", status: "failed" as const },
];

export const sampleScenarios: readonly SampleScenario[] = [
  { kind: "sample", id: "overview", name: "Idle", state: "idle", transcript: "Awaiting a command", response: "The Phase 1 interface is ready for visual inspection.", activity: baseActivity, cards: cards.slice(0, 3), sources },
  { kind: "sample", id: "listening", name: "Listening", state: "listening", transcript: "Prepare me for my next meeting", response: "Voice input is a visual preview in this phase.", activity: baseActivity, cards: cards.slice(3, 5), sources },
  { kind: "sample", id: "thinking", name: "Thinking", state: "thinking", transcript: "What matters most this morning?", response: "Reasoning is not connected. This state demonstrates visual behavior only.", activity: baseActivity, cards: cards.slice(5, 7), sources },
  { kind: "sample", id: "executing", name: "Executing", state: "executing", transcript: "Find my launch notes", response: "No tools are running. The activity panel contains sample presentation data.", activity: baseActivity, cards: cards.slice(7, 9), sources },
  { kind: "sample", id: "speaking", name: "Speaking", state: "speaking", transcript: "Summarize the review", response: "Your next review focuses on launch readiness and two open design decisions.", activity: baseActivity, cards: [cards[9]], sources },
  { kind: "sample", id: "confirmation", name: "Confirmation", state: "confirmation", transcript: "Create a review brief", response: "A future write action would require explicit approval here.", activity: baseActivity, cards: [cards[5]], sources },
  { kind: "sample", id: "error", name: "Error", state: "error", transcript: "Check the unavailable source", response: "The sample source could not be reached. No real connection was attempted.", activity: baseActivity, cards: [cards[9]], sources },
];

export function getSampleScenario(id: string): SampleScenario {
  return sampleScenarios.find((scenario) => scenario.id === id) ?? sampleScenarios[0];
}
