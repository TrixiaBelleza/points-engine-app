import { expireDueLots } from "./members";

const g = globalThis as unknown as { __pointsExpireJob?: boolean };

export function startExpireJob() {
  if (g.__pointsExpireJob) return;
  g.__pointsExpireJob = true;
  const tick = async () => {
    try {
      const { lotsPosted } = await expireDueLots();
      if (lotsPosted > 0) console.info(`expire-lots: posted ${lotsPosted} EXPIRE row(s)`);
    } catch (err) {
      console.error("expire-lots failed:", err);
    }
  };
  void tick();
  setInterval(tick, 60_000);
}
