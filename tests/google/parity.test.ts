import { describe, expect, it } from "vitest";
import { ToolRegistry } from "@/lib/tools/registry";
import { createDefaultToolRegistry } from "@/lib/tools/demo-tools";
import { registerGoogleTools } from "@/lib/google/tools";

/**
 * Phase 09 — Google Workspace Consolidation.
 *
 * Parity was evaluated against the installed Hermes version (F:\hermes-agent):
 * Hermes exposes no enabled Google Workspace toolset locally (its managed
 * connector path is disabled and remote-gateway dependent), so JARVIS retains
 * ownership of all Google capabilities. See docs/PHASE9-GOOGLE-PARITY.md.
 *
 * These tests guard that decision: all 7 Google tools must remain registered
 * through the single JARVIS implementation with the documented safety profile,
 * and no duplicate/parallel Google registration may exist.
 */
describe("Phase 09: Google Workspace Parity Guard", () => {
  it("registers all 7 Google tools through the single JARVIS implementation", () => {
    const registry = new ToolRegistry();
    registerGoogleTools(registry);

    const expectedTools = [
      "search_gmail",
      "read_gmail",
      "get_calendar_events",
      "search_drive",
      "read_drive_file",
      "create_google_doc",
      "draft_email",
    ];

    for (const id of expectedTools) {
      expect(registry.has(id), `missing tool: ${id}`).toBe(true);
    }

    // Exactly these tools — no duplicate or parallel Google registration.
    const googleTools = registry
      .list()
      .filter((t) => t.source === "gmail" || t.source === "drive" || t.source === "calendar");
    expect(googleTools.map((t) => t.id).sort()).toEqual([...expectedTools].sort());
  });

  it("keeps the documented permission profile for every Google tool", () => {
    const registry = createDefaultToolRegistry();

    const readTools = ["search_gmail", "read_gmail", "get_calendar_events", "search_drive", "read_drive_file"];
    for (const id of readTools) {
      const tool = registry.getCapability(id);
      expect(tool, `missing read tool: ${id}`).toBeDefined();
      expect(tool?.permission).toBe("read");
      expect(tool?.confirmationPolicy).toBe("none");
      expect(tool?.reversible).toBe(true);
      expect(tool?.idempotent).toBe(true);
    }

    const writeTools = ["create_google_doc", "draft_email"];
    for (const id of writeTools) {
      const tool = registry.getCapability(id);
      expect(tool, `missing write tool: ${id}`).toBeDefined();
      expect(tool?.permission).toBe("write");
      expect(tool?.confirmationPolicy).toBe("explicit");
      expect(tool?.reversible).toBe(false);
      expect(tool?.idempotent).toBe(false);
    }
  });

  it("never exposes a send_email capability", () => {
    const registry = createDefaultToolRegistry();
    expect(registry.has("send_email")).toBe(false);
    const all = registry.list().map((t) => t.id);
    expect(all.filter((id) => id.toLowerCase().includes("send"))).toHaveLength(0);
  });

  it("keeps confirmation required for every Google write tool", () => {
    const registry = createDefaultToolRegistry();
    expect(registry.isConfirmationRequired("create_google_doc")).toBe(true);
    expect(registry.isConfirmationRequired("draft_email")).toBe(true);
    expect(registry.isConfirmationRequired("search_gmail")).toBe(false);
  });
});
