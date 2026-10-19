// The bell's inbox: what needs your attention, built from data the app already
// has (trainer plans, today's readiness, coach insights). Nothing is stored;
// only the ids you've seen are kept on the device, so the bell can show a dot
// for anything new. Ids carry a date where the same kind of item can come back
// (a new day's check-in, a new PR), so it counts as new again.

import type { CoachInsight } from "./coach";
import type { ReadinessBand } from "./recovery";

export type InboxTone = "action" | "warning" | "success" | "info";

export interface InboxItem {
  id: string;
  tone: InboxTone;
  title: string;
  body: string;
  href: string;
}

export interface InboxInput {
  /** YYYY-MM-DD, local. */
  today: string;
  /** Plans a trainer assigned that aren't imported yet. */
  assignments: { id: string; name: string; trainer: string }[];
  /** Today's readiness; null before any training or check-in. */
  readiness: { band: ReadinessBand; painReported: boolean } | null;
  checkedInToday: boolean;
  /** Has the user trained at all? The check-in reminder needs some history. */
  hasTrained: boolean;
  insights: CoachInsight[];
}

const BODY = "/progress?tab=body";
const TONE_ORDER: Record<InboxTone, number> = { action: 0, warning: 1, success: 2, info: 3 };

export function buildInbox(input: InboxInput): InboxItem[] {
  const items: InboxItem[] = [];
  const month = input.today.slice(0, 7);

  for (const a of input.assignments) {
    items.push({
      id: `assignment-${a.id}`,
      tone: "action",
      title: `New plan: ${a.name}`,
      body: `From ${a.trainer}. Import it to add it to your workouts.`,
      href: "/programs",
    });
  }

  if (input.readiness?.painReported) {
    items.push({
      id: `pain-${input.today}`,
      tone: "warning",
      title: "Pain after a recent workout",
      body: "Ease off anything that hurts, and get it checked if it doesn't settle.",
      href: BODY,
    });
  }
  if (input.hasTrained && !input.checkedInToday) {
    items.push({
      id: `checkin-${input.today}`,
      tone: "action",
      title: "How are you feeling today?",
      body: "A 10-second check-in makes today's readiness estimate more reliable.",
      href: BODY,
    });
  } else if (input.readiness?.band === "low") {
    items.push({
      id: `readiness-low-${input.today}`,
      tone: "warning",
      title: "Readiness is low today",
      body: "Consider a lighter session, mobility work or a rest day.",
      href: BODY,
    });
  }

  // One set can break several records; show one item per exercise.
  const prs = new Map<string, CoachInsight[]>();
  for (const i of input.insights) {
    if (i.kind === "pr") {
      const key = i.exerciseId ?? i.id;
      prs.set(key, [...(prs.get(key) ?? []), i]);
      continue;
    }
    const item = fromInsight(i, input.today, month);
    if (item) items.push(item);
  }
  for (const group of prs.values()) {
    const exercise = group[0].exerciseId;
    items.push({
      // Ids carry each PR's date, so any new record makes this a new item.
      id: group.map((i) => i.id).sort().join("+"),
      tone: "success",
      title: group.length > 1 ? "New personal records" : "New personal record",
      body: group.map((i) => i.message).join(" "),
      href: exercise ? `/exercises/${encodeURIComponent(exercise)}` : "/progress?tab=strength",
    });
  }

  return items.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

function fromInsight(i: CoachInsight, today: string, month: string): InboxItem | null {
  const exercise = i.exerciseId ? `/exercises/${encodeURIComponent(i.exerciseId)}` : null;
  switch (i.kind) {
    case "stall":
      return { id: `${i.id}-${month}`, tone: "warning", title: "A lift has stalled", body: i.message, href: exercise ?? "/progress?tab=strength" };
    case "missed":
      return { id: `missed-${today}`, tone: "info", title: "Time for a workout?", body: i.message, href: "/" };
    case "streak":
      return { id: `streak-${i.numbers[0]}`, tone: "success", title: "On a streak", body: i.message, href: "/progress" };
    case "volume_up":
    case "volume_down":
      return { id: `${i.id}-${month}`, tone: "info", title: "Training volume", body: i.message, href: "/progress?tab=workouts" };
    default:
      return null;
  }
}

/** Items not seen yet that should light the bell. Info items never do, so a reminder doesn't nag. */
export function unseen(items: InboxItem[], seen: ReadonlySet<string>): InboxItem[] {
  return items.filter((i) => i.tone !== "info" && !seen.has(i.id));
}
