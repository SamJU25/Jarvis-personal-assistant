import {
  MAX_BODY_CONTENT_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_SNIPPET_LENGTH,
  type SearchGmailOutput,
  type ReadGmailOutput,
  type GetCalendarEventsOutput,
  type SearchDriveOutput,
  type ReadDriveFileOutput,
} from "./types";
import { GoogleApiError } from "./client";

/**
 * Truncates text safely if it exceeds maxLength, appending an explicit truncation notice.
 */
export function truncateContent(
  text: string,
  maxLength: number
): { text: string; truncated: boolean } {
  if (!text || text.length <= maxLength) {
    return { text: text || "", truncated: false };
  }
  const truncated = text.slice(0, maxLength).trimEnd() + "\n\n[Content truncated...]";
  return { text: truncated, truncated: true };
}

/**
 * Parses sender header "Name <email@domain.com>" or "email@domain.com".
 */
export function parseSender(fromHeader: string): { senderName: string; senderEmail: string } {
  if (!fromHeader) return { senderName: "Unknown", senderEmail: "" };
  const match = fromHeader.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    const name = match[1].replace(/^["']|["']$/g, "").trim();
    return { senderName: name || match[2].trim(), senderEmail: match[2].trim() };
  }
  return { senderName: fromHeader.trim(), senderEmail: fromHeader.trim() };
}

/**
 * Recursively extracts plain text body from a Gmail message payload.
 */
function extractBodyFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const p = payload as {
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  };

  // If this part contains body data in text/plain
  if (p.body?.data && (!p.mimeType || p.mimeType.startsWith("text/plain"))) {
    try {
      return Buffer.from(p.body.data, "base64url").toString("utf8");
    } catch {
      // fallback
    }
  }

  // If text/html and no plain text was found yet
  if (p.body?.data && p.mimeType?.startsWith("text/html")) {
    try {
      const html = Buffer.from(p.body.data, "base64url").toString("utf8");
      // Basic HTML tag stripping
      return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      // fallback
    }
  }

  // Recurse into multipart children
  if (Array.isArray(p.parts)) {
    // Prefer text/plain part first
    for (const part of p.parts) {
      const mime = (part as { mimeType?: string }).mimeType;
      if (mime === "text/plain") {
        const text = extractBodyFromPayload(part);
        if (text) return text;
      }
    }
    // Otherwise return first text extracted
    for (const part of p.parts) {
      const text = extractBodyFromPayload(part);
      if (text) return text;
    }
  }

  return "";
}

/**
 * Extracts attachments from Gmail payload parts.
 */
function extractAttachments(payload: unknown): Array<{
  filename: string;
  mimeType: string;
  sizeBytes: number;
}> {
  const attachments: Array<{ filename: string; mimeType: string; sizeBytes: number }> = [];
  if (!payload || typeof payload !== "object") return attachments;

  function visit(part: unknown) {
    if (!part || typeof part !== "object") return;
    const p = part as {
      filename?: string;
      mimeType?: string;
      body?: { size?: number; attachmentId?: string };
      parts?: unknown[];
    };
    if (p.filename && p.filename.trim().length > 0) {
      attachments.push({
        filename: p.filename.trim(),
        mimeType: p.mimeType || "application/octet-stream",
        sizeBytes: p.body?.size ?? 0,
      });
    }
    if (Array.isArray(p.parts)) {
      p.parts.forEach(visit);
    }
  }

  visit(payload);
  return attachments;
}

/**
 * Normalizes GWS Gmail search response.
 */
export function normalizeGmailSearch(raw: unknown, query: string): SearchGmailOutput {
  if (!raw || typeof raw !== "object") {
    return { query, total: 0, messages: [] };
  }

  const obj = raw as {
    messages?: Array<{
      id?: string;
      snippet?: string;
      internalDate?: string;
      labelIds?: string[];
      payload?: {
        headers?: Array<{ name?: string; value?: string }>;
        parts?: unknown[];
      };
    }>;
    resultSizeEstimate?: number;
  };

  if (!Array.isArray(obj.messages) || obj.messages.length === 0) {
    return { query, total: 0, messages: [] };
  }

  const messages = obj.messages.map((m) => {
    const id = m.id || "unknown";
    const headers = m.payload?.headers || [];
    const fromHdr = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
    const subjectHdr = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "(No subject)";
    const dateHdr = headers.find((h) => h.name?.toLowerCase() === "date")?.value;

    const { senderName, senderEmail } = parseSender(fromHdr);

    let timestamp = "";
    if (m.internalDate) {
      try {
        timestamp = new Date(parseInt(m.internalDate, 10)).toISOString();
      } catch {
        timestamp = dateHdr || "";
      }
    } else if (dateHdr) {
      try {
        timestamp = new Date(dateHdr).toISOString();
      } catch {
        timestamp = dateHdr;
      }
    }

    const { text: snippet } = truncateContent(m.snippet || "", MAX_SNIPPET_LENGTH);

    const attachments = extractAttachments(m.payload);

    return {
      id,
      senderName,
      senderEmail,
      subject: subjectHdr.slice(0, 200),
      snippet,
      timestamp,
      labels: Array.isArray(m.labelIds) ? m.labelIds : [],
      hasAttachments: attachments.length > 0,
    };
  });

  return {
    query,
    total: messages.length,
    messages,
  };
}

/**
 * Normalizes a single GWS Gmail message get response.
 */
export function normalizeGmailMessage(raw: unknown, messageId: string): ReadGmailOutput {
  if (!raw || typeof raw !== "object") {
    throw new GoogleApiError("not_found", `Message "${messageId}" was not found.`);
  }

  const m = raw as {
    id?: string;
    snippet?: string;
    internalDate?: string;
    payload?: {
      headers?: Array<{ name?: string; value?: string }>;
      body?: { data?: string };
      parts?: unknown[];
    };
  };

  const id = m.id || messageId;
  const headers = m.payload?.headers || [];
  const fromHdr = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "Unknown";
  const toHdr = headers.find((h) => h.name?.toLowerCase() === "to")?.value || "";
  const ccHdr = headers.find((h) => h.name?.toLowerCase() === "cc")?.value || "";
  const subjectHdr = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "(No subject)";
  const dateHdr = headers.find((h) => h.name?.toLowerCase() === "date")?.value;

  const recipients: string[] = [];
  if (toHdr) recipients.push(...toHdr.split(",").map((s) => s.trim()).filter(Boolean));
  if (ccHdr) recipients.push(...ccHdr.split(",").map((s) => s.trim()).filter(Boolean));

  let timestamp = "";
  if (m.internalDate) {
    try {
      timestamp = new Date(parseInt(m.internalDate, 10)).toISOString();
    } catch {
      timestamp = dateHdr || "";
    }
  } else if (dateHdr) {
    try {
      timestamp = new Date(dateHdr).toISOString();
    } catch {
      timestamp = dateHdr;
    }
  }

  let rawBody = extractBodyFromPayload(m.payload);
  if (!rawBody && m.snippet) {
    rawBody = m.snippet;
  }

  const { text: body, truncated } = truncateContent(rawBody, MAX_BODY_CONTENT_LENGTH);
  const attachments = extractAttachments(m.payload);

  return {
    id,
    sender: fromHdr,
    recipients,
    subject: subjectHdr.slice(0, 200),
    timestamp,
    body,
    truncated: truncated ? true : undefined,
    attachments,
  };
}

/**
 * Normalizes GWS Calendar events list response.
 */
export function normalizeCalendarEvents(
  raw: unknown,
  start: string,
  end: string
): GetCalendarEventsOutput {
  if (!raw || typeof raw !== "object") {
    return { start, end, total: 0, events: [] };
  }

  const obj = raw as {
    items?: Array<{
      id?: string;
      summary?: string;
      description?: string;
      location?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      attendees?: Array<{ displayName?: string; email?: string }>;
    }>;
  };

  if (!Array.isArray(obj.items) || obj.items.length === 0) {
    return { start, end, total: 0, events: [] };
  }

  const events = obj.items.map((item, idx) => {
    const id = item.id || `event-${idx}`;
    const title = item.summary || "(Untitled event)";
    const itemStart = item.start?.dateTime || item.start?.date || start;
    const itemEnd = item.end?.dateTime || item.end?.date || end;
    const location = item.location || "";
    const attendees = (item.attendees || [])
      .map((a) => a.displayName || a.email || "")
      .filter(Boolean);

    const { text: description } = truncateContent(item.description || "", MAX_DESCRIPTION_LENGTH);

    return {
      id,
      title: title.slice(0, 200),
      start: itemStart,
      end: itemEnd,
      attendees,
      location: location.slice(0, 200),
      description,
    };
  });

  return {
    start,
    end,
    total: events.length,
    events,
  };
}

/**
 * Converts mimeTypes to human-friendly format descriptions.
 */
function friendlyDriveType(mimeType?: string): string {
  if (!mimeType) return "file";
  if (mimeType.includes("document")) return "Google Doc";
  if (mimeType.includes("spreadsheet")) return "Google Sheet";
  if (mimeType.includes("presentation")) return "Google Slides";
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.startsWith("text/markdown")) return "Markdown";
  if (mimeType.startsWith("text/plain")) return "Text";
  if (mimeType.startsWith("text/csv")) return "CSV";
  if (mimeType.includes("folder")) return "Folder";
  return mimeType;
}

/**
 * Normalizes GWS Drive files list search response.
 */
export function normalizeDriveSearch(raw: unknown, query: string): SearchDriveOutput {
  if (!raw || typeof raw !== "object") {
    return { query, total: 0, files: [] };
  }

  const obj = raw as {
    files?: Array<{
      id?: string;
      name?: string;
      mimeType?: string;
      modifiedTime?: string;
      webViewLink?: string;
      owners?: Array<{ displayName?: string; emailAddress?: string }>;
    }>;
  };

  if (!Array.isArray(obj.files) || obj.files.length === 0) {
    return { query, total: 0, files: [] };
  }

  const files = obj.files.map((f, idx) => {
    const id = f.id || `file-${idx}`;
    const name = f.name || "(Untitled document)";
    const type = friendlyDriveType(f.mimeType);
    const modifiedAt = f.modifiedTime || "";
    const owner = f.owners?.[0]?.displayName || f.owners?.[0]?.emailAddress || "Unknown";
    const webLink = f.webViewLink || "";

    return {
      id,
      name: name.slice(0, 200),
      type,
      modifiedAt,
      owner,
      webLink,
    };
  });

  return {
    query,
    total: files.length,
    files,
  };
}

const SUPPORTED_TEXT_MIMES = [
  "application/vnd.google-apps.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/xml",
];

const UNSUPPORTED_BINARY_PATTERNS = [
  "image/",
  "video/",
  "audio/",
  "application/zip",
  "application/x-zip",
  "application/octet-stream",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats",
  "application/x-tar",
  "application/x-rar",
  "application/pdf", // reading raw binary PDF directly without OCR is unsupported
];

/**
 * Validates whether a file format is supported for text reading.
 */
export function isSupportedTextFormat(mimeType: string): boolean {
  const lower = (mimeType || "").toLowerCase();
  if (SUPPORTED_TEXT_MIMES.some((m) => lower.startsWith(m))) return true;
  if (UNSUPPORTED_BINARY_PATTERNS.some((p) => lower.startsWith(p))) return false;
  // If it starts with text/, consider supported
  return lower.startsWith("text/");
}

/**
 * Normalizes Drive file content read response.
 */
export function normalizeDriveFile(
  fileId: string,
  rawContent: string,
  metadata?: { name?: string; mimeType?: string; modifiedTime?: string }
): ReadDriveFileOutput {
  const name = metadata?.name || "Document";
  const mimeType = metadata?.mimeType || "text/plain";
  const modifiedAt = metadata?.modifiedTime || new Date().toISOString();

  if (metadata?.mimeType && !isSupportedTextFormat(metadata.mimeType)) {
    throw new GoogleApiError(
      "unsupported_format",
      `Drive file format "${metadata.mimeType}" is not supported for text reading. Only text and Google Docs can be read.`
    );
  }

  const { text: content, truncated } = truncateContent(rawContent, MAX_BODY_CONTENT_LENGTH);

  return {
    id: fileId,
    name: name.slice(0, 200),
    mimeType,
    content,
    truncated: truncated ? true : undefined,
    modifiedAt,
  };
}
