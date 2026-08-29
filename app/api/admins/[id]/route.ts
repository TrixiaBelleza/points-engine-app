import { setAdminStatus } from "@/lib/admins";
import { handle } from "@/lib/handle";
import { json, readJson, HttpError } from "@/lib/http";
import { requireSession } from "@/lib/session";

export const PATCH = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const body = await readJson<{ status?: "active" | "inactive" }>(req);
  if (body.status !== "active" && body.status !== "inactive") {
    throw new HttpError(400, "status must be active or inactive.");
  }
  await setAdminStatus(session, Number(id), body.status);
  return json({ ok: true });
});
