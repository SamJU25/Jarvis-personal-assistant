import { describe, expect, it } from "vitest";
import { ToolRegistry } from "@/lib/tools/registry";
import { MemoryService } from "@/lib/memory/service";
import {
  createSearchMemoryTool,
  createStoreMemoryTool,
  createListMemoryTool,
  createDeleteMemoryTool,
  registerMemoryTools,
} from "@/lib/memory/tools";

describe("Memory Tools", () => {
  it("registers all 4 memory tools into ToolRegistry with appropriate permissions", () => {
    const registry = new ToolRegistry();
    const service = new MemoryService({ dbPath: ":memory:" });
    registerMemoryTools(registry, service);

    expect(registry.has("search_memory")).toBe(true);
    expect(registry.has("store_memory")).toBe(true);
    expect(registry.has("list_memory")).toBe(true);
    expect(registry.has("delete_memory")).toBe(true);

    expect(registry.get("search_memory")?.permission).toBe("read");
    expect(registry.get("list_memory")?.permission).toBe("read");
    expect(registry.get("store_memory")?.permission).toBe("memory");
    expect(registry.get("delete_memory")?.permission).toBe("memory");

    service.close();
  });

  it("executes store_memory and validates input/output schemas", async () => {
    const service = new MemoryService({ dbPath: ":memory:" });
    const tool = createStoreMemoryTool(service);

    const output = await tool.execute(
      { content: "Always use strict TypeScript types.", category: "instruction" },
      { signal: new AbortController().signal, callId: "c1" }
    );

    expect(output.status).toBe("stored");
    expect(output.content).toBe("Always use strict TypeScript types.");
    expect(output.category).toBe("instruction");
    expect(output.id).toBeDefined();

    service.close();
  });

  it("executes search_memory and validates schema output", async () => {
    const service = new MemoryService({ dbPath: ":memory:" });
    service.storeMemory({ content: "Client prefers dark mode.", category: "preference" });
    const tool = createSearchMemoryTool(service);

    const output = await tool.execute(
      { query: "dark mode", limit: 5 },
      { signal: new AbortController().signal, callId: "c2" }
    );

    expect(output.query).toBe("dark mode");
    expect(output.total).toBe(1);
    expect(output.memories[0].content).toBe("Client prefers dark mode.");

    service.close();
  });

  it("executes list_memory and delete_memory", async () => {
    const service = new MemoryService({ dbPath: ":memory:" });
    const storeTool = createStoreMemoryTool(service);
    const listTool = createListMemoryTool(service);
    const deleteTool = createDeleteMemoryTool(service);

    const stored = await storeTool.execute(
      { content: "Temporary item.", category: "reminder" },
      { signal: new AbortController().signal, callId: "c3" }
    );

    const listOutput = await listTool.execute(
      { limit: 10 },
      { signal: new AbortController().signal, callId: "c4" }
    );
    expect(listOutput.total).toBe(1);

    const deleteOutput = await deleteTool.execute(
      { id: stored.id },
      { signal: new AbortController().signal, callId: "c5" }
    );
    expect(deleteOutput.success).toBe(true);
    expect(deleteOutput.deletedId).toBe(stored.id);

    service.close();
  });
});
