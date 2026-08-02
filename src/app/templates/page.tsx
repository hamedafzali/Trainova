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
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-600/20 to-teal-600/20 p-8 md:p-12 border border-white/10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070')] bg-cover bg-center opacity-20"></div>
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
            Workout Plans
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl">
            Build your perfect routine. Create programs, track progress, achieve
            your goals.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Create */}
          {creating && (
            <div className="card space-y-4 p-6">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="New plan name…"
                className="input w-full text-base"
              />
              <div className="grid grid-cols-2 gap-4">
                <button
                  className="btn-primary py-4 text-base font-semibold"
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
                  className="btn-ghost py-4 text-base font-semibold"
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
            <div className="card animate-pulse text-white/50">Loading…</div>
          ) : (
            <>
              {/* Programs (trainer plans) */}
              {programs.length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-lg font-semibold uppercase tracking-wide text-white/50">
                    Programs
                  </h2>
                  {programs.map((p) => {
                    const days = daysForProgram(p.id);
                    return (
                      <div key={p.id} className="card space-y-4 p-6">
                        <div className="flex items-start justify-between gap-4">
                          <Link
                            href={`/programs/${p.id}`}
                            className="flex-1 min-w-0"
                          >
                            <p className="font-semibold text-xl text-white">
                              {p.name}
                              {p.source === "trainer" && (
                                <span className="ml-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs uppercase text-blue-400">
                                  Trainer
                                </span>
                              )}
                            </p>
                            <p className="text-base text-white/60 mt-2">
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
                        <div className="space-y-3">
                          {days.map((d) => (
                            <div
                              key={d.id}
                              className="flex items-center justify-between rounded-xl bg-white/5 px-6 py-4 hover:bg-white/10 transition-all duration-300"
                            >
                              <span className="text-base font-medium text-white">
                                {d.name}
                                <span className="ml-2 text-sm text-white/50">
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
                            className="btn-ghost w-full py-4 text-base font-semibold"
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
              <section className="space-y-4">
                <h2 className="text-lg font-semibold uppercase tracking-wide text-white/50">
                  Single plans
                </h2>
                {standalone.length === 0 ? (
                  <div className="card text-center py-12 text-base text-white/50">
                    No standalone plans yet. Create your first workout routine!
                  </div>
                ) : (
                  standalone.map((t) => (
                    <div
                      key={t.id}
                      className="card flex items-center justify-between gap-4 p-6 hover:bg-white/5 transition-all duration-300"
                    >
                      <Link
                        href={`/templates/${t.id}`}
                        className="flex-1 min-w-0"
                      >
                        <p className="font-semibold text-xl text-white">
                          {t.name}
                        </p>
                        <p className="text-base text-white/60 mt-2">
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
          <div className="card">
            <h3 className="text-xl font-bold mb-6 text-white">Quick Info</h3>
            <div className="space-y-4 text-base text-white/70">
              <p>Programs are multi-day plans from trainers or yourself.</p>
              <p>Single plans are one-off workout routines.</p>
            </div>
          </div>

          {/* Motivation Card */}
          <div className="card relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070')] bg-cover bg-center opacity-30"></div>
            <div className="relative z-10 p-6">
              <h3 className="text-xl font-bold mb-3 text-white">
                Plan Your Success
              </h3>
              <p className="text-base text-white/70">
                A good plan is the foundation of great results. Start building
                yours today!
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
