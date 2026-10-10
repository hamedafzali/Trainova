// AI safety guardrails for model output and user input.
//
// Checks run per sentence with word boundaries, and a sentence that is itself
// a warning ("never train through sharp pain") is not flagged — the previous
// substring blocklist rejected "speed" (PED), "diet" (die) and any sensible
// advice that mentioned pain. Keep patterns narrow: a false positive silently
// drops a good answer.

export interface SafetyCheckResult {
  isSafe: boolean;
  reason?: string;
  severity?: "low" | "medium" | "high";
}

export const MEDICAL_DISCLAIMER =
  "I'm an AI coach, not a doctor. If you feel chest pain, dizziness, numbness or sharp joint pain, stop and get checked by a professional.";

const PII_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // phone numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // email addresses
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
];

/** Advice we never want to give, matched only in non-cautionary sentences. */
const HARMFUL_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\b(anabolic steroids?|steroid cycles?|sarms?|trenbolone|clenbuterol|dnp|insulin injections?)\b/i, reason: "performance-enhancing drugs" },
  { re: /\b(purg(e|ing)|make yourself (vomit|throw up)|laxatives? (to|for) (lose|cut))\b/i, reason: "disordered eating" },
  { re: /\b(starv(e|ing) yourself|eat (nothing|under (1[01]\d{2}|[1-9]\d{2}) ?(k?cal|calories)))\b/i, reason: "extreme restriction" },
  { re: /\b(push|train|work|lift) (through|past) (the )?(sharp |joint |chest )?pain\b/i, reason: "training through pain" },
  { re: /\bignore (the |any |your )?(pain|chest pain|dizziness|numbness)\b/i, reason: "ignoring warning symptoms" },
];

/** A sentence that warns against something is not itself harmful advice. */
const CAUTION = /\b(don'?t|do not|never|avoid|stop|not|no|shouldn'?t|should not|instead of|rather than|dangerous|unsafe|see a (doctor|physio|professional))\b/i;

/** Symptoms in a user's message that warrant "stop and get checked" first. */
const RED_FLAGS = /\b(chest (pain|tightness)|faint(ed|ing)?|passed out|black(ed)? out|can'?t breathe|shortness of breath|numb(ness)?|tingling|sharp pain|heart (racing|palpitations?)|pain (shoots|shooting|radiat\w*))\b/i;

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?\n])\s+/).filter(Boolean);
}

export function containsPII(content: string): boolean {
  return PII_PATTERNS.some((p) => {
    p.lastIndex = 0;
    return p.test(content);
  });
}

/** First harmful-advice reason found, or null. Cautionary sentences are skipped. */
export function harmfulAdviceReason(content: string): string | null {
  for (const s of sentences(content)) {
    if (CAUTION.test(s)) continue;
    const hit = HARMFUL_PATTERNS.find((h) => h.re.test(s));
    if (hit) return hit.reason;
  }
  return null;
}

export function containsHarmfulContent(content: string): boolean {
  return harmfulAdviceReason(content) !== null;
}

/** Safety check for model output. */
export function performSafetyCheck(content: string): SafetyCheckResult {
  if (containsPII(content)) {
    return { isSafe: false, reason: "Content contains personal information", severity: "high" };
  }
  const reason = harmfulAdviceReason(content);
  if (reason) return { isSafe: false, reason: `Potentially harmful advice (${reason})`, severity: "high" };
  return { isSafe: true };
}

/** Redacts emails/phone numbers before user text is sent to the model. */
export function sanitizeContent(content: string): string {
  return PII_PATTERNS.reduce((s, p) => s.replace(p, "[redacted]"), content);
}

/** True when a user's message describes symptoms that need a professional, not a program tweak. */
export function hasRedFlagSymptoms(input: string): boolean {
  return RED_FLAGS.test(input);
}
