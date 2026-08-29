"use client";

import { useEffect } from "react";

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[8vh] sm:pt-[12vh]">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        className={`relative w-full rounded-2xl border border-line bg-cream p-6 shadow-card ${wide ? "max-w-lg" : "max-w-md"}`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl text-ink">{title}</h2>
          <button type="button" className="text-muted hover:text-ink" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Banner({
  kind,
  children,
}: {
  kind: "error" | "ok";
  children: React.ReactNode;
}) {
  return (
    <p
      className={`rounded-lg px-3 py-2 text-[13px] ${
        kind === "error" ? "bg-red-50 text-danger" : "bg-pine/10 text-pine"
      }`}
    >
      {children}
    </p>
  );
}

export function TierPill({ name }: { name: string }) {
  const n = name.toLowerCase();
  const tone = n.includes("platinum")
    ? "bg-platinum text-white"
    : n.includes("gold")
      ? "bg-gold text-white"
      : n.includes("silver")
        ? "bg-silver text-white"
        : "bg-bronze text-white";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold tracking-wide ${tone}`}>
      {name}
    </span>
  );
}
