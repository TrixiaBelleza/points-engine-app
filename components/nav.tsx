"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/members", label: "Members" },
  { href: "/admins", label: "Admins" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ name }: { name: string }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-line/80 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/members" className="font-display text-xl tracking-tight text-pine">
          Points Engine
        </Link>
        <nav className="flex items-center gap-1 text-[14px]">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 ${
                  active ? "bg-pine/10 font-semibold text-pine" : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <p className="hidden text-[13px] text-muted sm:block">{name}</p>
      </div>
    </header>
  );
}
