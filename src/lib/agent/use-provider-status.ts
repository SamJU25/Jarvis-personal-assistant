"use client";

import { useEffect, useState } from "react";
import { providerStatusSchema, type ProviderStatus } from "@/lib/contracts/agent-api";

const unavailable: ProviderStatus = { available: false, authenticated: false, provider: "Command Code", model: "Not configured" };

export function useProviderStatus() {
  const [status, setStatus] = useState<ProviderStatus>(unavailable);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/agent/status", { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()).then((value) => setStatus(providerStatusSchema.parse(value))).catch(() => undefined);
    return () => controller.abort();
  }, []);
  return status;
}
