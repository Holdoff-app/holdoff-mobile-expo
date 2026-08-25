import { describe, expect, it } from "vitest";

import { createEmptyStore } from "../lib/holdoff-storage";
import { deriveWritingCues, getDraftCues, statusLabel, timeWindowLabel } from "../lib/holdoff-utils";
import type { Draft } from "../lib/holdoff-types";

describe("HoldOff local safety primitives", () => {
  it("surfaces transparent writing cues without interpreting the user’s intent", () => {
    const cues = deriveWritingCues("I AM NOT OKAY!!!", 61.4, 3);
    expect(cues.allCapsWords).toBe(2);
    expect(cues.repeatedPunctuation).toBe(true);
    expect(cues.typingBurstSeconds).toBe(61);
    expect(cues.recentSameRecipientDrafts).toBe(3);
  });

  it("counts drafts for the selected person without using contact data", () => {
    const drafts: Draft[] = [
      { id: "one", recipient: "Ari", body: "First", status: "HELD", createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z", cues: deriveWritingCues("First", 0, 0) },
      { id: "two", recipient: "ari", body: "Second", status: "SAVED", createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z", cues: deriveWritingCues("Second", 0, 0) },
    ];
    expect(getDraftCues(drafts, "ARI")).toBe(2);
    expect(getDraftCues(drafts, "Morgan")).toBe(0);
  });

  it("starts local-only with no implied consent or history", () => {
    const store = createEmptyStore();
    expect(store.version).toBe(1);
    expect(store.onboarding.completed).toBe(false);
    expect(store.onboarding.analysisConsent).toBe(false);
    expect(store.drafts).toEqual([]);
    expect(store.moodEvents).toEqual([]);
  });

  it("keeps the user’s final draft states explicit", () => {
    expect(statusLabel("READY_TO_SEND")).toBe("Ready to send");
    expect(statusLabel("SENT")).toBe("Sent");
    expect(statusLabel("DISCARDED")).toBe("Discarded");
  });

  it("classifies time windows from an actual saved timestamp", () => {
    expect(timeWindowLabel("2026-01-01T02:00:00.000Z")).toBe("Late night");
  });
});
