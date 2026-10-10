
// Maps free-text exercise names (from the AI, imports, or typing) onto the
// exercise library so new plans reuse existing ids — and with them history,
// devices, instructions and the right logging type.

const ALIASES: Record<string, string> = {
  rdl: "romanian deadlift",
  ohp: "overhead press",
  "chin up": "chin-up",
  chinup: "chin-up",
  "pull up": "pull-up",
  pullup: "pull-up",
  "push up": "push-up",
  pushup: "push-up",
  "step up": "step-up",
  "lat pull down": "lat pulldown",
  pulldown: "lat pulldown",
  squat: "back squat",
  "barbell squat": "back squat",
  "barbell back squat": "back squat",
  bench: "bench press",
  "flat bench press": "bench press",
  "barbell bench press": "bench press",
  "barbell deadlift": "deadlift",
  "conventional deadlift": "deadlift",
  "military press": "overhead press",
  "barbell overhead press": "overhead press",
  "hip thrust": "barbell hip thrust",
  "farmer walk": "farmer carry",
};

/** Words that describe equipment, not the movement. */
const EQUIPMENT_WORDS = new Set(["barbell", "dumbbell", "dumbbells", "db", "bb", "machine", "cable", "kettlebell", "kb", "smith", "ez", "bar", "band", "bodyweight", "weighted", "seated", "standing"]);

type Matchable = { name: string; equipment?: string | null };

function singular(w: string): string {
  if (/(ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 2 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

/** Lowercase, punctuation-free, singular form; aliases map to library names. */
export function normaliseName(name: string): string {
  let n = name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  n = n
    .split(" ")
    .map(singular)
    .join(" ");
  return ALIASES[n] ?? n;
}

function tokens(name: string): string[] {
  return normaliseName(name).replace(/-/g, " ").split(" ").filter(Boolean);
}

function movementTokens(name: string): Set<string> {
  return new Set(tokens(name).filter((t) => !EQUIPMENT_WORDS.has(t)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Best library match for a free-text name, or null when nothing is close
 * enough. Exact (normalised) names win; then same movement words with the
 * equipment named in the text; then a high token overlap.
 */
export function matchExercise<T extends Matchable>(name: string, exercises: T[]): T | null {
  const target = normaliseName(name);
  if (!target) return null;
  const exact = exercises.find((e) => normaliseName(e.name) === target);
  if (exact) return exact;

  const words = new Set(tokens(name));
  const move = movementTokens(name);
  let best: T | null = null;
  let bestScore = 0;
  for (const e of exercises) {
    const eMove = movementTokens(e.name);
    let score = jaccard(move, eMove);
    if (score === 0) continue;
    // Equipment named in the text should agree with the candidate's equipment.
    const eq = e.equipment ?? "";
    const namesEquipment = [...words].some((w) => EQUIPMENT_WORDS.has(w));
    if (namesEquipment && eq && [...words].some((w) => eq.startsWith(w) || w.startsWith(eq))) score += 0.15;
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return bestScore >= 0.6 ? best : null;
}
