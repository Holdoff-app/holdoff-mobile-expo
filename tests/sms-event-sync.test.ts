import { describe, expect, it } from "vitest";
import type { NativeSmsEvent } from "holdoff-sms";

import { createEmptyStore } from "../lib/holdoff-storage";
import { markSmsConversationRead, mergeNativeSmsEvents, normalizeSmsAddress } from "../lib/sms-event-sync";

const inbound: NativeSmsEvent = {
  id: "received-1",
  kind: "inbound",
  address: "+1 (415) 555-0100",
  body: "Are you around?",
  timestamp: "1767225600000",
  status: "received",
};

describe("native SMS event merging", () => {
  it("normalizes formatting without inventing a contact name", () => {
    expect(normalizeSmsAddress("+1 (415) 555-0100")).toBe("+14155550100");
    expect(normalizeSmsAddress("  ALPHANUMERIC  ")).toBe("alphanumeric");
  });

  it("adds an actual inbound receiver event once and increments unread only once", () => {
    const smsClient = createEmptyStore().smsClient;
    const first = mergeNativeSmsEvents(smsClient, [inbound]);
    const second = mergeNativeSmsEvents(first.smsClient, [inbound]);

    expect(first.smsClient.conversations).toHaveLength(1);
    expect(first.smsClient.conversations[0]).toMatchObject({ address: "+1 (415) 555-0100", unreadCount: 1 });
    expect(first.smsClient.messages[0]).toMatchObject({ body: "Are you around?", direction: "inbound", status: "received" });
    expect(second.smsClient.messages).toHaveLength(1);
    expect(second.smsClient.conversations[0].unreadCount).toBe(1);
    expect(second.persistedEventIds).toEqual(["received-1"]);
  });

  it("updates one outgoing record through queued, sent, and delivered callbacks", () => {
    const base = createEmptyStore().smsClient;
    const queued = mergeNativeSmsEvents(base, [{
      id: "outgoing-1",
      kind: "sent",
      address: "+14155550100",
      body: "Checking in.",
      timestamp: "1767225600100",
      status: "queued",
    }]);
    const delivered = mergeNativeSmsEvents(queued.smsClient, [{
      id: "outgoing-1",
      kind: "delivered",
      address: "+14155550100",
      body: "Checking in.",
      timestamp: "1767225600200",
      status: "delivered",
    }]);

    expect(delivered.smsClient.messages).toHaveLength(1);
    expect(delivered.smsClient.messages[0]).toMatchObject({ direction: "outbound", status: "delivered" });
    expect(delivered.smsClient.conversations[0].unreadCount).toBe(0);
  });

  it("does not downgrade a delivered state when delayed multipart sent callbacks arrive", () => {
    const delivered = mergeNativeSmsEvents(createEmptyStore().smsClient, [{
      id: "outgoing-2",
      kind: "delivered",
      address: "+14155550100",
      body: "A longer message.",
      timestamp: "1767225600200",
      status: "delivered",
    }]);
    const delayedSent = mergeNativeSmsEvents(delivered.smsClient, [{
      id: "outgoing-2",
      kind: "sent",
      address: "+14155550100",
      body: "A longer message.",
      timestamp: "1767225600300",
      status: "sent",
    }]);
    const failed = mergeNativeSmsEvents(delayedSent.smsClient, [{
      id: "outgoing-2",
      kind: "failed",
      address: "+14155550100",
      body: "A longer message.",
      timestamp: "1767225600400",
      status: "failed",
    }]);

    expect(delayedSent.smsClient.messages[0].status).toBe("delivered");
    expect(failed.smsClient.messages[0].status).toBe("failed");
  });

  it("clears unread state only for the conversation that was opened", () => {
    const first = mergeNativeSmsEvents(createEmptyStore().smsClient, [inbound]).smsClient;
    const withSecond = mergeNativeSmsEvents(first, [{ ...inbound, id: "received-2", address: "+14155550101", timestamp: "1767225600100" }]).smsClient;
    const opened = markSmsConversationRead(withSecond, "sms-conversation:+14155550100");

    expect(opened.conversations.find((conversation) => conversation.id === "sms-conversation:+14155550100")?.unreadCount).toBe(0);
    expect(opened.conversations.find((conversation) => conversation.id === "sms-conversation:+14155550101")?.unreadCount).toBe(1);
  });

  it("does not duplicate an inbound receiver event when matching local device history is loaded", () => {
    const receiverEvent = mergeNativeSmsEvents(createEmptyStore().smsClient, [inbound]).smsClient;
    const withHistory = mergeNativeSmsEvents(receiverEvent, [{
      ...inbound,
      id: "device-sms:52",
      timestamp: "1767225600005",
    }]).smsClient;

    expect(withHistory.messages).toHaveLength(1);
    expect(withHistory.conversations[0].unreadCount).toBe(1);
  });
});
