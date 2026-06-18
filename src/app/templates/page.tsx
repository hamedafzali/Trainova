"use client";

import Link from "next/link";
import { useState } from "react";
import { useHydrated, useStore } from "@/lib/store";

export default function TemplatesPage() {
  const hydrated = useHydrated();
  const templates = useStore((s) => s.templates);
  const createTemplate = useStore((s) => s.createTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const [name, setName] = useState("");

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
        <p className="text-sm text-muted">Reusable workout templates.</p>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          createTemplate(name);
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New plan name (e.g. Push A)"
          className="input"
        />
        <button className="btn-primary shrink-0">Add</button>
      </form>

      {!hydrated ? (
        <div className="card animate-pulse text-muted">Loading…</div>
      ) : templates.length === 0 ? (
        <div className="card text-center text-muted">No plans yet.</div>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id} className="card flex items-center justify-between">
              <Link href={`/templates/${t.id}`} className="flex-1">
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-muted">{t.exercises.length} exercises · tap to edit</p>
              </Link>
              <button
                className="btn-danger"
                onClick={() => {
                  if (confirm(`Delete “${t.name}”?`)) deleteTemplate(t.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
