import { notFound } from "next/navigation";
import { ProfileForm } from "./profile-form";
import { getMemberSnapshot } from "@/lib/members";
import { formatDate, formatExpirePhrase } from "@/lib/expiration";

function fmtPoints(n: number): string {
  return n.toLocaleString("en-US");
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const member = await getMemberSnapshot(BigInt(id));
  const nextCopy =
    member.available > 0 && member.nextExpiration
      ? `${fmtPoints(member.nextExpiration.amount)} points expire on ${formatExpirePhrase(new Date(member.nextExpiration.when), member.timezone)}`
      : "No points on file — nothing will expire.";
  const more =
    member.tier.nextTier && member.tier.nextTier.pointsNeeded > 0
      ? `${fmtPoints(member.tier.nextTier.pointsNeeded)} more to ${member.tier.nextTier.name}`
      : null;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display text-2xl">Profile</h2>
        <ProfileForm
          memberId={member.id}
          name={member.name}
          contactNumber={member.contactNumber}
          status={member.status}
        />
      </section>

      <section className="rounded-xl border border-line bg-cream p-5">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Tier</h3>
        <p className="mt-2 text-[16px]">
          {member.tier.name} · {fmtPoints(member.tier.qualifyingPoints)} points earned in the{" "}
          {member.tier.lookbackLabel}
        </p>
        {more ? <p className="mt-1 text-[14px] text-muted">{more}</p> : null}
        <p className="mt-3 text-[13px] text-muted">
          Member since {formatDate(new Date(member.createdAt), member.timezone)} ·{" "}
          {member.status === "active" ? "Active" : "Inactive"}
        </p>
      </section>

      <section className="rounded-xl border border-line bg-cream p-5">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Next expiration</h3>
        <p className="mt-2 text-[16px]">{nextCopy}</p>
      </section>
    </div>
  );
}
