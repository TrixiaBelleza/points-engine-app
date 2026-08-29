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
  const settingsKey = read("SETTINGS_S3_KEY") || defaultSettingsKey(appEnv);
  if (appEnv === "development" && (settingsKey.startsWith("production/") || settingsKey.startsWith("staging/"))) {
    throw new Error("Refusing to use production/ or staging/ S3 keys when APP_ENV=development");
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
    awsRegion: read("AWS_REGION") || "ap-southeast-1",
    awsAccessKeyId: read("AWS_ACCESS_KEY_ID"),
    awsSecretAccessKey: read("AWS_SECRET_ACCESS_KEY"),
    awsS3Bucket: read("AWS_S3_BUCKET"),
    awsS3Endpoint: read("AWS_S3_ENDPOINT"),
    settingsS3Key: settingsKey,
    seedDemoData: read("SEED_DEMO_DATA") === "true",
    cookieSecure: appEnv === "production" || appEnv === "staging",
  };
}

function defaultSettingsKey(appEnv: AppEnv): string {
  if (appEnv === "production") return "production/program-settings.json";
  if (appEnv === "staging") return "staging/program-settings.json";
  return "local/program-settings.json";
}

function emptyToNull(v: string): string | null {
  return v ? v : null;
}
