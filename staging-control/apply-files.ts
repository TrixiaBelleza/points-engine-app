import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateProgramSettings, type ProgramSettings } from "@/lib/settings-types";
import { ALLOWED_STAGING_ENV_FLAGS, ROOT, type AllowedStagingEnvFlag } from "./config";
import type { SetupBody } from "./validate";

const PROD_ENV = path.join(ROOT, "deploy/mac-cloudflare/prod.env");
const STAGING_ENV = path.join(ROOT, "deploy/mac-cloudflare/staging.env");
const STAGING_SETTINGS = path.join(ROOT, ".data/staging/program-settings.json");
const PROD_SETTINGS = path.join(ROOT, ".data/production/program-settings.json");
const ALLOWED_ENV = new Set<string>(ALLOWED_STAGING_ENV_FLAGS);

function sameFile(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

function assertNotProduction(filePath: string): void {
  const resolved = path.resolve(filePath);
  if (sameFile(resolved, PROD_ENV) || sameFile(resolved, PROD_SETTINGS)) {
    throw new Error("Refusing to write production files.");
  }
}

function assertStagingEnv(filePath: string): void {
  assertNotProduction(filePath);
  if (!sameFile(filePath, STAGING_ENV)) {
    throw new Error("Refusing to write a non-staging env file.");
  }
}

function assertStagingSettings(filePath: string): void {
  assertNotProduction(filePath);
  if (!sameFile(filePath, STAGING_SETTINGS)) {
    throw new Error("Refusing to write a non-staging settings file.");
  }
}

function assertAllowedEnvFlag(key: string): asserts key is AllowedStagingEnvFlag {
  if (!ALLOWED_ENV.has(key)) {
    throw new Error("Refusing to write an env key that is not on the allow-list.");
  }
}

export type SettingsPatch = Pick<SetupBody["changes"], "expiration_interval" | "timezone" | "tiers">;

export async function rewriteAllowedEnvFlagForTest(
  filePath: string,
  key: AllowedStagingEnvFlag,
  enabled: boolean,
): Promise<void> {
  assertNotProduction(filePath);
  await writeAllowedEnvFlag(filePath, key, enabled);
}

export async function rewriteAllowedEnvFlag(
  filePath: string,
  key: AllowedStagingEnvFlag,
  enabled: boolean,
): Promise<void> {
  assertStagingEnv(filePath);
  await writeAllowedEnvFlag(filePath, key, enabled);
}

export async function rewriteProgramSettingsPatchForTest(filePath: string, patch: SettingsPatch): Promise<void> {
  assertNotProduction(filePath);
  await writeProgramSettingsPatch(filePath, patch);
}

export async function rewriteProgramSettingsPatch(filePath: string, patch: SettingsPatch): Promise<void> {
  assertStagingSettings(filePath);
  await writeProgramSettingsPatch(filePath, patch);
}

async function writeAllowedEnvFlag(filePath: string, key: AllowedStagingEnvFlag, enabled: boolean): Promise<void> {
  assertAllowedEnvFlag(key);
  const text = await readFile(filePath, "utf8");
  const lineRe = new RegExp(`^${key}=`);
  const lines = text.split("\n");
  let found = false;
  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    if (lineRe.test(trimmed)) {
      found = true;
      return `${key}=${enabled ? "true" : "false"}`;
    }
    return line;
  });
  if (!found) {
    if (next.length && next[next.length - 1] === "") {
      next[next.length - 1] = `${key}=${enabled ? "true" : "false"}`;
      next.push("");
    } else {
      next.push(`${key}=${enabled ? "true" : "false"}`);
    }
  }
  await writeFile(filePath, next.join("\n"), "utf8");
}

async function writeProgramSettingsPatch(filePath: string, patch: SettingsPatch): Promise<void> {
  const text = await readFile(filePath, "utf8");
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Staging program settings are invalid.");
  }
  const record = data as Record<string, unknown>;
  const expirationRaw = record.expiration;
  if (!expirationRaw || typeof expirationRaw !== "object" || Array.isArray(expirationRaw)) {
    throw new Error("Staging program settings are missing expiration.");
  }
  const expiration = expirationRaw as Record<string, unknown>;
  if (patch.expiration_interval !== undefined) expiration.interval = patch.expiration_interval;
  if (patch.timezone !== undefined) expiration.timezone = patch.timezone;
  if (patch.tiers !== undefined) record.tiers = patch.tiers;

  const validated: ProgramSettings = validateProgramSettings(record);
  record.expiration = validated.expiration;
  record.tiers = validated.tiers;
  await writeFile(filePath, JSON.stringify(record, null, 2) + "\n", "utf8");
}
