import { SettingsClient } from "./settings-client";
import { requireSession } from "@/lib/session";
import { getProgramSettings } from "@/lib/settings";

export default async function SettingsPage() {
  const session = await requireSession();
  const settings = await getProgramSettings({ bypassCache: true });
  return (
    <div>
      <h1 className="mb-8 font-display text-4xl">Settings</h1>
      <SettingsClient email={session.email} settings={settings} />
    </div>
  );
}
