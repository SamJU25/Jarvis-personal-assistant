import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/debug/route";
import { debugSnapshotSchema } from "@/lib/contracts/diagnostics";
import { getDiagnosticService } from "@/lib/diagnostics";

describe("Phase 11 Debug API Route (/api/debug)", () => {
  it("returns a valid sanitized DebugSnapshot with no-store cache headers", async () => {
    const diagService = getDiagnosticService();
    diagService.clear();

    diagService.startRun("run-route-1", "Test request via API route");
    diagService.completeRun("run-route-1", "success");

    const response = await GET();
    expect(response.status).toBe(200);

    // Verify cache control
    const cacheHeader = response.headers.get("cache-control");
    expect(cacheHeader).toContain("no-store");

    const body = await response.json();
    const validated = debugSnapshotSchema.safeParse(body);
    expect(validated.success).toBe(true);

    if (validated.success) {
      expect(validated.data.totals.runs).toBe(1);
      expect(validated.data.totals.successes).toBe(1);
      expect(validated.data.recentRuns.length).toBe(1);
      expect(validated.data.recentRuns[0].runId).toBe("run-route-1");
    }
  });

  it("is strictly read-only and does not mutate task state, execute tools, or authorize writes", async () => {
    const diagService = getDiagnosticService();
    diagService.clear();

    const snapshot1 = diagService.getSnapshot();
    const res1 = await GET();
    const data1 = await res1.json();

    const res2 = await GET();
    const data2 = await res2.json();

    // Fetching /api/debug twice does not create runs, mutate state, or increment totals
    expect(data1.totals.runs).toBe(snapshot1.totals.runs);
    expect(data2.totals.runs).toBe(snapshot1.totals.runs);
  });
});
