import { Check } from "lucide-react";

export interface SetRow {
  id: string;
  weight: string;
  reps: string;
  rpe: string;
  rest: string;
  done: boolean;
  /** Warm-up, drop or failure marker shown before the number. */
  tag?: string;
}

/** SET · WEIGHT · REPS · RPE · REST · ✓ — the reference's working-sets table. */
export function SetTable({ rows, caption }: { rows: SetRow[]; caption: string }) {
  return (
    <table className="w-full table-fixed text-center tabular-nums">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-[11px] font-medium uppercase tracking-wide text-inkSoft">
          <th scope="col" className="w-[13%] pb-2 text-left font-medium">
            Set
          </th>
          <th scope="col" className="w-[24%] pb-2 font-medium">
            Weight
          </th>
          <th scope="col" className="pb-2 font-medium">
            Reps
          </th>
          <th scope="col" className="pb-2 font-medium">
            RPE
          </th>
          <th scope="col" className="pb-2 font-medium">
            Rest
          </th>
          <th scope="col" className="w-[12%] pb-2">
            <span className="sr-only">Done</span>
          </th>
        </tr>
      </thead>
      <tbody className="text-[15px] text-ink">
        {rows.map((r, i) => (
          <tr key={r.id} className="border-t border-border">
            <th scope="row" className="py-3 text-left font-normal">
              {r.tag ? <span className="text-muted">{r.tag}</span> : i + 1}
            </th>
            <td className="py-3">{r.weight}</td>
            <td className="py-3">{r.reps}</td>
            <td className="py-3">{r.rpe}</td>
            <td className="py-3">{r.rest}</td>
            <td className="py-3">
              {r.done ? (
                <span className="mx-auto grid h-5 w-5 place-items-center rounded-full bg-accentFill text-onAccent">
                  <Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden />
                  <span className="sr-only">Done</span>
                </span>
              ) : (
                <span className="mx-auto block h-5 w-5 rounded-full border-[1.5px] border-inkSoft/70">
                  <span className="sr-only">Not done</span>
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
