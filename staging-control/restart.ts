import { spawn } from "node:child_process";
import {
  FETCH_TIMEOUT_MS,
  HEALTH_POLL_MS,
  HEALTH_WAIT_MS,
  RESTART_STAGING_SCRIPT,
  ROOT,
  STAGING_HEALTH_URL,
  STAGING_META_URL,
} from "./config";

export class StagingUnavailableError extends Error {
  constructor(message = "Staging is unavailable.") {
    super(message);
    this.name = "StagingUnavailableError";
  }
}

function runRestartScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [RESTART_STAGING_SCRIPT], {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", () => reject(new Error("Staging restart failed.")));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || "Staging restart failed."));
    });
  });
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new StagingUnavailableError();
  return res.json();
}

export async function fetchStagingMeta(): Promise<unknown> {
  try {
    return await fetchJson(STAGING_META_URL);
  } catch {
    throw new StagingUnavailableError();
  }
}

async function stagingIsHealthy(): Promise<boolean> {
  try {
    const res = await fetch(STAGING_HEALTH_URL, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const body: unknown = await res.json().catch(() => null);
    if (!body || typeof body !== "object") return false;
    return (body as { ok?: unknown }).ok === true;
  } catch {
    return false;
  }
}

export async function waitForStagingHealth(timeoutMs = HEALTH_WAIT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await stagingIsHealthy()) return true;
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
  }
  return stagingIsHealthy();
}

export async function restartStagingAndVerify(): Promise<{
  restart_completed: boolean;
  health: "healthy" | "unhealthy";
  verified_metadata: unknown;
}> {
  try {
    await runRestartScript();
  } catch {
    return { restart_completed: false, health: "unhealthy", verified_metadata: {} };
  }
  const healthy = await waitForStagingHealth();
  if (!healthy) {
    return { restart_completed: true, health: "unhealthy", verified_metadata: {} };
  }
  try {
    const meta = await fetchStagingMeta();
    return { restart_completed: true, health: "healthy", verified_metadata: meta };
  } catch {
    return { restart_completed: true, health: "unhealthy", verified_metadata: {} };
  }
}
