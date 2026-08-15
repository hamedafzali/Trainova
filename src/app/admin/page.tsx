"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { getToken } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PromptDialog } from "@/components/PromptDialog";
import { ListSkeleton } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  has_state: string;
};

type Stats = {
  users: number;
  admins: number;
  trainers: number;
  withData: number;
  new7d: number;
  new30d: number;
  workouts: number;
  setsLogged: number;
  active7d: number;
  devices: number;
};

export default function AdminPage() {
  const hydrated = useHydrated();
  const isAdmin = useStore((s) => s.session?.role === "admin");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const auth = { authorization: `Bearer ${t}` };
      const [u, s] = await Promise.all([
        fetch("/api/admin/users", { headers: auth }),
        fetch("/api/admin/stats", { headers: auth }),
      ]);
      if (!u.ok) {
        const j = await u.json().catch(() => ({}) as { error?: string });
        setError(u.status === 403 ? "Not authorized." : j.error || "Couldn't load admin data.");
        return;
      }
      setUsers((await u.json()).users ?? []);
      if (s.ok) setStats(await s.json());
    } catch {
      setError("Couldn't load admin data. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (isAdmin) load();
    else setLoading(false);
  }, [hydrated, isAdmin, load]);

  const resetPassword = (u: AdminUser) => {
    setResetPasswordUser(u);
  };

  const submitResetPassword = async (pw: string) => {
    const u = resetPasswordUser;
    if (!u) return;
    setResetPasswordUser(null);
    try {
      const r = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ userId: u.id, password: pw }),
      });
      toast(r.ok ? "Password updated." : "Failed to update password.", {
        variant: r.ok ? "success" : "error",
      });
    } catch {
      toast("Couldn't reach the server. Check your connection and try again.", { variant: "error" });
    }
  };

  const deleteUser = (u: AdminUser) => {
    setConfirmDeleteUser(u);
  };

  const confirmDeleteUserAction = async () => {
    const u = confirmDeleteUser;
    if (!u) return;
    setConfirmDeleteUser(null);
    try {
      const r = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ userId: u.id }),
      });
      if (r.ok) load();
      else toast("Failed to delete user.", { variant: "error" });
    } catch {
      toast("Couldn't reach the server. Check your connection and try again.", { variant: "error" });
    }
  };

  const setRole = async (u: AdminUser, role: string) => {
    try {
      const r = await fetch("/api/admin/set-role", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ userId: u.id, role }),
      });
      if (r.ok) load();
      else toast("Failed to change role.", { variant: "error" });
    } catch {
      toast("Couldn't reach the server. Check your connection and try again.", { variant: "error" });
    }
  };

  if (!hydrated || loading)
    return (
      <main className="mx-auto max-w-4xl p-4">
        <ListSkeleton />
      </main>
    );

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-4xl space-y-3 p-4">
        <h1 className="page-title">Admin</h1>
        <div className="rounded-card border border-border bg-surface shadow-card p-6">
          <p className="text-muted">Admins only.</p>
          <Link href="/" className="mt-2 inline-block text-accent hover:text-accentHover">
            ← Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-subtitle">{users.length} users</p>
        </div>
        <Link href="/profile" className="text-sm text-accent hover:text-accentHover font-semibold transition-colors">
          Done
        </Link>
      </header>

      {error ? (
        <ErrorState body={error} onRetry={load} />
      ) : (
        <>
          {stats && (
            <div className="space-y-3">
              {/* Lead pair — cohort size and current engagement are what an admin checks first. */}
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Users" value={stats.users} sub={`+${stats.new7d} this wk`} lead />
                <Stat label="Active 7d" value={stats.active7d} sub="trained" lead />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Workouts" value={stats.workouts} sub="completed" />
                <Stat label="Sets" value={stats.setsLogged} sub="logged" />
                <Stat label="Trainers" value={stats.trainers} sub={`${stats.admins} admin`} />
                <Stat label="Devices" value={stats.devices} sub="in library" />
              </div>
            </div>
          )}

          <Link
            href="/admin/devices"
            className="flex items-center justify-between rounded-card border border-border bg-surface shadow-card px-5 py-4 hover:bg-border/60 transition-colors"
          >
            <span className="font-semibold text-ink">🏋️ Manage device library</span>
            <span className="text-muted">→</span>
          </Link>

          <ul className="space-y-3">
            {users.map((u) => (
              <li key={u.id} className="rounded-card border border-border bg-surface shadow-card p-6 space-y-3">
                <div>
                  <p className="font-semibold text-ink">{u.email}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {u.role}
                    {u.role === "admin" ? " ★" : ""} · joined{" "}
                    {new Date(u.created_at).toLocaleDateString()} ·{" "}
                    {Number(u.has_state) > 0 ? "has data" : "no data"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor={`role-${u.id}`} className="sr-only">
                    Role for {u.email}
                  </label>
                  <select
                    id={`role-${u.id}`}
                    className="input flex-1 py-1.5 text-xs"
                    value={u.role}
                    onChange={(e) => setRole(u, e.target.value)}
                  >
                    <option value="user">user</option>
                    <option value="trainer">trainer</option>
                    <option value="admin">admin</option>
                  </select>
                  <button className="btn-ghost flex-1 text-xs" onClick={() => resetPassword(u)}>
                    Reset pw
                  </button>
                  <button className="btn-danger flex-1 text-xs" onClick={() => deleteUser(u)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={!!confirmDeleteUser}
        title="Delete user"
        body={confirmDeleteUser ? `Delete ${confirmDeleteUser.email} and all their data? This can’t be undone.` : undefined}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteUserAction}
        onCancel={() => setConfirmDeleteUser(null)}
      />

      <PromptDialog
        open={!!resetPasswordUser}
        title="Reset password"
        body={resetPasswordUser ? `Set a new password for ${resetPasswordUser.email}.` : undefined}
        label="New password"
        placeholder="6+ characters"
        confirmLabel="Save"
        minLength={6}
        onConfirm={submitResetPassword}
        onCancel={() => setResetPasswordUser(null)}
      />
    </main>
  );
}

function Stat({ label, value, sub, lead }: { label: string; value: number; sub: string; lead?: boolean }) {
  return (
    <div className={`rounded-card border border-border bg-surface shadow-card text-center ${lead ? "p-5" : "p-4"}`}>
      <p className={`tabular-nums text-ink ${lead ? "text-stat" : "text-h2 font-semibold"}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-inkSoft mt-1">{label}</p>
      <p className="text-[10px] text-muted">{sub}</p>
    </div>
  );
}
