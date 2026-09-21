import fs from "node:fs/promises";
import path from "node:path";

export interface HermesModelConfig {
  provider: string;
  baseUrl: string;
  defaultModel: string;
}

export interface HermesConfigUpdateResult {
  updated: boolean;
  requiresRestart: boolean;
  previous: HermesModelConfig;
  current: HermesModelConfig;
}

export class HermesConfigUpdater {
  private readonly configPath: string;

  constructor(customPath?: string) {
    this.configPath =
      customPath ??
      process.env.HERMES_CONFIG_PATH ??
      path.join("F:", "hermes-agent", ".hermes", "config.yaml");
  }

  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Reads current model configuration from Hermes config.yaml.
   */
  async readModelConfig(): Promise<HermesModelConfig> {
    try {
      const content = await fs.readFile(this.configPath, "utf-8");
      return this.parseModelConfig(content);
    } catch {
      return {
        provider: "unknown",
        baseUrl: "http://127.0.0.1:11434/v1",
        defaultModel: "qwen3.5:4b",
      };
    }
  }

  /**
   * Updates the Hermes model configuration to point to custom FreeLLMAPI gateway.
   */
  async updateToGateway(
    gatewayBaseUrl: string = "http://127.0.0.1:3001/v1",
    model: string = "auto"
  ): Promise<HermesConfigUpdateResult> {
    let content = "";
    try {
      content = await fs.readFile(this.configPath, "utf-8");
    } catch {
      // If config doesn't exist, create directory and base template
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      content = `model:
  default: "auto"
  provider: "custom"
  base_url: "${gatewayBaseUrl}"
`;
    }

    const previous = this.parseModelConfig(content);

    // If already identical, no-op
    if (
      previous.provider === "custom" &&
      previous.baseUrl === gatewayBaseUrl &&
      previous.defaultModel === model
    ) {
      return {
        updated: false,
        requiresRestart: false,
        previous,
        current: previous,
      };
    }

    const updatedContent = this.replaceModelSection(content, {
      provider: "custom",
      baseUrl: gatewayBaseUrl,
      defaultModel: model,
    });

    await fs.writeFile(this.configPath, updatedContent, "utf-8");

    const current: HermesModelConfig = {
      provider: "custom",
      baseUrl: gatewayBaseUrl,
      defaultModel: model,
    };

    return {
      updated: true,
      requiresRestart: true,
      previous,
      current,
    };
  }

  private parseModelConfig(content: string): HermesModelConfig {
    let provider = "custom";
    let baseUrl = "http://127.0.0.1:11434/v1";
    let defaultModel = "qwen3.5:4b";

    const lines = content.split("\n");
    let inModelSection = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^model:\s*$/.test(trimmed)) {
        inModelSection = true;
        continue;
      }

      if (inModelSection) {
        if (/^[a-zA-Z0-9_-]+:\s*$/.test(trimmed) && !trimmed.startsWith("model:")) {
          inModelSection = false;
          continue;
        }

        const providerMatch = trimmed.match(/^provider:\s*["']?([^"']+)["']?/);
        if (providerMatch) provider = providerMatch[1].trim();

        const baseMatch = trimmed.match(/^base_url:\s*["']?([^"']+)["']?/);
        if (baseMatch) baseUrl = baseMatch[1].trim();

        const defaultMatch = trimmed.match(/^default:\s*["']?([^"']+)["']?/);
        if (defaultMatch) defaultModel = defaultMatch[1].trim();
      }
    }

    return { provider, baseUrl, defaultModel };
  }

  private replaceModelSection(
    content: string,
    newConfig: HermesModelConfig
  ): string {
    const lines = content.split("\n");
    let inModelSection = false;
    const outputLines: string[] = [];
    let modelSectionInserted = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (/^model:\s*$/.test(trimmed)) {
        inModelSection = true;
        outputLines.push("model:");
        outputLines.push(`  default: "${newConfig.defaultModel}"`);
        outputLines.push(`  provider: "${newConfig.provider}"`);
        outputLines.push(`  base_url: "${newConfig.baseUrl}"`);
        modelSectionInserted = true;
        continue;
      }

      if (inModelSection) {
        // If we reach another top-level section or end of indent
        if (/^[a-zA-Z0-9_-]+:\s*$/.test(trimmed)) {
          inModelSection = false;
          outputLines.push(line);
        }
        // Skip old model fields
        continue;
      }

      outputLines.push(line);
    }

    if (!modelSectionInserted) {
      outputLines.unshift(
        "model:",
        `  default: "${newConfig.defaultModel}"`,
        `  provider: "${newConfig.provider}"`,
        `  base_url: "${newConfig.baseUrl}"`,
        ""
      );
    }

    return outputLines.join("\n");
  }
}
