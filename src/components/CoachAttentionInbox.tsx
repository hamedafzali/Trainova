"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

type AttentionItem = {
  clientId: string;
  email: string;
  severity: "high" | "medium";
  type: "pain" | "fatigue" | "inactive";
  message: string;
};

export function CoachAttentionInbox() {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    void fetch("/api/trainer/attention", { headers: { authorization: `Bearer ${token}` } })
      .then(async (response) => (response.ok ? response.json() : { attention: [] }))
      .then((body) => setItems(body.attention ?? []))
      .finally(() => setReady(true));
  }, []);

  if (!ready || items.length === 0) return null;

  return (
    <section className="card space-y-3 border-amber-400/30">
      <div>
        <p className="section-label">Coach attention</p>
        <h2 className="mt-1 text-xl font-bold text-white">Members needing a check-in</h2>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={`${item.clientId}:${item.type}`} className="rounded-xl bg-white/[0.04] p-3">
            <p className={`text-xs font-semibold uppercase ${item.severity === "high" ? "text-red-400" : "text-amber-400"}`}>
              {item.type}
            </p>
            <p className="mt-1 font-semibold text-white">{item.email}</p>
            <p className="mt-1 text-sm text-white/60">{item.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
