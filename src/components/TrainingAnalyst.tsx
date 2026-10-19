"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { postAi, useAiStatus } from "@/lib/ai";
import { localDayKey } from "@/domain/streak";
import { MUSCLE_GROUPS } from "@/domain/taxonomy";
import {
  ANALYST_PERIODS,
  buildAnalystEvidence,
  ruleInterpretation,
  type AnalystEvidence,
  type AnalystFact,
  type AnalystInterpretation,
  type AnalystPeriod,
  type Confidence,
  type LiftStatus,
} from "@/domain/analyst";
import { Skeleton } from "@/components/Skeleton";
import { Segmented } from "@/components/ui/Segmented";
import { AiConsentCard } from "@/components/coach/AiConsentCard";

type AiResult = {
  evidence: AnalystEvidence;
  interpretation: AnalystInterpretation;
  fallback: "ai_off" | "no_data" | "invalid" | "unavailable" | null;
  dataVersion: number;
};

const PERIOD_OPTIONS = ANALYST_PERIODS.map((p) => ({ key: String(p), label: `${p} wk` }));

const STATUS: Record<LiftStatus, { label: string; badge: string; Icon: typeof TrendingUp }> = {
  improving: { label: "Improving", badge: "badge-success", Icon: TrendingUp },
  stalled: { label: "Stalled", badge: "badge-warning", Icon: Minus },
  declining: { label: "Declining", badge: "badge-danger", Icon: TrendingDown },
  insufficient: { label: "Too few sessions", badge: "badge-neutral", Icon: Minus },
};

const CONFIDENCE: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const groupLabel = (g: string) => MUSCLE_GROUPS.find((m) => m.key === g)?.label ?? g;
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}%`;
const formatFact = (f: AnalystFact) => `${f.value}${f.unit === "%" ? "%" : ` ${f.unit}`}`;

/**
 * Training Analyst: measured trends for a chosen period, then — kept visibly
 * apart — a reading of them. Numbers always come from the app; the AI reading
 * (when allowed) can only cite them.
 */
export function TrainingAnalyst() {
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const exercises = useStore((s) => s.exercises);
  const devices = useStore((s) => s.devices);
  const units = useStore((s) => s.units);
  const coaching = useStore((s) => s.profile.coaching);
  const [weeks, setWeeks] = useState<AnalystPeriod>(8);
  const today = localDayKey(new Date());

  const evidence = useMemo(
    () => buildAnalystEvidence({ sessions, sets, exercises, devices, units, coaching }, weeks, today),
    [sessions, sets, exercises, devices, units, coaching, weeks, today],
  );

  const ai = useAiStatus();
  const aiReady = ai.available === true && ai.signedIn && ai.consented === true;
  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [weeks]);

  const explain = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await postAi<AiResult>("/api/ai/analyst", { weeks, today }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The analyst couldn't answer. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const c = evidence.consistency;
  const reading = result?.interpretation ?? ruleInterpretation(evidence);
  // Citations resolve against the evidence the reading was made from.
  const citedFrom = result?.evidence ?? evidence;

  return (
    <section className="card space-y-5 p-4 sm:p-6" aria-labelledby="analyst-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="analyst-title" className="text-h3 text-ink">
            Training analysis
          </h2>
          <p className="text-xs text-muted">
            {evidence.period.from} – {evidence.period.to}
          </p>
        </div>
        <Segmented
          variant="accent"
          label="Analysis period"
          options={PERIOD_OPTIONS}
          value={String(weeks)}
          onChange={(k) => setWeeks(Number(k) as AnalystPeriod)}
        />
      </div>

      {/* Measured: computed on this device from the log. */}
      <div className="space-y-4" data-testid="analyst-evidence">
        <div className="flex items-center gap-2">
          <p className="section-label">Measured</p>
          <span className={evidence.confidence === "low" ? "badge-warning" : "badge-neutral"}>
            {CONFIDENCE[evidence.confidence]}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Figure label="Workouts" value={String(c.sessions)} sub={`prev. ${c.previousSessions}`} />
          <Figure
            label="Per week"
            value={String(c.perWeek)}
            sub={c.targetPerWeek ? `target ${c.targetPerWeek} · ${c.adherencePct}%` : "no target set"}
          />
          <Figure label="Longest gap" value={c.longestGapDays === null ? "—" : `${c.longestGapDays} d`} sub="between workouts" />
        </div>

        {evidence.lifts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-ink">Strength trend (est. 1RM)</p>
            <ul className="divide-y divide-border rounded-control border border-border">
              {evidence.lifts.map((l) => {
                const s = STATUS[l.status];
                return (
                  <li key={l.exerciseId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{l.name}</span>
                      <span className="block text-xs tabular-nums text-muted">
                        {l.sessions} session{l.sessions === 1 ? "" : "s"}
                        {l.startE1rm !== null && l.endE1rm !== null && ` · ${l.startE1rm} → ${l.endE1rm} ${evidence.units}`}
                      </span>
                    </span>
                    {l.changePct !== null && (
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-inkSoft">{signed(l.changePct)}</span>
                    )}
                    <span className={`${s.badge} shrink-0`}>
                      <s.Icon className="h-3 w-3" aria-hidden /> {s.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {evidence.muscleGroups.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-ink">Hard sets per muscle group</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {evidence.muscleGroups.map((m) => (
                <li key={m.group} className="rounded-control bg-surface2 px-3 py-2">
                  <p className="text-xs text-muted">{groupLabel(m.group)}</p>
                  <p className="text-sm font-semibold tabular-nums text-ink">
                    {m.hardSets} <span className="font-normal text-muted">· {m.perWeek}/wk</span>
                  </p>
                  <p className="text-xs tabular-nums text-muted">
                    {m.changePct === null ? `prev. ${m.previousHardSets}` : `${signed(m.changePct)} vs prev.`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {evidence.dataQuality.notes.length > 0 && (
          <ul className="space-y-1" aria-label="Missing or weak data">
            {evidence.dataQuality.notes.map((n) => (
              <li key={n} className="flex gap-2 text-xs text-inkSoft">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" aria-hidden /> {n}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Interpretation: visibly separate from the measurements above. */}
      <div className="space-y-3 rounded-control border border-ai/30 bg-ai/[0.06] p-4" data-testid="analyst-reading">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Sparkles className="h-4 w-4 text-ai" aria-hidden />
            {reading.source === "ai" ? "AI interpretation" : "What this means"}
          </p>
          <span className="text-xs text-muted">
            {reading.source === "ai"
              ? "From your last synced data · cites only the numbers above"
              : result?.fallback === "invalid"
                ? "The AI's answer didn't match your numbers, so this is the rule-based reading"
                : result?.fallback === "unavailable"
                  ? "AI unavailable right now — rule-based reading"
                  : "Rule-based reading"}
          </span>
        </div>

        {loading ? (
          <div className="space-y-2" aria-label="Analysing">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-inkSoft">{reading.summary}</p>
            {reading.points.length > 0 && (
              <ul className="space-y-3">
                {reading.points.map((p, i) => (
                  <li key={i} className="space-y-1">
                    <p className="text-sm font-semibold text-ink">{p.title}</p>
                    <p className="text-sm text-inkSoft">{p.detail}</p>
                    <p className="text-xs tabular-nums text-muted">
                      Based on{" "}
                      {p.factIds
                        .map((id) => citedFrom.facts.find((x) => x.id === id))
                        .filter((f) => f !== undefined)
                        .map((f, j) => (
                          <span key={f.id} title={f.label}>
                            {j > 0 && " · "}
                            <abbr className="no-underline" title={f.label}>
                              {formatFact(f)}
                            </abbr>
                          </span>
                        ))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {ai.available === true && ai.signedIn && ai.consented === false ? (
          <AiConsentCard compact />
        ) : aiReady && c.sessions > 0 ? (
          <button type="button" className="btn-secondary min-h-11 px-4 text-sm" onClick={() => void explain()} disabled={loading}>
            <Sparkles className="h-4 w-4" aria-hidden /> {result ? "Explain again" : "Explain with AI"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-control bg-surface2 px-3 py-2">
      <p className="truncate text-xs text-muted">{label}</p>
      <p className="text-lg font-bold tabular-nums text-ink">{value}</p>
      <p className="truncate text-[11px] tabular-nums text-muted">{sub}</p>
    </div>
  );
}
