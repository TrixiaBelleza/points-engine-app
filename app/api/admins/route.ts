import { createAdmin, listAdmins } from "@/lib/admins";
import { handle } from "@/lib/handle";
import { json, readJson } from "@/lib/http";
import { requireSession } from "@/lib/session";
import type { AdminRole } from "@prisma/client";

export const GET = handle(async () => {
  await requireSession();
  return json({ admins: await listAdmins() });
});

export const POST = handle(async (req) => {
  const session = await requireSession();
  const body = await readJson<{
    name?: string;
    email?: string;
    role?: AdminRole;
    password?: string;
    confirmPassword?: string;
  }>(req);
  if (body.password !== body.confirmPassword) {
    const { HttpError } = await import("@/lib/http");
    throw new HttpError(400, "Passwords do not match.");
  }
  const created = await createAdmin(session, {
    name: body.name ?? "",
    email: body.email ?? "",
    role: body.role === "superadmin" ? "superadmin" : "admin",
    password: body.password ?? "",
  });
  return json({ admin: created }, { status: 201 });
});
