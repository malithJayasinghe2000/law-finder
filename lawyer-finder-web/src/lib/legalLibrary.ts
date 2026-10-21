import type { LegalDocumentCategory, LegalSubject } from '@prisma/client';

/**
 * The Legal Library's vocabulary, in one place. The category list used to be
 * copied into four files.
 *
 * A TYPE is what kind of document it is; a SUBJECT is what it is about. There
 * is no "Amendment" type: an amending Act is an ACT whose `amendsId` points at
 * the law it changes, and that law's page lists it.
 */

export const DOCUMENT_TYPES: { value: LegalDocumentCategory; label: string; hint: string }[] = [
  { value: 'CONSTITUTION', label: 'Constitution', hint: 'The Constitution and its amendments' },
  { value: 'ACT', label: 'Acts', hint: 'Laws passed by Parliament, since 1948' },
  { value: 'ORDINANCE', label: 'Ordinances', hint: 'Laws made before 1948, many still in force' },
  { value: 'REGULATION', label: 'Regulations & Orders', hint: 'Detailed rules made under an Act' },
  { value: 'PROVINCIAL_STATUTE', label: 'Provincial Statutes', hint: 'Laws made by Provincial Councils' },
  { value: 'GAZETTE_NOTIFICATIONS', label: 'Gazette Notifications', hint: 'Official notices in the Gazette' },
  { value: 'COURT_RULES', label: 'Court Rules', hint: 'Rules of procedure made by the courts' },
  { value: 'SRI_LANKA_LAW_REPORTS', label: 'Sri Lanka Law Reports', hint: 'Reported court decisions' },
  { value: 'SUPREME_COURT_DECISIONS', label: 'Supreme Court Decisions', hint: 'Judgments of the Supreme Court' },
  { value: 'COURT_OF_APPEAL_DECISIONS', label: 'Court of Appeal Decisions', hint: 'Judgments of the Court of Appeal' },
  { value: 'HIGH_COURT_DECISIONS', label: 'High Court Decisions', hint: 'Judgments of the High Courts' },
];

export const SUBJECTS: { value: LegalSubject; label: string }[] = [
  { value: 'CONSTITUTIONAL', label: 'Constitution & Rights' },
  { value: 'CRIMINAL', label: 'Criminal' },
  { value: 'CIVIL_PROCEDURE', label: 'Courts & Procedure' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'LAND_PROPERTY', label: 'Land & Property' },
  { value: 'LABOUR', label: 'Employment' },
  { value: 'BUSINESS', label: 'Business & Companies' },
  { value: 'TAX_FINANCE', label: 'Tax & Finance' },
  { value: 'CONSUMER', label: 'Consumer' },
  { value: 'MOTOR_TRAFFIC', label: 'Motor Traffic' },
  { value: 'ENVIRONMENT', label: 'Environment' },
  { value: 'ADMINISTRATIVE', label: 'Government & Administration' },
];

export const TYPE_LABEL = Object.fromEntries(DOCUMENT_TYPES.map((t) => [t.value, t.label])) as Record<
  LegalDocumentCategory,
  string
>;
export const SUBJECT_LABEL = Object.fromEntries(SUBJECTS.map((s) => [s.value, s.label])) as Record<
  LegalSubject,
  string
>;

export const isDocumentType = (v: unknown): v is LegalDocumentCategory =>
  typeof v === 'string' && v in TYPE_LABEL;
export const isSubject = (v: unknown): v is LegalSubject => typeof v === 'string' && v in SUBJECT_LABEL;

/** Types that are legislation: they can amend, and be amended by, each other. */
export const LEGISLATION_TYPES: LegalDocumentCategory[] = [
  'CONSTITUTION', 'ACT', 'ORDINANCE', 'REGULATION', 'PROVINCIAL_STATUTE',
];
export const CASE_LAW_TYPES: LegalDocumentCategory[] = [
  'SRI_LANKA_LAW_REPORTS', 'SUPREME_COURT_DECISIONS', 'COURT_OF_APPEAL_DECISIONS', 'HIGH_COURT_DECISIONS',
];

/** Sources an admin picks from on upload. Free text is allowed too. */
export const KNOWN_SOURCES = [
  'Parliament of Sri Lanka',
  'Revised Legislative Enactments 1980 (LawNet, via CommonLII)',
  'Department of Government Printing',
  "Legal Draftsman's Department",
] as const;
export const PARLIAMENT_SOURCE = KNOWN_SOURCES[0];

/**
 * The category the AI service understands (lawyer-rag `_category_to_doc_type`).
 * It tells an amending Act from the law itself, so the AI can say which text
 * changed which; that distinction now lives in `amendsId`, not the type.
 */
export function ragCategoryFor(type: LegalDocumentCategory, amends: boolean): string {
  if (amends) return 'Amendment Acts';
  if (CASE_LAW_TYPES.includes(type)) return type === 'SRI_LANKA_LAW_REPORTS' ? 'Sri Lanka Law Reports' : 'Supreme Court Decisions';
  if (type === 'GAZETTE_NOTIFICATIONS') return 'Gazette Notifications';
  return 'Acts & Ordinances';
}

/** Letters and digits only, lower case: "Penal Code(Amendment)" meets "penal code". */
export const normaliseLawName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The law an amending Act's title names: "Penal Code (Amendment)" -> "Penal Code",
 * "JUDICATURE (AMENDMENT)" -> "JUDICATURE", "Twenty Second Amendment to the
 * Constitution" -> "Constitution". Null when the title is not an
 * amendment. A suggestion for an admin to confirm, never applied unseen.
 */
export function amendedLawName(title: string): string | null {
  if (/\bamendment\s+to\s+the\s+constitution\b/i.test(title)) return 'Constitution';
  const m = title.match(/^(.*?)\s*\(\s*(?:special\s+provisions\s+and\s+)?amendment\s*\)/i);
  return m && m[1].trim() ? m[1].trim() : null;
}

/** What the public may see: shown in the library, whether or not the AI holds it. */
export const PUBLIC_STATUSES = ['ACTIVE', 'AWAITING_ORIGINAL'] as const;

/** "JUDICATURE (AMENDMENT)" -> "Judicature (Amendment)". Mixed case is left alone. */
export function tidyTitle(title: string): string {
  if (title !== title.toUpperCase()) return title.replace(/\s*\(\s*/g, ' (').replace(/\s*\)/g, ')').trim();
  const small = new Set(['of', 'and', 'the', 'on', 'for', 'to', 'in', 'or', 'by', 'a', 'an']);
  return title
    .toLowerCase()
    .split(/(\s+|\(|\))/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

/** The library title for an Act: "Judicature (Amendment) Act, No. 23 of 2026". */
export function libraryTitle(act: { title: string; actNumber: string | null; year: number | null }): string {
  const name = tidyTitle(act.title);
  if (!act.actNumber) return name;
  const [no, year = act.year] = act.actNumber.split('/');
  const withAct = /\b(act|ordinance|law)$/i.test(name) || /constitution/i.test(name) ? name : `${name} Act`;
  return year ? `${withAct}, No. ${no} of ${year}` : `${withAct}, No. ${no}`;
}
