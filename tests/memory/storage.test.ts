import { describe, expect, it, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { MemoryStorage } from "@/lib/memory/storage";
import type { MemoryRecord } from "@/lib/memory/types";

describe("MemoryStorage", () => {
  let tempDbPath: string | null = null;

  afterEach(() => {
    if (tempDbPath && fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {
        // cleanup
      }
    }
  });

  it("creates and retrieves memories in SQLite", () => {
    const storage = new MemoryStorage({ dbPath: ":memory:" });
    const record: MemoryRecord = {
      id: "mem-1",
      content: "I prefer concise bullet points in responses.",
      category: "preference",
      source: "user_explicit",
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-20T10:00:00.000Z",
    };

    storage.create(record);
    const fetched = storage.getById("mem-1");

    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe("mem-1");
    expect(fetched?.content).toBe("I prefer concise bullet points in responses.");
    expect(fetched?.category).toBe("preference");
    expect(fetched?.source).toBe("user_explicit");
    storage.close();
  });

  it("persists data across separate storage instances using disk file", () => {
    tempDbPath = path.join(os.tmpdir(), `jarvis-memory-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    
    // First instance writes a record
    const storage1 = new MemoryStorage({ dbPath: tempDbPath });
    storage1.create({
      id: "mem-persist-1",
      content: "Start video recordings with the end result first.",
      category: "project",
      source: "user_explicit",
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-20T10:00:00.000Z",
    });
    storage1.close();

    // Second instance re-opens the same SQLite database
    const storage2 = new MemoryStorage({ dbPath: tempDbPath });
    const retrieved = storage2.getById("mem-persist-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.content).toBe("Start video recordings with the end result first.");
    expect(storage2.count()).toBe(1);
    storage2.close();
  });

  it("finds duplicate memory records by exact content ignoring case and excess whitespace", () => {
    const storage = new MemoryStorage({ dbPath: ":memory:" });
    storage.create({
      id: "mem-dup-1",
      content: "Never schedule meetings before 10 AM.",
      category: "preference",
      source: "user_explicit",
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-20T10:00:00.000Z",
    });

    const match = storage.getByExactContent("  never schedule meetings before 10 AM.  ");
    expect(match).not.toBeNull();
    expect(match?.id).toBe("mem-dup-1");

    const noMatch = storage.getByExactContent("Schedule meetings before 10 AM.");
    expect(noMatch).toBeNull();
    storage.close();
  });

  it("searches and ranks memories by relevance and recency", () => {
    const storage = new MemoryStorage({ dbPath: ":memory:" });
    storage.create({
      id: "mem-search-1",
      content: "DeepSeek models run well on local Ollama hardware.",
      category: "fact",
      source: "user_explicit",
      createdAt: "2026-09-18T10:00:00.000Z",
      updatedAt: "2026-09-18T10:00:00.000Z",
    });
    storage.create({
      id: "mem-search-2",
      content: "I prefer concise reports on DeepSeek research.",
      category: "preference",
      source: "user_explicit",
      createdAt: "2026-09-19T10:00:00.000Z",
      updatedAt: "2026-09-19T10:00:00.000Z",
    });
    storage.create({
      id: "mem-search-3",
      content: "Meeting with Yusuf is scheduled for Monday.",
      category: "reminder",
      source: "user_explicit",
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-20T10:00:00.000Z",
    });

    const results = storage.search("DeepSeek concise");
    expect(results.length).toBe(2);
    // mem-search-2 matched both "DeepSeek" and "concise", so it has higher score
    expect(results[0].id).toBe("mem-search-2");
    expect(results[1].id).toBe("mem-search-1");
    storage.close();
  });

  it("lists memories with category filtering and bounds limits", () => {
    const storage = new MemoryStorage({ dbPath: ":memory:" });
    storage.create({
      id: "m1",
      content: "Preference 1",
      category: "preference",
      source: "user_explicit",
      createdAt: "2026-09-20T08:00:00.000Z",
      updatedAt: "2026-09-20T08:00:00.000Z",
    });
    storage.create({
      id: "m2",
      content: "Fact 1",
      category: "fact",
      source: "user_explicit",
      createdAt: "2026-09-20T09:00:00.000Z",
      updatedAt: "2026-09-20T09:00:00.000Z",
    });
    storage.create({
      id: "m3",
      content: "Preference 2",
      category: "preference",
      source: "user_explicit",
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-20T10:00:00.000Z",
    });

    const preferences = storage.list({ category: "preference" });
    expect(preferences.total).toBe(2);
    expect(preferences.memories.map((m) => m.id)).toEqual(["m3", "m1"]);

    const allLimited = storage.list({ limit: 2 });
    expect(allLimited.total).toBe(3);
    expect(allLimited.memories.length).toBe(2);
    storage.close();
  });

  it("deletes a memory by ID cleanly and handles nonexistent IDs", () => {
    const storage = new MemoryStorage({ dbPath: ":memory:" });
    storage.create({
      id: "mem-del-1",
      content: "Temporary preference",
      category: "preference",
      source: "user_explicit",
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-20T10:00:00.000Z",
    });

    expect(storage.count()).toBe(1);
    const deleted = storage.delete("mem-del-1");
    expect(deleted).toBe(true);
    expect(storage.count()).toBe(0);
    expect(storage.getById("mem-del-1")).toBeNull();

    // Nonexistent ID
    const deletedAgain = storage.delete("nonexistent-id");
    expect(typeof deletedAgain).toBe("boolean");
    storage.close();
  });
});
