import { NextResponse } from "next/server";
import { getSettingsService } from "@/lib/settings/service";

export const dynamic = "force-dynamic";

export async function POST() {
  const service = getSettingsService();
  const result = await service.testGateway();
  return NextResponse.json(result);
}
