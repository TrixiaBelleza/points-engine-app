import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";
import type { AdminRole } from "@prisma/client";

export const SESSION_COOKIE = "pe_session";

export type Session = {
  adminId: number;
  email: string;
  name: string;
  role: AdminRole;
};

function secretKey() {
  return new TextEncoder().encode(env().sessionSecret);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({
    email: session.email,
    name: session.name,
    role: session.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(session.adminId))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const adminId = Number(payload.sub);
    const role = payload.role as AdminRole;
    const email = String(payload.email ?? "");
    const name = String(payload.name ?? "");
    if (!adminId || (role !== "admin" && role !== "superadmin") || !email) return null;
    return { adminId, email, name, role };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env().cookieSecure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const { HttpError } = await import("./http");
    throw new HttpError(401, "Unauthorized");
  }
  const { prisma } = await import("./db");
  const admin = await prisma.admin.findUnique({ where: { id: session.adminId } });
  if (!admin || admin.status !== "active") {
    const { HttpError } = await import("./http");
    throw new HttpError(401, "Unauthorized");
  }
  return {
    adminId: Number(admin.id),
    email: admin.email,
    name: admin.name,
    role: admin.role,
  };
}
