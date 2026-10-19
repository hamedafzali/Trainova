"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildDeterministicInsights } from "@/domain/coach";
import { buildInbox, unseen, type InboxItem } from "@/domain/inbox";
import { muscleReadiness, readinessEstimate } from "@/domain/recovery";
import { localDayKey } from "@/domain/streak";
import { apiFetch } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { useTrainingSummary } from "@/lib/useCoachData";

const SEEN_KEY = "trainova-inbox-seen";
const MAX_SEEN = 300;

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-MAX_SEEN)));
  } catch {
    // Private mode or blocked storage: the dot just stays until the items change.
  }
}

/** The bell's inbox items, the ones not seen yet, and a way to mark them seen. */
export function useInbox() {
  const account = useStore((s) => s.session?.mode === "account");
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const feedback = useStore((s) => s.feedback);
  const checkIns = useStore((s) => s.checkIns);
  const exerciseById = useStore((s) => s.exerciseById);
  const summary = useTrainingSummary();

  const [assignments, setAssignments] = useState<{ id: string; name: string; trainer: string }[]>([]);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());

  useEffect(() => setSeen(readSeen()), []);

  useEffect(() => {
    if (!account) return;
    let live = true;
    apiFetch("/api/assignments")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!live || !body) return;
        const list: { id: string; name: string; trainer_email: string }[] = body.assignments ?? [];
        setAssignments(list.map((a) => ({ id: a.id, name: a.name, trainer: a.trainer_email })));
      })
      .catch(() => {
        // Offline: no trainer plans shown, the rest of the inbox still works.
      });
    return () => {
      live = false;
    };
  }, [account]);

  const items: InboxItem[] = useMemo(() => {
    const today = localDayKey(new Date());
    const trainedDates = sessions.filter((s) => s.status === "completed").map((s) => s.date);
    const checkIn = checkIns.find((c) => c.date === today) ?? null;
    const hasTrained = trainedDates.length > 0;
    const estimate =
      hasTrained || checkIn
        ? readinessEstimate({ checkIn, feedback, trainedDates, muscles: muscleReadiness(sessions, sets, exerciseById), today })
        : null;
    return buildInbox({
      today,
      assignments,
      readiness: estimate && { band: estimate.band, painReported: estimate.painReported },
      checkedInToday: !!checkIn,
      hasTrained,
      insights: buildDeterministicInsights(summary),
    });
  }, [sessions, sets, feedback, checkIns, exerciseById, summary, assignments]);

  const fresh = useMemo(() => unseen(items, seen), [items, seen]);

  const markAllSeen = useCallback(() => {
    const next = readSeen();
    items.forEach((i) => next.add(i.id));
    writeSeen(next);
    setSeen(next);
  }, [items]);

  return { items, fresh, seen, markAllSeen };
}
