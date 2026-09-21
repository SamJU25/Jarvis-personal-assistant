import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { HermesConfigUpdater } from "@/lib/hermes/config-updater";

describe("HermesConfigUpdater", () => {
  let tempDir: string;
  let configYamlPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "hermes-cfg-test-"));
    configYamlPath = path.join(tempDir, "config.yaml");

    const sampleYaml = `model:
  default: "qwen3.5:4b"
  provider: "custom"
  base_url: "http://127.0.0.1:11434/v1"

platform_toolsets:
  api_server:
    - web
    - clarify

agent:
  disabled_toolsets:
    - terminal
`;
    await writeFile(configYamlPath, sampleYaml, "utf-8");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reads existing model configuration correctly", async () => {
    const updater = new HermesConfigUpdater(configYamlPath);
    const config = await updater.readModelConfig();

    expect(config.provider).toBe("custom");
    expect(config.baseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(config.defaultModel).toBe("qwen3.5:4b");
  });

  it("updates model section to target gateway without disturbing other sections", async () => {
    const updater = new HermesConfigUpdater(configYamlPath);
    const res = await updater.updateToGateway("http://127.0.0.1:3001/v1", "auto");

    expect(res.updated).toBe(true);
    expect(res.requiresRestart).toBe(true);
    expect(res.current.baseUrl).toBe("http://127.0.0.1:3001/v1");
    expect(res.current.defaultModel).toBe("auto");

    const updatedRaw = await readFile(configYamlPath, "utf-8");
    expect(updatedRaw).toContain('base_url: "http://127.0.0.1:3001/v1"');
    expect(updatedRaw).toContain('default: "auto"');
    expect(updatedRaw).toContain("platform_toolsets:");
    expect(updatedRaw).toContain("disabled_toolsets:");
  });

  it("is idempotent when applied with identical settings", async () => {
    const updater = new HermesConfigUpdater(configYamlPath);
    await updater.updateToGateway("http://127.0.0.1:3001/v1", "auto");

    const secondRun = await updater.updateToGateway("http://127.0.0.1:3001/v1", "auto");
    expect(secondRun.updated).toBe(false);
    expect(secondRun.requiresRestart).toBe(false);
  });
});
