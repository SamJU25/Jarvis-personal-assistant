import type { VerificationRequest, VerificationResult } from "@/lib/contracts/verification";

export interface VerificationStrategy {
  readonly id?: string;
  readonly name?: string;
  verify(
    request: VerificationRequest,
    context?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<VerificationResult>;
}
