"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Banner, Modal } from "@/components/modal";

type Member = { id: number; name: string };

export function MembersList({ initialMembers }: { initialMembers: Member[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await api<{ members: Member[] }>(`/api/members?q=${encodeURIComponent(debounced)}`);
      if (!cancelled) setMembers(data.members);
    })().catch(() => {
      if (!cancelled) setMembers([]);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const empty = useMemo(() => {
    if (members.length > 0) return null;
    return debounced.trim() ? "No members match." : "No members yet";
  }, [members, debounced]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const data = await api<{ member: Member }>("/api/members", {
        method: "POST",
        body: JSON.stringify({ name, contactNumber: phone }),
      });
      setOpen(false);
      router.push(`/members/${data.member.id}/history`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create member.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          className="field max-w-md"
          placeholder="Search names"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search members"
        />
        <button type="button" className="btn-primary ml-auto" onClick={() => setOpen(true)}>
          Create member
        </button>
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-line bg-cream/50 px-6 py-14 text-center">
          <p className="text-muted">{empty}</p>
          {empty === "No members yet" ? (
            <button type="button" className="btn-primary mt-4" onClick={() => setOpen(true)}>
              Create member
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-cream">
          {members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-pine/[0.04]"
                onClick={() => router.push(`/members/${m.id}/history`)}
              >
                <span className="text-[16px]">{m.name}</span>
                <span className="text-muted">→</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <Modal
          title="Create member"
          onClose={() => {
            if (!pending) setOpen(false);
          }}
        >
          <form onSubmit={create} className="space-y-4">
            {error ? <Banner kind="error">{error}</Banner> : null}
            <div>
              <label className="label" htmlFor="full-name">
                Full name
              </label>
              <input
                id="full-name"
                className="field"
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="contact">
                Contact number
              </label>
              <input
                id="contact"
                className="field"
                required
                placeholder="0917 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="hint">Philippine mobile. Stored as E.164 (e.g. +639171234567).</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending ? "Saving…" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
