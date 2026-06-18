"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHydrated, useStore } from "@/lib/store";

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
  const [name, setName] = useState("");

  // Templates not attached to any program show up as standalone plans.
  const inProgram = new Set(programs.flatMap((p) => p.dayTemplateIds));
  const standalone = templates.filter((t) => !inProgram.has(t.id));

  return (
    <main className="space-y-5 p-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
        <p className="text-sm text-muted">Trainer programs and your own routines.</p>
      </header>

      {/* Create */}
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New name…"
          className="input"
        />
        <button
          className="btn-ghost shrink-0"
          onClick={() => {
            if (!name.trim()) return;
            createTemplate(name);
            setName("");
          }}
        >
          + Plan
        </button>
        <button
          className="btn-primary shrink-0"
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

      {!hydrated ? (
        <div className="card animate-pulse text-muted">Loading…</div>
      ) : (
        <>
          {/* Programs (trainer plans) */}
          {programs.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Programs</h2>
              {programs.map((p) => {
                const days = daysForProgram(p.id);
                return (
                  <div key={p.id} className="card space-y-2">
                    <div className="flex items-start justify-between">
                      <Link href={`/programs/${p.id}`} className="flex-1">
                        <p className="font-semibold">
                          {p.name}
                          {p.source === "trainer" && (
                            <span className="ml-2 rounded-full bg-accentDim/40 px-2 py-0.5 text-[10px] uppercase text-accent">
                              Trainer
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted">
                          {days.length} day{days.length === 1 ? "" : "s"} · tap to edit
                        </p>
                      </Link>
                      <button
                        className="btn-danger"
                        onClick={() => {
                          if (confirm(`Delete program “${p.name}”?`)) deleteProgram(p.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {days.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2"
                        >
                          <span className="text-sm">
                            {d.name}
                            <span className="ml-1 text-xs text-muted">
                              ({d.exercises.length})
                            </span>
                          </span>
                          <button
                            className="btn-primary px-3 py-1.5 text-xs"
                            onClick={() => {
                              const sid = startSession(d.id);
                              router.push(`/session/${sid}`);
                            }}
                          >
                            Start
                          </button>
                        </div>
                      ))}
                      <button
                        className="btn-ghost w-full text-xs"
                        onClick={() => {
                          const tid = addDayToProgram(p.id, `Day ${days.length + 1}`);
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
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Single plans
            </h2>
            {standalone.length === 0 ? (
              <div className="card text-center text-sm text-muted">No standalone plans.</div>
            ) : (
              standalone.map((t) => (
                <div key={t.id} className="card flex items-center justify-between">
                  <Link href={`/templates/${t.id}`} className="flex-1">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-muted">{t.exercises.length} exercises · tap to edit</p>
                  </Link>
                  <button
                    className="btn-primary px-3 py-1.5"
                    onClick={() => {
                      const sid = startSession(t.id);
                      router.push(`/session/${sid}`);
                    }}
                  >
                    Start
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => {
                      if (confirm(`Delete “${t.name}”?`)) deleteTemplate(t.id);
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
