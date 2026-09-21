import { describe, expect, it, afterEach } from "vitest";
import { checkGoogleStatus, getGwsExecutablePath } from "@/lib/google/config";

describe("Google Workspace Configuration and Status", () => {
  const origEnv = process.env.JARVIS_GWS_EXECUTABLE;

  afterEach(() => {
    if (origEnv !== undefined) {
      process.env.JARVIS_GWS_EXECUTABLE = origEnv;
    } else {
      delete process.env.JARVIS_GWS_EXECUTABLE;
    }
  });

  it("reports Not configured when executable is not set and gws is not found", async () => {
    delete process.env.JARVIS_GWS_EXECUTABLE;
    // Pass non-existent path override or let probe test missing gws
    const result = await checkGoogleStatus(null);
    expect(result.status).toBe("Not configured");
    expect(result.configured).toBe(false);
  });

  it("reports Unavailable when configured executable does not exist", async () => {
    const fakePath = "C:\\nonexistent\\path\\to\\gws.exe";
    const result = await checkGoogleStatus(fakePath);
    expect(result.status).toBe("Unavailable");
    expect(result.configured).toBe(true);
  });

  it("reads JARVIS_GWS_EXECUTABLE environment variable", () => {
    process.env.JARVIS_GWS_EXECUTABLE = "C:\\test\\gws.cmd";
    expect(getGwsExecutablePath()).toBe("C:\\test\\gws.cmd");
  });

  it("returns null when JARVIS_GWS_EXECUTABLE is empty", () => {
    process.env.JARVIS_GWS_EXECUTABLE = "   ";
    expect(getGwsExecutablePath()).toBeNull();
  });

  it("does not leak secrets, paths, or tokens in status output", async () => {
    const result = await checkGoogleStatus("C:\\secret-folder\\token-12345\\gws.exe");
    expect(result).not.toHaveProperty("path");
    expect(result).not.toHaveProperty("token");
    expect(result).not.toHaveProperty("secret");
    expect(result).not.toHaveProperty("stderr");
    expect(["Available", "Not configured", "Unauthenticated", "Unavailable", "Invalid configuration"]).toContain(
      result.status
    );
  });
});
