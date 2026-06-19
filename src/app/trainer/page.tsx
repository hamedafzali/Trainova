"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { getToken } from "@/lib/auth";

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
  const [progress, setProgress] = useState<Record<string, Progress>>({});

  const auth = () => ({ authorization: `Bearer ${getToken()}` });

  const load = useCallback(async () => {
    const r = await fetch("/api/trainer/clients", { headers: { authorization: `Bearer ${getToken()}` } });
    if (r.ok) setClients((await r.json()).clients ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (isTrainer) load();
    else setLoading(false);
  }, [hydrated, isTrainer, load]);

  const addClient = async () => {
    setMsg(null);
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
  };

  const assign = async (clientId: string, templateId: string) => {
    if (!templateId) return;
    const payload = serializeTemplate(templateId);
    const tpl = templates.find((t) => t.id === templateId);
    if (!payload || !tpl) return;
    const r = await fetch("/api/trainer/assign", {
      method: "POST",
      headers: { "content-type": "application/json", ...auth() },
      body: JSON.stringify({ clientId, name: tpl.name, payload }),
    });
    setMsg(r.ok ? `Assigned “${tpl.name}”.` : "Assign failed");
    setTimeout(() => setMsg(null), 2500);
  };

  const viewProgress = async (clientId: string) => {
    const r = await fetch(`/api/trainer/progress?clientId=${clientId}`, { headers: auth() });
    if (r.ok) {
      const data = (await r.json()) as Progress;
      setProgress((p) => ({ ...p, [clientId]: data }));
    }
  };

  if (!hydrated || loading) return <main className="p-4 text-muted">Loading…</main>;
  if (!isTrainer)
    return (
      <main className="space-y-3 p-4">
        <h1 className="text-2xl font-bold">Trainer</h1>
        <p className="text-muted">This area is for trainers. Ask an admin to enable trainer mode.</p>
        <Link href="/" className="text-accent">
          ← Home
        </Link>
      </main>
    );

  return (
    <main className="space-y-4 p-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted">{clients.length} linked</p>
        </div>
        <Link href="/profile" className="text-sm text-accent">
          Done
        </Link>
      </header>

      <div className="flex gap-2">
        <input
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

      <ul className="space-y-2">
        {clients.map((c) => (
          <li key={c.id} className="card space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{c.email}</p>
                <p className="text-xs text-muted">{c.workouts} workouts logged</p>
              </div>
              <button className="btn-ghost text-xs" onClick={() => viewProgress(c.id)}>
                Progress
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Assign:</span>
              <select
                className="input flex-1 py-1.5 text-sm"
                defaultValue=""
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
              <div className="rounded-lg bg-surface2 p-2 text-xs">
                <p className="mb-1 font-semibold">Recent sessions</p>
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
          <li className="card text-center text-sm text-muted">
            Add a client by their account email to assign plans and view progress.
          </li>
        )}
      </ul>
    </main>
  );
}
