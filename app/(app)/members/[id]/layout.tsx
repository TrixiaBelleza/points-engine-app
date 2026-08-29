import { notFound } from "next/navigation";
import { MemberChrome } from "./member-chrome";
import { getMemberSnapshot } from "@/lib/members";

export const dynamic = "force-dynamic";

export default async function MemberLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  try {
    const member = await getMemberSnapshot(BigInt(id));
    const chrome = {
      id: member.id,
      name: member.name,
      status: member.status,
      available: member.available,
      earnedTotal: member.earnedTotal,
      redeemedTotal: member.redeemedTotal,
      expiredTotal: member.expiredTotal,
      tier: member.tier,
    };
    return (
      <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        <MemberChrome member={chrome} />
        <div>{children}</div>
      </div>
    );
  } catch {
    notFound();
  }
}
