/** Local YYYY-MM-DD for a date. */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday 00:00 (local) of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

/** The seven local day keys (Mon→Sun) of the week containing `d`. */
export function weekDays(d: Date): string[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return localDayKey(x);
  });
}

/**
 * Consecutive weeks (Mon–Sun) with at least one workout. Strength training
 * isn't daily, so a weekly streak is the honest consistency measure. The
 * current week counts once trained, but an untrained current week doesn't
 * break the streak until it ends.
 */
export function weekStreak(trainedDays: Set<string>, today = new Date()): number {
  const trainedIn = (start: Date) =>
    weekDays(start).some((k) => trainedDays.has(k));
  let n = 0;
  const cursor = startOfWeek(today);
  if (trainedIn(cursor)) n++;
  cursor.setDate(cursor.getDate() - 7);
  while (trainedIn(cursor)) {
    n++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return n;
}
