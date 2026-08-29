"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Banner } from "@/components/modal";
import { formatPhMobile } from "@/lib/phone";

export function ProfileForm({
  memberId,
  name: initialName,
  contactNumber,
  status,
}: {
  memberId: number;
  name: string;
  contactNumber: string;
  status: "active" | "inactive";
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(formatPhMobile(contactNumber));
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState(false);
  const [statusPending, setStatusPending] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    setPending(true);
    try {
      await api(`/api/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, contactNumber: phone }),
      });
      setOk("Saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  async function toggleStatus() {
    setError("");
    setOk("");
    setStatusPending(true);
    try {
      await api(`/api/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: status === "active" ? "inactive" : "active" }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setStatusPending(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-md space-y-4">
      {error ? <Banner kind="error">{error}</Banner> : null}
      {ok ? <Banner kind="ok">{ok}</Banner> : null}
      <div>
        <label className="label" htmlFor="profile-name">
          Full name
        </label>
        <input
          id="profile-name"
          className="field"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="profile-phone">
          Contact number
        </label>
        <input
          id="profile-phone"
          className="field"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className="btn-ghost" disabled={statusPending} onClick={toggleStatus}>
          {status === "active" ? "Deactivate member" : "Reactivate member"}
        </button>
      </div>
    </form>
  );
}
