import { NextResponse } from "next/server";
import { getSettingsService } from "@/lib/settings/service";
import { providerKeyInputSchema } from "@/lib/contracts/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = providerKeyInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid platform or key format",
          errors: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { platform, key, label } = parsed.data;
    const service = getSettingsService();
    const result = await service.saveProviderKey(platform, key, label);

    // Explicitly return ONLY success and message. Never reflect key!
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to save key",
      },
      { status: 500 }
    );
  }
}
