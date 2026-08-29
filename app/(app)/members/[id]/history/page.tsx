import { notFound } from "next/navigation";
import { HistoryClient } from "./history-client";
import { getHistory, getMemberSnapshot, listActivityTypes } from "@/lib/members";
import { getProgramSettings } from "@/lib/settings";

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const memberId = BigInt(id);
  const [member, history, activityTypes, settings] = await Promise.all([
    getMemberSnapshot(memberId),
    getHistory(memberId, "3m", 1),
    listActivityTypes(),
    getProgramSettings(),
  ]);
  return (
    <HistoryClient
      memberId={member.id}
      memberActive={member.status === "active"}
      available={member.available}
      history={history}
      activityTypes={activityTypes}
      timezone={settings.expiration.timezone}
      interval={settings.expiration.interval}
    />
  );
}
