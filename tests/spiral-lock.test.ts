import { describe, expect, it } from "vitest";

import { createEmptyStore } from "../lib/holdoff-storage";
import { shouldTriggerSpiralLock } from "../lib/spiral-lock";

describe("Spiral Lock decision boundary", () => {
  it("does not trigger until a person explicitly enables it", () => {
    const settings = createEmptyStore().smsClient.spiralLock;
    expect(shouldTriggerSpiralLock(settings, { allCapsWords: 4, repeatedPunctuation: true, typingBurstSeconds: 90, recentSameRecipientDrafts: 0 })).toBe(false);
  });

  it("uses only the user-selected local cue settings after enablement", () => {
    const settings = { ...createEmptyStore().smsClient.spiralLock, enabled: true, triggerAllCaps: false, triggerRepeatedPunctuation: true, triggerRapidTyping: false };
    expect(shouldTriggerSpiralLock(settings, { allCapsWords: 4, repeatedPunctuation: false, typingBurstSeconds: 90, recentSameRecipientDrafts: 0 })).toBe(false);
    expect(shouldTriggerSpiralLock(settings, { allCapsWords: 0, repeatedPunctuation: true, typingBurstSeconds: 2, recentSameRecipientDrafts: 0 })).toBe(true);
  });
});
