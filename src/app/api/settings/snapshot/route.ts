import { NextResponse } from "next/server";
import { getSettingsService } from "@/lib/settings/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const service = getSettingsService();
  const snapshot = await service.getSnapshot(true);
  return NextResponse.json(snapshot);
}
