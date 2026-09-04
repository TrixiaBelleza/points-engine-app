import { handle } from "@/lib/handle";
import { json, HttpError } from "@/lib/http";
import { getHistory } from "@/lib/members";
import type { HistoryRange } from "@/lib/types";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpError(404, "Member not found.");
  const rangeParam = new URL(req.url).searchParams.get("range") ?? "3m";
  const range: HistoryRange =
    rangeParam === "6m" || rangeParam === "1y" || rangeParam === "all" || rangeParam === "3m"
      ? rangeParam
      : "3m";
  const page = Number(new URL(req.url).searchParams.get("page") ?? "1");
  return json(await getHistory(Number(id), range, page), { headers: { "Cache-Control": "no-store" } });
});
