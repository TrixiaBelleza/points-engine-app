"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TierPill } from "@/components/modal";
import { fmtPoints, signedPoints } from "@/lib/client";
import type { MemberChromeData } from "@/lib/types";

export function MemberChrome({ member }: { member: MemberChromeData }) {
  const pathname = usePathname();
  const historyHref = `/members/${member.id}/history`;
  const profileHref = `/members/${member.id}/profile`;
  return (
    <aside className="lg:sticky lg:top-8 lg:self-start">
      <Link href="/members" className="text-[13px] text-muted hover:text-ink">
        ← Back to Members
      </Link>
      <div className="mt-4 flex items-center gap-2">
        <h1 className="font-display text-3xl leading-tight">{member.name}</h1>
        <TierPill name={member.tier.name} />
      </div>
      {member.status === "inactive" ? (
        <p className="mt-2 text-[13px] font-medium text-danger">Inactive</p>
      ) : null}
      <p className="mt-3 text-[18px] font-semibold tabular-nums">
        {fmtPoints(member.available)} available
      </p>
      <table className="mt-3 w-full text-[14px]">
        <tbody>
          <Row label="Earned" value={fmtPoints(member.earnedTotal)} />
          <Row label="Redeemed" value={signedPoints(-member.redeemedTotal)} />
          <Row label="Expired" value={signedPoints(-member.expiredTotal)} />
          <tr className="border-t border-ink/20 font-semibold">
            <td className="py-1.5">Available</td>
            <td className="py-1.5 text-right tabular-nums">{fmtPoints(member.available)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-muted">All-time · does not follow the history filter.</p>
      <nav className="mt-6 flex gap-1 rounded-lg border border-line bg-cream p-1 text-[13px]">
        <SubLink href={historyHref} active={pathname.endsWith("/history")}>
          Points history
        </SubLink>
        <SubLink href={profileHref} active={pathname.endsWith("/profile")}>
          Profile
        </SubLink>
      </nav>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-1 text-muted">{label}</td>
      <td className="py-1 text-right tabular-nums">{value}</td>
    </tr>
  );
}

function SubLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex-1 rounded-md px-2 py-1.5 text-center ${
        active ? "bg-pine text-cream" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
