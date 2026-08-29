"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Banner, Modal } from "@/components/modal";
import {
  exampleTierCopy,
  type ExpirationIntervalId,
  type LookbackPeriodId,
  type ProgramSettings,
  type TierRule,
  validateProgramSettings,
} from "@/lib/settings-types";

export function SettingsClient({ email, settings: initial }: { email: string; settings: ProgramSettings }) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordOk, setPasswordOk] = useState("");

  return (
    <div className="space-y-12">
      <AccountSection email={email} />
      <ProgramSection initial={initial} />
      <section className="border-t border-line pt-8">
        {passwordOk ? (
          <div className="mb-4 max-w-md">
            <Banner kind="ok">{passwordOk}</Banner>
          </div>
        ) : null}
        <button type="button" id="change-password" className="btn-ghost" onClick={() => setPasswordOpen(true)}>
          Change password
        </button>
      </section>
      {passwordOpen ? (
        <ChangePasswordModal
          onClose={() => setPasswordOpen(false)}
          onUpdated={() => {
            setPasswordOpen(false);
            setPasswordOk("Password updated.");
          }}
        />
      ) : null}
    </div>
  );
}

function AccountSection({ email }: { email: string }) {
  const router = useRouter();

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <section className="max-w-md">
      <h2 className="font-display text-2xl">Your account</h2>
      <p className="mt-1 mb-4 text-[14px] text-muted">{email}</p>
      <button type="button" className="btn-ghost" onClick={signOut}>
        Sign out
      </button>
    </section>
  );
}

function ChangePasswordModal({ onClose, onUpdated }: { onClose: () => void; onUpdated: () => void }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title="Change password" onClose={() => !pending && onClose()}>
      <form onSubmit={updatePassword} className="space-y-4">
        {error ? <Banner kind="error">{error}</Banner> : null}
        <div>
          <label className="label" htmlFor="current-pw">
            Current password
          </label>
          <input
            id="current-pw"
            className="field"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="new-pw">
            New password
          </label>
          <input
            id="new-pw"
            className="field"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="confirm-pw">
            Confirm new password
          </label>
          <input
            id="confirm-pw"
            className="field"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProgramSection({ initial }: { initial: ProgramSettings }) {
  const [interval, setInterval] = useState<ExpirationIntervalId>(initial.expiration.interval);
  const [timezone, setTimezone] = useState(initial.expiration.timezone);
  const [lookback, setLookback] = useState<LookbackPeriodId>(initial.tiers.lookbackPeriod);
  const [rules, setRules] = useState<TierRule[]>(initial.tiers.rules);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState(false);

  const draft: ProgramSettings = {
    schemaVersion: 1,
    expiration: { interval, timezone },
    tiers: { lookbackPeriod: lookback, rules },
  };

  const example = useMemo(() => {
    try {
      return exampleTierCopy(validateProgramSettings(draft));
    } catch {
      return exampleTierCopy(initial);
    }
  }, [draft, initial]);

  function updateRule(i: number, patch: Partial<TierRule>) {
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      validateProgramSettings(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid settings.");
      return;
    }
    setPending(true);
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify(draft) });
      setOk("Program settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-10">
      {error ? <Banner kind="error">{error}</Banner> : null}
      {ok ? <Banner kind="ok">{ok}</Banner> : null}

      <section>
        <h2 className="font-display text-2xl">Points expiration</h2>
        <fieldset className="mt-4">
          <legend className="label">Points expire after</legend>
          <div className="flex gap-4 text-[14px]">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="interval"
                checked={interval === "6_months"}
                onChange={() => setInterval("6_months")}
              />
              6 months
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="interval"
                checked={interval === "1_year"}
                onChange={() => setInterval("1_year")}
              />
              1 year
            </label>
          </div>
        </fieldset>
        <div className="mt-4 max-w-md">
          <label className="label" htmlFor="tz">
            Timezone
          </label>
          <input id="tz" className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </div>
        <p className="hint max-w-xl">
          New activities use this interval. Existing points keep the expiry they were given when earned.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl">Tiers</h2>
        <fieldset className="mt-4">
          <legend className="label">Lookback period</legend>
          <div className="flex flex-wrap gap-4 text-[14px]">
            {(
              [
                ["3_months", "3 months"],
                ["6_months", "6 months"],
                ["1_year", "1 year"],
              ] as const
            ).map(([id, label]) => (
              <label key={id} className="flex items-center gap-2">
                <input type="radio" name="lookback" checked={lookback === id} onChange={() => setLookback(id)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="hint max-w-xl">
          Tier uses points earned in this period, not the available balance. Redeeming or expiry does not lower the
          count; older earns falling out of the window can.
        </p>

        <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-cream">
          <table className="w-full max-w-lg text-left text-[14px]">
            <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Min points earned in period</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, i) => (
                <tr key={i} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3">
                    <input
                      className="field"
                      value={rule.name}
                      onChange={(e) => updateRule(i, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="field"
                      type="number"
                      min={rule.isBase ? 0 : 1}
                      step={1}
                      disabled={rule.isBase}
                      value={rule.minPoints}
                      onChange={(e) => updateRule(i, { minPoints: Number(e.target.value) })}
                    />
                    {rule.isBase ? <p className="hint">Locked at 0</p> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[14px] text-pine">{example}</p>
      </section>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
