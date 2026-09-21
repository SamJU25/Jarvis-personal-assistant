import { describe, expect, it } from "vitest";
import { createDefaultToolRegistry } from "@/lib/tools/demo-tools";
import { ToolRegistry } from "@/lib/tools/registry";
import { z } from "zod";
import type { JarvisTool } from "@/lib/contracts/tool";

describe("Phase 06: Capability Registry & Declarative Metadata", () => {
  it("all 17 registered tools declare capability metadata", () => {
    const registry = createDefaultToolRegistry();
    const tools = registry.list();

    expect(tools.length).toBe(17);

    for (const tool of tools) {
      expect(tool.id).toBeTruthy();
      expect(tool.permission).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();

      // Resolved capability
      const cap = registry.getCapability(tool.id);
      expect(cap).toBeDefined();
      expect(["low", "medium", "high", "critical"]).toContain(cap?.riskLevel);
      expect(["read", "write", "idempotent_write", "admin"]).toContain(cap?.capabilityClass);
      expect(["none", "explicit", "always"]).toContain(cap?.confirmationPolicy);
      expect(typeof cap?.verificationStrategy).toBe("string");
      expect(typeof cap?.reversible).toBe("boolean");
      expect(typeof cap?.timeoutMs).toBe("number");
      expect(typeof cap?.idempotent).toBe("boolean");
    }
  });

  it("accurately detects write actions requiring human confirmation", () => {
    const registry = createDefaultToolRegistry();

    // Write tools require confirmation
    expect(registry.isConfirmationRequired("create_note")).toBe(true);
    expect(registry.isConfirmationRequired("create_google_doc")).toBe(true);
    expect(registry.isConfirmationRequired("draft_email")).toBe(true);

    // Read and safe tools do not require confirmation
    expect(registry.isConfirmationRequired("get_current_time")).toBe(false);
    expect(registry.isConfirmationRequired("search_demo_data")).toBe(false);
    expect(registry.isConfirmationRequired("search_vault")).toBe(false);
    expect(registry.isConfirmationRequired("read_note")).toBe(false);
    expect(registry.isConfirmationRequired("search_gmail")).toBe(false);
    expect(registry.isConfirmationRequired("search_memory")).toBe(false);
    expect(registry.isConfirmationRequired("store_memory")).toBe(false);
  });

  it("maps declared verification strategies correctly", () => {
    const registry = createDefaultToolRegistry();

    expect(registry.getVerificationStrategy("create_note")).toBe("note_verification");
    expect(registry.getVerificationStrategy("create_google_doc")).toBe("doc_verification");
    expect(registry.getVerificationStrategy("draft_email")).toBe("email_verification");
    expect(registry.getVerificationStrategy("get_current_time")).toBe("read_verification");
    expect(registry.getVerificationStrategy("search_vault")).toBe("read_verification");
  });

  it("synthesizes safe defaults when an undeclared tool is registered", () => {
    const registry = new ToolRegistry();
    const minimalTool: JarvisTool = {
      id: "custom_read_tool",
      name: "Custom Read Tool",
      description: "A custom tool without explicit capability metadata",
      permission: "read",
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ answer: z.string() }),
      renderer: "generic",
      source: "custom",
      execute: async () => ({ answer: "ok" }),
    };

    registry.register(minimalTool);

    const cap = registry.getCapability("custom_read_tool");
    expect(cap).toBeDefined();
    expect(cap?.riskLevel).toBe("low");
    expect(cap?.capabilityClass).toBe("read");
    expect(cap?.confirmationPolicy).toBe("none");
    expect(cap?.verificationStrategy).toBe("read_verification");
    expect(cap?.reversible).toBe(true);
    expect(cap?.idempotent).toBe(true);
    expect(cap?.timeoutMs).toBe(5000);

    const metadataList = registry.getMetadata();
    expect(metadataList).toHaveLength(1);
    expect(metadataList[0].riskLevel).toBe("low");
    expect(metadataList[0].capabilityClass).toBe("read");
  });
});
