"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, LogOut, Trash2 } from "lucide-react";
import { apiFetch, fetchMeCached, signOut, type Me } from "@/lib/auth";
import { pushState } from "@/lib/sync";
import { setAnalyticsOptOut } from "@/lib/analytics";
import { SIGN_IN_PATH } from "@/lib/paths";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { PromptDialog } from "@/components/PromptDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type CoachLink = { trainerId: string; trainerEmail: string; status: "pending" | "active"; invitedAt: string };

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = `toggle-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="flex items-start gap-4 p-4 sm:p-5">
      <div className="min-w-0 flex-1">
        <h3 id={id} className="text-sm font-semibold text-ink">
          {label}
        </h3>
        <div className="mt-0.5 text-xs text-muted">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative grid h-11 w-14 shrink-0 place-items-center disabled:opacity-50"
      >
        <span
          aria-hidden
          className={`block h-7 w-12 rounded-full border transition-colors ${
            checked ? "border-accentFill bg-accentFill" : "border-border bg-surface2"
          }`}
        />
        <span
          aria-hidden
          className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
            checked ? "translate-x-[10px]" : "-translate-x-[10px]"
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Account-only privacy controls: AI data-sharing consent, analytics opt-out,
 * coach access, full account export, sign-out-everywhere and deletion.
 */
export function AccountPrivacy() {
  const router = useRouter();
  const leaveSession = useStore((s) => s.leaveSession);
  const [me, setMe] = useState<Me | null>(null);
  const [links, setLinks] = useState<CoachLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [endAll, setEndAll] = useState(false);

  const load = useCallback(async () => {
    setMe(await fetchMeCached(true));
    try {
      const r = await apiFetch("/api/account/coaches");
      if (r.ok) setLinks((await r.json()).links ?? []);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePrivacy = async (patch: { aiConsent?: boolean; analyticsOptOut?: boolean }) => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/account/privacy", { method: "POST", body: JSON.stringify(patch) });
      if (!r.ok) throw new Error();
      if (patch.analyticsOptOut !== undefined) setAnalyticsOptOut(patch.analyticsOptOut);
      setMe(await fetchMeCached(true));
      toast("Saved");
    } catch {
      toast("Couldn't save. Check your connection and try again.", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const answer = async (trainerId: string, action: "accept" | "decline" | "revoke") => {
    try {
      const r = await apiFetch("/api/account/coaches", { method: "POST", body: JSON.stringify({ trainerId, action }) });
      if (!r.ok) throw new Error();
      toast(action === "accept" ? "Coach added" : action === "decline" ? "Invitation declined" : "Coach access removed");
      void load();
    } catch {
      toast("Couldn't update. Try again.", { variant: "error" });
    }
  };

  const deleteAccount = async (password: string) => {
    try {
      const r = await apiFetch("/api/account", { method: "DELETE", body: JSON.stringify({ password }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast(j.error ?? "Couldn't delete the account.", { variant: "error" });
        return;
      }
      setDeleting(false);
      leaveSession({ wipe: true });
      router.push("/");
      toast("Your account and its data were deleted.");
    } catch {
      toast("Couldn't reach the server. Nothing was deleted.", { variant: "error" });
    }
  };

  const signOutEverywhere = async () => {
    setEndAll(false);
    await pushState(); // keep anything not yet synced
    await signOut({ everywhere: true });
    leaveSession({ wipe: true });
    router.push(SIGN_IN_PATH);
  };

  const aiOn = Boolean(me?.aiConsent);

  return (
    <>
      <section className="scroll-mt-20 space-y-2" id="privacy">
        <h2 className="section-label px-1">Privacy</h2>
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          <Toggle
            label="AI coaching data sharing"
            checked={aiOn}
            disabled={!me || busy}
            onChange={(v) => savePrivacy({ aiConsent: v })}
            hint={
              <>
                When on, the AI coach receives your training history, profile (goal, experience, optional body stats)
                and any notes or limitations you entered, so it can analyse your training. Data is sent to our AI
                provider only when you use an AI feature; our server doesn&apos;t store your prompts or the coach&apos;s replies. Turn off any
                time — AI features stop working until you turn it back on.
              </>
            }
          />
          <Toggle
            label="Product analytics"
            checked={me ? !me.analyticsOptOut : true}
            disabled={!me || busy}
            onChange={(v) => savePrivacy({ analyticsOptOut: !v })}
            hint="Usage events linked to your account (e.g. 'workout finished', never workout contents) that help improve Trainova. Turning this off also deletes events already collected."
          />
        </div>
      </section>

      <section className="space-y-2" id="coaches">
        <h2 className="section-label px-1">Coaches</h2>
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {links.length === 0 ? (
            <p className="p-4 text-xs text-muted sm:p-5">
              No coaches. If a trainer invites you, the invitation appears here — they can&apos;t see your training until
              you accept.
            </p>
          ) : (
            links.map((l) => (
              <div key={l.trainerId} className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{l.trainerEmail}</p>
                  <p className="text-xs text-muted">
                    {l.status === "pending"
                      ? "Wants to coach you. Accepting lets them see your workouts and assign plans."
                      : "Can see your workouts and assign plans."}
                  </p>
                </div>
                {l.status === "pending" ? (
                  <div className="flex gap-2">
                    <button type="button" className="btn-ghost min-h-11 px-3 text-sm" onClick={() => answer(l.trainerId, "decline")}>
                      Decline
                    </button>
                    <button type="button" className="btn-primary min-h-11 px-4 text-sm" onClick={() => answer(l.trainerId, "accept")}>
                      Accept
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn-ghost min-h-11 px-3 text-sm" onClick={() => answer(l.trainerId, "revoke")}>
                    Remove access
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="section-label px-1">Account data</h2>
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          <div className="space-y-2.5 p-4 sm:p-5">
            <div>
              <h3 className="text-sm font-semibold text-ink">Download account data</h3>
              <p className="text-xs text-muted">Everything stored on our server for this account, as JSON.</p>
            </div>
            <a href="/api/account/export" className="btn-secondary inline-flex px-4 py-2.5 text-sm" download>
              <Download className="h-4 w-4" aria-hidden /> Download
            </a>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-inkSoft hover:bg-surface2/60 hover:text-ink sm:px-5"
            onClick={() => setEndAll(true)}
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sign out on all devices
          </button>
          <div className="space-y-2.5 p-4 sm:p-5">
            <div>
              <h3 className="text-sm font-semibold text-ink">Delete account</h3>
              <p className="text-xs text-muted">
                Permanently deletes your account and all synced data from our server, including coach links. This
                can&apos;t be undone — download your data first.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10"
              onClick={() => setDeleting(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Delete account
            </button>
          </div>
        </div>
      </section>

      <PromptDialog
        open={deleting}
        title="Delete your account?"
        body="Enter your password to confirm. Your account and all of its data will be removed permanently."
        label="Password"
        autoComplete="current-password"
        confirmLabel="Delete account"
        danger
        onConfirm={deleteAccount}
        onCancel={() => setDeleting(false)}
      />
      <ConfirmDialog
        open={endAll}
        title="Sign out everywhere?"
        body="Every device signed in to this account, including this one, will need to sign in again."
        confirmLabel="Sign out everywhere"
        onConfirm={signOutEverywhere}
        onCancel={() => setEndAll(false)}
      />
    </>
  );
}
