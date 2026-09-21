---
id: capture-note
name: Capture Note
description: Capture a user's thought into their second brain by preparing a note for storage.
whenToUse:
  - "Take a note"
  - "Remember this note"
  - "Put this in my second brain"
  - "Capture note"
  - "Write down that"
preferredTools:
  - create_note
---

# Purpose
Capture an idea, reminder, or insight from the user and prepare a clean Markdown note in the Obsidian vault. This is distinct from assistant persistent memory: notes represent user-owned long-form knowledge documents, whereas persistent memory stores compact assistant preferences and facts.

# Process
1. Extract the title and key content from the user's request.
2. Format the content into clean, structured Markdown.
3. Target destination folder `Inbox/JARVIS/`.
4. Propose calling `create_note` with `{ title, content, folder: "Inbox/JARVIS/" }`.
5. Permission boundary constraint: `create_note` has `write` permission. The application runtime intercepts this call and creates an explicit pending confirmation for human approval.
6. Present the drafted note content and prompt the user to confirm creation.
7. Never claim a note was written or created unless the tool execution status is `success` after user confirmation.

# Decision Rules
- Distinct from memory: If the user says "remember that I prefer concise answers" or asks to store an assistant preference, use persistent memory (`store_memory`), not `create_note`.
- Never bypass the write permission boundary; the application runtime strictly owns authorization.
- Do not invent a fake confirmation or claim the user already approved.
- Clearly present the prepared note content in the result cards so the user can verify what was captured.
- Report truthfully whether the note is pending confirmation, created, or cancelled.

# Expected Output
A spoken response explaining that the note was prepared and requires user confirmation, paired with a note card displaying the title, folder, and drafted body.
