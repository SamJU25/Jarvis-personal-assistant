import type { VerificationRequest, VerificationResult } from "@/lib/contracts/verification";

export interface VerificationStrategy {
  verify(
    request: VerificationRequest,
    context?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<VerificationResult>;
}
