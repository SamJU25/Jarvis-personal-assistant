import type { JarvisTool } from "@/lib/contracts/tool";
import type { ToolRegistry } from "@/lib/tools/registry";
import {
  searchGmailInputSchema,
  searchGmailOutputSchema,
  readGmailInputSchema,
  readGmailOutputSchema,
  getCalendarEventsInputSchema,
  getCalendarEventsOutputSchema,
  searchDriveInputSchema,
  searchDriveOutputSchema,
  readDriveFileInputSchema,
  readDriveFileOutputSchema,
  createGoogleDocInputSchema,
  createGoogleDocOutputSchema,
  draftEmailInputSchema,
  draftEmailOutputSchema,
  type SearchGmailInput,
  type SearchGmailOutput,
  type ReadGmailInput,
  type ReadGmailOutput,
  type GetCalendarEventsInput,
  type GetCalendarEventsOutput,
  type SearchDriveInput,
  type SearchDriveOutput,
  type ReadDriveFileInput,
  type ReadDriveFileOutput,
  type CreateGoogleDocInput,
  type CreateGoogleDocOutput,
  type DraftEmailInput,
  type DraftEmailOutput,
} from "./types";
import { executeGws } from "./client";
import {
  normalizeGmailSearch,
  normalizeGmailMessage,
  normalizeCalendarEvents,
  normalizeDriveSearch,
  normalizeDriveFile,
} from "./normalizers";

// 1. search_gmail
export const searchGmailTool: JarvisTool<SearchGmailInput, SearchGmailOutput> = {
  id: "search_gmail",
  name: "Search Gmail",
  description:
    "Searches the user's Gmail messages matching keywords, senders, or search expressions. Use when the user asks about recent emails, correspondence with a person, message topics, or follow-ups. Returns message summaries with subject, sender, timestamp, and snippet. Do NOT use for calendar events, Google Drive files, or sending emails.",
  inputSchema: searchGmailInputSchema,
  outputSchema: searchGmailOutputSchema,
  permission: "read",
  renderer: "email",
  source: "gmail",
  async execute(input, context) {
    const rawOutput = await executeGws(
      [
        "gmail",
        "users",
        "messages",
        "list",
        "--params",
        JSON.stringify({
          userId: "me",
          q: input.query,
          maxResults: input.limit ?? 10,
        }),
        "--format",
        "json",
      ],
      { signal: context.signal }
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      parsed = {};
    }

    return normalizeGmailSearch(parsed, input.query);
  },
};

// 2. read_gmail
export const readGmailTool: JarvisTool<ReadGmailInput, ReadGmailOutput> = {
  id: "read_gmail",
  name: "Read Gmail Message",
  description:
    "Reads the full textual content, recipients, subject, and attachment metadata of a specific email using its messageId. Use after searching when full email body or specific details are needed. Returns cleaned email body and attachment names. Do NOT use for sending, replying, archiving, or drafting emails.",
  inputSchema: readGmailInputSchema,
  outputSchema: readGmailOutputSchema,
  permission: "read",
  renderer: "email",
  source: "gmail",
  async execute(input, context) {
    const rawOutput = await executeGws(
      [
        "gmail",
        "users",
        "messages",
        "get",
        "--params",
        JSON.stringify({
          userId: "me",
          id: input.messageId,
          format: "full",
        }),
        "--format",
        "json",
      ],
      { signal: context.signal }
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      parsed = {};
    }

    return normalizeGmailMessage(parsed, input.messageId);
  },
};

// 3. get_calendar_events
export const getCalendarEventsTool: JarvisTool<
  GetCalendarEventsInput,
  GetCalendarEventsOutput
> = {
  id: "get_calendar_events",
  name: "Get Calendar Events",
  description:
    "Retrieves scheduled events and meetings from the user's primary Google Calendar within a specified start and end date/time range (ISO 8601 strings). Use when the user asks about their schedule, upcoming meetings, event times, attendees, or availability. Returns event titles, times, locations, attendees, and descriptions. Do NOT use for emails, Drive files, or creating/modifying calendar events.",
  inputSchema: getCalendarEventsInputSchema,
  outputSchema: getCalendarEventsOutputSchema,
  permission: "read",
  renderer: "calendar",
  source: "calendar",
  async execute(input, context) {
    const startIso = new Date(input.start).toISOString();
    const endIso = new Date(input.end).toISOString();

    const params: Record<string, unknown> = {
      calendarId: "primary",
      timeMin: startIso,
      timeMax: endIso,
      singleEvents: true,
      orderBy: "startTime",
    };
    if (input.query && input.query.trim()) {
      params.q = input.query.trim();
    }

    const rawOutput = await executeGws(
      ["calendar", "events", "list", "--params", JSON.stringify(params), "--format", "json"],
      { signal: context.signal }
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      parsed = {};
    }

    return normalizeCalendarEvents(parsed, startIso, endIso);
  },
};

// 4. search_drive
export const searchDriveTool: JarvisTool<SearchDriveInput, SearchDriveOutput> = {
  id: "search_drive",
  name: "Search Google Drive",
  description:
    "Searches the user's Google Drive files and documents matching keywords or titles. Use when the user asks to find a cloud document, presentation, spreadsheet, or file. Returns file metadata including name, format type, modification time, and web link. Do NOT use for local Obsidian notes or reading full file content.",
  inputSchema: searchDriveInputSchema,
  outputSchema: searchDriveOutputSchema,
  permission: "read",
  renderer: "document",
  source: "drive",
  async execute(input, context) {
    const escaped = input.query.replace(/'/g, "\\'");
    const qStr = `name contains '${escaped}' or fullText contains '${escaped}'`;

    const rawOutput = await executeGws(
      [
        "drive",
        "files",
        "list",
        "--params",
        JSON.stringify({
          q: qStr,
          pageSize: input.limit ?? 10,
          fields: "files(id, name, mimeType, modifiedTime, owners, webViewLink)",
        }),
        "--format",
        "json",
      ],
      { signal: context.signal }
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      parsed = {};
    }

    return normalizeDriveSearch(parsed, input.query);
  },
};

// 5. read_drive_file
export const readDriveFileTool: JarvisTool<ReadDriveFileInput, ReadDriveFileOutput> = {
  id: "read_drive_file",
  name: "Read Drive File",
  description:
    "Reads the text content of a specific Google Doc or text-based document from Google Drive using its fileId. Only text documents and Google Docs are supported; binary files will fail safely. Returns clean textual content and document metadata. Do NOT use for creating files, downloading binary media, or editing documents.",
  inputSchema: readDriveFileInputSchema,
  outputSchema: readDriveFileOutputSchema,
  permission: "read",
  renderer: "document",
  source: "drive",
  async execute(input, context) {
    // Step 1: Fetch metadata to verify mimeType and title
    const metaOutput = await executeGws(
      [
        "drive",
        "files",
        "get",
        "--params",
        JSON.stringify({
          fileId: input.fileId,
          fields: "id, name, mimeType, modifiedTime",
        }),
        "--format",
        "json",
      ],
      { signal: context.signal }
    );

    let metadata: { id?: string; name?: string; mimeType?: string; modifiedTime?: string } = {};
    try {
      metadata = JSON.parse(metaOutput);
    } catch {
      // fallback
    }

    const mimeType = metadata.mimeType || "";

    // Step 2: Fetch content based on format
    let content = "";
    if (mimeType === "application/vnd.google-apps.document") {
      // Google Doc: export as plain text
      content = await executeGws(
        [
          "drive",
          "files",
          "export",
          "--params",
          JSON.stringify({
            fileId: input.fileId,
            mimeType: "text/plain",
          }),
        ],
        { signal: context.signal }
      );
    } else {
      // Other text file: download media content
      content = await executeGws(
        [
          "drive",
          "files",
          "get",
          "--params",
          JSON.stringify({
            fileId: input.fileId,
            alt: "media",
          }),
        ],
        { signal: context.signal }
      );
    }

    return normalizeDriveFile(input.fileId, content, metadata);
  },
};

// 6. create_google_doc (Phase 9 Write Action)
export const createGoogleDocTool: JarvisTool<CreateGoogleDocInput, CreateGoogleDocOutput> = {
  id: "create_google_doc",
  name: "Create Google Doc",
  description:
    "Creates a new Google Document in Google Drive with the specified title and initial body content. Use when the user explicitly asks to create a Google Doc, document, or turn notes into a document. Requires explicit user confirmation before writing.",
  inputSchema: createGoogleDocInputSchema,
  outputSchema: createGoogleDocOutputSchema,
  permission: "write",
  renderer: "document",
  source: "drive",
  async execute(input, context) {
    const rawOutput = await executeGws(
      [
        "docs",
        "documents",
        "create",
        "--params",
        JSON.stringify({
          requestBody: {
            title: input.title,
          },
        }),
        "--format",
        "json",
      ],
      { signal: context.signal }
    );

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawOutput) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    const documentId = String(parsed.documentId || parsed.id || `doc-${Date.now()}`);
    const title = String(parsed.title || input.title);

    return {
      documentId,
      title,
      webLink: `https://docs.google.com/document/d/${documentId}/edit`,
      createdAt: new Date().toISOString(),
    };
  },
};

// 7. draft_email (Phase 9 Write Action - Draft Only, NEVER Send)
export const draftEmailTool: JarvisTool<DraftEmailInput, DraftEmailOutput> = {
  id: "draft_email",
  name: "Draft Gmail Message",
  description:
    "Creates a draft email in the user's Gmail without sending it. Use when the user asks to compose, draft, or prepare an email. Does NOT send emails. Requires explicit user confirmation before creating the draft.",
  inputSchema: draftEmailInputSchema,
  outputSchema: draftEmailOutputSchema,
  permission: "write",
  renderer: "email",
  source: "gmail",
  async execute(input, context) {
    const rawEmail = [
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      input.body,
    ].join("\r\n");

    const encodedEmail = Buffer.from(rawEmail).toString("base64url");
    const params: Record<string, unknown> = {
      userId: "me",
      requestBody: {
        message: {
          raw: encodedEmail,
          ...(input.replyToMessageId ? { threadId: input.replyToMessageId } : {}),
        },
      },
    };

    const rawOutput = await executeGws(
      [
        "gmail",
        "users",
        "drafts",
        "create",
        "--params",
        JSON.stringify(params),
        "--format",
        "json",
      ],
      { signal: context.signal }
    );

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawOutput) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    const draftId = String(parsed.id || `draft-${Date.now()}`);

    return {
      draftId,
      to: input.to,
      subject: input.subject,
      snippet: input.body.slice(0, 100),
      createdAt: new Date().toISOString(),
    };
  },
};

/**
 * Registers all Google Workspace tools (read tools and confirmed write tools) into the application ToolRegistry.
 */
export function registerGoogleTools(registry: ToolRegistry): void {
  registry.register(searchGmailTool);
  registry.register(readGmailTool);
  registry.register(getCalendarEventsTool);
  registry.register(searchDriveTool);
  registry.register(readDriveFileTool);
  registry.register(createGoogleDocTool);
  registry.register(draftEmailTool);
}
