import { z } from "zod";

export const whisperStatusEnum = z.enum([
  "Available",
  "Not configured",
  "Model unavailable",
  "Unavailable",
  "Invalid configuration",
]);
export type WhisperStatus = z.infer<typeof whisperStatusEnum>;

export const kokoroStatusEnum = z.enum([
  "Available",
  "Not configured",
  "Model unavailable",
  "Unavailable",
  "Invalid configuration",
]);
export type KokoroStatus = z.infer<typeof kokoroStatusEnum>;

export const microphoneStatusEnum = z.enum([
  "Available",
  "Permission required",
  "Denied",
  "Unavailable",
]);
export type MicrophoneStatus = z.infer<typeof microphoneStatusEnum>;

export const speakerStatusEnum = z.enum(["Available", "Unavailable"]);
export type SpeakerStatus = z.infer<typeof speakerStatusEnum>;

export const voiceStatusSchema = z.object({
  status: z.enum(["Available", "Not configured", "Partial", "Unavailable"]),
  whisper: z.object({
    status: whisperStatusEnum,
    configured: z.boolean(),
    model: z.string().optional(),
    language: z.string().optional(),
    transport: z.enum(["http", "cli", "none"]),
  }),
  kokoro: z.object({
    status: kokoroStatusEnum,
    configured: z.boolean(),
    model: z.string().optional(),
    voice: z.string().optional(),
    speed: z.number().optional(),
  }),
  microphone: z.object({
    status: microphoneStatusEnum,
  }),
  speaker: z.object({
    status: speakerStatusEnum,
  }),
});
export type VoiceStatus = z.infer<typeof voiceStatusSchema>;

export const transcriptionResponseSchema = z.object({
  transcript: z.string(),
  isFinal: z.boolean(),
  durationMs: z.number().int().nonnegative().optional(),
});
export type TranscriptionResponse = z.infer<typeof transcriptionResponseSchema>;

export const synthesisRequestSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  voice: z.string().optional(),
  speed: z.number().min(0.25).max(4.0).optional(),
});
export type SynthesisRequest = z.infer<typeof synthesisRequestSchema>;

export const voiceEventTypeEnum = z.enum([
  "voice_session_started",
  "voice_session_stopped",
  "microphone_permission_granted",
  "microphone_permission_denied",
  "transcript_partial",
  "transcript_committed",
  "transcription_started",
  "transcription_completed",
  "tts_started",
  "tts_audio_started",
  "tts_completed",
  "tts_interrupted",
  "voice_failed",
]);
export type VoiceEventType = z.infer<typeof voiceEventTypeEnum>;

export const voiceEventSchema = z.object({
  id: z.string(),
  type: voiceEventTypeEnum,
  timestamp: z.string(),
  label: z.string(),
  detail: z.record(z.string(), z.unknown()).optional(),
});
export type VoiceEvent = z.infer<typeof voiceEventSchema>;
