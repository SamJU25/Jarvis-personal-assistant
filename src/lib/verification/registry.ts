import type { VerificationStrategy } from "./types";
import { CreateNoteVerificationStrategy } from "./strategies/note-verification";
import { CreateGoogleDocVerificationStrategy } from "./strategies/doc-verification";
import { DraftEmailVerificationStrategy } from "./strategies/email-verification";
import { DefaultReadVerificationStrategy } from "./strategies/read-verification";
import { SkillVerificationStrategy } from "./strategies/skill-verification";
import { DocumentVerificationStrategy } from "./strategies/document-verification";

export class VerificationRegistry {
  private readonly strategies = new Map<string, VerificationStrategy>();
  private readonly defaultStrategy: VerificationStrategy = new DefaultReadVerificationStrategy();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const noteStrategy = new CreateNoteVerificationStrategy();
    const docStrategy = new CreateGoogleDocVerificationStrategy();
    const emailStrategy = new DraftEmailVerificationStrategy();
    const readStrategy = new DefaultReadVerificationStrategy();
    const skillStrategy = new SkillVerificationStrategy();
    const documentStrategy = new DocumentVerificationStrategy();

    // Register by canonical strategy ID
    this.register("note_verification", noteStrategy);
    this.register("doc_verification", docStrategy);
    this.register("email_verification", emailStrategy);
    this.register("read_verification", readStrategy);
    this.register("skill_verification", skillStrategy);
    this.register("document_verification", documentStrategy);

    // Backward-compatible registration by tool ID alias
    this.register("create_note", noteStrategy);
    this.register("create_google_doc", docStrategy);
    this.register("draft_email", emailStrategy);
    this.register("propose_skill_improvement", skillStrategy);
    this.register("write_document", documentStrategy);
  }

  register(strategyOrToolId: string, strategy: VerificationStrategy): void {
    this.strategies.set(strategyOrToolId, strategy);
  }

  get(strategyOrToolId: string): VerificationStrategy {
    return this.strategies.get(strategyOrToolId) ?? this.defaultStrategy;
  }

  getStrategyName(strategyOrToolId: string): string {
    const strat = this.get(strategyOrToolId);
    return strat.name ?? strat.id ?? "VerificationStrategy";
  }

  has(strategyOrToolId: string): boolean {
    return this.strategies.has(strategyOrToolId);
  }

  clear(): void {
    this.strategies.clear();
    this.registerDefaults();
  }
}

// Global singleton for application runtime
const globalForVerification = globalThis as unknown as {
  _verificationRegistry?: VerificationRegistry;
};

export const verificationRegistry =
  globalForVerification._verificationRegistry ?? new VerificationRegistry();

if (process.env.NODE_ENV !== "production") {
  globalForVerification._verificationRegistry = verificationRegistry;
}

export function getVerificationRegistry(): VerificationRegistry {
  return verificationRegistry;
}
