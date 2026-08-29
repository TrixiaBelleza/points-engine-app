import { handle } from "@/lib/handle";
import { json, readJson, HttpError } from "@/lib/http";
import { getMemberSnapshot, updateMember } from "@/lib/members";
import { requireSession } from "@/lib/session";

function parseId(id: string): bigint {
  if (!/^\d+$/.test(id)) throw new HttpError(404, "Member not found.");
  return BigInt(id);
}

export const GET = handle(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await ctx.params;
  const member = await getMemberSnapshot(parseId(id));
  return json({ member });
});

export const PATCH = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await ctx.params;
  const body = await readJson<{ name?: string; contactNumber?: string; status?: "active" | "inactive" }>(
    req,
  );
  try {
    const member = await updateMember(parseId(id), body);
    return json({ member });
  } catch (err) {
    if (err instanceof Error && !(err instanceof HttpError) && err.message.includes("2–80")) {
      throw new HttpError(400, err.message);
    }
    throw err;
  }
});
