import type { SmsConversationRecord, SmsMessageRecord } from "@/lib/holdoff-types";

export type SearchMatchSegment = { text: string; matched: boolean };

export function splitSearchMatch(value: string, query: string): SearchMatchSegment[] {
  const needle = query.trim();
  if (!needle || !value) return [{ text: value, matched: false }];
  const haystack = value.toLocaleLowerCase();
  const normalizedNeedle = needle.toLocaleLowerCase();
  const segments: SearchMatchSegment[] = [];
  let cursor = 0;
  let matchAt = haystack.indexOf(normalizedNeedle, cursor);
  while (matchAt !== -1) {
    if (matchAt > cursor) segments.push({ text: value.slice(cursor, matchAt), matched: false });
    segments.push({ text: value.slice(matchAt, matchAt + needle.length), matched: true });
    cursor = matchAt + needle.length;
    matchAt = haystack.indexOf(normalizedNeedle, cursor);
  }
  if (cursor < value.length) segments.push({ text: value.slice(cursor), matched: false });
  return segments.length ? segments : [{ text: value, matched: false }];
}

export function filterConversations(
  conversations: SmsConversationRecord[],
  messages: SmsMessageRecord[],
  query: string,
): SmsConversationRecord[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return conversations;
  const matchingConversationIds = new Set(
    messages
      .filter((message) => message.body.toLocaleLowerCase().includes(needle))
      .map((message) => message.conversationId),
  );
  return conversations.filter((conversation) => (
    matchingConversationIds.has(conversation.id)
    || conversation.address.toLocaleLowerCase().includes(needle)
    || conversation.displayName?.toLocaleLowerCase().includes(needle)
  ));
}
