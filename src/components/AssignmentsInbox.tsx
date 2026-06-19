"use client";

import { useCallback, useEffect, useState } from "react";
import { useStore, type AssignedPlan } from "@/lib/store";
import { getToken } from "@/lib/auth";

type Assignment = { id: string; name: string; payload: AssignedPlan; trainer_email: string };

/** Shows plans a trainer assigned; importing creates a local template. */
export function AssignmentsInbox() {
  const account = useStore((s) => s.session?.mode === "account");
  const importAssignedPlan = useStore((s) => s.importAssignedPlan);
  const [items, setItems] = useState<Assignment[]>([]);

  const load = useCallback(async () => {
    if (!account || !getToken()) return;
    const r = await fetch("/api/assignments", { headers: { authorization: `Bearer ${getToken()}` } });
    if (r.ok) setItems((await r.json()).assignments ?? []);
  }, [account]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async (a: Assignment) => {
    importAssignedPlan(a.payload);
    await fetch("/api/assignments", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id: a.id }),
    });
    setItems((cur) => cur.filter((x) => x.id !== a.id));
  };

  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
        From your trainer
      </h2>
      {items.map((a) => (
        <div key={a.id} className="card flex items-center justify-between border-accent/50">
          <div>
            <p className="font-semibold">{a.name}</p>
            <p className="text-xs text-muted">
              {a.payload.exercises?.length ?? 0} exercises · {a.trainer_email}
            </p>
          </div>
          <button className="btn-primary px-3 py-1.5" onClick={() => accept(a)}>
            Import
          </button>
        </div>
      ))}
    </section>
  );
}
