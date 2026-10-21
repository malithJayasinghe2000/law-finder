import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { checkParliament, queueFromSearch, refreshSuggestions } from '@/lib/parliamentActs';
import { sanitizeString } from '@/lib/sanitize';
import { validatePaginationParams } from '@/lib/security';

/**
 * Parliament's Acts listing as a review queue (src/lib/parliamentActs.ts).
 * GET lists it; POST reads Parliament's website now. The weekly job runs the
 * same check: npm run library:check-parliament.
 */

async function requireAdmin() {
  const session = await getSession();
  return session?.role === 'ADMIN' ? session : null;
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const status = statusParam === 'IMPORTED' || statusParam === 'DISMISSED' ? statusParam : 'NEW';
  const { page, limit } = validatePaginationParams(url.searchParams.get('page'), url.searchParams.get('limit'));
  // ?q=Penal Code: only that law's Acts, after a Find.
  const q = sanitizeString(url.searchParams.get('q') ?? '', 80).trim();
  const byName: Prisma.ParliamentActWhereInput = q ? { title: { contains: q, mode: 'insensitive' } } : {};
  const where: Prisma.ParliamentActWhereInput = { ...byName, status };

  const [listed, total, counts, lastSeen] = await Promise.all([
    prisma.parliamentAct.findMany({
      where,
      // A law itself first (its amendments can only link to it once it is added),
      // then Acts that amend a law the library already holds (finishing a law in
      // progress, e.g. the Penal Code after its 1980 text), then newest first.
      orderBy: [
        { isAmendment: 'asc' },
        { suggestedAmendsId: { sort: 'asc', nulls: 'last' } },
        { endorsedOn: 'desc' },
        { ref: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.parliamentAct.count({ where }),
    prisma.parliamentAct.groupBy({ by: ['status'], where: byName, _count: { id: true } }),
    prisma.parliamentAct.aggregate({ _max: { lastSeenAt: true } }),
  ]);

  const acts = status === 'NEW' ? await refreshSuggestions(listed) : listed;

  // The suggested law's title, for the admin to confirm.
  const suggestedIds = [...new Set(acts.map((a) => a.suggestedAmendsId).filter((v): v is string => !!v))];
  const suggested = await prisma.legalDocument.findMany({
    where: { id: { in: suggestedIds } },
    select: { id: true, title: true, status: true },
  });

  return NextResponse.json({
    acts: acts.map((a) => ({ ...a, suggestedAmends: suggested.find((s) => s.id === a.suggestedAmendsId) ?? null })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count.id])),
    lastCheckedAt: lastSeen._max.lastSeenAt,
  });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  // Pages of seven, newest first. More than 20 at once is a backfill: use the script.
  const pages = Math.min(Math.max(Number(body?.pages) || 5, 1), 20);
  // With a keyword: every Act under that name, e.g. "Penal Code".
  const keyword = typeof body?.keyword === 'string' ? sanitizeString(body.keyword, 80).trim() : '';
  try {
    if (keyword) {
      if (keyword.length < 3) return NextResponse.json({ error: 'Type at least three letters of the law\'s name.' }, { status: 400 });
      return NextResponse.json(await queueFromSearch(keyword));
    }
    return NextResponse.json(await checkParliament(pages));
  } catch (error) {
    // An outage is not a fact about the law: say we could not tell.
    console.error('[PARLIAMENT_CHECK]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Could not read Parliament's website, so nothing was checked. Try again later." },
      { status: 503 }
    );
  }
}
