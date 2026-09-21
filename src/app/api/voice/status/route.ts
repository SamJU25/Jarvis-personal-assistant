import { NextResponse } from "next/server";
import { getVoiceStatus } from "@/lib/voice/config";

export async function GET() {
  try {
    const status = await getVoiceStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve voice status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
