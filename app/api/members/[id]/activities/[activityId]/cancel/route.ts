import { handle } from "@/lib/handle";
import { HttpError, json, readJson } from "@/lib/http";
import { cancelEarn } from "@/lib/members";
import { requireSession } from "@/lib/session";

export const POST = handle(
  async (_req, ctx: { params: Promise<{ id: string; activityId: string }> }) => {
    const session = await requireSession();
    const { id, activityId } = await ctx.params;
    if (!/^\d+$/.test(id) || !/^\d+$/.test(activityId)) {
      throw new HttpError(404, "Earn activity not found.");
    }
    const body = await readJson<{ amount?: number }>(_req);
    const member = await cancelEarn(BigInt(id), BigInt(activityId), session, {
      amount: Number(body.amount),
    });
    return json({ member });
  },
);
