import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ConfirmationActionCategory,
  PendingConfirmation,
} from "@/lib/contracts/confirmation";
import { buildSkillDiff } from "@/lib/learning/diff";
import { getObsidianVaultPath } from "@/lib/obsidian/config";

export interface CreateConfirmationOptions {
  originatingRunId: string;
  toolId: string;
  actionCategory: ConfirmationActionCategory;
  title: string;
  target: string;
  summary: string;
  preview: string;
  parameters: Record<string, unknown>;
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 60_000; // 60 seconds

export function buildConfirmationDetails(
  toolId: string,
  parameters: Record<string, unknown>
): {
  actionCategory: ConfirmationActionCategory;
  title: string;
  target: string;
  summary: string;
  preview: string;
} {
  if (toolId === "create_note") {
    const noteTitle = typeof parameters.title === "string" ? parameters.title : "Untitled Note";
    const content = typeof parameters.content === "string" ? parameters.content : "";
    return {
      actionCategory: "note",
      title: "CREATE NOTE",
      target: `Inbox/JARVIS/${noteTitle}.md`,
      summary: `Create note "${noteTitle}" in Obsidian vault`,
      preview: content.slice(0, 500),
    };
  }

  if (toolId === "create_google_doc") {
    const docTitle = typeof parameters.title === "string" ? parameters.title : "Untitled Document";
    const content = typeof parameters.content === "string" ? parameters.content : "";
    return {
      actionCategory: "document",
      title: "CREATE GOOGLE DOC",
      target: `Google Drive / ${docTitle}`,
      summary: `Create Google Doc "${docTitle}" in Google Drive`,
      preview: content.slice(0, 500),
    };
  }

  if (toolId === "draft_email") {
    const to = typeof parameters.to === "string" ? parameters.to : "Unknown recipient";
    const subject = typeof parameters.subject === "string" ? parameters.subject : "No Subject";
    const body = typeof parameters.body === "string" ? parameters.body : "";
    return {
      actionCategory: "email",
      title: "DRAFT EMAIL",
      target: `To: ${to}`,
      summary: `Draft email to ${to}: "${subject}" (Draft only, will NOT be sent)`,
      preview: `Subject: ${subject}\n\n${body.slice(0, 500)}`,
    };
  }

  if (toolId === "propose_skill_improvement") {
    const skill = typeof parameters.skill === "string" ? parameters.skill : "unknown";
    const rationale = typeof parameters.rationale === "string" ? parameters.rationale : "";
    const proposed = typeof parameters.content === "string" ? parameters.content : "";

    // Safe diff preview against the canonical vault copy (bounded sync read).
    let diffPreview = proposed.slice(0, 800);
    const vaultRoot = getObsidianVaultPath();
    if (vaultRoot && /^[a-z0-9][a-z0-9-]*$/.test(skill)) {
      try {
        const skillPath = path.join(vaultRoot, "AI", "Skills", skill, "SKILL.md");
        const stat = fs.statSync(skillPath);
        if (stat.isFile() && stat.size <= 200_000) {
          const current = fs.readFileSync(skillPath, "utf-8");
          diffPreview = buildSkillDiff(current, proposed).rendered;
        }
      } catch {
        // Skill unreadable: fall back to a content preview only.
      }
    }

    return {
      actionCategory: "other",
      title: "UPDATE SKILL",
      target: `AI/Skills/${skill}/SKILL.md`,
      summary: `Update Obsidian skill "${skill}" — requires your approval. Reason: ${rationale.slice(0, 160)}`,
      preview: diffPreview.slice(0, 4000),
    };
  }

  return {
    actionCategory: "other",
    title: `WRITE ACTION: ${toolId}`,
    target: toolId,
    summary: `Execute write action: ${toolId}`,
    preview: JSON.stringify(parameters, null, 2),
  };
}

export class ConfirmationService {
  private readonly store = new Map<string, PendingConfirmation>();

  createPendingConfirmation(options: CreateConfirmationOptions): PendingConfirmation {
    const id = `conf-${randomUUID()}`;
    const now = Date.now();
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

    const confirmation: PendingConfirmation = {
      id,
      originatingRunId: options.originatingRunId,
      toolId: options.toolId,
      actionCategory: options.actionCategory,
      title: options.title,
      target: options.target,
      summary: options.summary,
      preview: options.preview,
      parameters: { ...options.parameters },
      status: "pending",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    };

    this.store.set(id, confirmation);
    return confirmation;
  }

  get(id: string): PendingConfirmation | undefined {
    const item = this.store.get(id);
    if (!item) return undefined;

    // Check expiry
    if (item.status === "pending" && Date.now() > new Date(item.expiresAt).getTime()) {
      item.status = "expired";
    }

    return item;
  }

  /**
   * Authorizes a pending confirmation.
   * Enforces single-use consumption to strictly protect against replay attacks.
   */
  authorize(id: string): PendingConfirmation {
    const item = this.get(id);
    if (!item) {
      throw new Error(`Confirmation "${id}" not found.`);
    }

    if (item.status === "expired") {
      throw new Error(`Confirmation "${id}" has expired.`);
    }

    if (item.status !== "pending") {
      throw new Error(
        `Confirmation "${id}" cannot be authorized because it is already ${item.status}.`
      );
    }

    // Atomic consumption: single-use protection
    item.status = "consumed";
    return item;
  }

  /**
   * Cancels a pending confirmation.
   */
  cancel(id: string): PendingConfirmation {
    const item = this.get(id);
    if (!item) {
      throw new Error(`Confirmation "${id}" not found.`);
    }

    if (item.status === "pending") {
      item.status = "cancelled";
    }

    return item;
  }

  /**
   * Finds the latest active unexpired pending confirmation for an originating run.
   */
  getActivePendingForRun(runId: string): PendingConfirmation | undefined {
    for (const item of this.store.values()) {
      if (item.originatingRunId === runId && item.status === "pending") {
        if (Date.now() > new Date(item.expiresAt).getTime()) {
          item.status = "expired";
        } else {
          return item;
        }
      }
    }
    return undefined;
  }

  /**
   * Returns the most recent unexpired pending confirmation.
   * Useful for voice turn matching ("Yes, create it").
   */
  getLatestPending(): PendingConfirmation | undefined {
    const pending = Array.from(this.store.values())
      .filter((item) => {
        if (item.status === "pending") {
          if (Date.now() > new Date(item.expiresAt).getTime()) {
            item.status = "expired";
            return false;
          }
          return true;
        }
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return pending[0];
  }

  /**
   * Cleans up all confirmations older than 10 minutes.
   */
  cleanup(): void {
    const cutoff = Date.now() - 600_000;
    for (const [id, item] of this.store.entries()) {
      if (new Date(item.createdAt).getTime() < cutoff) {
        this.store.delete(id);
      }
    }
  }

  /**
   * Clears all confirmations (used in test isolation).
   */
  clear(): void {
    this.store.clear();
  }
}

// Global singleton instance
const globalForConfirmation = globalThis as unknown as {
  _confirmationService?: ConfirmationService;
};

export const confirmationService =
  globalForConfirmation._confirmationService ?? new ConfirmationService();

if (process.env.NODE_ENV !== "production") {
  globalForConfirmation._confirmationService = confirmationService;
}

export function getConfirmationService(): ConfirmationService {
  return confirmationService;
}
