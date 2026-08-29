"use server";

import { redirect } from "next/navigation";
import { authenticate } from "@/lib/admins";
import { boot } from "@/lib/boot";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { cookies } from "next/headers";

export async function loginAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await boot();
    const session = await authenticate(email, password);
    const token = await signSession(session);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  } catch {
    return { error: "Email or password is incorrect." };
  }
  redirect("/members");
}
