import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  rewriteAllowedEnvFlag,
  rewriteAllowedEnvFlagForTest,
  rewriteProgramSettingsPatch,
  rewriteProgramSettingsPatchForTest,
} from "./apply-files";
import { ROOT } from "./config";

const SAMPLE_ENV = `NODE_ENV=production
APP_ENV=staging
ENABLE_CANCEL_EARN=false
ENABLE_CANCEL_REDEEM=false
PORT=3001
SESSION_SECRET=keep-me
`;

const SAMPLE_SETTINGS = {
  schemaVersion: 1,
  expiration: { interval: "6_months", timezone: "Asia/Manila" },
  tiers: {
    lookbackPeriod: "1_year",
    extraNote: "keep me",
    rules: [
      { name: "Bronze", minPoints: 0, isBase: true },
      { name: "Silver", minPoints: 250, isBase: false },
      { name: "Gold", minPoints: 501, isBase: false },
      { name: "Platinum", minPoints: 1000, isBase: false },
    ],
  },
  unrelated: { foo: 1 },
};

describe("staging file rewrites", () => {
  it("updates only allow-listed env flags", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "staging-control-"));
    const file = path.join(dir, "staging.env");
    await writeFile(file, SAMPLE_ENV, "utf8");
    await rewriteAllowedEnvFlagForTest(file, "ENABLE_CANCEL_EARN", true);
    await rewriteAllowedEnvFlagForTest(file, "ENABLE_CANCEL_REDEEM", true);
    const text = await readFile(file, "utf8");
    expect(text).toContain("ENABLE_CANCEL_EARN=true");
    expect(text).toContain("ENABLE_CANCEL_REDEEM=true");
    expect(text).toContain("APP_ENV=staging");
    expect(text).toContain("SESSION_SECRET=keep-me");
    expect(text).toContain("PORT=3001");
  });

  it("patches timezone and interval and preserves unrelated JSON", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "staging-control-"));
    const file = path.join(dir, "program-settings.json");
    await writeFile(file, JSON.stringify(SAMPLE_SETTINGS, null, 2), "utf8");
    await rewriteProgramSettingsPatchForTest(file, {
      expiration_interval: "1_year",
      timezone: "UTC",
    });
    const parsed = JSON.parse(await readFile(file, "utf8")) as typeof SAMPLE_SETTINGS;
    expect(parsed.expiration.interval).toBe("1_year");
    expect(parsed.expiration.timezone).toBe("UTC");
    expect(parsed.unrelated.foo).toBe(1);
    expect(parsed.tiers.lookbackPeriod).toBe("1_year");
  });

  it("replaces tiers while keeping other settings", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "staging-control-"));
    const file = path.join(dir, "program-settings.json");
    await writeFile(file, JSON.stringify(SAMPLE_SETTINGS, null, 2), "utf8");
    await rewriteProgramSettingsPatchForTest(file, {
      tiers: {
        lookbackPeriod: "3_months",
        rules: [
          { name: "Bronze", minPoints: 0, isBase: true },
          { name: "Silver", minPoints: 100, isBase: false },
          { name: "Gold", minPoints: 200, isBase: false },
          { name: "Platinum", minPoints: 300, isBase: false },
        ],
      },
    });
    const parsed = JSON.parse(await readFile(file, "utf8")) as typeof SAMPLE_SETTINGS;
    expect(parsed.tiers.lookbackPeriod).toBe("3_months");
    expect(parsed.tiers.rules[1].minPoints).toBe(100);
    expect(parsed.expiration.interval).toBe("6_months");
    expect(parsed.unrelated.foo).toBe(1);
  });

  it("refuses to write production env or settings", async () => {
    await expect(
      rewriteAllowedEnvFlag(path.join(ROOT, "deploy/mac-cloudflare/prod.env"), "ENABLE_CANCEL_EARN", true),
    ).rejects.toThrow(/production|non-staging/);
    await expect(
      rewriteProgramSettingsPatch(path.join(ROOT, ".data/production/program-settings.json"), {
        timezone: "UTC",
      }),
    ).rejects.toThrow(/production|non-staging/);
  });
});
