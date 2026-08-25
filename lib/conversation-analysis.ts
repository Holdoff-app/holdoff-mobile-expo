import type { SmsMessageRecord } from "@/lib/holdoff-types";

export const MAX_CONVERSATION_ANALYSIS_MESSAGES = 200;
export const MAX_CONVERSATION_ANALYSIS_CHARACTERS = 24_000;

export type ConversationAnalysisScope = {
  messages: Array<Pick<SmsMessageRecord, "body" | "direction" | "createdAt">>;
  includedMessageCount: number;
  totalMessageCount: number;
  truncated: boolean;
};

export function buildConversationAnalysisScope(messages: SmsMessageRecord[]): ConversationAnalysisScope {
  const ordered = [...messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const selected: ConversationAnalysisScope["messages"] = [];
  let characters = 0;
  for (const message of ordered.slice(-MAX_CONVERSATION_ANALYSIS_MESSAGES).reverse()) {
    const nextLength = message.body.length + 64;
    if (selected.length && characters + nextLength > MAX_CONVERSATION_ANALYSIS_CHARACTERS) break;
    selected.unshift({ body: message.body, direction: message.direction, createdAt: message.createdAt });
    characters += nextLength;
  }
  return {
    messages: selected,
    includedMessageCount: selected.length,
    totalMessageCount: ordered.length,
    truncated: selected.length !== ordered.length,
  };
}
