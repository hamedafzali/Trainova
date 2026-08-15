"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { getToken } from "@/lib/auth";
import { CoachAttentionInbox } from "@/components/CoachAttentionInbox";
import { ListSkeleton } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";

type Client = { id: string; email: string; workouts: number };
type Progress = { workouts: number; sessions: { title: string; date: string }[] };

export default function TrainerPage() {
  const hydrated = useHydrated();
  const role = useStore((s) => s.session?.role);
  const isTrainer = role === "trainer" || role === "admin";
  const templates = useStore((s) => s.templates);
  const serializeTemplate = useStore((s) => s.serializeTemplate);

  const [clients, setClients] = useState<Client[]>([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});

  const auth = () => ({ authorization: `Bearer ${getToken()}` });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/trainer/clients", { headers: { authorization: `Bearer ${getToken()}` } });
      if (r.ok) setClients((await r.json()).clients ?? []);
      else setError("Couldn't load clients.");
    } catch {
      setError("Couldn't load clients. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (isTrainer) load();
    else setLoading(false);
  }, [hydrated, isTrainer, load]);

  const addClient = async () => {
    setMsg(null);
    try {
      const r = await fetch("/api/trainer/clients", {
        method: "POST",
        headers: { "content-type": "application/json", ...auth() },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (r.ok) {
        setEmail("");
        load();
      } else setMsg(j.error ?? "Failed");
    } catch {
      setMsg("Couldn't reach the server. Check your connection and try again.");
    }
  };

  const assign = async (clientId: string, templateId: string) => {
    if (!templateId) return;
    const payload = serializeTemplate(templateId);
    const tpl = templates.find((t) => t.id === templateId);
    if (!payload || !tpl) return;
    try {
      const r = await fetch("/api/trainer/assign", {
        method: "POST",
        headers: { "content-type": "application/json", ...auth() },
        body: JSON.stringify({ clientId, name: tpl.name, payload }),
      });
      setMsg(r.ok ? `Assigned “${tpl.name}”.` : "Assign failed");
    } catch {
      setMsg("Couldn't reach the server. Check your connection and try again.");
    }
    setTimeout(() => setMsg(null), 2500);
  };

  const viewProgress = async (clientId: string) => {
    try {
      const r = await fetch(`/api/trainer/progress?clientId=${clientId}`, { headers: auth() });
      if (r.ok) {
        const data = (await r.json()) as Progress;
        setProgress((p) => ({ ...p, [clientId]: data }));
      } else {
        const j = await r.json().catch(() => ({}) as { error?: string });
        setMsg(j.error || "Couldn't load progress.");
        setTimeout(() => setMsg(null), 2500);
      }
    } catch {
      setMsg("Couldn't load progress. Check your connection and try again.");
      setTimeout(() => setMsg(null), 2500);
    }
  };

  if (!hydrated || loading)
    return (
      <main className="mx-auto max-w-3xl p-4">
        <ListSkeleton />
      </main>
    );
  if (!isTrainer)
    return (
      <main className="mx-auto max-w-3xl space-y-3 p-4">
        <h1 className="page-title">Trainer</h1>
        <div className="rounded-card border border-border bg-surface shadow-card p-6">
          <p className="text-muted">This area is for trainers. Ask an admin to enable trainer mode.</p>
          <Link href="/" className="mt-2 inline-block text-accent hover:text-accentHover">
            ← Home
          </Link>
        </div>
      </main>
    );

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">{clients.length} linked</p>
        </div>
        <Link href="/profile" className="text-sm text-accent hover:text-accentHover font-semibold transition-colors">
          Done
        </Link>
      </header>

      {/* What needs a trainer's attention today leads; the roster is reference below it. */}
      <CoachAttentionInbox />

      <div className="rounded-card border border-border bg-surface shadow-card p-4 space-y-2">
        <label htmlFor="trainer-add-client-email" className="sr-only">
          Client's account email
        </label>
        <div className="flex gap-2">
          <input
            id="trainer-add-client-email"
            className="input"
            type="email"
            placeholder="Client’s account email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary shrink-0" onClick={addClient}>
            Add
          </button>
        </div>
        {msg && <p className="text-xs text-accent">{msg}</p>}
      </div>

      {error ? (
        <ErrorState body={error} onRetry={load} />
      ) : (
        <ul className="space-y-3">
          {clients.map((c) => (
            <li key={c.id} className="rounded-card border border-border bg-surface shadow-card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink">{c.email}</p>
                  <p className="text-xs text-muted mt-0.5">{c.workouts} workouts logged</p>
                </div>
                <button className="btn-ghost text-xs" onClick={() => viewProgress(c.id)}>
                  Progress
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span id={`assign-label-${c.id}`} className="text-xs text-muted">
                  Assign:
                </span>
                <select
                  className="input flex-1 py-1.5 text-sm"
                  defaultValue=""
                  aria-labelledby={`assign-label-${c.id}`}
                  onChange={(e) => assign(c.id, e.target.value)}
                >
                  <option value="" disabled>
                    Pick a plan…
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {progress[c.id] && (
                <div className="rounded-control bg-surface2 p-3 text-xs">
                  <p className="mb-1 font-semibold text-ink">Recent sessions</p>
                  {progress[c.id].sessions.length === 0 ? (
                    <p className="text-muted">No completed workouts yet.</p>
                  ) : (
                    progress[c.id].sessions.map((s, i) => (
                      <p key={i} className="text-muted">
                        {s.date} · {s.title}
                      </p>
                    ))
                  )}
                </div>
              )}
            </li>
          ))}
          {clients.length === 0 && (
            <li>
              <EmptyState
                icon="🧑‍🏫"
                title="No clients yet"
                body="Add a client by their account email to assign plans and view progress."
              />
            </li>
          )}
        </ul>
      )}
    </main>
  );
}
