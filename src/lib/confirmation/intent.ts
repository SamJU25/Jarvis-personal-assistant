/**
 * Intent evaluation for user confirmation of pending write actions.
 * Strictly distinguishes explicit affirmative / negative approval
 * from ambiguous or unrelated conversational input.
 */

const AFFIRMATIVE_REGEXES: RegExp[] = [
  /^yes\b/i,
  /^confirm\b/i,
  /^yes[,.\s]+(?:please|create|save|do it|go ahead|proceed)\b/i,
  /^create(?: it| note| doc| document| draft)?\b/i,
  /^save(?: it| note)?\b/i,
  /^go ahead\b/i,
  /^proceed\b/i,
  /^do it\b/i,
  /^approve\b/i,
  /^looks good\b/i,
  /^sure\b/i,
];

const NEGATIVE_REGEXES: RegExp[] = [
  /^no\b/i,
  /^cancel\b/i,
  /^don'?t\b/i,
  /^stop\b/i,
  /^abort\b/i,
  /^reject\b/i,
  /^never\s*mind\b/i,
  /^no[,.\s]+(?:thanks|don'?t|cancel)\b/i,
];

export function isAffirmativeConfirmation(utterance: string): boolean {
  const trimmed = utterance.trim().toLowerCase().replace(/[!?]/g, "");
  if (!trimmed) return false;
  return AFFIRMATIVE_REGEXES.some((regex) => regex.test(trimmed));
}

export function isNegativeConfirmation(utterance: string): boolean {
  const trimmed = utterance.trim().toLowerCase().replace(/[!?]/g, "");
  if (!trimmed) return false;
  return NEGATIVE_REGEXES.some((regex) => regex.test(trimmed));
}
