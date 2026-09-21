import type { VerificationStrategy } from "./types";
import { CreateNoteVerificationStrategy } from "./strategies/note-verification";
import { CreateGoogleDocVerificationStrategy } from "./strategies/doc-verification";
import { DraftEmailVerificationStrategy } from "./strategies/email-verification";
import { DefaultReadVerificationStrategy } from "./strategies/read-verification";

export class VerificationRegistry {
  private readonly strategies = new Map<string, VerificationStrategy>();
  private readonly defaultStrategy: VerificationStrategy = new DefaultReadVerificationStrategy();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register("create_note", new CreateNoteVerificationStrategy());
    this.register("create_google_doc", new CreateGoogleDocVerificationStrategy());
    this.register("draft_email", new DraftEmailVerificationStrategy());
  }

  register(toolId: string, strategy: VerificationStrategy): void {
    this.strategies.set(toolId, strategy);
  }

  get(toolId: string): VerificationStrategy {
    return this.strategies.get(toolId) ?? this.defaultStrategy;
  }

  has(toolId: string): boolean {
    return this.strategies.has(toolId);
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
