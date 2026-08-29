import { env } from "./env";
import { seedSuperadminIfEmpty } from "./admins";
import { seedActivityTypes, expireDueLots } from "./members";
import { getProgramSettings } from "./settings";
import { startExpireJob } from "./expire-job";
import { seedDemoData } from "./demo-seed";

const g = globalThis as unknown as { __pointsBoot?: Promise<void> };

export function boot(): Promise<void> {
  if (!g.__pointsBoot) {
    g.__pointsBoot = (async () => {
      await getProgramSettings();
      await seedSuperadminIfEmpty();
      await seedActivityTypes();
      if (env().seedDemoData) {
        await seedDemoData();
      }
      await expireDueLots();
      startExpireJob();
    })().catch((err) => {
      console.error("Boot failed:", err);
      g.__pointsBoot = undefined;
    });
  }
  return g.__pointsBoot ?? Promise.resolve();
}
