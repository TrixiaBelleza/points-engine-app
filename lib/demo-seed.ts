import { DateTime } from "luxon";
import { prisma } from "./db";
import { createActivity, redeemPoints } from "./members";
import { getProgramSettings } from "./settings";

/** Deterministic demo: Elena Cruz + SPEC-style earns. Idempotent on contact number. */
export async function seedDemoData() {
  const existing = await prisma.member.findUnique({
    where: { contactNumber: "+639171234567" },
  });
  if (existing) return;

  const admin = await prisma.admin.findFirst({ where: { role: "superadmin" } });
  if (!admin) return;

  const settings = await getProgramSettings();
  const tz = settings.expiration.timezone;
  const actor = {
    adminId: Number(admin.id),
    email: admin.email,
    name: admin.name,
    role: admin.role,
  };

  const elena = await prisma.member.create({
    data: { name: "Elena Cruz", contactNumber: "+639171234567", status: "active" },
  });
  await prisma.member.create({
    data: { name: "Juan Dela Cruz", contactNumber: "+639189876543", status: "active" },
  });

  const types = await prisma.activityType.findMany();
  const purchase = types.find((t) => t.name === "In-store purchase") ?? types[0];
  const bonus = types.find((t) => t.name === "Bonus") ?? types[0];
  if (!purchase || !bonus) return;

  const iso = (dt: DateTime) => dt.setZone(tz).toISO() ?? dt.toISO() ?? "";

  const memberId = elena.id;
  const now = DateTime.now().setZone(tz);

  // 100+350+150+200 = 800 earned in the last ~3 months → Gold (seeded rules).
  await createActivity(memberId, actor, {
    activityTypeId: Number(purchase.id),
    points: 100,
    occurredAt: iso(now.minus({ days: 40 })),
  });
  await createActivity(memberId, actor, {
    activityTypeId: Number(purchase.id),
    points: 350,
    occurredAt: iso(now.minus({ days: 55 })),
  });
  await createActivity(memberId, actor, {
    activityTypeId: Number(purchase.id),
    points: 150,
    occurredAt: iso(now.minus({ days: 20 })),
  });
  await createActivity(memberId, actor, {
    activityTypeId: Number(purchase.id),
    points: 200,
    occurredAt: DateTime.fromISO("2026-08-26T14:14:32", { zone: tz }).toUTC().toISO() ?? "",
    note: "SPEC example earn",
  });
  // Inside 1-year window, outside 3 months → 1,200 Platinum if lookback is 1 year.
  await createActivity(memberId, actor, {
    activityTypeId: Number(bonus.id),
    points: 400,
    occurredAt: iso(now.minus({ days: 200 })),
    note: "Birthday bonus",
  });
  // Old earn that has already expired under a 1-year interval.
  await createActivity(memberId, actor, {
    activityTypeId: Number(purchase.id),
    points: 400,
    occurredAt: iso(now.minus({ days: 400 })),
    note: "Prior year",
  });
  await redeemPoints(memberId, actor, {
    amount: 80,
    occurredAt: iso(now.minus({ hours: 2 })),
    note: "Free drink",
  });
}
