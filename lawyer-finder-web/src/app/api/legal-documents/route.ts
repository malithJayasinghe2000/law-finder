import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

const CATEGORY_MAP: Record<string, string> = {
  'SRI_LANKA_LAW_REPORTS': 'Sri Lanka Law Reports',
  'ACTS_AND_ORDINANCES': 'Acts & Ordinances',
  'AMENDMENT_ACTS': 'Amendment Acts',
  'GAZETTE_NOTIFICATIONS': 'Gazette Notifications',
  'SUPREME_COURT_DECISIONS': 'Supreme Court Decisions',
  'COURT_OF_APPEAL_DECISIONS': 'Court of Appeal Decisions',
};

// GET: Public endpoint to list active legal documents
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const yearFrom = url.searchParams.get('yearFrom');
    const yearTo = url.searchParams.get('yearTo');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '12', 10);

    const where: any = { status: 'ACTIVE' };

    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { actNumber: { contains: search, mode: 'insensitive' } },
        { courtName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (yearFrom || yearTo) {
      where.year = {};
      if (yearFrom) where.year.gte = parseInt(yearFrom, 10);
      if (yearTo) where.year.lte = parseInt(yearTo, 10);
    }

    const [documents, total] = await Promise.all([
      prisma.legalDocument.findMany({
        where,
        select: {
          id: true,
          title: true,
          category: true,
          description: true,
          actNumber: true,
          year: true,
          courtName: true,
          caseNumber: true,
          gazetteNumber: true,
          pageCount: true,
          chunksCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.legalDocument.count({ where }),
    ]);

    const enrichedDocs = documents.map((doc: any) => ({
      ...doc,
      categoryDisplay: CATEGORY_MAP[doc.category] || doc.category,
    }));

    // Get category counts (only active docs)
    const categoryCounts = await prisma.legalDocument.groupBy({
      by: ['category'],
      where: { status: 'ACTIVE' },
      _count: { id: true },
    });

    const categories = Object.entries(CATEGORY_MAP).map(([enumVal, display]) => ({
      value: enumVal,
      label: display,
      count: categoryCounts.find((c: any) => c.category === enumVal)?._count?.id || 0,
    }));

    return NextResponse.json({
      documents: enrichedDocs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      categories,
    });
  } catch (error) {
    console.error('[PUBLIC_LEGAL_DOCS]', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
