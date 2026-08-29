export type AppEnv = "development" | "staging" | "production";

function read(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export function getAppEnv(): AppEnv {
  const v = read("APP_ENV", "development");
  if (v === "staging" || v === "production" || v === "development") return v;
  return "development";
}

export function env() {
  const appEnv = getAppEnv();
  const sessionSecret = read("SESSION_SECRET");
  if (!sessionSecret || sessionSecret.length < 16) {
    throw new Error("SESSION_SECRET must be set to a string of at least 16 characters");
  }
  return {
    appEnv,
    publicUrl: read("APP_PUBLIC_URL") || "http://localhost:3000",
    version: emptyToNull(read("APP_VERSION")),
    gitTag: emptyToNull(read("GIT_TAG")),
    gitSha: emptyToNull(read("GIT_SHA")),
    deployedAt: emptyToNull(read("DEPLOYED_AT")),
    databaseUrl: read("DATABASE_URL"),
    sessionSecret,
    superadminEmail: read("SUPERADMIN_EMAIL"),
    superadminPassword: read("SUPERADMIN_PASSWORD"),
    settingsFile: read("SETTINGS_FILE"),
    seedDemoData: read("SEED_DEMO_DATA") === "true",
    enableCancelEarn: parseEnvFlag(read("ENABLE_CANCEL_EARN"), true),
    cookieSecure: appEnv === "production" || appEnv === "staging",
  };
}

export function parseEnvFlag(value: string, fallback = true): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return fallback;
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

export function cancelEarnEnabled(): boolean {
  return parseEnvFlag(read("ENABLE_CANCEL_EARN"), true);
}

function emptyToNull(v: string): string | null {
  return v ? v : null;
}
