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
      .catch(() => ({ attention: [] }))
      .then((body) => setItems(body.attention ?? []))
      .finally(() => setReady(true));
  }, []);

  if (!ready || items.length === 0) return null;

  return (
    <section className="rounded-card border border-border bg-surface shadow-card overflow-hidden">
      <div className="p-5 sm:p-6 pb-4">
        <p className="section-label">Coach attention</p>
        <h2 className="mt-1 text-lg font-bold text-ink">Members needing a check-in</h2>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={`${item.clientId}:${item.type}`} className="px-5 sm:px-6 py-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                item.severity === "high" ? "bg-danger/10 text-danger" : "bg-amber/10 text-amber"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${item.severity === "high" ? "bg-danger" : "bg-amber"}`}
              />
              {item.type}
            </span>
            <p className="mt-2 font-semibold text-ink">{item.email}</p>
            <p className="mt-1 text-sm text-inkSoft">{item.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
