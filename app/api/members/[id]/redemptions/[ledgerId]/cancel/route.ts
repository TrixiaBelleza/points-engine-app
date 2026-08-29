import { handle } from "@/lib/handle";
import { HttpError, json, readJson } from "@/lib/http";
import { cancelRedeem } from "@/lib/members";
import { requireSession } from "@/lib/session";

export const POST = handle(
  async (req, ctx: { params: Promise<{ id: string; ledgerId: string }> }) => {
    const session = await requireSession();
    const { id, ledgerId } = await ctx.params;
    if (!/^\d+$/.test(id) || !/^\d+$/.test(ledgerId)) {
      throw new HttpError(404, "Redemption not found.");
    }
    const body = await readJson<{ amount?: number }>(req);
    const member = await cancelRedeem(BigInt(id), BigInt(ledgerId), session, {
      amount: Number(body.amount),
    });
    return json({ member });
  },
);
