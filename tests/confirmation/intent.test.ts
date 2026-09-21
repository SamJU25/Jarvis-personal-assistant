import { describe, expect, it } from "vitest";
import {
  isAffirmativeConfirmation,
  isNegativeConfirmation,
} from "@/lib/confirmation/intent";

describe("Phase 9: Confirmation Intent Recognition", () => {
  it("identifies explicit affirmative confirmation utterances", () => {
    const affirmatives = [
      "Yes",
      "yes",
      "Confirm",
      "confirm",
      "Yes, please",
      "Yes, create it",
      "create it",
      "Create Note",
      "Create Document",
      "Create Doc",
      "Save it",
      "Go ahead",
      "proceed",
      "Do it",
      "Approve",
      "Sure",
      "Looks good",
    ];

    for (const phrase of affirmatives) {
      expect(isAffirmativeConfirmation(phrase)).toBe(true);
      expect(isNegativeConfirmation(phrase)).toBe(false);
    }
  });

  it("identifies explicit negative confirmation / cancellation utterances", () => {
    const negatives = [
      "No",
      "no",
      "Cancel",
      "cancel",
      "Don't create it",
      "Stop",
      "Abort",
      "Reject",
      "Never mind",
      "No thanks",
    ];

    for (const phrase of negatives) {
      expect(isNegativeConfirmation(phrase)).toBe(true);
      expect(isAffirmativeConfirmation(phrase)).toBe(false);
    }
  });

  it("treats ambiguous utterances as neither affirmative nor negative", () => {
    const ambiguous = [
      "What do you think?",
      "Can you check the calendar?",
      "Tell me more about it",
      "Maybe later",
      "What's in the note?",
      "Wait a second",
      "Who sent that?",
    ];

    for (const phrase of ambiguous) {
      expect(isAffirmativeConfirmation(phrase)).toBe(false);
      expect(isNegativeConfirmation(phrase)).toBe(false);
    }
  });
});
