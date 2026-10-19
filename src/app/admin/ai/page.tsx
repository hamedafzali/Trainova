"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader, StatBand } from "@/components/kit";
import { ErrorState } from "@/components/ErrorState";
import { ListSkeleton } from "@/components/Skeleton";
import { apiFetch } from "@/lib/auth";
import { useHydrated, useStore } from "@/lib/store";
import type { AiRunStats } from "@/server/aiRuns";

const PERIODS = [
  { days: 1, label: "24 h" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");
const ms = (v: number | null) => (v === null ? "–" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);
const count = (v: number) => v.toLocaleString();

/** Admin AI observability: outcomes, latency, models and prompt versions from ai_runs. */
export default function AdminAiPage() {
  const hydrated = useHydrated();
  const isAdmin = useStore((s) => s.session?.role === "admin");
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<AiRunStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch(`/api/admin/ai-runs?days=${d}`);
      if (!r.ok) {
        setError(r.status === 403 ? "Not authorized." : "Couldn't load AI stats.");
        return;
      }
      setStats(await r.json());
    } catch {
      setError("Couldn't load AI stats. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (isAdmin) load(days);
    else setLoading(false);
  }, [hydrated, isAdmin, days, load]);

  if (hydrated && !isAdmin)
    return (
      <main className="mx-auto max-w-4xl space-y-3">
        <h1 className="page-title">AI runs</h1>
        <div className="card">
          <p className="text-muted">Admins only.</p>
        </div>
      </main>
    );

  const t = stats?.totals;
  const maxDaily = Math.max(1, ...(stats?.daily.map((d) => d.runs) ?? [1]));

  return (
    <main className="mx-auto max-w-4xl space-y-8 pb-20 md:pb-0">
      <PageHeader
        title="AI runs"
        subtitle="Outcomes, latency and models for every request that reached the model. Counts only, no content."
        actions={
          <Link href="/admin" className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 font-semibold text-accent hover:text-accentHover">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Admin
          </Link>
        }
      />

      <div role="group" aria-label="Period" className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            aria-pressed={days === p.days}
            onClick={() => setDays(p.days)}
            className={`chip min-h-11 px-4 ${days === p.days ? "border-accent bg-accentFill text-onAccent" : ""}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState body={error} onRetry={() => load(days)} />
      ) : loading || !stats || !t ? (
        <ListSkeleton />
      ) : (
        <>
          <StatBand
            label="AI run totals"
            columns="1fr 1fr 1fr 1fr"
            stats={[
              { label: "Runs", value: count(t.runs) },
              { label: "Success", value: pct(t.success, t.runs) },
              { label: "Fallback", value: pct(t.fallbacks, t.runs) },
              { label: "Users", value: count(t.users) },
            ]}
          />
          <p className="-mt-5 text-xs text-muted" data-testid="ai-totals">
            {count(t.rejected)} rejected by validation · {count(t.failed)} failed · {count(t.rateLimited)} rate limited ·{" "}
            {count(t.inputTokens)} input / {count(t.outputTokens)} output tokens
          </p>

          {t.runs === 0 ? (
            <div className="card text-sm text-muted">No AI runs in this period.</div>
          ) : (
            <>
              <section className="space-y-3" aria-labelledby="by-task">
                <h2 id="by-task" className="section-label">By task</h2>
                <div className="card overflow-x-auto p-0">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-xs text-muted">
                      <tr className="border-b border-border">
                        <th className="px-4 py-3 font-semibold">Task</th>
                        <th className="px-3 py-3 text-right font-semibold">Runs</th>
                        <th className="px-3 py-3 text-right font-semibold">Success</th>
                        <th className="px-3 py-3 text-right font-semibold">Rejected</th>
                        <th className="px-3 py-3 text-right font-semibold">Fallback</th>
                        <th className="px-3 py-3 text-right font-semibold">p50</th>
                        <th className="px-3 py-3 text-right font-semibold">p95</th>
                        <th className="px-4 py-3 text-right font-semibold">Tokens in/out</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border tabular-nums">
                      {stats.tasks.map((r) => (
                        <tr key={r.task}>
                          <td className="px-4 py-3 font-semibold text-ink">{r.task}</td>
                          <td className="px-3 py-3 text-right">{count(r.runs)}</td>
                          <td className="px-3 py-3 text-right">{pct(r.success, r.runs)}</td>
                          <td className={`px-3 py-3 text-right ${r.rejected > 0 ? "text-amber" : ""}`}>{count(r.rejected)}</td>
                          <td className="px-3 py-3 text-right">{pct(r.fallbacks, r.runs)}</td>
                          <td className="px-3 py-3 text-right">{ms(r.p50Ms)}</td>
                          <td className="px-3 py-3 text-right">{ms(r.p95Ms)}</td>
                          <td className="px-4 py-3 text-right text-inkSoft">
                            {r.avgInputTokens ?? "–"} / {r.avgOutputTokens ?? "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-3" aria-labelledby="per-day">
                <h2 id="per-day" className="section-label">Per day</h2>
                <div className="card flex h-40 items-end gap-1" aria-label="Runs per day">
                  {stats.daily.map((d) => (
                    <div key={d.day} className="flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${d.runs} runs, ${d.success} succeeded`}>
                      <div className="rounded-t bg-accentFill/80" style={{ height: `${(d.success / maxDaily) * 100}%` }} />
                      <div className="bg-amber/70" style={{ height: `${((d.runs - d.success) / maxDaily) * 100}%` }} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted">Lime: succeeded. Amber: rejected, failed or rate limited.</p>
              </section>

              <div className="grid gap-6 md:grid-cols-2">
                <Breakdown title="Models" rows={stats.models.map((m) => [m.model, m.runs])} />
                <Breakdown title="Error codes" rows={stats.errors.map((e) => [e.code, e.runs])} empty="No errors." />
              </div>

              <section className="space-y-3" aria-labelledby="prompts">
                <h2 id="prompts" className="section-label">Prompt versions</h2>
                <div className="card divide-y divide-border p-0">
                  {stats.prompts.map((p) => (
                    <div key={`${p.task}-${p.promptVersion}`} className="space-y-1 px-4 py-3 text-sm">
                      <p className="break-all font-mono text-xs text-ink">{p.promptVersion}</p>
                      <p className="tabular-nums text-muted">
                        {count(p.runs)} runs · {pct(p.rejected, p.runs)} rejected · {new Date(p.lastSeen).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}

function Breakdown({ title, rows, empty = "None." }: { title: string; rows: [string, number][]; empty?: string }) {
  const total = rows.reduce((n, [, v]) => n + v, 0);
  return (
    <section className="space-y-3">
      <h2 className="section-label">{title}</h2>
      <div className="card divide-y divide-border p-0">
        {rows.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">{empty}</p>
        ) : (
          rows.map(([label, v]) => (
            <div key={label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 truncate text-ink">{label}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {count(v)} · {pct(v, total)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
