import { z } from "zod";

export const hermesStatusSchema = z.object({
  status: z.enum(["connected", "degraded", "unavailable", "error"]),
  version: z.string().optional(),
  baseUrl: z.string(),
  sessionReadiness: z.enum(["ready", "not_ready"]),
  runReadiness: z.enum(["ready", "not_ready"]),
  capabilityCount: z.number().int().nonnegative(),
  skillCount: z.number().int().nonnegative(),
  delegationEnabled: z.boolean(),
  lastCheckedAt: z.string(),
});

export type HermesStatus = z.infer<typeof hermesStatusSchema>;

export const gatewayStatusSchema = z.object({
  status: z.enum(["connected", "degraded", "unavailable"]),
  baseUrl: z.string(),
  routingStrategy: z.string().default("automatic"),
  streamingSupported: z.boolean(),
  toolCallingSupported: z.boolean(),
  lastCheckedAt: z.string(),
  currentRoutedModel: z.string().optional(),
  currentRoutedProvider: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
});

export type GatewayStatus = z.infer<typeof gatewayStatusSchema>;

export const providerCredentialSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  configured: z.boolean(),
  health: z.enum(["healthy", "untested", "failing", "not_configured"]),
  lastCheckedAt: z.string(),
});

export type ProviderCredentialSummary = z.infer<typeof providerCredentialSummarySchema>;

export const obsidianSettingsStatusSchema = z.object({
  status: z.string(),
  vaultLabel: z.string(),
  noteCount: z.number().int().nonnegative(),
  lastCheckedAt: z.string(),
});

export type ObsidianSettingsStatus = z.infer<typeof obsidianSettingsStatusSchema>;

export const voiceSettingsStatusSchema = z.object({
  whisper: z.string(),
  kokoro: z.string(),
  microphone: z.string(),
});

export type VoiceSettingsStatus = z.infer<typeof voiceSettingsStatusSchema>;

export const specialistSummarySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: z.string(),
  preferredRoutingProfile: z.string(),
  allowedCapabilities: z.array(z.string()),
  userVisible: z.boolean(),
  status: z.enum(["active", "disabled"]).default("active"),
});

export type SpecialistSummary = z.infer<typeof specialistSummarySchema>;

export const systemStatusSnapshotSchema = z.object({
  hermes: hermesStatusSchema,
  gateway: gatewayStatusSchema,
  providers: z.array(providerCredentialSummarySchema),
  obsidian: obsidianSettingsStatusSchema,
  voice: voiceSettingsStatusSchema,
  specialists: z.array(specialistSummarySchema).optional(),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

export type SystemStatusSnapshot = z.infer<typeof systemStatusSnapshotSchema>;

export const providerKeyInputSchema = z.object({
  platform: z.string().trim().min(1).max(50),
  key: z.string().trim().min(1).max(500),
  label: z.string().trim().max(50).optional(),
});

export type ProviderKeyInput = z.infer<typeof providerKeyInputSchema>;

export const settingsApplyStateSchema = z.enum(["idle", "applying", "applied", "failed", "verified"]);
export type SettingsApplyState = z.infer<typeof settingsApplyStateSchema>;

export const settingsEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("snapshot_updated"),
    snapshot: systemStatusSnapshotSchema,
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("hermes_probed"),
    status: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("gateway_probed"),
    status: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("apply_state_changed"),
    state: settingsApplyStateSchema,
    message: z.string().optional(),
    timestamp: z.string(),
  }),
]);

export type SettingsEvent = z.infer<typeof settingsEventSchema>;
