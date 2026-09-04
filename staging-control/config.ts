import path from "node:path";

/** Repo root. Start scripts always `cd` here. Never taken from request input. */
export const ROOT = path.resolve(process.cwd());

export const CONTROL_HOST = "127.0.0.1";
export const CONTROL_PORT = 3100;

export const STAGING_HOST = "127.0.0.1";
export const STAGING_PORT = 3001;
export const STAGING_HEALTH_URL = `http://${STAGING_HOST}:${STAGING_PORT}/health`;
export const STAGING_META_URL = `http://${STAGING_HOST}:${STAGING_PORT}/api/meta`;

export const STAGING_ENV_FILE = path.join(ROOT, "deploy/mac-cloudflare/staging.env");
export const STAGING_SETTINGS_FILE = path.join(ROOT, ".data/staging/program-settings.json");
export const RESTART_STAGING_SCRIPT = path.join(ROOT, "scripts/mac-cloudflare/restart-staging.sh");
export const AUDIT_LOG_FILE = path.join(ROOT, ".runtime/staging-control-audit.jsonl");

export const EXPIRATION_INTERVALS = ["6_months", "1_year"] as const;
export type ExpirationInterval = (typeof EXPIRATION_INTERVALS)[number];

export const LOOKBACK_PERIODS = ["3_months", "6_months", "1_year"] as const;
export type LookbackPeriod = (typeof LOOKBACK_PERIODS)[number];

export const ALLOWED_STAGING_ENV_FLAGS = ["ENABLE_CANCEL_EARN", "ENABLE_CANCEL_REDEEM"] as const;
export type AllowedStagingEnvFlag = (typeof ALLOWED_STAGING_ENV_FLAGS)[number];

export const HEALTH_WAIT_MS = 60_000;
export const HEALTH_POLL_MS = 500;
export const FETCH_TIMEOUT_MS = 8_000;
export const MAX_BODY_BYTES = 8_192;

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 30;
export const SETUP_RATE_LIMIT_MAX = 6;
