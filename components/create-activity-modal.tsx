"use client";

import { useMemo, useState } from "react";
import { Modal, Banner } from "@/components/modal";
import { api } from "@/lib/client";
import { computeExpiresAt, formatExpirePhrase, parseOccurredAt, toDatetimeLocalValue } from "@/lib/expiration";
import type { ExpirationIntervalId } from "@/lib/settings-types";

export function CreateActivityModal({
  memberId,
  activityTypes,
  timezone,
  interval,
  onClose,
  onSaved,
}: {
  memberId: number;
  activityTypes: { id: number; name: string }[];
  timezone: string;
  interval: ExpirationIntervalId;
  onClose: () => void;
  onSaved: (available?: number) => void | Promise<void>;
}) {
  const [activityTypeId, setActivityTypeId] = useState(activityTypes[0] ? String(activityTypes[0].id) : "");
  const [points, setPoints] = useState("100");
  const [occurredAt, setOccurredAt] = useState(toDatetimeLocalValue(new Date(), timezone));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const preview = useMemo(() => {
    const n = Number(points);
    if (!Number.isInteger(n) || n < 1 || !occurredAt) return null;
    try {
      const utc = parseOccurredAt(occurredAt, timezone);
      const expires = computeExpiresAt(utc, timezone, interval);
      return { n, text: formatExpirePhrase(expires, timezone) };
    } catch {
      return null;
    }
  }, [points, occurredAt, timezone, interval]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(points);
    if (!activityTypeId || !Number.isInteger(n) || n < 1) return;
    setError("");
    setPending(true);
    try {
      const data = await api<{ member: { available: number } }>(`/api/members/${memberId}/activities`, {
        method: "POST",
        body: JSON.stringify({
          activityTypeId: Number(activityTypeId),
          points: n,
          occurredAt,
          note: note.trim() || undefined,
        }),
      });
      await onSaved(data.member.available);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save activity.");
    } finally {
      setPending(false);
    }
  }

  const n = Number(points);
  const canSubmit = Boolean(activityTypeId) && Number.isInteger(n) && n >= 1 && !pending;

  return (
    <Modal title="Create Activity" onClose={() => !pending && onClose()}>
      <form onSubmit={submit} className="space-y-4">
        {error ? <Banner kind="error">{error}</Banner> : null}
        <div>
          <label className="label" htmlFor="activity-type">
            Activity type
          </label>
          <select
            id="activity-type"
            className="field"
            required
            value={activityTypeId}
            onChange={(e) => setActivityTypeId(e.target.value)}
          >
            {activityTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="points">
            Points
          </label>
          <input
            id="points"
            className="field"
            type="number"
            min={1}
            step={1}
            required
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="occurred">
            Occurred at
          </label>
          <input
            id="occurred"
            className="field"
            type="datetime-local"
            step={1}
            required
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
          <p className="hint">Timezone: {timezone}</p>
        </div>
        <div>
          <label className="label" htmlFor="note">
            Note
          </label>
          <input id="note" className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {preview ? (
          <p className="rounded-lg bg-pine/10 px-3 py-2 text-[13px] text-pine">
            These {preview.n.toLocaleString("en-US")} points will expire on {preview.text}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
