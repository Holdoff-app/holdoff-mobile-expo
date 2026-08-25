import { describe, expect, it } from "vitest";

import { buildConversationAnalysisScope } from "../lib/conversation-analysis";
import { detectEmotionalSpiralCues } from "../lib/spiral-lock";

const settings = {
  enabled: false,
  emotionalCueCheckEnabled: true,
  triggerAllCaps: true,
  triggerRepeatedPunctuation: true,
  triggerRapidTyping: true,
  trustedContactSupport: { enabled: false, acknowledged: false, contactName: "", phone: "", message: "", cancellationSeconds: 15 },
};

describe("transparent cue and history-analysis scope helpers", () => {
  it("returns observable local writing cues only when the user enables the cue check", () => {
    const cues = detectEmotionalSpiralCues(settings, "I CAN'T do this!!! It always happens right now", { allCapsWords: 1, repeatedPunctuation: true, typingBurstSeconds: 56, recentSameRecipientDrafts: 0 });
    expect(cues.map((cue) => cue.code)).toEqual(expect.arrayContaining(["repeated_punctuation", "absolute_language", "urgent_language", "rapid_typing"]));
    expect(detectEmotionalSpiralCues({ ...settings, emotionalCueCheckEnabled: false }, "I CAN'T do this!!!", { allCapsWords: 1, repeatedPunctuation: true, typingBurstSeconds: 56, recentSameRecipientDrafts: 0 })).toEqual([]);
  });

  it("keeps the newest local conversation messages within the disclosed analysis scope", () => {
    const scope = buildConversationAnalysisScope([
      { id: "1", conversationId: "a", body: "older", direction: "inbound", status: "received", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "2", conversationId: "a", body: "newer", direction: "outbound", status: "sent", createdAt: "2026-01-02T00:00:00.000Z" },
    ]);
    expect(scope.includedMessageCount).toBe(2);
    expect(scope.truncated).toBe(false);
    expect(scope.messages[1].body).toBe("newer");
  });
});
