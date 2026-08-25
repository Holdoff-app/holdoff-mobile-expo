import type { Draft, DraftStatus, WritingCues } from "@/lib/holdoff-types";

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function deriveWritingCues(
  body: string,
  typingBurstSeconds: number,
  recentSameRecipientDrafts: number,
): WritingCues {
  const allCapsWords = (body.match(/\b[A-Z]{3,}\b/g) ?? []).length;
  return {
    allCapsWords,
    repeatedPunctuation: /([!?])\1{2,}/.test(body),
    typingBurstSeconds: Math.max(0, Math.round(typingBurstSeconds)),
    recentSameRecipientDrafts,
  };
}

export function statusLabel(status: DraftStatus): string {
  return status.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export function getDraftCues(drafts: Draft[], recipient: string): number {
  const normalized = recipient.trim().toLowerCase();
  if (!normalized) return 0;
  return drafts.filter((draft) => draft.recipient.trim().toLowerCase() === normalized).length;
}

export function timeWindowLabel(date: string): "Morning" | "Afternoon" | "Evening" | "Late night" {
  const hour = new Date(date).getHours();
  if (hour < 5) return "Late night";
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(date));
}
