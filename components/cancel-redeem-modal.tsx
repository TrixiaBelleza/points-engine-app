"use client";

import { useState } from "react";
import { api, fmtPoints } from "@/lib/client";
import { Banner, Modal } from "@/components/modal";

export function CancelRedeemModal({
  memberId,
  ledgerId,
  remaining,
  onClose,
  onSaved,
}: {
  memberId: number;
  ledgerId: number;
  remaining: number;
  onClose: () => void;
  onSaved: (available?: number) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState("1");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const amount = mode === "full" ? remaining : Number(partialAmount);
  const canPartiallyCancel = remaining > 1;
  const validPartial =
    Number.isInteger(Number(partialAmount)) &&
    Number(partialAmount) >= 1 &&
    Number(partialAmount) < remaining;
  const canSubmit = !pending && (mode === "full" ? remaining > 0 : validPartial);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setError("");
    setPending(true);
    try {
      const data = await api<{ member: { available: number } }>(
        `/api/members/${memberId}/redemptions/${ledgerId}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({ amount }),
        },
      );
      await onSaved(data.member.available);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel this redemption.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title="Cancel redeem" onClose={() => !pending && onClose()}>
      <form onSubmit={submit} className="space-y-4">
        {error ? <Banner kind="error">{error}</Banner> : null}
        <p className="text-[14px]">
          Remaining on this redemption:{" "}
          <span className="font-semibold tabular-nums">{fmtPoints(remaining)}</span>
        </p>
        <fieldset className="space-y-2">
          <legend className="label">Cancellation</legend>
          <label className="flex items-center gap-2 text-[14px]">
            <input
              type="radio"
              name="cancel-redeem-mode"
              checked={mode === "full"}
              onChange={() => setMode("full")}
            />
            Fully cancel the remaining {fmtPoints(remaining)} points
          </label>
          <label className="flex items-center gap-2 text-[14px]">
            <input
              type="radio"
              name="cancel-redeem-mode"
              disabled={!canPartiallyCancel}
              checked={mode === "partial"}
              onChange={() => setMode("partial")}
            />
            Partially cancel
          </label>
        </fieldset>
        {mode === "partial" ? (
          <div>
            <label className="label" htmlFor="cancel-redeem-amount">
              Points to cancel
            </label>
            <input
              id="cancel-redeem-amount"
              className="field"
              type="number"
              min={1}
              max={remaining - 1}
              step={1}
              required
              value={partialAmount}
              onChange={(event) => setPartialAmount(event.target.value)}
            />
            <p className="hint">Use Full cancellation to restore all remaining redeemed points.</p>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" disabled={pending} onClick={onClose}>
            Close
          </button>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {pending ? "Cancelling…" : `Cancel ${fmtPoints(amount)} points`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
