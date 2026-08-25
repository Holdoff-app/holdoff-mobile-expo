import { describe, expect, it } from "vitest";

import { resolveContactNamesByAddress } from "../lib/contact-resolution";
import { filterConversations, splitSearchMatch } from "../lib/conversation-search";

const conversations = [
  { id: "sms-conversation:+14155550100", address: "+1 (415) 555-0100", displayName: "Rae", updatedAt: "2026-08-25T12:00:00.000Z", unreadCount: 1, source: "default_sms_client" as const },
  { id: "sms-conversation:+14155550101", address: "+1 415 555 0101", updatedAt: "2026-08-24T12:00:00.000Z", unreadCount: 0, source: "default_sms_client" as const },
];

const messages = [
  { id: "one", conversationId: conversations[0].id, body: "Can we talk later?", direction: "inbound" as const, status: "received" as const, createdAt: "2026-08-25T12:00:00.000Z" },
  { id: "two", conversationId: conversations[1].id, body: "See you at dinner", direction: "outbound" as const, status: "sent" as const, createdAt: "2026-08-24T12:00:00.000Z" },
];

describe("conversation search and local contact matching", () => {
  it("searches locally across display names, phone numbers, and message previews", () => {
    expect(filterConversations(conversations, messages, "rae")).toHaveLength(1);
    expect(filterConversations(conversations, messages, "dinner")[0].id).toBe(conversations[1].id);
    expect(filterConversations(conversations, messages, "0100")[0].id).toBe(conversations[0].id);
  });

  it("resolves only unambiguous local contact names for matching phone numbers", () => {
    const names = resolveContactNamesByAddress(["+14155550100", "+14155550101"], [
      { name: "Rae Park", phoneNumbers: [{ number: "+1 (415) 555-0100" }] },
      { name: "Different Rae", phoneNumbers: [{ number: "+1 (415) 555-0101" }] },
      { name: "Duplicate", phoneNumbers: [{ number: "+1 415 555 0101" }] },
    ]);

    expect(names["+14155550100"]).toBe("Rae Park");
    expect(names["+14155550101"]).toBeUndefined();
  });

  it("segments all case-insensitive local matches without changing the displayed text", () => {
    expect(splitSearchMatch("Rae wrote to Rae", "rae")).toEqual([
      { text: "Rae", matched: true },
      { text: " wrote to ", matched: false },
      { text: "Rae", matched: true },
    ]);
    expect(splitSearchMatch("+1 415 555 0100", "415")).toContainEqual({ text: "415", matched: true });
  });
});
