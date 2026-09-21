import { getProviderStatus } from "@/lib/agent/status";
import { providerStatusSchema } from "@/lib/contracts/agent-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = providerStatusSchema.parse(await getProviderStatus());
  return Response.json(status, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
