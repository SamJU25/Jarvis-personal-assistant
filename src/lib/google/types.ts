import { z } from "zod";

// ==========================================
// Safe bounding limits
// ==========================================
export const MAX_QUERY_LENGTH = 500;
export const MAX_ID_LENGTH = 200;
export const MAX_RESULTS_LIMIT = 50;
export const MAX_BODY_CONTENT_LENGTH = 40_000;
export const MAX_DESCRIPTION_LENGTH = 5_000;
export const MAX_SNIPPET_LENGTH = 1_000;

// ==========================================
// 1. search_gmail
// ==========================================
export const searchGmailInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Query cannot be empty")
    .max(MAX_QUERY_LENGTH, `Query exceeds ${MAX_QUERY_LENGTH} characters`),
  limit: z.coerce.number().int().min(1).max(MAX_RESULTS_LIMIT).default(10).optional(),
});

export const gmailMessageSummarySchema = z.object({
  id: z.string(),
  senderName: z.string(),
  senderEmail: z.string(),
  subject: z.string(),
  snippet: z.string(),
  timestamp: z.string(),
  labels: z.array(z.string()),
  hasAttachments: z.boolean(),
});

export const searchGmailOutputSchema = z.object({
  query: z.string(),
  total: z.number().int().nonnegative(),
  messages: z.array(gmailMessageSummarySchema),
});

// ==========================================
// 2. read_gmail
// ==========================================
export const readGmailInputSchema = z.object({
  messageId: z
    .string()
    .trim()
    .min(1, "Message ID cannot be empty")
    .max(MAX_ID_LENGTH, `Message ID exceeds ${MAX_ID_LENGTH} characters`),
});

export const emailAttachmentSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
});

export const readGmailOutputSchema = z.object({
  id: z.string(),
  sender: z.string(),
  recipients: z.array(z.string()),
  subject: z.string(),
  timestamp: z.string(),
  body: z.string(),
  truncated: z.boolean().optional(),
  attachments: z.array(emailAttachmentSchema),
});

// ==========================================
// 3. get_calendar_events
// ==========================================
export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  attendees: z.array(z.string()),
  location: z.string(),
  description: z.string(),
});

export const getCalendarEventsInputSchema = z
  .object({
    start: z
      .string()
      .trim()
      .min(1, "Start date is required")
      .refine(
        (val) => !isNaN(Date.parse(val)),
        "Start date must be a valid ISO 8601 or date string (e.g. '2026-09-20' or '2026-09-20T00:00:00Z')"
      ),
    end: z
      .string()
      .trim()
      .min(1, "End date is required")
      .refine(
        (val) => !isNaN(Date.parse(val)),
        "End date must be a valid ISO 8601 or date string (e.g. '2026-09-20' or '2026-09-20T23:59:59Z')"
      ),
    query: z.string().trim().max(MAX_QUERY_LENGTH).optional(),
  })
  .refine((data) => new Date(data.start).getTime() <= new Date(data.end).getTime(), {
    message: "Start date must be before or equal to end date",
    path: ["end"],
  });

export const getCalendarEventsOutputSchema = z.object({
  start: z.string(),
  end: z.string(),
  total: z.number().int().nonnegative(),
  events: z.array(calendarEventSchema),
});

// ==========================================
// 4. search_drive
// ==========================================
export const searchDriveInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Search query cannot be empty")
    .max(MAX_QUERY_LENGTH, `Query exceeds ${MAX_QUERY_LENGTH} characters`),
  limit: z.coerce.number().int().min(1).max(MAX_RESULTS_LIMIT).default(10).optional(),
});

export const driveFileSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  modifiedAt: z.string(),
  owner: z.string(),
  webLink: z.string(),
});

export const searchDriveOutputSchema = z.object({
  query: z.string(),
  total: z.number().int().nonnegative(),
  files: z.array(driveFileSummarySchema),
});

// ==========================================
// 5. read_drive_file
// ==========================================
export const readDriveFileInputSchema = z.object({
  fileId: z
    .string()
    .trim()
    .min(1, "File ID cannot be empty")
    .max(MAX_ID_LENGTH, `File ID exceeds ${MAX_ID_LENGTH} characters`),
});

export const readDriveFileOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  content: z.string(),
  truncated: z.boolean().optional(),
  modifiedAt: z.string(),
});

// ==========================================
// 6. create_google_doc (Phase 9 Write Action)
// ==========================================
export const createGoogleDocInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Document title cannot be empty")
    .max(300, "Title exceeds 300 characters"),
  content: z
    .string()
    .min(1, "Document content cannot be empty")
    .max(100_000, "Content exceeds 100,000 characters"),
});

export const createGoogleDocOutputSchema = z.object({
  documentId: z.string(),
  title: z.string(),
  webLink: z.string().optional(),
  createdAt: z.string(),
});

// ==========================================
// 7. draft_email (Phase 9 Write Action - Draft Only, NEVER Send)
// ==========================================
export const draftEmailInputSchema = z.object({
  to: z
    .string()
    .trim()
    .min(1, "Recipient email ('to') cannot be empty")
    .max(500, "Recipient exceeds 500 characters"),
  subject: z
    .string()
    .trim()
    .min(1, "Subject cannot be empty")
    .max(300, "Subject exceeds 300 characters"),
  body: z
    .string()
    .min(1, "Email body cannot be empty")
    .max(40_000, "Body exceeds 40,000 characters"),
  replyToMessageId: z.string().trim().max(MAX_ID_LENGTH).optional(),
});

export const draftEmailOutputSchema = z.object({
  draftId: z.string(),
  to: z.string(),
  subject: z.string(),
  snippet: z.string(),
  createdAt: z.string(),
});

// Inferred TypeScript types
export type SearchGmailInput = z.infer<typeof searchGmailInputSchema>;
export type SearchGmailOutput = z.infer<typeof searchGmailOutputSchema>;

export type ReadGmailInput = z.infer<typeof readGmailInputSchema>;
export type ReadGmailOutput = z.infer<typeof readGmailOutputSchema>;

export type GetCalendarEventsInput = z.infer<typeof getCalendarEventsInputSchema>;
export type GetCalendarEventsOutput = z.infer<typeof getCalendarEventsOutputSchema>;

export type SearchDriveInput = z.infer<typeof searchDriveInputSchema>;
export type SearchDriveOutput = z.infer<typeof searchDriveOutputSchema>;

export type ReadDriveFileInput = z.infer<typeof readDriveFileInputSchema>;
export type ReadDriveFileOutput = z.infer<typeof readDriveFileOutputSchema>;

export type CreateGoogleDocInput = z.infer<typeof createGoogleDocInputSchema>;
export type CreateGoogleDocOutput = z.infer<typeof createGoogleDocOutputSchema>;

export type DraftEmailInput = z.infer<typeof draftEmailInputSchema>;
export type DraftEmailOutput = z.infer<typeof draftEmailOutputSchema>;

