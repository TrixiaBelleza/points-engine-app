import { authenticate } from "@/lib/admins";
import { handle } from "@/lib/handle";
import { json, readJson } from "@/lib/http";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { cookies } from "next/headers";

export const POST = handle(async (req) => {
  const body = await readJson<{ email?: string; password?: string }>(req);
  const session = await authenticate(body.email ?? "", body.password ?? "");
  const token = await signSession(session);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  return json({ ok: true });
});
