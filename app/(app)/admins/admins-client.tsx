"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Banner, Modal } from "@/components/modal";

type Admin = {
  id: number;
  name: string;
  email: string;
  role: "superadmin" | "admin";
  status: "active" | "inactive";
};

export function AdminsClient({
  admins,
  actorId,
  actorRole,
}: {
  admins: Admin[];
  actorId: number;
  actorRole: "superadmin" | "admin";
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<Admin | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
          Create admin
        </button>
      </div>
      {error ? <div className="mb-3"><Banner kind="error">{error}</Banner></div> : null}
      {ok ? <div className="mb-3"><Banner kind="ok">{ok}</Banner></div> : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-cream">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => {
              const canSetPassword = a.role === "admin" && a.id !== actorId;
              return (
                <tr key={a.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3">{a.name}</td>
                  <td className="px-4 py-3">{a.email}</td>
                  <td className="px-4 py-3">{a.role === "superadmin" ? "Superadmin" : "Admin"}</td>
                  <td className="px-4 py-3">{a.status === "active" ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3 text-right">
                    {canSetPassword ? (
                      <button type="button" className="text-[13px] font-semibold text-pine" onClick={() => setPasswordTarget(a)}>
                        Set password
                      </button>
                    ) : null}
                    {a.id !== actorId ? (
                      <button
                        type="button"
                        className="ml-3 text-[13px] text-muted hover:text-ink"
                        onClick={async () => {
                          setError("");
                          setOk("");
                          try {
                            await api(`/api/admins/${a.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                status: a.status === "active" ? "inactive" : "active",
                              }),
                            });
                            router.refresh();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Could not update admin.");
                          }
                        }}
                      >
                        {a.status === "active" ? "Deactivate" : "Reactivate"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <CreateAdminModal
          canCreateSuperadmin={actorRole === "superadmin"}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            setOk("Admin created. Share the email and password out of band.");
            router.refresh();
          }}
        />
      ) : null}
      {passwordTarget ? (
        <SetPasswordModal
          admin={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onSaved={() => {
            setPasswordTarget(null);
            setOk("Password updated.");
          }}
        />
      ) : null}
    </div>
  );
}

function CreateAdminModal({
  canCreateSuperadmin,
  onClose,
  onSaved,
}: {
  canCreateSuperadmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "superadmin">("admin");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await api("/api/admins", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          role,
          password,
          confirmPassword: confirm,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create admin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title="Create admin" onClose={() => !pending && onClose()}>
      <form onSubmit={submit} className="space-y-4">
        {error ? <Banner kind="error">{error}</Banner> : null}
        <div>
          <label className="label" htmlFor="admin-name">
            Name
          </label>
          <input id="admin-name" className="field" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            className="field"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="admin-role">
            Role
          </label>
          <select
            id="admin-role"
            className="field"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "superadmin")}
          >
            <option value="admin">Admin</option>
            {canCreateSuperadmin ? <option value="superadmin">Superadmin</option> : null}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="admin-password">
            Password
          </label>
          <input
            id="admin-password"
            className="field"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="admin-confirm">
            Confirm password
          </label>
          <input
            id="admin-confirm"
            className="field"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SetPasswordModal({
  admin,
  onClose,
  onSaved,
}: {
  admin: Admin;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await api(`/api/admins/${admin.id}/password`, {
        method: "POST",
        body: JSON.stringify({ password, confirmPassword: confirm }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title={`Set password · ${admin.name}`} onClose={() => !pending && onClose()}>
      <form onSubmit={submit} className="space-y-4">
        {error ? <Banner kind="error">{error}</Banner> : null}
        <div>
          <label className="label" htmlFor="new-pw">
            New password
          </label>
          <input
            id="new-pw"
            className="field"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="new-pw2">
            Confirm
          </label>
          <input
            id="new-pw2"
            className="field"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Set password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
