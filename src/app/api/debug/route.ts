import { NextResponse } from "next/server";
import { getDiagnosticService } from "@/lib/diagnostics/service";

export async function GET() {
  try {
    const service = getDiagnosticService();
    const snapshot = service.getSnapshot();
    return NextResponse.json(snapshot, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate debug snapshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
