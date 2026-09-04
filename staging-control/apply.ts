import { rewriteAllowedEnvFlag, rewriteProgramSettingsPatch } from "./apply-files";
import { STAGING_ENV_FILE, STAGING_SETTINGS_FILE } from "./config";
import type { AppliedChanges, SetupBody } from "./validate";

export async function applyStagingChanges(body: SetupBody): Promise<AppliedChanges> {
  const applied: AppliedChanges = {};
  const { changes } = body;

  if (changes.enable_cancel_earn !== undefined) {
    await rewriteAllowedEnvFlag(STAGING_ENV_FILE, "ENABLE_CANCEL_EARN", changes.enable_cancel_earn);
    applied.enable_cancel_earn = changes.enable_cancel_earn;
  }
  if (changes.enable_cancel_redeem !== undefined) {
    await rewriteAllowedEnvFlag(STAGING_ENV_FILE, "ENABLE_CANCEL_REDEEM", changes.enable_cancel_redeem);
    applied.enable_cancel_redeem = changes.enable_cancel_redeem;
  }

  const settingsPatch = {
    expiration_interval: changes.expiration_interval,
    timezone: changes.timezone,
    tiers: changes.tiers,
  };
  if (
    settingsPatch.expiration_interval !== undefined ||
    settingsPatch.timezone !== undefined ||
    settingsPatch.tiers !== undefined
  ) {
    await rewriteProgramSettingsPatch(STAGING_SETTINGS_FILE, settingsPatch);
    if (changes.expiration_interval !== undefined) applied.expiration_interval = changes.expiration_interval;
    if (changes.timezone !== undefined) applied.timezone = changes.timezone;
    if (changes.tiers !== undefined) applied.tiers = changes.tiers;
  }

  return applied;
}
