import { z } from "zod";

export const MAX_CONVERSATION_MESSAGES = 12;
export const MAX_MESSAGE_LENGTH = 4_000;
export const MAX_CONTEXT_LENGTH = 16_000;

export const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export const conversationSchema = z.array(conversationMessageSchema).max(MAX_CONVERSATION_MESSAGES).superRefine((messages, context) => {
  const totalLength = messages.reduce((total, message) => total + message.content.length, 0);
  if (totalLength > MAX_CONTEXT_LENGTH) context.addIssue({ code: "custom", message: "Conversation context is too large." });
});

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
