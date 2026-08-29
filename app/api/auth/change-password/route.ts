import { changeOwnPassword } from "@/lib/admins";
import { handle } from "@/lib/handle";
import { json, readJson } from "@/lib/http";
import { requireSession } from "@/lib/session";

export const POST = handle(async (req) => {
  const session = await requireSession();
  const body = await readJson<{ currentPassword?: string; newPassword?: string }>(req);
  await changeOwnPassword(session.adminId, body.currentPassword ?? "", body.newPassword ?? "");
  return json({ ok: true });
});
