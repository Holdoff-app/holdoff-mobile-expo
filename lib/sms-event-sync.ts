import type { NativeSmsEvent } from "holdoff-sms";

import type { SmsClientFoundationState, SmsConversationRecord, SmsMessageRecord } from "@/lib/holdoff-types";

export type NativeSmsSyncResult = {
  smsClient: SmsClientFoundationState;
  persistedEventIds: string[];
};

export function normalizeSmsAddress(address: string): string {
  const trimmed = address.trim();
  const numeric = trimmed.replace(/[^+\d]/g, "");
  if (!numeric) return trimmed.toLocaleLowerCase() || "unknown-sender";
  return numeric.startsWith("00") ? `+${numeric.slice(2)}` : numeric;
}

function eventTimestamp(timestamp: string): string {
  const numericTimestamp = Number(timestamp);
  const parsed = Number.isFinite(numericTimestamp)
    ? new Date(numericTimestamp)
    : new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function compareByNewest<T extends { updatedAt?: string; createdAt?: string }>(left: T, right: T): number {
  const leftValue = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
  const rightValue = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
  return rightValue - leftValue;
}

function statusForEvent(event: NativeSmsEvent): SmsMessageRecord["status"] {
  if (event.kind === "inbound") return "received";
  return event.status;
}

function directionForEvent(event: NativeSmsEvent): SmsMessageRecord["direction"] {
  return event.kind === "inbound" ? "inbound" : "outbound";
}

function matchingInboundMessageIndex(
  messages: SmsMessageRecord[],
  conversationId: string,
  body: string,
  createdAt: string,
): number | undefined {
  const eventTime = new Date(createdAt).getTime();
  const match = messages.findIndex((message) => (
    message.conversationId === conversationId
    && message.direction === "inbound"
    && message.body === body
    && Math.abs(new Date(message.createdAt).getTime() - eventTime) <= 10_000
  ));
  return match === -1 ? undefined : match;
}

function strongestOutgoingStatus(
  existing: SmsMessageRecord["status"],
  next: SmsMessageRecord["status"],
): SmsMessageRecord["status"] {
  if (existing === "failed" || next === "failed") return "failed";
  const rank: Record<SmsMessageRecord["status"], number> = {
    queued: 0,
    sent: 1,
    delivered: 2,
    received: 0,
    failed: 3,
  };
  return rank[next] > rank[existing] ? next : existing;
}

export function markSmsConversationRead(
  smsClient: SmsClientFoundationState,
  conversationId: string,
): SmsClientFoundationState {
  return {
    ...smsClient,
    conversations: smsClient.conversations.map((conversation) => (
      conversation.id === conversationId && conversation.unreadCount > 0
        ? { ...conversation, unreadCount: 0 }
        : conversation
    )),
  };
}

export function mergeNativeSmsEvents(
  smsClient: SmsClientFoundationState,
  events: NativeSmsEvent[],
): NativeSmsSyncResult {
  const conversations = [...smsClient.conversations];
  const messages = [...smsClient.messages];
  const conversationIndex = new Map(
    conversations.map((conversation, index) => [normalizeSmsAddress(conversation.address), index]),
  );
  const messageIndex = new Map(messages.map((message, index) => [message.id, index]));
  const persistedEventIds = new Set<string>();

  [...events]
    .filter((event) => Boolean(event.id?.trim()))
    .sort((left, right) => eventTimestamp(left.timestamp).localeCompare(eventTimestamp(right.timestamp)))
    .forEach((event) => {
      const address = event.address.trim() || "Unknown sender";
      const normalizedAddress = normalizeSmsAddress(address);
      const createdAt = eventTimestamp(event.timestamp);
      const messageId = `native-sms:${event.id}`;
      let conversationPosition = conversationIndex.get(normalizedAddress);

      if (conversationPosition === undefined) {
        conversations.push({
          id: `sms-conversation:${normalizedAddress}`,
          address,
          updatedAt: createdAt,
          unreadCount: 0,
          source: "default_sms_client",
        });
        conversationPosition = conversations.length - 1;
        conversationIndex.set(normalizedAddress, conversationPosition);
      }

      const conversation = conversations[conversationPosition];
      const isInbound = directionForEvent(event) === "inbound";
      const existingMessagePosition = messageIndex.get(messageId)
        ?? (isInbound ? matchingInboundMessageIndex(messages, conversation.id, event.body, createdAt) : undefined);

      if (existingMessagePosition === undefined) {
        messages.push({
          id: messageId,
          conversationId: conversation.id,
          body: event.body,
          direction: directionForEvent(event),
          status: statusForEvent(event),
          createdAt,
        });
        messageIndex.set(messageId, messages.length - 1);
        if (isInbound) {
          conversations[conversationPosition] = {
            ...conversation,
            unreadCount: conversation.unreadCount + 1,
            updatedAt: createdAt,
          };
        } else {
          conversations[conversationPosition] = { ...conversation, updatedAt: createdAt };
        }
      } else {
        const existingMessage = messages[existingMessagePosition];
        messageIndex.set(messageId, existingMessagePosition);
        messages[existingMessagePosition] = {
          ...existingMessage,
          body: event.body || existingMessage.body,
          status: existingMessage.direction === "outbound"
            ? strongestOutgoingStatus(existingMessage.status, statusForEvent(event))
            : statusForEvent(event),
        };
        if (new Date(createdAt).getTime() > new Date(conversation.updatedAt).getTime()) {
          conversations[conversationPosition] = { ...conversation, updatedAt: createdAt };
        }
      }

      persistedEventIds.add(event.id);
    });

  return {
    smsClient: {
      ...smsClient,
      conversations: conversations.sort(compareByNewest),
      messages: messages.sort(compareByNewest),
    },
    persistedEventIds: [...persistedEventIds],
  };
}
