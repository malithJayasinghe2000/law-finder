import prisma from '@/lib/db';

/**
 * Expires quotes whose validity has lapsed.
 *
 * A quote used to expire only when the client happened to open it — so an
 * unanswered quote stayed `QUOTED` indefinitely, and because `QUOTED` blocks the
 * time slot, it silently held that slot off the lawyer's calendar forever.
 *
 * This sweeps them lazily: it runs on the endpoints that list bookings and
 * availability, which is cheap (one indexed update) and needs no cron. If the
 * platform later grows a scheduler, move this to it.
 */
export async function expireStaleQuotes(): Promise<number> {
  const now = new Date();

  const stale = await prisma.quote.findMany({
    where: { status: 'SENT', validUntil: { lt: now } },
    select: { id: true, bookingId: true },
  });

  if (stale.length === 0) return 0;

  await prisma.$transaction([
    prisma.quote.updateMany({
      where: { id: { in: stale.map((q) => q.id) } },
      data: { status: 'EXPIRED' },
    }),
    // Only move bookings still sitting in QUOTED. A booking that has moved on
    // (accepted, cancelled, re-quoted) must not be dragged backwards.
    prisma.booking.updateMany({
      where: { id: { in: stale.map((q) => q.bookingId) }, status: 'QUOTED' },
      data: { status: 'QUOTE_EXPIRED' },
    }),
  ]);

  return stale.length;
}
