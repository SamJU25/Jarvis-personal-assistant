import { stat, access, constants } from "node:fs/promises";

export type ObsidianStatus = "Available" | "Not configured" | "Unavailable" | "Invalid";

export interface ObsidianConfigStatus {
  status: ObsidianStatus;
  configured: boolean;
}

export function getObsidianVaultPath(): string | null {
  const path = process.env.OBSIDIAN_VAULT_PATH;
  if (!path || !path.trim()) {
    return null;
  }
  return path.trim();
}

export async function checkObsidianStatus(vaultPathOverride?: string): Promise<ObsidianConfigStatus> {
  const rawPath = vaultPathOverride !== undefined ? vaultPathOverride : getObsidianVaultPath();

  if (!rawPath || !rawPath.trim()) {
    return { status: "Not configured", configured: false };
  }

  const trimmed = rawPath.trim();

  try {
    const info = await stat(trimmed);
    if (!info.isDirectory()) {
      return { status: "Invalid", configured: true };
    }
    await access(trimmed, constants.R_OK);
    return { status: "Available", configured: true };
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "ENOENT") {
      return { status: "Unavailable", configured: true };
    }
    if (err.code === "EACCES" || err.code === "EPERM") {
      return { status: "Unavailable", configured: true };
    }
    return { status: "Invalid", configured: true };
  }
}
