import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolRegistry, ToolRegistryError } from "@/lib/tools/registry";
import { getCurrentTimeTool, searchDemoDataTool, createDefaultToolRegistry } from "@/lib/tools/demo-tools";

describe("ToolRegistry", () => {
  it("registers valid tools and retrieves them by ID", () => {
    const registry = new ToolRegistry();
    registry.register(getCurrentTimeTool);

    expect(registry.has("get_current_time")).toBe(true);
    expect(registry.get("get_current_time")?.name).toBe("Get Current Time");
  });

  it("rejects duplicate tool registrations with ToolRegistryError", () => {
    const registry = new ToolRegistry();
    registry.register(getCurrentTimeTool);

    expect(() => registry.register(getCurrentTimeTool)).toThrow(ToolRegistryError);
    expect(() => registry.register(getCurrentTimeTool)).toThrow('already registered');
  });

  it("returns undefined for unknown tool lookup", () => {
    const registry = new ToolRegistry();
    expect(registry.get("non_existent_tool")).toBeUndefined();
    expect(registry.has("non_existent_tool")).toBe(false);
  });

  it("rejects malformed tool definitions on registration", () => {
    const registry = new ToolRegistry();

    // Missing id
    expect(() =>
      registry.register({
        id: "",
        name: "Test",
        description: "Desc",
        permission: "read",
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        renderer: "generic",
        source: "test",
        execute: async () => ({}),
      })
    ).toThrow("Tool id must be a non-empty string");

    // Invalid permission
    expect(() =>
      registry.register({
        id: "bad_perm",
        name: "Test",
        description: "Desc",
        // @ts-expect-error testing invalid runtime permission
        permission: "admin",
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        renderer: "generic",
        source: "test",
        execute: async () => ({}),
      })
    ).toThrow("has invalid permission");

    // Missing execute function
    expect(() =>
      registry.register({
        id: "no_exec",
        name: "Test",
        description: "Desc",
        permission: "read",
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        renderer: "generic",
        source: "test",
        // @ts-expect-error testing invalid execute function
        execute: null,
      })
    ).toThrow("must have an execute function");
  });

  it("lists all registered tools in list()", () => {
    const registry = new ToolRegistry();
    registry.register(getCurrentTimeTool);
    registry.register(searchDemoDataTool);

    const tools = registry.list();
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.id)).toEqual(["get_current_time", "search_demo_data"]);
  });

  it("generates safe metadata without leaking internal functions or paths", () => {
    const registry = createDefaultToolRegistry();
    const metadata = registry.getMetadata();

    // 3 demo + 3 obsidian + 7 google (5 read + 2 write) + 4 memory = 17 tools
    expect(metadata.length).toBe(17);
    for (const item of metadata) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("description");
      expect(item).toHaveProperty("permission");
      expect(item).toHaveProperty("parameters");

      // Verify no leaked internal implementation details
      expect(item).not.toHaveProperty("execute");
      expect(item).not.toHaveProperty("source");
      expect(item).not.toHaveProperty("inputSchema");
      expect(item).not.toHaveProperty("outputSchema");
      const serialized = JSON.stringify(item);
      expect(serialized).not.toContain("node_modules");
      expect(serialized).not.toContain("C:\\");
      expect(serialized).not.toContain("/Users/");
    }
  });
});
