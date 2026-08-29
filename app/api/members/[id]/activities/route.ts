import { handle } from "@/lib/handle";
import { json, readJson, HttpError } from "@/lib/http";
import { createActivity } from "@/lib/members";
import { requireSession } from "@/lib/session";

export const POST = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpError(404, "Member not found.");
  const body = await readJson<{
    activityTypeId?: number;
    points?: number;
    occurredAt?: string;
    note?: string;
  }>(req);
  const member = await createActivity(BigInt(id), session, {
    activityTypeId: Number(body.activityTypeId),
    points: Number(body.points),
    occurredAt: body.occurredAt ?? "",
    note: body.note,
  });
  return json({ member }, { status: 201 });
});
