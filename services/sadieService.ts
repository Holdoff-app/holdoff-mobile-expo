import type {
  SadieAnalysis,
  SadieChatRequest,
  SadieConversationHistoryRequest,
  SadieDraftRequest,
  SadieExpression,
  ConversationHistoryAnalysis,
  SadieInterpretRequest,
} from "@/lib/holdoff-types";

/**
 * Production Sadie requests are intentionally centralized here. When the HoldOff
 * backend moves, replace the injected transport with the HTTPS API at this base URL.
 * No credential is present in the client bundle.
 */
export const BASE_URL = "https://api.smsholdoff.com";

export class SadieUnavailableError extends Error {
  constructor() {
    super("Sadie is unavailable");
    this.name = "SadieUnavailableError";
  }
}

export interface SadieTransport {
  analyzeDraft: (request: SadieDraftRequest) => Promise<SadieAnalysis>;
  analyzeConversationHistory: (request: SadieConversationHistoryRequest) => Promise<ConversationHistoryAnalysis>;
  interpretMessage: (request: SadieInterpretRequest) => Promise<{
    tone: string;
    possibleMeaning: string;
    possibleFeeling: string;
    replyApproaches: string[];
  }>;
  chat: (request: SadieChatRequest) => Promise<{ reply: string; expression: SadieExpression; moodScore: number }>;
}

async function protect<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new SadieUnavailableError();
  }
}

export const sadieService = {
  analyzeDraft: (transport: SadieTransport, request: SadieDraftRequest) =>
    protect(() => transport.analyzeDraft(request)),
  analyzeConversationHistory: (transport: SadieTransport, request: SadieConversationHistoryRequest) =>
    protect(() => transport.analyzeConversationHistory(request)),
  interpretMessage: (transport: SadieTransport, request: SadieInterpretRequest) =>
    protect(() => transport.interpretMessage(request)),
  chat: (transport: SadieTransport, request: SadieChatRequest) => protect(() => transport.chat(request)),
};
