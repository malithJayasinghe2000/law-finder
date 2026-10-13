import type { Prisma } from '@prisma/client';

/**
 * The next matter number for this year — "BK-2026-0042".
 *
 * Derived from the highest existing number for the year, not count() + 1: a
 * count collided whenever a booking was deleted and restarted numbering wrongly
 * at each year boundary. Call inside a Serializable transaction so two requests
 * cannot take the same number.
 */
export async function nextBookingNumber(tx: Prisma.TransactionClient): Promise<string> {
  const prefix = `BK-${new Date().getFullYear()}-`;

  const latest = await tx.booking.findFirst({
    where: { bookingNumber: { startsWith: prefix } },
    orderBy: { bookingNumber: 'desc' },
    select: { bookingNumber: true },
  });

  const lastSequence = latest
    ? parseInt(latest.bookingNumber.slice(prefix.length), 10) || 0
    : 0;
  return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;
}
