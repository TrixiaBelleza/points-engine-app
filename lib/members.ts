import { prisma } from "./db";
import { HttpError } from "./http";
import { computeExpiresAt, localDateKey, lookbackThreshold, parseOccurredAt } from "./expiration";
import { normalizePhMobile, validateName } from "./phone";
import { getProgramSettings } from "./settings";
import { tierSnapshot } from "./tiers";
import type { Session } from "./session";
import type { ExpirationIntervalId } from "./settings-types";
import { HISTORY_PAGE_SIZE, type HistoryRange } from "./types";
import { cancelEarnEnabled, cancelRedeemEnabled } from "./env";

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

export async function getMemberOrThrow(id: number) {
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member) throw new HttpError(404, "Member not found.");
  return member;
}

export async function getMemberSnapshot(memberId: number) {
  const member = await getMemberOrThrow(memberId);
  const settings = await getProgramSettings();
  const now = new Date();

  const [lots, earnAgg, redeemAgg, expireAgg, cancelAgg, cancelRedeemAgg, qualifyingAgg] = await Promise.all([
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
      where: { memberId, type: "CANCEL" },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { memberId, type: "CANCEL_REDEEM" },
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
  const cancelledTotal = cancelAgg._sum.amount ?? 0;
  const cancelledRedeemTotal = cancelRedeemAgg._sum.amount ?? 0;
  const postedExpired = expireAgg._sum.amount ?? 0;
  const unpostedExpired = lots
    .filter((l) => l.remainingAmount > 0 && l.expiresAt <= now)
    .reduce((s, l) => s + expirationAmount(l), 0);
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
    cancelledTotal,
    cancelledRedeemTotal,
    expiredTotal,
    unpostedExpired,
    tier,
    nextExpiration,
  };
}

type LotRow = {
  originalAmount: number;
  remainingAmount: number;
  cancelledAmount: number;
  restoredAmount?: number;
  expiresAt: Date;
};

// Deliberately reproduces the partial-cancel defect: cancellation reduces the
// spendable balance, but an expiration event still sees the pre-cancel amount.
function expirationAmount(lot: Pick<LotRow, "remainingAmount" | "cancelledAmount">): number {
  return lot.remainingAmount + (lot.cancelledAmount > 0 ? lot.cancelledAmount : 0);
}

export function nextExpirationFromLots(
  lots: LotRow[],
  now: Date,
  timezone: string,
): { when: string; amount: number } | null {
  const spendable = lots.filter(
    (l) => l.remainingAmount > 0 && l.expiresAt > now && expirationAmount(l) > 0,
  );
  if (spendable.length === 0) return null;
  const minExpires = spendable.reduce(
    (min, l) => (l.expiresAt < min ? l.expiresAt : min),
    spendable[0].expiresAt,
  );
  const key = localDateKey(minExpires, timezone);
  const amount = spendable
    .filter((l) => localDateKey(l.expiresAt, timezone) === key)
    .reduce((s, l) => s + expirationAmount(l), 0);
  return { when: minExpires.toISOString(), amount };
}

export async function updateMember(
  memberId: number,
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

export async function getHistory(memberId: number, range: HistoryRange, page = 1) {
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

  const redeemIds = entries.filter((e) => e.type === "REDEEM").map((e) => e.id);
  const redeemConsumptions = redeemIds.length
    ? await prisma.lotConsumption.findMany({
        where: { ledgerEntryId: { in: redeemIds } },
        include: { lot: true },
      })
    : [];
  const consumptionsByRedeem = new Map<number, typeof redeemConsumptions>();
  for (const c of redeemConsumptions) {
    const key = Number(c.ledgerEntryId);
    const list = consumptionsByRedeem.get(key) ?? [];
    list.push(c);
    consumptionsByRedeem.set(key, list);
  }
  const cancelRedeems = redeemIds.length
    ? await prisma.ledgerEntry.findMany({
        where: { type: "CANCEL_REDEEM", sourceLedgerId: { in: redeemIds } },
      })
    : [];
  const cancelledRedeemBySource = new Map<number, number>();
  for (const row of cancelRedeems) {
    if (!row.sourceLedgerId) continue;
    const key = Number(row.sourceLedgerId);
    cancelledRedeemBySource.set(key, (cancelledRedeemBySource.get(key) ?? 0) + row.amount);
  }

  const enableCancelEarn = cancelEarnEnabled();
  const enableCancelRedeem = cancelRedeemEnabled();

  return {
    range,
    from: from ? from.toISOString() : null,
    to: now.toISOString(),
    timezone: settings.expiration.timezone,
    page: safePage,
    pageSize,
    total,
    totalPages,
    enableCancelEarn,
    enableCancelRedeem,
    entries: entries.map((e) => {
      const lot = e.activityId ? lotByActivity.get(Number(e.activityId)) : undefined;
      let description = "";
      if (e.type === "EARN") {
        description = e.activity?.activityType.name ?? "Earn";
        if (e.note) description += ` — ${e.note}`;
      } else if (e.type === "REDEEM") {
        description = e.note?.trim() ? e.note : "Redemption";
      } else if (e.type === "CANCEL") {
        description = e.note?.trim() ? e.note : "Earn cancelled";
      } else if (e.type === "CANCEL_REDEEM") {
        description = e.note?.trim() ? e.note : "Redemption cancelled";
      } else {
        description = "Points expired";
      }
      const signed = e.type === "EARN" || e.type === "CANCEL_REDEEM" ? e.amount : -e.amount;
      let canCancel = false;
      let cancelUnavailableReason: string | null = null;
      let cancellableAmount = 0;
      if (enableCancelEarn && e.type === "EARN") {
        cancellableAmount = lot?.remainingAmount ?? 0;
        canCancel = Boolean(lot && lot.remainingAmount > 0 && lot.expiresAt > now);
        if (!canCancel) {
          if (!lot || lot.remainingAmount <= 0) {
            cancelUnavailableReason = "This earn has no remaining points.";
          } else if (lot.expiresAt <= now) {
            cancelUnavailableReason = "Expired points can no longer be cancelled.";
          }
        }
      }
      if (enableCancelRedeem && e.type === "REDEEM") {
        const already = cancelledRedeemBySource.get(Number(e.id)) ?? 0;
        cancellableAmount = Math.max(0, e.amount - already);
        const consumedLots = consumptionsByRedeem.get(Number(e.id)) ?? [];
        const expiredLot = consumedLots.some((c) => c.lot.expiresAt <= now);
        canCancel = cancellableAmount > 0 && !expiredLot;
        if (!canCancel) {
          if (expiredLot) {
            cancelUnavailableReason = "Redeemed points that have expired can no longer be cancelled.";
          } else {
            cancelUnavailableReason = "This redemption has already been cancelled.";
          }
        }
      }
      return {
        id: Number(e.id),
        occurredAt: e.occurredAt.toISOString(),
        type: e.type,
        description,
        points: signed,
        expiresAt: e.type === "EARN" && lot ? lot.expiresAt.toISOString() : null,
        activityId: e.type === "EARN" && e.activityId ? Number(e.activityId) : null,
        cancellableAmount,
        canCancel,
        cancelUnavailableReason,
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
  memberId: number,
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
    where: { id: input.activityTypeId, isActive: true },
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
        createdByAdminId: actor.adminId,
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
        createdByAdminId: actor.adminId,
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
  memberId: number,
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
      // SQLite serializes writes. Keep this workflow inside one interactive
      // transaction rather than using MySQL's SELECT ... FOR UPDATE.
      const lots = await tx.pointLot.findMany({
        where: {
          memberId,
          remainingAmount: { gt: 0 },
          expiresAt: { gt: now },
        },
        orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      });

      const available = lots.reduce((s, l) => s + l.remainingAmount, 0);
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
          createdByAdminId: actor.adminId,
        },
      });

      let left = amount;
      for (const lot of lots) {
        if (left <= 0) break;
        const take = Math.min(left, lot.remainingAmount);
        await tx.pointLot.update({
          where: { id: lot.id },
          data: { remainingAmount: lot.remainingAmount - take },
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
    { timeout: 15000 },
  );

  return getMemberSnapshot(memberId);
}

export async function cancelEarn(
  memberId: number,
  activityId: number,
  actor: Session,
  input: { amount: number },
) {
  if (!cancelEarnEnabled()) throw new HttpError(404, "Not found.");

  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount < 1) {
    throw new HttpError(400, "Cancellation amount must be an integer of at least 1.");
  }
  await getMemberOrThrow(memberId);
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      const lot = await tx.pointLot.findFirst({
        where: { memberId, activityId },
      });
      if (!lot) throw new HttpError(404, "Earn activity not found.");

      const remaining = lot.remainingAmount;
      if (lot.expiresAt <= now) {
        throw new HttpError(422, "Expired points can no longer be cancelled.");
      }
      if (remaining <= 0) {
        throw new HttpError(422, "This earn has no remaining points to cancel.");
      }
      if (amount > remaining) {
        throw new HttpError(422, "Cannot cancel more than the remaining points.", { remaining });
      }

      const ledger = await tx.ledgerEntry.create({
        data: {
          memberId,
          type: "CANCEL",
          amount,
          occurredAt: now,
          activityId,
          note: amount === remaining ? "Earn fully cancelled" : "Earn partially cancelled",
          createdByAdminId: actor.adminId,
        },
      });
      await tx.pointLot.update({
        where: { id: lot.id },
        data: {
          remainingAmount: remaining - amount,
          cancelledAmount: lot.cancelledAmount + amount,
        },
      });
      await tx.lotConsumption.create({
        data: { lotId: lot.id, ledgerEntryId: ledger.id, amount },
      });
    },
    { timeout: 15000 },
  );

  return getMemberSnapshot(memberId);
}

export async function cancelRedeem(
  memberId: number,
  redeemLedgerId: number,
  actor: Session,
  input: { amount: number },
) {
  if (!cancelRedeemEnabled()) throw new HttpError(404, "Not found.");

  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount < 1) {
    throw new HttpError(400, "Cancellation amount must be an integer of at least 1.");
  }
  await getMemberOrThrow(memberId);
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      const redeem = await tx.ledgerEntry.findFirst({
        where: { id: redeemLedgerId, memberId, type: "REDEEM" },
        include: { consumptions: { include: { lot: true }, orderBy: { id: "desc" } } },
      });
      if (!redeem) throw new HttpError(404, "Redemption not found.");

      const alreadyRows = await tx.ledgerEntry.findMany({
        where: { type: "CANCEL_REDEEM", sourceLedgerId: redeem.id },
        include: { consumptions: true },
      });
      const already = alreadyRows.reduce((s, r) => s + r.amount, 0);
      const leftover = redeem.amount - already;
      if (leftover <= 0) {
        throw new HttpError(422, "This redemption has already been cancelled.");
      }
      if (amount > leftover) {
        throw new HttpError(422, "Cannot cancel more than the remaining redeemed points.", {
          remaining: leftover,
        });
      }
      if (redeem.consumptions.some((c) => c.lot.expiresAt <= now)) {
        throw new HttpError(422, "Redeemed points that have expired can no longer be cancelled.");
      }

      const restoredByLot = new Map<string, number>();
      for (const row of alreadyRows) {
        for (const c of row.consumptions) {
          const key = String(c.lotId);
          restoredByLot.set(key, (restoredByLot.get(key) ?? 0) + c.amount);
        }
      }

      const ledger = await tx.ledgerEntry.create({
        data: {
          memberId,
          type: "CANCEL_REDEEM",
          amount,
          occurredAt: now,
          sourceLedgerId: redeem.id,
          note: amount === leftover ? "Redemption fully cancelled" : "Redemption partially cancelled",
          createdByAdminId: actor.adminId,
        },
      });

      let left = amount;
      for (const consumption of redeem.consumptions) {
        if (left <= 0) break;
        const lotKey = String(consumption.lotId);
        const alreadyRestored = restoredByLot.get(lotKey) ?? 0;
        const unrestored = consumption.amount - alreadyRestored;
        if (unrestored <= 0) continue;
        const take = Math.min(left, unrestored);
        const locked = await tx.pointLot.findUnique({
          where: { id: consumption.lotId },
        });
        if (!locked) throw new HttpError(404, "Point lot not found.");
        if (locked.expiresAt <= now) {
          throw new HttpError(422, "Redeemed points that have expired can no longer be cancelled.");
        }
        await tx.pointLot.update({
          where: { id: consumption.lotId },
          data: {
            remainingAmount: locked.remainingAmount + take,
            restoredAmount: locked.restoredAmount + take,
          },
        });
        await tx.lotConsumption.create({
          data: { lotId: consumption.lotId, ledgerEntryId: ledger.id, amount: take },
        });
        restoredByLot.set(lotKey, alreadyRestored + take);
        left -= take;
      }
      if (left !== 0) {
        throw new HttpError(422, "Could not restore the cancelled redemption onto lots.");
      }
    },
    { timeout: 15000 },
  );

  return getMemberSnapshot(memberId);
}

export async function expireDueLots(opts?: {
  now?: Date;
  memberId?: number;
  createdByAdminId?: number;
}): Promise<{ lotsPosted: number; pointsExpired: number }> {
  const now = opts?.now ?? new Date();
  const due = await prisma.pointLot.findMany({
    where: {
      remainingAmount: { gt: 0 },
      expiresAt: { lte: now },
      ...(opts?.memberId ? { memberId: opts.memberId } : {}),
    },
    orderBy: { id: "asc" },
  });
  let lotsPosted = 0;
  let pointsExpired = 0;
  for (const lot of due) {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.pointLot.findFirst({
        where: {
          id: lot.id,
          remainingAmount: { gt: 0 },
          expiresAt: { lte: now },
        },
      });
      if (!locked) return;
      const remaining = locked.remainingAmount;
      if (remaining <= 0) return;
      const amountToExpire = expirationAmount({
        remainingAmount: remaining,
        cancelledAmount: locked.cancelledAmount,
      });
      if (amountToExpire <= 0) return;
      const ledger = await tx.ledgerEntry.create({
        data: {
          memberId: lot.memberId,
          type: "EXPIRE",
          amount: amountToExpire,
          occurredAt: lot.expiresAt,
          note: "Points expired",
          createdByAdminId: opts?.createdByAdminId ?? null,
        },
      });
      await tx.lotConsumption.create({
        data: { lotId: lot.id, ledgerEntryId: ledger.id, amount: amountToExpire },
      });
      await tx.pointLot.update({
        where: { id: lot.id },
        data: { remainingAmount: 0 },
      });
      lotsPosted += 1;
      pointsExpired += amountToExpire;
    });
  }
  return { lotsPosted, pointsExpired };
}

export async function expireMemberLots(memberId: number, session: Session) {
  await getMemberOrThrow(memberId);
  const result = await expireDueLots({ memberId, createdByAdminId: session.adminId });
  const member = await getMemberSnapshot(memberId);
  return { ...result, member };
}
