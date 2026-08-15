"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { AiPlanButton } from "@/components/AiPlanButton";
import { AssignmentsInbox } from "@/components/AssignmentsInbox";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { SEED_PLAN_ID, SEED_PROGRAM_ID } from "@/lib/seed";

function SeedBadge() {
  return (
    <span className="badge-accent">
      <span aria-hidden>✦</span> Sample
    </span>
  );
}

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
  const [confirmDeleteProgram, setConfirmDeleteProgram] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<{
    id: string;
    name: string;
  } | null>(null);

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

  const isEmpty = hydrated && programs.length === 0 && standalone.length === 0;

  // Lead action: resume an in-progress session, or jump straight into the
  // first available day — programs first, then standalone plans.
  const activeSession = hydrated ? getActiveSession() : undefined;
  const firstProgram = programs[0];
  const firstProgramDay = firstProgram
    ? daysForProgram(firstProgram.id)[0]
    : undefined;
  const heroTemplate = firstProgramDay ?? standalone[0];

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Plans</h1>
          <p className="page-subtitle">
            Programs and single-day routines you can start anytime.
          </p>
        </div>
        <button
          className="btn-primary px-5 py-2.5 text-sm font-semibold shrink-0"
          onClick={() => setCreating((v) => !v)}
        >
          + New
        </button>
      </header>

      {hydrated && activeSession && (
        <div className="rounded-card border border-accent/30 bg-accent/[0.06] shadow-elevated p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="section-label text-accent">In progress</p>
              <p className="font-semibold text-xl text-ink mt-1">
                Resume your workout
              </p>
            </div>
            <button
              className="btn-primary px-6 py-3 text-base font-semibold shrink-0"
              onClick={() => router.push(`/session/${activeSession.id}`)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {hydrated && !activeSession && heroTemplate && (
        <div className="rounded-card border border-border bg-surface shadow-elevated p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="section-label text-accent">Start here</p>
              <p className="font-semibold text-xl text-ink mt-1 truncate">
                {heroTemplate.name}
                {heroTemplate.id === SEED_PLAN_ID && (
                  <span className="ml-2 align-middle">
                    <SeedBadge />
                  </span>
                )}
              </p>
              <p className="text-sm text-inkSoft mt-1">
                {heroTemplate.exercises.length} exercise
                {heroTemplate.exercises.length === 1 ? "" : "s"}
                {firstProgramDay ? ` · ${firstProgram.name}` : ""}
              </p>
            </div>
            <button
              className="btn-primary px-6 py-3 text-base font-semibold shrink-0"
              onClick={() => start(heroTemplate.id)}
            >
              Start
            </button>
          </div>
        </div>
      )}

      {hydrated && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-card border border-border bg-surface shadow-card p-5 flex flex-col gap-1">
            <span className="text-xs text-inkSoft">Programs</span>
            <span className="text-stat text-ink">{programs.length}</span>
          </div>
          <div className="rounded-card border border-border bg-surface shadow-card p-5 flex flex-col gap-1">
            <span className="text-xs text-inkSoft">Single plans</span>
            <span className="text-stat text-ink">{standalone.length}</span>
          </div>
        </div>
      )}

      {/* Create */}
      {creating && (
        <div className="card shadow-card space-y-4">
          <label htmlFor="new-plan-name" className="sr-only">
            New plan name
          </label>
          <input
            id="new-plan-name"
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
        <ListSkeleton />
      ) : isEmpty ? (
        <div className="rounded-card border border-dashed border-border bg-surface text-center py-14 px-6 space-y-3">
          <p className="text-3xl" aria-hidden>
            🏋️
          </p>
          <p className="font-semibold text-lg text-ink">Build your first plan</p>
          <p className="text-sm text-inkSoft max-w-xs mx-auto">
            Create a single workout or a multi-day program — either one, you
            can start it right away.
          </p>
          <button
            className="btn-primary px-6 py-3 text-base font-semibold mt-2"
            onClick={() => setCreating(true)}
          >
            + New plan
          </button>
        </div>
      ) : (
        <>
          {/* Programs (trainer plans) */}
          {programs.length > 0 && (
            <section className="space-y-4">
              <h2 className="section-label">Programs</h2>
              {programs.map((p) => {
                const days = daysForProgram(p.id);
                return (
                  <div
                    key={p.id}
                    className="rounded-card border border-border bg-surface shadow-card p-6 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <Link href={`/programs/${p.id}`} className="flex-1 min-w-0">
                        <p className="font-semibold text-xl text-ink flex items-center flex-wrap gap-2">
                          {p.name}
                          {p.source === "trainer" && (
                            <span className="badge-accent">Trainer</span>
                          )}
                          {p.id === SEED_PROGRAM_ID && <SeedBadge />}
                        </p>
                        <p className="text-sm text-inkSoft mt-1.5">
                          {days.length} day{days.length === 1 ? "" : "s"} · tap
                          to edit
                        </p>
                      </Link>
                      <button
                        className="btn-danger px-4 py-2 text-base shrink-0"
                        onClick={() =>
                          setConfirmDeleteProgram({ id: p.id, name: p.name })
                        }
                      >
                        Delete
                      </button>
                    </div>
                    <div className="space-y-3">
                      {days.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between rounded-control bg-surface2 px-6 py-4 hover:bg-border/60 transition-colors"
                        >
                          <span className="text-base font-medium text-ink">
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
            <h2 className="section-label">Single plans</h2>
            {standalone.length === 0 ? (
              <EmptyState
                icon="✦"
                title="No single-day plans yet"
                body="Add one whenever you want a routine outside your programs."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {standalone.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-card border border-border bg-surface shadow-card p-6 flex flex-col gap-4"
                  >
                    <Link href={`/templates/${t.id}`} className="min-w-0">
                      <p className="font-semibold text-xl text-ink flex items-center flex-wrap gap-2">
                        {t.name}
                        {t.id === SEED_PLAN_ID && <SeedBadge />}
                      </p>
                      <p className="text-sm text-inkSoft mt-1.5">
                        {t.exercises.length} exercise
                        {t.exercises.length === 1 ? "" : "s"} · tap to edit
                      </p>
                    </Link>
                    <div className="flex items-center gap-3">
                      <button
                        className="btn-primary flex-1 py-2.5 text-base font-semibold"
                        onClick={() => start(t.id)}
                      >
                        Start
                      </button>
                      <button
                        className="btn-danger px-3 py-2.5 text-base shrink-0"
                        onClick={() =>
                          setConfirmDeleteTemplate({ id: t.id, name: t.name })
                        }
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={!!confirmDeleteProgram}
        title="Delete program"
        body={
          confirmDeleteProgram
            ? `Delete program "${confirmDeleteProgram.name}"?`
            : undefined
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (confirmDeleteProgram) deleteProgram(confirmDeleteProgram.id);
          setConfirmDeleteProgram(null);
        }}
        onCancel={() => setConfirmDeleteProgram(null)}
      />

      <ConfirmDialog
        open={!!confirmDeleteTemplate}
        title="Delete plan"
        body={
          confirmDeleteTemplate
            ? `Delete "${confirmDeleteTemplate.name}"?`
            : undefined
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (confirmDeleteTemplate) deleteTemplate(confirmDeleteTemplate.id);
          setConfirmDeleteTemplate(null);
        }}
        onCancel={() => setConfirmDeleteTemplate(null)}
      />
    </main>
  );
}
