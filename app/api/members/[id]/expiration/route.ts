import { handle } from "@/lib/handle";
import { json, HttpError } from "@/lib/http";
import { formatExpirePhrase } from "@/lib/expiration";
import { getMemberSnapshot } from "@/lib/members";
import { requireSession } from "@/lib/session";

export const GET = handle(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpError(404, "Member not found.");
  const member = await getMemberSnapshot(Number(id));
  if (!member.nextExpiration || member.available <= 0) {
    return json({
      when: null,
      amount: 0,
      message: "No points on file — nothing will expire.",
    });
  }
  const when = new Date(member.nextExpiration.when);
  return json({
    when: member.nextExpiration.when,
    amount: member.nextExpiration.amount,
    message: `${member.nextExpiration.amount.toLocaleString("en-US")} points expire on ${formatExpirePhrase(when, member.timezone)}`,
  });
});
