import { describe, expect, it } from "vitest";

import { buildConversationDeepLink, getConversationAddressFromDeepLink } from "../lib/notification-deep-link";

describe("incoming notification conversation links", () => {
  it("encodes a phone address into the exact conversation route", () => {
    expect(buildConversationDeepLink("holdoff", "+1 (415) 555-0100")).toBe("holdoff:///conversation/%2B1%20(415)%20555-0100");
  });

  it("recovers the original phone address without accepting unrelated routes", () => {
    expect(getConversationAddressFromDeepLink("holdoff:///conversation/%2B14155550100")).toBe("+14155550100");
    expect(getConversationAddressFromDeepLink("holdoff:///settings")).toBeNull();
  });
});
