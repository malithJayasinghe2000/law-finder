import { randomBytes } from 'crypto';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';

/**
 * Identity documents of attorney applicants: the Attorney-at-Law ID card and the
 * face photo taken during the application. Tier 3 personal data
 * (docs/restructure/DATA-INVENTORY.md §5).
 *
 * Kept in the web server's own folder, never in `public/` and never at a
 * Cloudinary address, which anyone holding the link could open. They are read
 * only through `GET /api/identity-documents/<name>`, by an administrator or by
 * the person who uploaded them.
 *
 * **Deploy:** `storage/` must persist across deploys (as for legal documents).
 *
 * File names are `<userId>-<random>.<ext>`: the owner is known from the name, and
 * the random part makes names unguessable.
 */

export const IDENTITY_DOCUMENT_STORAGE = path.join(process.cwd(), 'storage', 'identity-documents');
import { IDENTITY_DOCUMENT_URL_PREFIX } from '@/lib/identityDocumentUrl';
export { IDENTITY_DOCUMENT_URL_PREFIX };

const NAME = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-[0-9a-f]{32}\.(jpg|png|webp)$/;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Store one document; returns the URL to keep in the application. */
export async function saveIdentityDocument(userId: string, buffer: Buffer, mimeType: string): Promise<string> {
  const ext = EXT_BY_TYPE[mimeType];
  if (!ext) throw new Error('Unsupported document type.');
  await mkdir(IDENTITY_DOCUMENT_STORAGE, { recursive: true });
  const name = `${userId}-${randomBytes(16).toString('hex')}.${ext}`;
  await writeFile(path.join(IDENTITY_DOCUMENT_STORAGE, name), buffer, { mode: 0o600 });
  return `${IDENTITY_DOCUMENT_URL_PREFIX}${name}`;
}

/** Owner and extension of a stored name, or null for anything that is not one. */
export function parseIdentityDocumentName(name: string): { ownerId: string; ext: string } | null {
  const m = NAME.exec(name);
  return m ? { ownerId: m[1], ext: m[2] } : null;
}

export async function readIdentityDocument(name: string): Promise<Buffer | null> {
  if (!parseIdentityDocumentName(name)) return null;
  const file = path.join(IDENTITY_DOCUMENT_STORAGE, name);
  // The pattern already excludes separators; this is the containment check anyway.
  if (path.dirname(file) !== IDENTITY_DOCUMENT_STORAGE) return null;
  return readFile(file).catch(() => null);
}

/**
 * Delete stored documents nothing points at any more: replaced uploads, an
 * application that was erased or purged, a rejected one that was redone.
 * Referenced = in a LawyerApplication's draft or on a LawyerProfile.
 * Run by the retention purge and after an erasure. A file younger than a day is
 * left alone: it may be an upload whose draft has not been saved yet.
 */
export async function sweepOrphanIdentityDocuments(
  /** After an erasure: that person's files go at once, whatever their age. */
  options: { ownerId?: string } = {}
): Promise<number> {
  const names = await readdir(IDENTITY_DOCUMENT_STORAGE).catch(() => [] as string[]);
  if (names.length === 0) return 0;

  const [apps, profiles] = await Promise.all([
    prisma.lawyerApplication.findMany({ select: { draftData: true } }),
    prisma.lawyerProfile.findMany({ select: { licenseImageUrl: true, identityImageUrl: true } }),
  ]);
  const referenced = JSON.stringify(apps.map((a) => a.draftData)) +
    profiles.map((p) => `${p.licenseImageUrl} ${p.identityImageUrl}`).join(' ');

  let removed = 0;
  for (const name of names) {
    const parsed = parseIdentityDocumentName(name);
    if (!parsed || referenced.includes(name)) continue;
    if (options.ownerId && parsed.ownerId !== options.ownerId) continue;
    const file = path.join(IDENTITY_DOCUMENT_STORAGE, name);
    const age = Date.now() - (await stat(file)).mtimeMs;
    if (!options.ownerId && age < 24 * 60 * 60 * 1000) continue;
    await unlink(file).catch(() => {});
    removed++;
  }
  return removed;
}
