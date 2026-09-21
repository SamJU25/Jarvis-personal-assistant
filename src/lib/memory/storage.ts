import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { MemoryRecord, MemoryCategory } from "./types";

export interface MemoryStorageOptions {
  dbPath?: string;
}

export class MemoryStorage {
  private db: DatabaseSync;
  private readonly dbPath: string;

  constructor(options?: MemoryStorageOptions) {
    this.dbPath =
      options?.dbPath ??
      process.env.JARVIS_MEMORY_DB_PATH ??
      (process.env.NODE_ENV === "test"
        ? ":memory:"
        : path.join(process.cwd(), ".jarvis", "memory.db"));

    if (this.dbPath !== ":memory:") {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(this.dbPath);
    if (this.dbPath !== ":memory:") {
      try {
        this.db.exec("PRAGMA journal_mode = WAL;");
        this.db.exec("PRAGMA busy_timeout = 5000;");
      } catch {
        // Safe fallback
      }
    }
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_category ON memories (category);
    `);
  }

  create(record: MemoryRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO memories (id, content, category, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.id,
      record.content,
      record.category,
      record.source,
      record.createdAt,
      record.updatedAt
    );
  }

  getById(id: string): MemoryRecord | null {
    const stmt = this.db.prepare(`
      SELECT id, content, category, source, created_at as createdAt, updated_at as updatedAt
      FROM memories
      WHERE id = ?
    `);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  getByExactContent(content: string): MemoryRecord | null {
    const stmt = this.db.prepare(`
      SELECT id, content, category, source, created_at as createdAt, updated_at as updatedAt
      FROM memories
      WHERE LOWER(TRIM(content)) = LOWER(TRIM(?))
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(content) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  list(options?: {
    category?: MemoryCategory;
    limit?: number;
    offset?: number;
  }): { memories: MemoryRecord[]; total: number } {
    const limit = Math.max(1, Math.min(options?.limit ?? 20, 100));
    const offset = Math.max(0, options?.offset ?? 0);

    let countSql = "SELECT COUNT(*) as count FROM memories";
    let selectSql = `
      SELECT id, content, category, source, created_at as createdAt, updated_at as updatedAt
      FROM memories
    `;
    const params: (string | number)[] = [];

    if (options?.category) {
      countSql += " WHERE category = ?";
      selectSql += " WHERE category = ?";
      params.push(options.category);
    }

    selectSql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const countRow = this.db.prepare(countSql).get(...(options?.category ? [options.category] : [])) as { count: number };
    const total = Number(countRow?.count ?? 0);

    const rows = this.db.prepare(selectSql).all(...params) as Record<string, unknown>[];
    const memories = rows.map((r) => this.mapRow(r));

    return { memories, total };
  }

  search(query: string, limit = 5): MemoryRecord[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "in", "on", "at", "to",
  "for", "of", "with", "by", "from", "about", "what", "which", "who",
  "whom", "this", "that", "these", "those", "have", "has", "had", "do",
  "does", "did", "can", "could", "will", "would", "should", "my", "your",
  "his", "her", "its", "our", "their", "me", "him", "them", "you", "how",
  "why", "when", "where", "tell", "show", "give", "please", "recipe",
]);

    // Extract search keywords (at least 2 chars long, excluding common stop words)
    const rawTokens = trimmed
      .split(/\s+/)
      .map((t) => t.replace(/[^\w-]/g, ""))
      .filter((t) => t.length >= 2);

    const tokens = rawTokens.filter((t) => !STOP_WORDS.has(t));
    if (tokens.length === 0) return [];

    // Retrieve candidate memories (most recent first)
    const stmt = this.db.prepare(`
      SELECT id, content, category, source, created_at as createdAt, updated_at as updatedAt
      FROM memories
      ORDER BY created_at DESC
      LIMIT 100
    `);
    const rows = stmt.all() as Record<string, unknown>[];
    const records = rows.map((r) => this.mapRow(r));

    // Score candidates based on relevance
    const scored: Array<{ record: MemoryRecord; score: number }> = [];

    for (const record of records) {
      const lower = record.content.toLowerCase();
      let score = 0;

      // Full query match
      if (lower.includes(trimmed)) {
        score += 10;
      }

      // Keyword token overlap using word boundaries
      for (const token of tokens) {
        try {
          const regex = new RegExp(`\\b${token}\\b`, "i");
          if (regex.test(lower)) {
            score += 3;
          }
        } catch {
          if (lower.includes(token)) {
            score += 1;
          }
        }
      }

      // Category matching
      if (tokens.some((t) => record.category.toLowerCase().includes(t))) {
        score += 1;
      }

      if (score > 0) {
        scored.push({ record, score });
      }
    }

    // Sort by score DESC, then created_at DESC
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.record.createdAt).getTime() - new Date(a.record.createdAt).getTime();
    });

    return scored.slice(0, Math.max(1, limit)).map((s) => s.record);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare("DELETE FROM memories WHERE id = ?");
    const result = stmt.run(id);
    return (result as { changes?: number }).changes ? (result as { changes: number }).changes > 0 : true;
  }

  count(): number {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM memories");
    const row = stmt.get() as { count: number } | undefined;
    return Number(row?.count ?? 0);
  }

  close(): void {
    try {
      this.db.close();
    } catch {
      // Ignore if already closed
    }
  }

  private mapRow(row: Record<string, unknown>): MemoryRecord {
    return {
      id: String(row.id),
      content: String(row.content),
      category: row.category as MemoryCategory,
      source: String(row.source),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }
}
