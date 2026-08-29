"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, fmtPoints } from "@/lib/client";
import { Banner } from "@/components/modal";

export function ExpireNow({
  memberId,
  unpostedExpired,
}: {
  memberId: number;
  unpostedExpired: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function run() {
    setError("");
    setOk("");
    setPending(true);
    try {
      const result = await api<{ lotsPosted: number; pointsExpired: number }>(
        `/api/members/${memberId}/expire`,
        { method: "POST" },
      );
      if (result.pointsExpired <= 0) {
        setOk("Nothing to expire. Remaining lots are still within their dates.");
      } else {
        setOk(`Posted Expire for ${fmtPoints(result.pointsExpired)} points.`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run expiration.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {unpostedExpired > 0 ? (
        <p className="text-[13px] text-muted">
          {fmtPoints(unpostedExpired)} points are past their expire date and not yet in history.
        </p>
      ) : null}
      {error ? <Banner kind="error">{error}</Banner> : null}
      {ok ? <Banner kind="ok">{ok}</Banner> : null}
      <button
        type="button"
        id="run-expiration"
        className="btn-ghost px-3 py-1.5 text-[13px]"
        disabled={pending}
        onClick={run}
      >
        {pending ? "Running…" : "Run expiration"}
      </button>
    </div>
  );
}
