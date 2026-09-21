import type { SkillDefinition } from "@/lib/contracts/skill";

/**
 * Normalizes a string by converting to lowercase and stripping punctuation.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?'"“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Selects an applicable skill for a user's message using semantic intent matching.
 * Returns null if the request is unrelated or does not clearly match any skill.
 */
export function selectSkill(message: string, skills: readonly SkillDefinition[]): SkillDefinition | null {
  const normalizedMsg = normalize(message);
  if (!normalizedMsg) return null;

  // 1. Direct match with trigger phrases defined in skill whenToUse
  for (const skill of skills) {
    for (const trigger of skill.whenToUse) {
      const normalizedTrigger = normalize(trigger);
      if (normalizedTrigger && normalizedMsg.includes(normalizedTrigger)) {
        return skill;
      }
    }
  }

  // 2. Semantic intent patterns for the 5 JARVIS core skills
  // capture-note
  if (
    /(?:take|capture|make|write down|record)\s+(?:a\s+|this\s+)?note/i.test(message) ||
    /write down that\s+/i.test(message) ||
    /put this in (?:my\s+)?(?:second brain|notes|vault)/i.test(message) ||
    /remember this\s+note/i.test(message)
  ) {
    const captureSkill = skills.find((s) => s.id === "capture-note");
    if (captureSkill) return captureSkill;
  }

  // meeting-prep
  if (
    /(?:prepare|prep|get ready)(?:\s+me)?\s+for\s+(?:my\s+|the\s+)?(?:next\s+|upcoming\s+)?meeting/i.test(message) ||
    /meeting\s+prep/i.test(message) ||
    /(?:prepare|prep|ready)\s+for\s+(?:my\s+|the\s+)?meeting\s+with/i.test(message) ||
    /what do i need for (?:my\s+|the\s+)?(?:upcoming\s+)?(?:meeting|sync)/i.test(message)
  ) {
    const meetingSkill = skills.find((s) => s.id === "meeting-prep");
    if (meetingSkill) return meetingSkill;
  }

  // morning-briefing
  if (
    /morning\s+briefing/i.test(message) ||
    /(?:give|show)\s+me\s+my\s+morning\s+briefing/i.test(message) ||
    /start\s+my\s+day/i.test(message) ||
    /what\s+does\s+my\s+day\s+look\s+like/i.test(message) ||
    /brief\s+me\s+on\s+today/i.test(message) ||
    /daily\s+briefing/i.test(message)
  ) {
    const briefingSkill = skills.find((s) => s.id === "morning-briefing");
    if (briefingSkill) return briefingSkill;
  }

  // loose-ends
  if (
    /what\s+am\s+i\s+forgetting/i.test(message) ||
    /loose\s+ends/i.test(message) ||
    /pending\s+follow-?ups?/i.test(message) ||
    /anything\s+unfinished/i.test(message) ||
    /check\s+for\s+loose\s+ends/i.test(message)
  ) {
    const looseEndsSkill = skills.find((s) => s.id === "loose-ends");
    if (looseEndsSkill) return looseEndsSkill;
  }

  // research
  if (
    /what\s+did\s+i\s+write(?:\s+down)?\s+about/i.test(message) ||
    /what\s+do\s+i\s+know\s+about/i.test(message) ||
    /find\s+everything\s+(?:i\s+have|we\s+have|i\s+know)\s+(?:on|about)/i.test(message) ||
    /search\s+(?:my\s+)?notes\s+for/i.test(message) ||
    /research\s+.+\s+in\s+(?:my\s+)?(?:vault|notes)/i.test(message) ||
    /what\s+(?:do\s+i|have\s+i)\s+(?:recorded|written|saved)\s+(?:about|on)/i.test(message)
  ) {
    const researchSkill = skills.find((s) => s.id === "research");
    if (researchSkill) return researchSkill;
  }

  return null;
}
