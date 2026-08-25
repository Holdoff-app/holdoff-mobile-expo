import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

const expressionSchema = z.enum(["calm", "listening", "concerned", "encouraging", "celebrating"]);
const cuesSchema = z.object({
  allCapsWords: z.number().int().min(0).max(100),
  repeatedPunctuation: z.boolean(),
  typingBurstSeconds: z.number().int().min(0).max(7200),
  recentSameRecipientDrafts: z.number().int().min(0).max(1000),
});

const draftResponseSchema = z.object({
  verdict: z.enum(["CLEAR", "HOLD", "SPIRAL_LOCK"]),
  explanation: z.string().min(1).max(360),
  gentleRewrite: z.string().max(1200),
  signals: z.array(z.string().max(80)).max(6),
  moodScore: z.number().min(0).max(100),
  immediateCare: z.boolean(),
  expression: expressionSchema,
});

const conversationHistoryResponseSchema = z.object({
  summary: z.string().min(1).max(700),
  patterns: z.array(z.string().min(1).max(260)).max(4),
  momentsToNotice: z.array(z.string().min(1).max(260)).max(4),
  nextStep: z.string().min(1).max(360),
  immediateCare: z.boolean(),
});

const interpretResponseSchema = z.object({
  tone: z.string().min(1).max(260),
  possibleMeaning: z.string().min(1).max(360),
  possibleFeeling: z.string().min(1).max(260),
  replyApproaches: z.array(z.string().min(1).max(240)).min(2).max(3),
});

const chatResponseSchema = z.object({
  reply: z.string().min(1).max(700),
  expression: expressionSchema,
  moodScore: z.number().min(0).max(100),
});

async function askSadie(system: string, user: string): Promise<unknown> {
  const { data: models } = await listLLMModels();
  const model = models.find((item) => item.id === "gpt-5-mini")?.id;
  const response = await invokeLLM({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    maxTokens: 900,
  });
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Sadie response unavailable");
  return JSON.parse(content);
}

const SADIE_FOUNDATION = `You are Sadie, an empathetic, connection-first message companion. Validate feelings before offering perspective. Never shame, lecture, diagnose, claim certainty, or claim to be therapy. Do not assign attachment styles or clinical labels to either participant. You may reflect observable communication patterns as possibilities, including wishes for reassurance, space, clarity, repair, or boundaries, but never infer hidden motives. Do not give medical, legal, or emergency instructions except to gently encourage immediate local help if someone says they may imminently harm themselves or another person. You are analyzing only the text the user explicitly submits; do not claim access to phone messages, contacts, or hidden context. Return JSON only.`;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  sadie: router({
    analyze: publicProcedure
      .input(z.object({ draft: z.string().min(1).max(2400), recipient: z.string().max(100), cues: cuesSchema, rewriteTone: z.enum(["balanced", "empathetic", "direct"]).default("balanced") }))
      .mutation(async ({ input }) => {
        const result = await askSadie(
          `${SADIE_FOUNDATION}\nClassify a draft as CLEAR, HOLD, or SPIRAL_LOCK. Use SPIRAL_LOCK only for clear escalation signals such as credible self-harm intent, credible threats of violence, coercive rage escalation, or repeated obsessive pursuit. It must be triggered by the provided content or patterns, not by user choice. For HOLD, offer a rewrite that preserves the core boundary or need. The user selected rewriteTone=${input.rewriteTone}. For balanced, be calm and clear. For empathetic, validate the relationship while retaining the user’s meaning. For direct, be concise, respectful, and explicit about the boundary or request. For CLEAR, the rewrite may be empty. moodScore is an inference from writing only: 0 means steady, 100 means highly activated. immediateCare is true only where the draft signals self-harm or imminent harm. Output fields: verdict, explanation, gentleRewrite, signals, moodScore, immediateCare, expression.`,
          JSON.stringify(input),
        );
        return draftResponseSchema.parse(result);
      }),
    analyzeConversationHistory: publicProcedure
      .input(z.object({
        participantLabel: z.string().min(1).max(120),
        messages: z.array(z.object({
          body: z.string().min(1).max(2400),
          direction: z.enum(["inbound", "outbound"]),
          createdAt: z.string().max(80),
        })).min(1).max(200),
      }))
      .mutation(async ({ input }) => {
        const totalCharacters = input.messages.reduce((count, message) => count + message.body.length, 0);
        if (totalCharacters > 24_000) throw new Error("Conversation history exceeds the explicit analysis limit.");
        const result = await askSadie(
          `${SADIE_FOUNDATION}\nAnalyze only the conversation messages explicitly supplied by the user. Offer a concise, non-diagnostic reflection on observable communication patterns. Do not claim certainty about either person, infer hidden intent, or recommend contacting anyone. Patterns and momentsToNotice must be framed as possibilities from the submitted text only. nextStep must be a small user-controlled option such as pausing, clarifying a boundary, or waiting before replying. immediateCare is true only if the submitted text signals credible immediate self-harm or imminent harm. Output fields: summary, patterns, momentsToNotice, nextStep, immediateCare.`,
          JSON.stringify(input),
        );
        return conversationHistoryResponseSchema.parse(result);
      }),
    interpret: publicProcedure
      .input(z.object({ message: z.string().min(1).max(2400), avoidContact: z.boolean() }))
      .mutation(async ({ input }) => {
        const result = await askSadie(
          `${SADIE_FOUNDATION}\nInterpret a received message with uncertainty. Do not diagnose its sender. Explain a likely tone, what it might mean, and what they might be feeling. Offer two or three healthy reply approaches. If avoidContact is true, do not encourage contact or replies; instead offer self-protective, non-engagement-oriented approaches. Output fields: tone, possibleMeaning, possibleFeeling, replyApproaches.`,
          JSON.stringify(input),
        );
        return interpretResponseSchema.parse(result);
      }),
    chat: publicProcedure
      .input(z.object({
        message: z.string().min(1).max(1600),
        context: z.array(z.object({ role: z.enum(["user", "sadie"]), text: z.string().max(900) })).max(6),
        sessionNote: z.string().max(600),
      }))
      .mutation(async ({ input }) => {
        const result = await askSadie(
          `${SADIE_FOUNDATION}\nRespond warmly in no more than five concise sentences. Reference context only when it helps. Validate before offering a small option or reflection. If the user expresses immediate self-harm intent, gently include: "If you might act on these feelings or are in immediate danger, call or text 988 in the US or contact local emergency services." Output fields: reply, expression, moodScore.`,
          JSON.stringify(input),
        );
        return chatResponseSchema.parse(result);
      }),
  }),
});

export type AppRouter = typeof appRouter;
