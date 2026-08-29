import { handle } from "@/lib/handle";
import { json, readJson, HttpError } from "@/lib/http";
import { redeemPoints } from "@/lib/members";
import { requireSession } from "@/lib/session";

export const POST = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpError(404, "Member not found.");
  const body = await readJson<{ amount?: number; occurredAt?: string; note?: string }>(req);
  const member = await redeemPoints(BigInt(id), session, {
    amount: Number(body.amount),
    occurredAt: body.occurredAt ?? "",
    note: body.note,
  });
  return json({ member });
});
