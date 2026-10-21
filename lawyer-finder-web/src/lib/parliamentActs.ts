import prisma from '@/lib/db';
import { amendedLawName, LEGISLATION_TYPES, normaliseLawName } from '@/lib/legalLibrary';

export { libraryTitle, tidyTitle } from '@/lib/legalLibrary';

/**
 * Parliament's Acts listing (parliament.lk/en/business-of-parliament/acts-listing)
 * as a review queue for the Legal Library.
 *
 * The listing is every Act Parliament has passed, newest first, seven to a page,
 * back to about 1949, each with an official PDF. robots.txt allows it. What it
 * cannot hold is a law made before Parliament existed (the Penal Code, 1883): for
 * those it lists only the amending Acts.
 *
 * Nothing seen here reaches the library or the AI until an admin approves it.
 */

const LISTING = 'https://www.parliament.lk/en/business-of-parliament/acts-listing';
const ORIGIN = 'https://www.parliament.lk/';

export type ListedAct = {
  ref: string; // "G6435" or "P588"
  actNumber: string | null; // "23/2026"; Parliament sometimes prints only "20"
  year: number | null;
  title: string; // "JUDICATURE (AMENDMENT)"
  endorsedOn: Date | null;
  pdfUrl: string;
  detailUrl: string;
  isAmendment: boolean;
};

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/** Only Parliament's own addresses are kept: a PDF is downloaded from this later. */
function onParliament(href: string): string | null {
  try {
    const u = new URL(href, ORIGIN);
    return u.protocol === 'https:' && u.hostname === 'www.parliament.lk' ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * One page of the listing. An entry without a PDF (some older ones) is counted
 * in `withoutPdf` and not returned: there is nothing to import.
 */
export function parseListing(html: string): { acts: ListedAct[]; withoutPdf: number } {
  const acts: ListedAct[] = [];
  let withoutPdf = 0;
  const seen = new Set<string>();
  // Each entry is a heading linked to act-details/<ref>, then its date, then
  // "View Act" and "Download Act" links, before the next entry's heading.
  const heading = /href='([^']*\/act-details\/([A-Z]+\d+))'\s*>\s*<h1[^>]*>([\s\S]*?)<\/h1>/g;
  const matches = [...html.matchAll(heading)];
  matches.forEach((m, i) => {
    const [, detailHref, ref, rawHeading] = m;
    if (seen.has(ref)) return;
    const block = html.slice(m.index!, matches[i + 1]?.index ?? html.length);

    const text = decode(rawHeading.replace(/<[^>]*>/g, ''));
    const split = text.match(/^(N\/A|\d+(?:\s*\/\s*\d{4})?)\s*:\s*(.+)$/i);
    if (!split) return;
    const number = split[1].toUpperCase() === 'N/A' ? null : split[1].replace(/\s/g, '');
    const title = split[2].trim();

    const pdfHref = block.match(/href='([^']*\/uploads\/acts\/[^']*\.pdf)'/i)?.[1];
    const pdfUrl = pdfHref ? onParliament(pdfHref) : null;
    const detailUrl = onParliament(detailHref);
    if (!detailUrl) return;
    if (!pdfUrl) {
      withoutPdf++;
      return;
    }

    const date = block.match(/Endorsed Date:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
    const year = number?.includes('/') ? Number(number.split('/')[1]) : date ? Number(date.slice(0, 4)) : null;

    seen.add(ref);
    acts.push({
      ref,
      actNumber: number,
      year,
      title,
      endorsedOn: date ? new Date(`${date}T00:00:00Z`) : null,
      pdfUrl,
      detailUrl,
      isAmendment: amendedLawName(title) !== null,
    });
  });
  return { acts, withoutPdf };
}

export async function fetchListingPage(page: number, keyword?: string) {
  const url = new URL(LISTING);
  if (page > 1) url.searchParams.set('page', String(page));
  if (keyword) url.searchParams.set('keyword', keyword);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TheLawyr Legal Library (checks for new Acts weekly)' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Parliament's website answered ${res.status}.`);
  return parseListing(await res.text());
}

/**
 * Law names compared without "Act"/"Ordinance" at the end, an edition note like
 * "(1980 Revised Edition)", or any punctuation.
 */
const lawKey = (title: string) =>
  normaliseLawName(
    title
      .replace(/,?\s*no\.?\s*\d+\s*of\s*\d{4}.*$/i, '')
      .replace(/\s*\([^)]*(revised|edition|consolidated|\d{4})[^)]*\)\s*$/i, '')
      .replace(/\b(act|ordinance|law)\s*$/i, '')
  );

const amendableLaws = () =>
  prisma.legalDocument.findMany({
    where: {
      amendsId: null,
      category: { in: LEGISLATION_TYPES },
      status: { in: ['ACTIVE', 'AWAITING_ORIGINAL', 'PROCESSING'] },
    },
    select: { id: true, title: true },
  });

function matchLaw(title: string, laws: { id: string; title: string }[]): string | null {
  const name = amendedLawName(title);
  if (!name) return null;
  const key = lawKey(name);
  return laws.find((l) => lawKey(l.title) === key)?.id ?? null;
}

/** The library law an amending Act's title names, if the library has it. */
export async function suggestAmendedLaw(title: string): Promise<string | null> {
  return matchLaw(title, await amendableLaws());
}

/**
 * Suggest a law for queued amendments that had none, and save it: the law may
 * have been added since (an admin listing the Penal Code while approving one
 * of its amendments). Returns the acts with suggestions filled in.
 */
export async function refreshSuggestions<T extends { id: string; title: string; isAmendment: boolean; suggestedAmendsId: string | null }>(
  acts: T[]
): Promise<T[]> {
  const missing = acts.filter((a) => a.isAmendment && !a.suggestedAmendsId);
  if (missing.length === 0) return acts;
  const laws = await amendableLaws();
  const found = new Map<string, string>();
  for (const a of missing) {
    const lawId = matchLaw(a.title, laws);
    if (lawId) found.set(a.id, lawId);
  }
  await Promise.all(
    [...found].map(([id, lawId]) => prisma.parliamentAct.update({ where: { id }, data: { suggestedAmendsId: lawId } }))
  );
  return acts.map((a) => (found.has(a.id) ? { ...a, suggestedAmendsId: found.get(a.id)! } : a));
}

export type CheckResult = {
  pagesRead: number;
  added: number;
  withoutPdf: number;
  complete: boolean;
  lawsMarkedChecked: number;
};

/**
 * Read the listing from the newest Act backwards and queue every Act not seen
 * before. Stops at the first page with nothing new (everything older was seen
 * on an earlier run) or after `maxPages`.
 *
 * Only a complete run (one that reached Acts already seen) may mark laws as
 * checked, and only laws with no new amendment waiting for review: a law page
 * must not say "checked today" while an amendment to it sits in the queue.
 */
export async function checkParliament(maxPages = 5): Promise<CheckResult> {
  let added = 0;
  let withoutPdf = 0;
  let pagesRead = 0;
  let complete = false;
  const now = new Date();

  for (let page = 1; page <= maxPages; page++) {
    const listed = await fetchListingPage(page);
    const acts = listed.acts;
    withoutPdf += listed.withoutPdf;
    pagesRead++;
    if (acts.length === 0 && listed.withoutPdf === 0) {
      complete = true; // past the last page
      break;
    }

    const known = await prisma.parliamentAct.findMany({
      where: { ref: { in: acts.map((a) => a.ref) } },
      select: { ref: true },
    });
    const knownRefs = new Set(known.map((k) => k.ref));
    if (knownRefs.size > 0) {
      await prisma.parliamentAct.updateMany({ where: { ref: { in: [...knownRefs] } }, data: { lastSeenAt: now } });
    }

    for (const act of acts.filter((a) => !knownRefs.has(a.ref))) {
      await prisma.parliamentAct.create({
        data: { ...act, suggestedAmendsId: await suggestAmendedLaw(act.title), lastSeenAt: now },
      });
      added++;
    }

    if (acts.length > 0 && knownRefs.size === acts.length) {
      complete = true;
      break;
    }
  }

  let lawsMarkedChecked = 0;
  if (complete) {
    const pending = await prisma.parliamentAct.findMany({
      where: { status: 'NEW', suggestedAmendsId: { not: null } },
      select: { suggestedAmendsId: true },
    });
    const waiting = pending.map((p) => p.suggestedAmendsId!);
    const marked = await prisma.legalDocument.updateMany({
      where: {
        amendsId: null,
        category: { in: ['ACT', 'ORDINANCE', 'CONSTITUTION'] },
        status: { in: ['ACTIVE', 'AWAITING_ORIGINAL'] },
        id: { notIn: waiting },
      },
      data: { lastCheckedAt: now },
    });
    lawsMarkedChecked = marked.count;
  }

  return { pagesRead, added, withoutPdf, complete, lawsMarkedChecked };
}

/**
 * Queue every Act Parliament lists under a name, e.g. all the Penal Code
 * amendments, to link them to a law just added. Unlike checkParliament it reads
 * a search, not the newest Acts, so it never marks anything checked.
 */
export async function queueFromSearch(keyword: string, maxPages = 10): Promise<{ found: number; added: number; withoutPdf: number }> {
  let found = 0;
  let added = 0;
  let withoutPdf = 0;
  for (let page = 1; page <= maxPages; page++) {
    const listed = await fetchListingPage(page, keyword);
    withoutPdf += listed.withoutPdf;
    if (listed.acts.length === 0) break;
    found += listed.acts.length;
    const known = new Set(
      (await prisma.parliamentAct.findMany({ where: { ref: { in: listed.acts.map((a) => a.ref) } }, select: { ref: true } })).map((k) => k.ref)
    );
    for (const act of listed.acts.filter((a) => !known.has(a.ref))) {
      await prisma.parliamentAct.create({ data: { ...act, suggestedAmendsId: await suggestAmendedLaw(act.title) } });
      added++;
    }
    if (listed.acts.length + listed.withoutPdf < 7) break; // the last page
  }
  return { found, added, withoutPdf };
}
