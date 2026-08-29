"use client";

import { useState } from "react";
import { Modal, Banner } from "@/components/modal";
import { api, fmtPoints } from "@/lib/client";
import { toDatetimeLocalValue } from "@/lib/expiration";

export function RedeemModal({
  memberId,
  available,
  timezone,
  onClose,
  onSaved,
}: {
  memberId: number;
  available: number;
  timezone: string;
  onClose: () => void;
  onSaved: (available?: number) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("1");
  const [occurredAt, setOccurredAt] = useState(toDatetimeLocalValue(new Date(), timezone));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const n = Number(amount);
  const over = Number.isInteger(n) && n > available;
  const canSubmit = Number.isInteger(n) && n >= 1 && n <= available && !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setPending(true);
    try {
      const data = await api<{ member: { available: number } }>(`/api/members/${memberId}/redemptions`, {
        method: "POST",
        body: JSON.stringify({
          amount: n,
          occurredAt,
          note: note.trim() || undefined,
        }),
      });
      await onSaved(data.member.available);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not redeem.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title="Redeem" onClose={() => !pending && onClose()}>
      <form onSubmit={submit} className="space-y-4">
        {error ? <Banner kind="error">{error}</Banner> : null}
        <p className="text-[14px]">
          Available: <span className="font-semibold tabular-nums">{fmtPoints(available)}</span>
        </p>
        <div>
          <label className="label" htmlFor="amount">
            Amount
          </label>
          <input
            id="amount"
            className="field"
            type="number"
            min={1}
            max={available}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {over ? <p className="hint text-danger">Cannot redeem more than available.</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="redeem-at">
            Occurred at
          </label>
          <input
            id="redeem-at"
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
          <label className="label" htmlFor="redeem-note">
            Note
          </label>
          <input
            id="redeem-note"
            className="field"
            placeholder="Free drink"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {pending ? "Saving…" : "Redeem"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
