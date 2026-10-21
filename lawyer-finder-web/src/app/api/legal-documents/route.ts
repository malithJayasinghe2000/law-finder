import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { DOCUMENT_TYPES, PUBLIC_STATUSES, SUBJECTS, TYPE_LABEL, isDocumentType, isSubject } from '@/lib/legalLibrary';
import { sanitizeString, validatePaginationParams } from '@/lib/security';

const visible = { status: { in: [...PUBLIC_STATUSES] } };

/**
 * GET: the public library. Laws are listed once each; an amending Act is
 * listed on its law's page, and here only when someone searches for it.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const subject = url.searchParams.get('subject');
    const search = url.searchParams.get('search') ? sanitizeString(url.searchParams.get('search') || '', 100) : '';
    const { page, limit } = validatePaginationParams(url.searchParams.get('page'), url.searchParams.get('limit'));

    const where: Prisma.LegalDocumentWhereInput = { ...visible };
    if (isDocumentType(category)) where.category = category;
    if (isSubject(subject)) where.subjects = { has: subject };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { actNumber: { contains: search, mode: 'insensitive' } },
        { courtName: { contains: search, mode: 'insensitive' } },
      ];
    } else {
      where.amendsId = null;
    }

    const lawsOnly = { ...visible, amendsId: null };
    const [documents, total, typeCounts, subjectRows] = await Promise.all([
      prisma.legalDocument.findMany({
        where,
        select: {
          id: true,
          title: true,
          category: true,
          subjects: true,
          status: true,
          description: true,
          actNumber: true,
          year: true,
          consolidatedToYear: true,
          courtName: true,
          caseNumber: true,
          sourceName: true,
          lastCheckedAt: true,
          amends: { select: { id: true, title: true } },
          amendments: {
            where: visible,
            select: { year: true, actNumber: true },
            orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
          },
        },
        // Laws by name, the way a reader looks for them.
        orderBy: { title: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.legalDocument.count({ where }),
      prisma.legalDocument.groupBy({ by: ['category'], where: lawsOnly, _count: { id: true } }),
      prisma.legalDocument.findMany({ where: lawsOnly, select: { subjects: true } }),
    ]);

    const subjectCounts = new Map<string, number>();
    for (const row of subjectRows) for (const s of row.subjects) subjectCounts.set(s, (subjectCounts.get(s) ?? 0) + 1);

    return NextResponse.json({
      documents: documents.map(({ amendments, ...doc }) => ({
        ...doc,
        categoryDisplay: TYPE_LABEL[doc.category],
        amendmentCount: amendments.length,
        lastAmendedYear: amendments[0]?.year ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      categories: DOCUMENT_TYPES.map((t) => ({
        value: t.value,
        label: t.label,
        count: typeCounts.find((c) => c.category === t.value)?._count.id ?? 0,
      })),
      subjects: SUBJECTS.map((s) => ({ ...s, count: subjectCounts.get(s.value) ?? 0 })),
    });
  } catch (error) {
    console.error('[PUBLIC_LEGAL_DOCS]', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
