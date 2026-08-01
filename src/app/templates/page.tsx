"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { AiPlanButton } from "@/components/AiPlanButton";
import { AssignmentsInbox } from "@/components/AssignmentsInbox";

export default function PlansPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const programs = useStore((s) => s.programs);
  const templates = useStore((s) => s.templates);
  const daysForProgram = useStore((s) => s.daysForProgram);
  const createProgram = useStore((s) => s.createProgram);
  const deleteProgram = useStore((s) => s.deleteProgram);
  const addDayToProgram = useStore((s) => s.addDayToProgram);
  const createTemplate = useStore((s) => s.createTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const startSession = useStore((s) => s.startSession);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const [name, setName] = useState("");

  const start = (templateId: string) => {
    const { id, blocked } = startSession(templateId);
    if (blocked) {
      const a = getActiveSession();
      if (a) router.push(`/session/${a.id}`);
      return;
    }
    if (id) router.push(`/session/${id}`);
  };

  // Templates not attached to any program show up as standalone plans.
  const inProgram = new Set(programs.flatMap((p) => p.dayTemplateIds));
  const standalone = templates.filter((t) => !inProgram.has(t.id));

  return (
    <main className="space-y-6 p-4 pb-20">
      <header className="pt-2">
        <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
        <p className="mt-1 text-sm text-muted">
          Trainer programs and your own routines.
        </p>
      </header>

      {/* Create */}
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New plan name…"
          className="input w-full text-base"
        />
        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn-primary py-3 text-base font-semibold"
            onClick={() => {
              if (!name.trim()) return;
              createTemplate(name);
              setName("");
            }}
          >
            + Plan
          </button>
          <button
            className="btn-ghost py-3 text-base font-semibold"
            onClick={() => {
              if (!name.trim()) return;
              const id = createProgram(name, "trainer");
              setName("");
              router.push(`/programs/${id}`);
            }}
          >
            + Program
          </button>
        </div>
      </div>

      <AiPlanButton />

      <AssignmentsInbox />

      {!hydrated ? (
        <div className="card animate-pulse text-muted">Loading…</div>
      ) : (
        <>
          {/* Programs (trainer plans) */}
          {programs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Programs
              </h2>
              {programs.map((p) => {
                const days = daysForProgram(p.id);
                return (
                  <div key={p.id} className="card space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/programs/${p.id}`}
                        className="flex-1 min-w-0"
                      >
                        <p className="font-semibold text-base">
                          {p.name}
                          {p.source === "trainer" && (
                            <span className="ml-2 rounded-full bg-accentDim/40 px-2 py-0.5 text-[10px] uppercase text-accent">
                              Trainer
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted mt-1">
                          {days.length} day{days.length === 1 ? "" : "s"} · tap
                          to edit
                        </p>
                      </Link>
                      <button
                        className="btn-danger px-3 py-2 text-sm shrink-0"
                        onClick={() => {
                          if (confirm(`Delete program "${p.name}"?`))
                            deleteProgram(p.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="space-y-2">
                      {days.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between rounded-xl bg-surface2 px-4 py-3"
                        >
                          <span className="text-sm font-medium">
                            {d.name}
                            <span className="ml-2 text-xs text-muted">
                              ({d.exercises.length})
                            </span>
                          </span>
                          <button
                            className="btn-primary px-4 py-2 text-sm font-semibold"
                            onClick={() => start(d.id)}
                          >
                            Start
                          </button>
                        </div>
                      ))}
                      <button
                        className="btn-ghost w-full py-3 text-sm font-semibold"
                        onClick={() => {
                          const tid = addDayToProgram(
                            p.id,
                            `Day ${days.length + 1}`,
                          );
                          router.push(`/templates/${tid}`);
                        }}
                      >
                        + Add day
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* Standalone plans */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Single plans
            </h2>
            {standalone.length === 0 ? (
              <div className="card text-center py-8 text-sm text-muted">
                No standalone plans yet.
              </div>
            ) : (
              standalone.map((t) => (
                <div
                  key={t.id}
                  className="card flex items-center justify-between gap-3"
                >
                  <Link href={`/templates/${t.id}`} className="flex-1 min-w-0">
                    <p className="font-semibold text-base">{t.name}</p>
                    <p className="text-sm text-muted mt-1">
                      {t.exercises.length} exercises · tap to edit
                    </p>
                  </Link>
                  <button
                    className="btn-primary px-4 py-2 text-sm font-semibold shrink-0"
                    onClick={() => start(t.id)}
                  >
                    Start
                  </button>
                  <button
                    className="btn-danger px-3 py-2 text-sm shrink-0"
                    onClick={() => {
                      if (confirm(`Delete "${t.name}"?`)) deleteTemplate(t.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
