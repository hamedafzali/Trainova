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
  const [creating, setCreating] = useState(false);

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
    <main className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Plans
          </h1>
          <p className="text-lg text-muted mt-2 md:text-xl">
            Trainer programs and your routines.
          </p>
        </div>
        <button
          className="btn-primary py-3 px-6 text-base font-semibold md:text-sm"
          onClick={() => setCreating(true)}
        >
          + New plan
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Create */}
          {creating && (
            <div className="card space-y-3 p-6">
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
                    setCreating(false);
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
                    setCreating(false);
                  }}
                >
                  + Program
                </button>
              </div>
            </div>
          )}

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
                      <div key={p.id} className="card space-y-3 p-6">
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href={`/programs/${p.id}`}
                            className="flex-1 min-w-0"
                          >
                            <p className="font-semibold text-lg">
                              {p.name}
                              {p.source === "trainer" && (
                                <span className="ml-2 rounded-full bg-accentDim/40 px-2 py-0.5 text-xs uppercase text-accent">
                                  Trainer
                                </span>
                              )}
                            </p>
                            <p className="text-base text-muted mt-1">
                              {days.length} day{days.length === 1 ? "" : "s"} ·
                              tap to edit
                            </p>
                          </Link>
                          <button
                            className="btn-danger px-4 py-2 text-base shrink-0"
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
                              <span className="text-base font-medium">
                                {d.name}
                                <span className="ml-2 text-sm text-muted">
                                  ({d.exercises.length})
                                </span>
                              </span>
                              <button
                                className="btn-primary px-4 py-2 text-base font-semibold"
                                onClick={() => start(d.id)}
                              >
                                Start
                              </button>
                            </div>
                          ))}
                          <button
                            className="btn-ghost w-full py-3 text-base font-semibold"
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
                  <div className="card text-center py-8 text-base text-muted">
                    No standalone plans yet.
                  </div>
                ) : (
                  standalone.map((t) => (
                    <div
                      key={t.id}
                      className="card flex items-center justify-between gap-3 p-6"
                    >
                      <Link
                        href={`/templates/${t.id}`}
                        className="flex-1 min-w-0"
                      >
                        <p className="font-semibold text-lg">{t.name}</p>
                        <p className="text-base text-muted mt-1">
                          {t.exercises.length} exercises · tap to edit
                        </p>
                      </Link>
                      <button
                        className="btn-primary px-4 py-2 text-base font-semibold shrink-0"
                        onClick={() => start(t.id)}
                      >
                        Start
                      </button>
                      <button
                        className="btn-danger px-3 py-2 text-base shrink-0"
                        onClick={() => {
                          if (confirm(`Delete "${t.name}"?`))
                            deleteTemplate(t.id);
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
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Info</h3>
            <div className="space-y-3 text-base">
              <p className="text-muted">
                Programs are multi-day plans from trainers or yourself.
              </p>
              <p className="text-muted">
                Single plans are one-off workout routines.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
