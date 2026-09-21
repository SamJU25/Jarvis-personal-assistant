import { createHash } from "node:crypto";

export type IdempotencyStatus = "in_progress" | "completed" | "failed";

export interface IdempotencyRecord<T = unknown> {
  key: string;
  toolId: string;
  parametersHash: string;
  status: IdempotencyStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  result?: T;
  error?: string;
}

export interface ExecuteOnceResult<T> {
  result: T;
  replayed: boolean;
  key: string;
}

const DEFAULT_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_IDEMPOTENCY_RECORDS = 200;

/**
 * Deterministically serializes parameters by recursively sorting object keys.
 */
export function canonicalizeValue(val: unknown): unknown {
  if (val === null || typeof val !== "object") {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalizeValue);
  }
  const obj = val as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = canonicalizeValue(obj[key]);
  }
  return sorted;
}

/**
 * Creates a deterministic SHA-256 operation key for a capability and arguments.
 */
export function createOperationKey(
  toolId: string,
  parameters: Record<string, unknown> = {},
  scopeId?: string
): string {
  const canonical = canonicalizeValue(parameters);
  const json = JSON.stringify(canonical);
  const hash = createHash("sha256").update(json).digest("hex").slice(0, 24);
  return scopeId ? `op_${scopeId}_${toolId}_${hash}` : `op_${toolId}_${hash}`;
}

export class IdempotencyService {
  private readonly records = new Map<string, IdempotencyRecord>();
  private readonly inFlightPromises = new Map<string, Promise<unknown>>();
  private readonly defaultTtlMs: number;

  constructor(options?: { defaultTtlMs?: number }) {
    this.defaultTtlMs = options?.defaultTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (new Date(record.expiresAt).getTime() <= now) {
        this.records.delete(key);
      }
    }
    while (this.records.size > MAX_IDEMPOTENCY_RECORDS) {
      const oldestKey = this.records.keys().next().value;
      if (oldestKey) this.records.delete(oldestKey);
      else break;
    }
  }

  /**
   * Retrieves an idempotency record if it exists and is unexpired.
   */
  getRecord<T = unknown>(key: string): IdempotencyRecord<T> | undefined {
    const record = this.records.get(key);
    if (!record) return undefined;
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      this.records.delete(key);
      return undefined;
    }
    return record as IdempotencyRecord<T>;
  }

  /**
   * Checks if an operation is completed and unexpired.
   */
  isCompleted(key: string): boolean {
    const record = this.getRecord(key);
    return record?.status === "completed";
  }

  /**
   * Executes an operation with idempotency protection.
   * If already completed, returns the cached result without re-executing.
   * If in-progress, deduplicates and awaits the in-flight execution.
   */
  async executeOnce<T>(
    key: string,
    toolId: string,
    parameters: Record<string, unknown>,
    executeFn: () => Promise<T>,
    ttlMs?: number
  ): Promise<ExecuteOnceResult<T>> {
    this.pruneExpired();

    const existing = this.getRecord<T>(key);
    if (existing && existing.status === "completed" && existing.result !== undefined) {
      return {
        result: existing.result,
        replayed: true,
        key,
      };
    }

    // Deduplicate in-flight concurrent execution for the same operation identity
    const inFlight = this.inFlightPromises.get(key);
    if (inFlight) {
      const result = (await inFlight) as T;
      return {
        result,
        replayed: true,
        key,
      };
    }

    const effectiveTtl = ttlMs ?? this.defaultTtlMs;
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + effectiveTtl).toISOString();
    const parametersHash = createHash("sha256")
      .update(JSON.stringify(canonicalizeValue(parameters)))
      .digest("hex")
      .slice(0, 16);

    const record: IdempotencyRecord<T> = {
      key,
      toolId,
      parametersHash,
      status: "in_progress",
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt: expiresIso,
    };
    this.records.set(key, record as IdempotencyRecord);

    const executionPromise = (async () => {
      try {
        const result = await executeFn();
        record.status = "completed";
        record.result = result;
        record.updatedAt = new Date().toISOString();
        return result;
      } catch (err: unknown) {
        record.status = "failed";
        record.error = err instanceof Error ? err.message : String(err);
        record.updatedAt = new Date().toISOString();
        throw err;
      } finally {
        this.inFlightPromises.delete(key);
      }
    })();

    this.inFlightPromises.set(key, executionPromise);

    const result = await executionPromise;
    return {
      result,
      replayed: false,
      key,
    };
  }

  /**
   * Explicitly sets a completed record (useful for confirmations completed via other paths).
   */
  storeResult<T>(
    key: string,
    toolId: string,
    parameters: Record<string, unknown>,
    result: T,
    ttlMs?: number
  ): void {
    this.pruneExpired();
    const effectiveTtl = ttlMs ?? this.defaultTtlMs;
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + effectiveTtl).toISOString();
    const parametersHash = createHash("sha256")
      .update(JSON.stringify(canonicalizeValue(parameters)))
      .digest("hex")
      .slice(0, 16);

    this.records.set(key, {
      key,
      toolId,
      parametersHash,
      status: "completed",
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt: expiresIso,
      result,
    });
  }

  clear(): void {
    this.records.clear();
    this.inFlightPromises.clear();
  }
}

// Global singleton instance for application runtime
const globalForIdempotency = globalThis as unknown as {
  _idempotencyService?: IdempotencyService;
};

export const idempotencyService =
  globalForIdempotency._idempotencyService ?? new IdempotencyService();

if (process.env.NODE_ENV !== "production") {
  globalForIdempotency._idempotencyService = idempotencyService;
}

export function getIdempotencyService(): IdempotencyService {
  return idempotencyService;
}
