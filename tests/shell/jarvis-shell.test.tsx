import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JarvisShell } from "@/components/jarvis/jarvis-shell";

const liveResult = { type: "result", result: { speech: "Hello from JARVIS.", title: "Greeting", state: "complete", cards: [{ id: "response", type: "generic", label: "Response", title: "Hello", body: "Ready." }], sources: [] }, meta: { provider: "Command Code", model: "default", durationMs: 20 } };
function responseWith(frames: unknown[]) { const text = frames.map((frame) => JSON.stringify(frame)).join("\n") + "\n"; return Promise.resolve(new Response(text, { status: 200, headers: { "Content-Type": "application/x-ndjson" } })); }
afterEach(() => vi.unstubAllGlobals());

describe("JarvisShell", () => {
  it("keeps unavailable integrations truthful", () => {
    render(<JarvisShell />);
    expect(screen.getAllByText("Unavailable in Phase 2")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Start voice input" })).toBeInTheDocument();
    expect(screen.queryByText(/connected/i)).not.toBeInTheDocument();
  });

  it("changes coordinated preview state while idle", () => {
    render(<JarvisShell />);
    fireEvent.click(screen.getByRole("button", { name: "thinking" }));
    expect(screen.getByText("thinking · visual preview")).toBeInTheDocument();
  });

  it("renders a validated live provider result without a sample label", async () => {
    vi.stubGlobal("fetch", vi.fn(() => responseWith([{ type: "event", event: { id: "1", type: "agent_started", timestamp: "now", label: "Reasoning started" } }, liveResult])));
    render(<JarvisShell />);
    fireEvent.change(screen.getByLabelText("Command JARVIS"), { target: { value: "Hello Jarvis." } });
    fireEvent.click(screen.getByRole("button", { name: "Send command" }));
    expect(await screen.findByText("Hello from JARVIS.")).toBeInTheDocument();
    expect(screen.getByText("Live provider response")).toBeInTheDocument();
    expect(screen.queryByText("Phase 1 · Sample presentation data")).not.toBeInTheDocument();
  });

  it("aborts an active request from the stop control", async () => {
    vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))));
    render(<JarvisShell />);
    fireEvent.change(screen.getByLabelText("Command JARVIS"), { target: { value: "Keep thinking" } });
    fireEvent.click(screen.getByRole("button", { name: "Send command" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop reasoning" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("cancelled"));
  });

  it("exposes accessible intelligence tabs", () => {
    render(<JarvisShell />);
    fireEvent.click(screen.getByRole("tab", { name: "Results" }));
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "tab-results");
  });
});
