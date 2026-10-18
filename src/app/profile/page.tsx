"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ChevronRight, Download, FileSpreadsheet, LogOut, Shield, Trash2, Upload, Users, X } from "lucide-react";
import { useHydrated, useStore } from "@/lib/store";
import { signOut } from "@/lib/auth";
import { pushState } from "@/lib/sync";
import type { UserProfile, Units } from "@/domain/types";
import { SCHEMA_VERSION } from "@/domain/legacy";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AccountPrivacy } from "@/components/AccountPrivacy";
import { Stepper } from "@/components/Stepper";
import { CardSkeleton } from "@/components/Skeleton";
import { buildBackup, buildSetsCsv, download } from "@/lib/backup";
import { localDayKey } from "@/domain/streak";
import { formatWeight, fromDisplay, toDisplay } from "@/lib/units";
import { toast } from "@/lib/toast";
import pkg from "../../../package.json";

const GOALS: { key: NonNullable<UserProfile["goal"]>; label: string }[] = [
  { key: "strength", label: "Strength" },
  { key: "hypertrophy", label: "Muscle" },
  { key: "fat_loss", label: "Fat loss" },
  { key: "health", label: "Health" },
];
const LEVELS: { key: NonNullable<UserProfile["experience"]>; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
            value === o.key
              ? "border-accentFill bg-accentFill text-onAccent"
              : "border-border bg-surface2 text-inkSoft hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5 p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-2">
      <h2 className="section-label px-1">{title}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const state = useStore();
  const { profile, session, units, bodyLog } = state;
  const [weight, setWeight] = useState<number | null>(null);
  const [weightDate, setWeightDate] = useState(() => localDayKey(new Date()));
  const [pendingImport, setPendingImport] = useState<Record<string, unknown> | null>(null);
  const [resetting, setResetting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!hydrated)
    return (
      <main className="mx-auto max-w-2xl">
        <CardSkeleton />
      </main>
    );

  const exit = async () => {
    const account = session?.mode === "account";
    // Flush pending changes, then clear this device so the next account starts clean.
    if (account) await pushState();
    await signOut();
    state.leaveSession({ wipe: account });
    router.push("/");
  };

  const persisted = () => ({
    units: state.units,
    profile: state.profile,
    audit: state.audit,
    devices: state.devices.filter((d) => d.owner != null),
    exercises: state.exercises.filter((e) => e.owner != null),
    programs: state.programs,
    templates: state.templates,
    sessions: state.sessions,
    sets: state.sets,
    feedback: state.feedback,
    prs: state.prs,
    bodyLog: state.bodyLog,
    tombstones: state.tombstones,
  });
  const stamp = localDayKey(new Date());

  const onFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.sessions) || !Array.isArray(data.sets)) throw new Error("bad");
      setPendingImport(data);
    } catch {
      toast("That file isn't a Trainova backup");
    }
  };

  const latest = [...bodyLog].sort((a, b) => b.date.localeCompare(a.date));
  const currentWeight = weight ?? Math.round(toDisplay(latest[0]?.weightKg ?? profile.weightKg ?? 75, units) * 10) / 10;
  const isTrainerOrAdmin = session?.role === "trainer" || session?.role === "admin";
  const completed = state.sessions.filter((s) => s.status === "completed").length;

  return (
    <main className="mx-auto max-w-2xl space-y-8 pb-12">
      <header>
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Your details, preferences and data.</p>
      </header>

      <Section title="About you">
        <Row label="Name">
          <input
            className="input"
            placeholder="Your name"
            aria-label="Name"
            maxLength={40}
            defaultValue={profile.displayName ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== profile.displayName) {
                state.updateProfile({ displayName: v });
                toast("Saved");
              }
            }}
          />
        </Row>
        <Row label="Goal" hint="Shapes program recommendations and coaching.">
          <Segmented label="Goal" options={GOALS} value={profile.goal} onChange={(goal) => state.updateProfile({ goal })} />
        </Row>
        <Row label="Experience">
          <Segmented
            label="Experience"
            options={LEVELS}
            value={profile.experience}
            onChange={(experience) => state.updateProfile({ experience })}
          />
        </Row>
      </Section>

      <Section title="Bodyweight" id="bodyweight">
        <Row label="Log your weight" hint="Used for bodyweight exercises and your progress chart.">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="date"
              aria-label="Date"
              className="input sm:w-44"
              value={weightDate}
              max={localDayKey(new Date())}
              onChange={(e) => setWeightDate(e.target.value)}
            />
            <div className="flex-1">
              <Stepper label="Bodyweight" value={currentWeight} step={0.1} min={20} max={units === "kg" ? 300 : 660} unit={units} decimals={1} onChange={setWeight} />
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                state.addBodyweight(weightDate, fromDisplay(currentWeight, units));
                setWeight(null);
                toast("Weight logged");
              }}
            >
              Save
            </button>
          </div>
        </Row>
        {latest.length > 0 && (
          <ul className="divide-y divide-border">
            {latest.slice(0, 8).map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span className="flex-1 text-inkSoft">
                  {new Date(b.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="font-semibold tabular-nums text-ink">{formatWeight(b.weightKg, units)}</span>
                <button
                  type="button"
                  aria-label={`Delete entry for ${b.date}`}
                  className="grid h-11 w-11 place-items-center rounded-control text-muted hover:bg-danger/10 hover:text-danger"
                  onClick={() => state.removeBodyweight(b.id)}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Preferences">
        <Row label="Weight unit" hint="Everything is stored precisely; switching only changes how weights are shown.">
          <Segmented<Units>
            label="Weight unit"
            options={[
              { key: "kg", label: "Kilograms (kg)" },
              { key: "lb", label: "Pounds (lb)" },
            ]}
            value={units}
            onChange={(u) => state.setUnits(u)}
          />
        </Row>
        <Row label="Appearance">
          <ThemeToggle />
        </Row>
      </Section>

      <Section title="Your data">
        <Row
          label="Export"
          hint={`${completed} workout${completed === 1 ? "" : "s"} and ${state.sets.filter((x) => x.completed).length} sets. Your data is yours — take it anywhere.`}
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary px-4 py-2.5 text-sm"
              onClick={() =>
                download(`trainova-backup-${stamp}.json`, JSON.stringify(buildBackup(persisted(), SCHEMA_VERSION), null, 2), "application/json")
              }
            >
              <Download className="h-4 w-4" aria-hidden /> Full backup (JSON)
            </button>
            <button
              type="button"
              className="btn-secondary px-4 py-2.5 text-sm"
              onClick={() => download(`trainova-sets-${stamp}.csv`, buildSetsCsv(state), "text/csv")}
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden /> Workout log (CSV)
            </button>
          </div>
        </Row>
        <Row label="Restore from backup" hint="Replaces the data on this device with a Trainova JSON backup.">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <button type="button" className="btn-ghost px-4 py-2.5 text-sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden /> Choose backup file
          </button>
        </Row>
        <Row label="Delete all data" hint="Removes every workout, plan and measurement. Export a backup first.">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10"
            onClick={() => setResetting(true)}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete all data
          </button>
        </Row>
      </Section>

      <Section title="Account">
        <div className="flex items-center gap-3 p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
              {session?.mode === "account" ? session.email : "Guest"}
              {profile.role !== "user" && <span className="badge-accent capitalize">{profile.role}</span>}
            </p>
            <p className="text-xs text-muted">
              {session?.mode === "account"
                ? "Signed in — your data syncs across devices."
                : "Your data is stored on this device only. Export a backup to keep it safe."}
            </p>
          </div>
        </div>
        {isTrainerOrAdmin && (
          <Link href="/trainer" className="flex items-center gap-3 px-4 py-3.5 text-sm text-ink hover:bg-surface2/60 sm:px-5">
            <Users className="h-4 w-4 text-muted" aria-hidden />
            <span className="flex-1">Trainer · clients</span>
            <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
          </Link>
        )}
        {session?.role === "admin" && (
          <Link href="/admin" className="flex items-center gap-3 px-4 py-3.5 text-sm text-ink hover:bg-surface2/60 sm:px-5">
            <Shield className="h-4 w-4 text-muted" aria-hidden />
            <span className="flex-1">Admin panel</span>
            <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
          </Link>
        )}
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-inkSoft hover:bg-surface2/60 hover:text-ink sm:px-5"
          onClick={exit}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {session?.mode === "account" ? "Sign out" : "Switch account / sign in"}
        </button>
      </Section>

      {session?.mode === "account" && <AccountPrivacy />}

      <p className="text-center text-xs text-muted">Trainova v{pkg.version}</p>

      <ConfirmDialog
        open={!!pendingImport}
        title="Restore this backup?"
        body={
          pendingImport
            ? `It contains ${(pendingImport.sessions as unknown[]).length} workouts. The data currently on this device will be replaced.`
            : undefined
        }
        confirmLabel="Restore"
        onConfirm={() => {
          const ok = pendingImport ? state.importBackup(pendingImport) : false;
          setPendingImport(null);
          toast(ok ? "Backup restored" : "Couldn't restore that backup");
        }}
        onCancel={() => setPendingImport(null)}
      />
      <ConfirmDialog
        open={resetting}
        title="Delete all your data?"
        body="Every workout, plan, record and measurement will be permanently removed. This can't be undone."
        confirmLabel="Delete everything"
        danger
        onConfirm={() => {
          state.resetUserData({ forget: true });
          setResetting(false);
          router.push("/");
        }}
        onCancel={() => setResetting(false)}
      />
    </main>
  );
}
