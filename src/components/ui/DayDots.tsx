import { Check } from "lucide-react";

/** A week as seven circles (Mon→Sun): lime with a tick when trained, outlined otherwise. */
export function DayDots({ days, trained, today }: { days: string[]; trained: Set<string>; today: string }) {
  return (
    <ol className="flex gap-2" aria-label="This week">
      {days.map((k) => {
        const d = new Date(k + "T00:00:00");
        const done = trained.has(k);
        const name = d.toLocaleDateString(undefined, { weekday: "long" });
        return (
          <li key={k} className="flex flex-col items-center gap-1.5">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full ${
                done ? "bg-accentFill text-onAccent" : k === today ? "border-2 border-accent" : "border-[1.5px] border-inkSoft/60"
              }`}
            >
              {done && <Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden />}
              <span className="sr-only">
                {name}: {done ? "trained" : "not trained"}
              </span>
            </span>
            <span className="text-xs text-inkSoft" aria-hidden>
              {d.toLocaleDateString(undefined, { weekday: "narrow" })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
