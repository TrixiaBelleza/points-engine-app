import { handle } from "@/lib/handle";
import { json, HttpError } from "@/lib/http";
import { expireMemberLots } from "@/lib/members";
import { requireSession } from "@/lib/session";

export const POST = handle(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpError(404, "Member not found.");
  const result = await expireMemberLots(BigInt(id), session);
  return json(result);
});
