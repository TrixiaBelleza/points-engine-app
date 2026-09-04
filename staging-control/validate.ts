import { z } from "zod";
import { DEFAULT_PROGRAM_SETTINGS, validateProgramSettings } from "@/lib/settings-types";
import { EXPIRATION_INTERVALS, LOOKBACK_PERIODS } from "./config";

const tierRuleSchema = z
  .object({
    name: z.string().min(1).max(40),
    minPoints: z.number().int(),
    isBase: z.boolean(),
  })
  .strict();

const tiersSchema = z
  .object({
    lookbackPeriod: z.enum(LOOKBACK_PERIODS),
    rules: z.array(tierRuleSchema).length(4),
  })
  .strict();

const changesSchema = z
  .object({
    enable_cancel_earn: z.boolean().optional(),
    enable_cancel_redeem: z.boolean().optional(),
    expiration_interval: z.enum(EXPIRATION_INTERVALS).optional(),
    timezone: z.string().min(1).max(64).optional(),
    tiers: tiersSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const empty =
      value.enable_cancel_earn === undefined &&
      value.enable_cancel_redeem === undefined &&
      value.expiration_interval === undefined &&
      value.timezone === undefined &&
      value.tiers === undefined;
    if (empty) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "changes must not be empty." });
    }
  });

export const setupBodySchema = z
  .object({
    request_id: z.string().min(1).max(200),
    dry_run: z.boolean().optional().default(false),
    changes: changesSchema,
  })
  .strict();

export type SetupBody = z.infer<typeof setupBodySchema>;
export type AppliedChanges = SetupBody["changes"];

function issueMessage(first: z.ZodIssue): string {
  const path = first.path.join(".");
  if (first.code === "unrecognized_keys") return "Unknown fields are not allowed.";
  if (path === "changes" && first.code === "custom") return "changes must not be empty.";
  if (path.includes("enable_cancel_earn")) return "enable_cancel_earn must be a boolean.";
  if (path.includes("enable_cancel_redeem")) return "enable_cancel_redeem must be a boolean.";
  if (path.includes("expiration_interval")) return 'expiration_interval must be "6_months" or "1_year".';
  if (path.includes("timezone")) return "timezone must be a valid IANA name (e.g. Asia/Manila).";
  if (path.includes("tiers") || path.includes("lookbackPeriod") || path.includes("minPoints")) {
    return "tiers must match program settings (lookbackPeriod and exactly four rules).";
  }
  if (path.includes("request_id")) return "request_id must be a non-empty string.";
  return "Invalid request body.";
}

export function parseSetupBody(input: unknown): { ok: true; value: SetupBody } | { ok: false; error: string } {
  const parsed = setupBodySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: issueMessage(parsed.error.issues[0]) };
  }

  const { timezone, tiers, expiration_interval } = parsed.data.changes;
  if (timezone !== undefined || tiers !== undefined || expiration_interval !== undefined) {
    try {
      validateProgramSettings({
        schemaVersion: 1,
        expiration: {
          interval: expiration_interval ?? DEFAULT_PROGRAM_SETTINGS.expiration.interval,
          timezone: timezone ?? DEFAULT_PROGRAM_SETTINGS.expiration.timezone,
        },
        tiers: tiers ?? DEFAULT_PROGRAM_SETTINGS.tiers,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid program settings.";
      return { ok: false, error: message };
    }
  }

  return { ok: true, value: parsed.data };
}
