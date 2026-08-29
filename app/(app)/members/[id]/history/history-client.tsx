"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, signedPoints } from "@/lib/client";
import { formatDate, formatDateTime } from "@/lib/expiration";
import { CreateActivityModal } from "@/components/create-activity-modal";
import { RedeemModal } from "@/components/redeem-modal";
import type { ExpirationIntervalId } from "@/lib/settings-types";
import type { HistoryRange } from "@/lib/types";

type History = {
  range: HistoryRange;
  from: string | null;
  to: string;
  timezone: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  entries: {
    id: number;
    occurredAt: string;
    type: "EARN" | "REDEEM" | "EXPIRE";
    description: string;
    points: number;
    expiresAt: string | null;
  }[];
};

const CHIPS: { id: HistoryRange; label: string }[] = [
  { id: "3m", label: "Last 3 months" },
  { id: "6m", label: "Last 6 months" },
  { id: "1y", label: "Last 1 year" },
  { id: "all", label: "All" },
];

export function HistoryClient({
  memberId,
  memberActive,
  available,
  history: initial,
  activityTypes,
  timezone,
  interval,
}: {
  memberId: number;
  memberActive: boolean;
  available: number;
  history: History;
  activityTypes: { id: number; name: string }[];
  timezone: string;
  interval: ExpirationIntervalId;
}) {
  const router = useRouter();
  const [history, setHistory] = useState(initial);
  const [range, setRange] = useState<HistoryRange>(initial.range);
  const [availableNow, setAvailableNow] = useState(available);
  const [activityOpen, setActivityOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [loadingRange, setLoadingRange] = useState(false);

  useEffect(() => {
    setAvailableNow(available);
  }, [available]);

  async function fetchHistory(nextRange: HistoryRange, nextPage = 1, silent = false) {
    if (!silent) setLoadingRange(true);
    try {
      const data = await api<History>(
        `/api/members/${memberId}/history?range=${nextRange}&page=${nextPage}`,
      );
      setHistory(data);
      setRange(nextRange);
    } finally {
      if (!silent) setLoadingRange(false);
    }
  }

  async function afterLedgerChange() {
    await fetchHistory(range, 1, true);
    router.refresh();
  }

  function helper() {
    if (history.range === "all" || !history.from) return "Showing all history";
    return `Showing ${formatDate(new Date(history.from), timezone)} – ${formatDate(new Date(history.to), timezone)}`;
  }

  function pageLabel() {
    if (history.total === 0) return null;
    const start = (history.page - 1) * history.pageSize + 1;
    const end = Math.min(history.page * history.pageSize, history.total);
    return `${start}–${end} of ${history.total}`;
  }

  function typeLabel(t: History["entries"][number]["type"]) {
    if (t === "EARN") return "Earn";
    if (t === "REDEEM") return "Redeem";
    return "Expire";
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={!memberActive}
          onClick={() => setActivityOpen(true)}
        >
          Create Activity
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!memberActive || availableNow < 1}
          title={availableNow < 1 ? "No points to redeem." : undefined}
          onClick={() => setRedeemOpen(true)}
        >
          Redeem
        </button>
        {!memberActive ? <p className="text-[13px] text-danger">Inactive members cannot earn or redeem.</p> : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => fetchHistory(c.id, 1)}
            className={`rounded-full px-3 py-1 text-[13px] ${
              range === c.id ? "bg-pine text-cream" : "border border-line bg-cream text-muted hover:text-ink"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-[13px] text-muted">
        {helper()}
        {pageLabel() ? ` · ${pageLabel()}` : null}
      </p>

      {loadingRange ? (
        <p className="text-muted">Loading…</p>
      ) : history.entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
          <p className="text-muted">No history in this period.</p>
          {range !== "all" ? (
            <button type="button" className="btn-ghost mt-4" onClick={() => fetchHistory("all", 1)}>
              Show all history
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-cream">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Points</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {history.entries.map((row) => (
                  <tr key={row.id} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDateTime(new Date(row.occurredAt), timezone)}
                    </td>
                    <td className="px-4 py-3">{typeLabel(row.type)}</td>
                    <td className="px-4 py-3">{row.description}</td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${row.points > 0 ? "text-pine" : "text-ink"}`}
                    >
                      {signedPoints(row.points)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {row.expiresAt ? formatDateTime(new Date(row.expiresAt), timezone, false) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.totalPages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted">
                Page {history.page} of {history.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={history.page <= 1}
                  onClick={() => fetchHistory(range, history.page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={history.page >= history.totalPages}
                  onClick={() => fetchHistory(range, history.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {activityOpen ? (
        <CreateActivityModal
          memberId={memberId}
          activityTypes={activityTypes}
          timezone={timezone}
          interval={interval}
          onClose={() => setActivityOpen(false)}
          onSaved={async (nextAvailable) => {
            if (typeof nextAvailable === "number") setAvailableNow(nextAvailable);
            await afterLedgerChange();
            setActivityOpen(false);
          }}
        />
      ) : null}
      {redeemOpen ? (
        <RedeemModal
          memberId={memberId}
          available={availableNow}
          timezone={timezone}
          onClose={() => setRedeemOpen(false)}
          onSaved={async (nextAvailable) => {
            if (typeof nextAvailable === "number") setAvailableNow(nextAvailable);
            await afterLedgerChange();
            setRedeemOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
