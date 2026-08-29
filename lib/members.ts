import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./http";
import { computeExpiresAt, localDateKey, lookbackThreshold, parseOccurredAt } from "./expiration";
import { normalizePhMobile, validateName } from "./phone";
import { getProgramSettings } from "./settings";
import { tierSnapshot } from "./tiers";
import type { Session } from "./session";
import type { ExpirationIntervalId } from "./settings-types";
import { HISTORY_PAGE_SIZE, type HistoryRange } from "./types";

function asInterval(id: ExpirationIntervalId): "six_months" | "one_year" {
  return id === "1_year" ? "one_year" : "six_months";
}

export async function listMembers(q?: string) {
  const query = (q ?? "").trim();
  const rows = await prisma.member.findMany({
    where: {
      status: "active",
      ...(query ? { name: { contains: query } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((m) => ({ id: Number(m.id), name: m.name }));
}

function requireName(input: string): string {
  try {
    return validateName(input);
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : "Invalid name.");
  }
}

function requireOccurredAt(input: string, timezone: string): Date {
  try {
    return parseOccurredAt(input, timezone);
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : "Invalid occurred_at.");
  }
}

export async function createMember(nameInput: string, contactInput: string) {
  const name = requireName(nameInput);
  const contactNumber = normalizePhMobile(contactInput);
  if (!contactNumber) {
    throw new HttpError(400, "Enter a valid Philippine mobile number.");
  }
  try {
    const member = await prisma.member.create({
      data: { name, contactNumber, status: "active" },
    });
    return { id: Number(member.id), name: member.name };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      throw new HttpError(409, "A member with that contact number already exists.");
    }
    throw err;
  }
}

export async function getMemberOrThrow(id: bigint) {
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member) throw new HttpError(404, "Member not found.");
  return member;
}

export async function getMemberSnapshot(memberId: bigint) {
  const member = await getMemberOrThrow(memberId);
  const settings = await getProgramSettings();
  const now = new Date();

  const [lots, earnAgg, redeemAgg, expireAgg, qualifyingAgg] = await Promise.all([
    prisma.pointLot.findMany({ where: { memberId } }),
    prisma.ledgerEntry.aggregate({
      where: { memberId, type: "EARN" },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { memberId, type: "REDEEM" },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { memberId, type: "EXPIRE" },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        memberId,
        type: "EARN",
        occurredAt: { gte: lookbackThreshold(now, settings.tiers.lookbackPeriod) },
      },
      _sum: { amount: true },
    }),
  ]);

  const available = lots
    .filter((l) => l.remainingAmount > 0 && l.expiresAt > now)
    .reduce((s, l) => s + l.remainingAmount, 0);

  const earnedTotal = earnAgg._sum.amount ?? 0;
  const redeemedTotal = redeemAgg._sum.amount ?? 0;
  const postedExpired = expireAgg._sum.amount ?? 0;
  const unpostedExpired = lots
    .filter((l) => l.remainingAmount > 0 && l.expiresAt <= now)
    .reduce((s, l) => s + l.remainingAmount, 0);
  const expiredTotal = postedExpired + unpostedExpired;

  const qualifyingPoints = qualifyingAgg._sum.amount ?? 0;
  const tier = tierSnapshot(qualifyingPoints, settings);
  const nextExpiration = nextExpirationFromLots(lots, now, settings.expiration.timezone);

  return {
    id: Number(member.id),
    name: member.name,
    contactNumber: member.contactNumber,
    status: member.status,
    createdAt: member.createdAt.toISOString(),
    timezone: settings.expiration.timezone,
    available,
    earnedTotal,
    redeemedTotal,
    expiredTotal,
    tier,
    nextExpiration,
  };
}

type LotRow = { remainingAmount: number; expiresAt: Date };

export function nextExpirationFromLots(
  lots: LotRow[],
  now: Date,
  timezone: string,
): { when: string; amount: number } | null {
  const spendable = lots.filter((l) => l.remainingAmount > 0 && l.expiresAt > now);
  if (spendable.length === 0) return null;
  const minExpires = spendable.reduce(
    (min, l) => (l.expiresAt < min ? l.expiresAt : min),
    spendable[0].expiresAt,
  );
  const key = localDateKey(minExpires, timezone);
  const amount = spendable
    .filter((l) => localDateKey(l.expiresAt, timezone) === key)
    .reduce((s, l) => s + l.remainingAmount, 0);
  return { when: minExpires.toISOString(), amount };
}

export async function updateMember(
  memberId: bigint,
  input: { name?: string; contactNumber?: string; status?: "active" | "inactive" },
) {
  const data: { name?: string; contactNumber?: string; status?: "active" | "inactive" } = {};
  if (input.name !== undefined) data.name = requireName(input.name);
  if (input.contactNumber !== undefined) {
    const phone = normalizePhMobile(input.contactNumber);
    if (!phone) throw new HttpError(400, "Enter a valid Philippine mobile number.");
    data.contactNumber = phone;
  }
  if (input.status !== undefined) data.status = input.status;
  try {
    await prisma.member.update({ where: { id: memberId }, data });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      throw new HttpError(409, "A member with that contact number already exists.");
    }
    throw err;
  }
  return getMemberSnapshot(memberId);
}

export function rangeThreshold(range: HistoryRange, now: Date): Date | null {
  if (range === "all") return null;
  const period = range === "3m" ? "3_months" : range === "6m" ? "6_months" : "1_year";
  return lookbackThreshold(now, period);
}

export async function getHistory(memberId: bigint, range: HistoryRange, page = 1) {
  await getMemberOrThrow(memberId);
  const settings = await getProgramSettings();
  const now = new Date();
  const from = rangeThreshold(range, now);
  const where = {
    memberId,
    ...(from ? { occurredAt: { gte: from } } : {}),
  };
  const total = await prisma.ledgerEntry.count({ where });
  const pageSize = HISTORY_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const entries = await prisma.ledgerEntry.findMany({
    where,
    include: { activity: { include: { activityType: true } } },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  });

  const earnIds = entries.filter((e) => e.type === "EARN" && e.activityId).map((e) => e.activityId!);
  const lots = earnIds.length
    ? await prisma.pointLot.findMany({ where: { activityId: { in: earnIds } } })
    : [];
  const lotByActivity = new Map(lots.map((l) => [Number(l.activityId), l]));

  return {
    range,
    from: from ? from.toISOString() : null,
    to: now.toISOString(),
    timezone: settings.expiration.timezone,
    page: safePage,
    pageSize,
    total,
    totalPages,
    entries: entries.map((e) => {
      const lot = e.activityId ? lotByActivity.get(Number(e.activityId)) : undefined;
      let description = "";
      if (e.type === "EARN") {
        description = e.activity?.activityType.name ?? "Earn";
        if (e.note) description += ` — ${e.note}`;
      } else if (e.type === "REDEEM") {
        description = e.note?.trim() ? e.note : "Redemption";
      } else {
        description = "Points expired";
      }
      const signed = e.type === "EARN" ? e.amount : -e.amount;
      return {
        id: Number(e.id),
        occurredAt: e.occurredAt.toISOString(),
        type: e.type,
        description,
        points: signed,
        expiresAt: e.type === "EARN" && lot ? lot.expiresAt.toISOString() : null,
      };
    }),
  };
}

export async function listActivityTypes() {
  const rows = await prisma.activityType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({ id: Number(r.id), name: r.name }));
}

export async function seedActivityTypes() {
  const seeds = [
    { name: "In-store purchase", sortOrder: 1 },
    { name: "Bonus", sortOrder: 2 },
    { name: "Other", sortOrder: 3 },
  ];
  for (const s of seeds) {
    await prisma.activityType.upsert({
      where: { name: s.name },
      create: { name: s.name, isActive: true, sortOrder: s.sortOrder },
      update: { isActive: true, sortOrder: s.sortOrder },
    });
  }
}

export async function createActivity(
  memberId: bigint,
  actor: Session,
  input: { activityTypeId: number; points: number; occurredAt: string; note?: string },
) {
  const member = await getMemberOrThrow(memberId);
  if (member.status !== "active") {
    throw new HttpError(400, "Cannot log activity for an inactive member.");
  }
  const points = Number(input.points);
  if (!Number.isInteger(points) || points < 1) {
    throw new HttpError(400, "Points must be an integer of at least 1.");
  }
  const activityType = await prisma.activityType.findFirst({
    where: { id: BigInt(input.activityTypeId), isActive: true },
  });
  if (!activityType) throw new HttpError(400, "Choose an activity type.");
  const settings = await getProgramSettings();
  const occurredAt = requireOccurredAt(input.occurredAt, settings.expiration.timezone);
  const expiresAt = computeExpiresAt(occurredAt, settings.expiration.timezone, settings.expiration.interval);
  const note = input.note?.trim() ? input.note.trim().slice(0, 500) : null;

  await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.create({
      data: {
        memberId,
        activityTypeId: activityType.id,
        points,
        occurredAt,
        note,
        createdByAdminId: BigInt(actor.adminId),
      },
    });
    await tx.ledgerEntry.create({
      data: {
        memberId,
        type: "EARN",
        amount: points,
        occurredAt,
        activityId: activity.id,
        note,
        createdByAdminId: BigInt(actor.adminId),
      },
    });
    await tx.pointLot.create({
      data: {
        memberId,
        activityId: activity.id,
        originalAmount: points,
        remainingAmount: points,
        earnedAt: occurredAt,
        expiresAt,
        expirationInterval: asInterval(settings.expiration.interval),
      },
    });
  });

  return getMemberSnapshot(memberId);
}

export async function redeemPoints(
  memberId: bigint,
  actor: Session,
  input: { amount: number; occurredAt: string; note?: string },
) {
  const member = await getMemberOrThrow(memberId);
  if (member.status !== "active") {
    throw new HttpError(400, "Cannot redeem for an inactive member.");
  }
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount < 1) {
    throw new HttpError(400, "Amount must be an integer of at least 1.");
  }
  const settings = await getProgramSettings();
  const occurredAt = requireOccurredAt(input.occurredAt, settings.expiration.timezone);
  const note = input.note?.trim() ? input.note.trim().slice(0, 500) : null;
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT id FROM members WHERE id = ${memberId} FOR UPDATE`;
      const lots = await tx.$queryRaw<
        { id: bigint; remaining_amount: number; expires_at: Date }[]
      >(Prisma.sql`
        SELECT id, remaining_amount, expires_at
        FROM point_lots
        WHERE member_id = ${memberId}
          AND remaining_amount > 0
          AND expires_at > ${now}
        ORDER BY expires_at ASC, id ASC
        FOR UPDATE
      `);

      const available = lots.reduce((s, l) => s + Number(l.remaining_amount), 0);
      if (amount > available) {
        throw new HttpError(422, "Not enough points available.", { available });
      }

      const ledger = await tx.ledgerEntry.create({
        data: {
          memberId,
          type: "REDEEM",
          amount,
          occurredAt,
          note,
          createdByAdminId: BigInt(actor.adminId),
        },
      });

      let left = amount;
      for (const lot of lots) {
        if (left <= 0) break;
        const take = Math.min(left, Number(lot.remaining_amount));
        await tx.pointLot.update({
          where: { id: lot.id },
          data: { remainingAmount: Number(lot.remaining_amount) - take },
        });
        await tx.lotConsumption.create({
          data: { lotId: lot.id, ledgerEntryId: ledger.id, amount: take },
        });
        left -= take;
      }
      if (left !== 0) {
        throw new HttpError(422, "Not enough points available.");
      }
    },
    { isolationLevel: "ReadCommitted", timeout: 15000 },
  );

  return getMemberSnapshot(memberId);
}

export async function expireDueLots(now = new Date()): Promise<number> {
  const due = await prisma.pointLot.findMany({
    where: { remainingAmount: { gt: 0 }, expiresAt: { lte: now } },
    orderBy: { id: "asc" },
  });
  let posted = 0;
  for (const lot of due) {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: bigint; remaining_amount: number; expires_at: Date }[]>(
        Prisma.sql`
          SELECT id, remaining_amount, expires_at
          FROM point_lots
          WHERE id = ${lot.id} AND remaining_amount > 0 AND expires_at <= ${now}
          FOR UPDATE
        `,
      );
      if (locked.length === 0) return;
      const remaining = Number(locked[0].remaining_amount);
      if (remaining <= 0) return;
      const ledger = await tx.ledgerEntry.create({
        data: {
          memberId: lot.memberId,
          type: "EXPIRE",
          amount: remaining,
          occurredAt: lot.expiresAt,
          note: "Points expired",
        },
      });
      await tx.lotConsumption.create({
        data: { lotId: lot.id, ledgerEntryId: ledger.id, amount: remaining },
      });
      await tx.pointLot.update({
        where: { id: lot.id },
        data: { remainingAmount: 0 },
      });
      posted += 1;
    });
  }
  return posted;
}
