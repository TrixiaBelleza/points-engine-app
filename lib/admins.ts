import { compare, hash } from "bcryptjs";
import { prisma } from "./db";
import { HttpError } from "./http";
import { env } from "./env";
import type { AdminRole } from "@prisma/client";
import type { Session } from "./session";

const ROUNDS = 10;
const GENERIC_LOGIN = "Email or password is incorrect.";

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ROUNDS);
}

export function assertPassword(plain: string): void {
  if (typeof plain !== "string" || plain.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters.");
  }
}

export async function authenticate(email: string, password: string): Promise<Session> {
  const admin = await prisma.admin.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!admin || admin.status !== "active") {
    throw new HttpError(401, GENERIC_LOGIN);
  }
  const ok = await compare(password, admin.passwordHash);
  if (!ok) throw new HttpError(401, GENERIC_LOGIN);
  return {
    adminId: Number(admin.id),
    email: admin.email,
    name: admin.name,
    role: admin.role,
  };
}

export async function changeOwnPassword(
  adminId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  assertPassword(newPassword);
  const admin = await prisma.admin.findUnique({ where: { id: BigInt(adminId) } });
  if (!admin) throw new HttpError(401, "Unauthorized");
  const ok = await compare(currentPassword, admin.passwordHash);
  if (!ok) throw new HttpError(400, "Current password is incorrect.");
  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}

export async function seedSuperadminIfEmpty(): Promise<void> {
  const count = await prisma.admin.count();
  if (count > 0) return;
  const e = env();
  if (!e.superadminEmail || !e.superadminPassword) {
    console.warn("admins table is empty and SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD are unset.");
    return;
  }
  assertPassword(e.superadminPassword);
  await prisma.admin.create({
    data: {
      email: e.superadminEmail.trim().toLowerCase(),
      passwordHash: await hashPassword(e.superadminPassword),
      name: "Superadmin",
      role: "superadmin",
      status: "active",
    },
  });
  console.info(`Seeded superadmin ${e.superadminEmail}. Unset SUPERADMIN_PASSWORD after first sign-in.`);
}

export async function listAdmins() {
  const rows = await prisma.admin.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });
  return rows.map((a) => ({
    id: Number(a.id),
    name: a.name,
    email: a.email,
    role: a.role,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function createAdmin(
  actor: Session,
  input: { name: string; email: string; role: AdminRole; password: string },
) {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 120) throw new HttpError(400, "Name is required.");
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email.");
  assertPassword(input.password);
  if (input.role === "superadmin" && actor.role !== "superadmin") {
    throw new HttpError(403, "Only a superadmin can create a superadmin.");
  }
  const role: AdminRole = input.role === "superadmin" ? "superadmin" : "admin";
  try {
    const created = await prisma.admin.create({
      data: {
        name,
        email,
        role,
        status: "active",
        passwordHash: await hashPassword(input.password),
      },
    });
    return {
      id: Number(created.id),
      name: created.name,
      email: created.email,
      role: created.role,
      status: created.status,
    };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      throw new HttpError(409, "An admin with that email already exists.");
    }
    throw err;
  }
}

export async function setAdminPassword(actor: Session, targetId: number, newPassword: string) {
  assertPassword(newPassword);
  const target = await prisma.admin.findUnique({ where: { id: BigInt(targetId) } });
  if (!target) throw new HttpError(404, "Admin not found.");
  if (target.role === "superadmin") {
    throw new HttpError(403, "Superadmin passwords cannot be reset from the Admins page.");
  }
  if (targetId === actor.adminId) {
    throw new HttpError(400, "Change your own password in Settings.");
  }
  await prisma.admin.update({
    where: { id: target.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}

export async function setAdminStatus(actor: Session, targetId: number, status: "active" | "inactive") {
  const target = await prisma.admin.findUnique({ where: { id: BigInt(targetId) } });
  if (!target) throw new HttpError(404, "Admin not found.");
  if (status === "inactive" && target.role === "superadmin") {
    const remaining = await prisma.admin.count({
      where: { role: "superadmin", status: "active" },
    });
    if (remaining <= 1) {
      throw new HttpError(400, "Cannot deactivate the last remaining superadmin.");
    }
  }
  await prisma.admin.update({
    where: { id: target.id },
    data: { status },
  });
}
