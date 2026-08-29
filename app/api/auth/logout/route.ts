import { handle } from "@/lib/handle";
import { json } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";
import { cookies } from "next/headers";

export const POST = handle(async () => {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return json({ ok: true });
});
