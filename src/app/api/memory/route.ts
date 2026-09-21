import { getMemoryService } from "@/lib/memory/service";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deleteQuerySchema = z.object({
  id: z.string().trim().min(1),
});

export async function GET() {
  try {
    const memoryService = getMemoryService();
    const result = memoryService.listMemory({ limit: 50 });
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "Failed to retrieve memories." },
      { status: 500, headers: { "X-Content-Type-Options": "nosniff" } }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const parsed = deleteQuerySchema.safeParse({ id });

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid or missing memory ID." },
        { status: 400, headers: { "X-Content-Type-Options": "nosniff" } }
      );
    }

    const memoryService = getMemoryService();
    const result = memoryService.deleteMemory({ id: parsed.data.id });

    if (!result.success) {
      return Response.json(result, {
        status: 404,
        headers: { "X-Content-Type-Options": "nosniff" },
      });
    }

    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "Failed to delete memory." },
      { status: 500, headers: { "X-Content-Type-Options": "nosniff" } }
    );
  }
}
