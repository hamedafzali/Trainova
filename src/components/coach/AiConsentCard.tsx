"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { setAiConsent } from "@/lib/ai";
import { toast } from "@/lib/toast";

/**
 * Shown instead of AI features until the account allows AI data sharing.
 * The server enforces the same rule, so this is disclosure, not the guard.
 */
export function AiConsentCard({ compact }: { compact?: boolean }) {
  const [saving, setSaving] = useState(false);
  const allow = async () => {
    setSaving(true);
    const ok = await setAiConsent(true);
    setSaving(false);
    if (!ok) toast("Couldn't save. Check your connection and try again.", { variant: "error" });
  };
  return (
    <div className="space-y-3 rounded-control border border-ai/30 bg-ai/[0.06] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <ShieldCheck className="h-4 w-4 text-ai" aria-hidden /> Allow AI coaching?
      </p>
      <p className="text-xs text-inkSoft">
        To analyse your training, the AI coach sends your workout history, plans, profile (goal, experience, optional
        body stats) and any notes or limitations to our AI provider when you use an AI feature.
        {!compact && " Our server doesn't keep your prompts or the coach's replies. You can turn this off in Profile → Privacy."}
      </p>
      <button type="button" className="btn-primary min-h-11 px-4 text-sm" disabled={saving} onClick={allow}>
        {saving ? "Saving…" : "Allow and continue"}
      </button>
    </div>
  );
}
