// Pure session lifecycle rules. No I/O — the store calls these to stay correct.
// Lifecycle: active → completed → archived, with a guarded completed → active reopen.
// See ARCHITECTURE.md §3.

import type { WorkoutSession, WorkoutSet } from "./types";

/** The single active session, or null. Active state is derived, never a pointer. */
export function activeSession(sessions: WorkoutSession[]): WorkoutSession | null {
  return sessions.find((s) => s.status === "active") ?? null;
}

/** A new session may only be created when none is currently active. */
export function canCreateSession(sessions: WorkoutSession[]): boolean {
  return activeSession(sessions) === null;
}

/** A completed session may reopen only if nothing else is active. */
export function canReopen(session: WorkoutSession, sessions: WorkoutSession[]): boolean {
  return session.status === "completed" && activeSession(sessions) === null;
}

/** Number of sets actually logged (completed) in a session. */
export function completedSetCount(sessionId: string, sets: WorkoutSet[]): number {
  return sets.filter((x) => x.sessionId === sessionId && x.completed).length;
}

/**
 * An active session with zero completed sets is "abandoned" — finishing it should
 * discard it rather than persist an empty record that masquerades as in-progress.
 */
export function isAbandoned(session: WorkoutSession, sets: WorkoutSet[]): boolean {
  return session.status === "active" && completedSetCount(session.id, sets) === 0;
}

/** Local YYYY-MM-DD key for a date (the calendar/session date). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
