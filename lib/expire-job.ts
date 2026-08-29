import { expireDueLots } from "./members";

const g = globalThis as unknown as { __pointsExpireJob?: boolean };

export function startExpireJob() {
  if (g.__pointsExpireJob) return;
  g.__pointsExpireJob = true;
  const tick = async () => {
    try {
      const n = await expireDueLots();
      if (n > 0) console.info(`expire-lots: posted ${n} EXPIRE row(s)`);
    } catch (err) {
      console.error("expire-lots failed:", err);
    }
  };
  void tick();
  setInterval(tick, 60_000);
}
