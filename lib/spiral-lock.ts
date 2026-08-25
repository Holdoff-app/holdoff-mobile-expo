import type { EmotionalSpiralCue, SpiralLockSettings, WritingCues } from "@/lib/holdoff-types";

export function shouldTriggerSpiralLock(settings: SpiralLockSettings, cues: WritingCues): boolean {
  if (!settings.enabled) return false;
  return (
    (settings.triggerAllCaps && cues.allCapsWords >= 2)
    || (settings.triggerRepeatedPunctuation && cues.repeatedPunctuation)
    || (settings.triggerRapidTyping && cues.typingBurstSeconds >= 45)
  );
}

export function detectEmotionalSpiralCues(settings: SpiralLockSettings, body: string, cues: WritingCues): EmotionalSpiralCue[] {
  if (!settings.emotionalCueCheckEnabled || !body.trim()) return [];
  const normalized = body.toLocaleLowerCase();
  const findings: EmotionalSpiralCue[] = [];
  if (cues.allCapsWords >= 2) findings.push({ code: "all_caps", label: "Several all-caps words", detail: "This draft has multiple all-caps words." });
  if (cues.repeatedPunctuation) findings.push({ code: "repeated_punctuation", label: "Repeated punctuation", detail: "This draft has repeated ! or ? punctuation." });
  if (/\b(always|never|everyone|no one|nothing|everything)\b/.test(normalized)) findings.push({ code: "absolute_language", label: "Absolute language", detail: "This draft includes words such as always, never, everyone, or nothing." });
  if (/\b(i can'?t|i cannot|i['’]?m done|leave me alone|right now|immediately)\b/.test(normalized)) findings.push({ code: "urgent_language", label: "Urgent language", detail: "This draft includes wording that may reflect urgency." });
  if (cues.typingBurstSeconds >= 45) findings.push({ code: "rapid_typing", label: "Long continuous drafting", detail: "This draft has been open for a sustained writing burst." });
  return findings;
}
