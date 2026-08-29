import { setAdminPassword } from "@/lib/admins";
import { handle } from "@/lib/handle";
import { json, readJson, HttpError } from "@/lib/http";
import { requireSession } from "@/lib/session";

export const POST = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const body = await readJson<{ password?: string; confirmPassword?: string }>(req);
  if (body.password !== body.confirmPassword) {
    throw new HttpError(400, "Passwords do not match.");
  }
  await setAdminPassword(session, Number(id), body.password ?? "");
  return json({ ok: true });
});
