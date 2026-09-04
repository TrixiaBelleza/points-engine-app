import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, SETUP_RATE_LIMIT_MAX } from "./config";

type Bucket = number[];

const general = new Map<string, Bucket>();
const setup = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number): Bucket {
  return bucket.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
}

function hit(store: Map<string, Bucket>, key: string, max: number, now: number): boolean {
  const next = prune(store.get(key) ?? [], now);
  if (next.length >= max) {
    store.set(key, next);
    return false;
  }
  next.push(now);
  store.set(key, next);
  return true;
}

export function allowRequest(ip: string, isSetup: boolean): boolean {
  const now = Date.now();
  if (!hit(general, ip, RATE_LIMIT_MAX, now)) return false;
  if (isSetup && !hit(setup, ip, SETUP_RATE_LIMIT_MAX, now)) return false;
  return true;
}
