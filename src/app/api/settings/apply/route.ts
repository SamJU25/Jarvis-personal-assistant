import { NextResponse } from "next/server";
import { getSettingsService } from "@/lib/settings/service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const applyRequestSchema = z.object({
  gatewayUrl: z.string().optional(),
  model: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = applyRequestSchema.safeParse(raw);
    const options = parsed.success ? parsed.data : {};

    const service = getSettingsService();
    const result = await service.applyGatewaySettings(options);

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        state: "failed",
        requiresRestart: false,
        message: err instanceof Error ? err.message : "Apply operation failed",
      },
      { status: 500 }
    );
  }
}
