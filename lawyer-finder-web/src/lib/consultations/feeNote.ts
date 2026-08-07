import prisma from '@/lib/db';

/**
 * Fee notes — the firm's own invoice to its own client.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * We render a document. We are not in the transaction.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The firm supplies the legal service, so the firm is the taxable person: it
 * bills under its own TIN and VAT registration, and the client pays the firm's
 * own bank account directly. We never hold the money, never route it, never
 * verify it, and take no percentage of it.
 *
 * Both halves of that matter. Holding or settling other people's money is a
 * regulated activity needing Central Bank authorisation under the Payments and
 * Settlements Systems Act No. 28 of 2005. Taking a cut of a legal fee is
 * fee-sharing with a non-lawyer under Supreme Court Rules 39-49, in either
 * direction, however the invoice is worded. A fee note touches both, so it is
 * the one document where it is worth being explicit about what we are not
 * doing.
 *
 * **There is no platform-fee line and no commission line anywhere below.** Not a
 * zeroed one, not a hidden one. If you are ever asked to add one, that is the
 * restructure being undone.
 *
 * Like the engagement letter, the rendered body is snapshotted onto the row at
 * issue. A fee note is a tax document; if the firm later changes its name,
 * address or VAT number, an already-issued note must still say what it said on
 * the day it was issued.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 1, 2 and 7).
 *
 * NOTE FOR COUNSEL REVIEW: the wording and the tax treatment below are a
 * good-faith draft. A Sri Lankan attorney and an accountant should both review
 * this before a real client sees one. Tracked as counsel question 10.
 */

export type FeeNoteLine = {
  description: string;
  amount: number;
};

export interface FeeNoteInput {
  noteNumber: string;
  issuedAt: Date;
  dueDate?: Date | null;

  firmName: string;
  firmAddress?: string | null;
  firmTin?: string | null;
  firmVatNumber?: string | null;
  firmBankName?: string | null;
  firmAccountName?: string | null;
  firmAccountNumber?: string | null;
  firmBankBranch?: string | null;

  clientName: string;
  clientAddress?: string | null;
  clientEmail?: string | null;

  /** Named because the client is entitled to know who acted for them. */
  attorneyName?: string | null;

  matterReference: string;
  lines: FeeNoteLine[];
  subtotal: number;
  vatRatePercent?: number | null;
  vatAmount: number;
  total: number;
  currency: string;
}

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-LK')}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Render the fee note as Markdown.
 *
 * Deliberately plain. This is a document a client may hand to their accountant
 * or produce in a taxation dispute, so it says who is charging whom, for what,
 * on whose authority, and where to pay — and nothing that reads as marketing.
 */
export function renderFeeNote(input: FeeNoteInput): string {
  const lines: string[] = [];

  lines.push(`# Fee Note ${input.noteNumber}`);
  lines.push('');
  lines.push(`**Issued:** ${formatDate(input.issuedAt)}`);
  if (input.dueDate) {
    lines.push(`**Payment due:** ${formatDate(input.dueDate)}`);
  }
  lines.push(`**Matter reference:** ${input.matterReference}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Who is charging ──────────────────────────────────────────────────────
  lines.push('## From');
  lines.push('');
  lines.push(`**${input.firmName}**`);
  lines.push('Attorneys-at-Law');
  if (input.firmAddress) lines.push('', input.firmAddress);
  if (input.firmTin) lines.push('', `TIN: ${input.firmTin}`);
  if (input.firmVatNumber) lines.push(`VAT registration: ${input.firmVatNumber}`);
  lines.push('');

  lines.push('## To');
  lines.push('');
  lines.push(`**${input.clientName}**`);
  if (input.clientAddress) lines.push('', input.clientAddress);
  if (input.clientEmail) lines.push('', input.clientEmail);
  lines.push('');

  if (input.attorneyName) {
    lines.push(`**Attorney acting:** ${input.attorneyName}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // ── What is being charged ────────────────────────────────────────────────
  lines.push('## Professional fees');
  lines.push('');
  lines.push('| Description | Amount |');
  lines.push('| --- | ---: |');
  for (const line of input.lines) {
    lines.push(`| ${line.description} | ${money(line.amount, input.currency)} |`);
  }
  lines.push(`| **Subtotal** | **${money(input.subtotal, input.currency)}** |`);

  if (input.vatAmount > 0) {
    const rate = input.vatRatePercent ? ` (${input.vatRatePercent}%)` : '';
    lines.push(`| VAT${rate} | ${money(input.vatAmount, input.currency)} |`);
  }

  lines.push(`| **Total due** | **${money(input.total, input.currency)}** |`);
  lines.push('');

  // ── How to pay ───────────────────────────────────────────────────────────
  lines.push('## Payment');
  lines.push('');
  lines.push(
    `Payment is due to **${input.firmName}** directly. Please quote the fee note number ` +
      `**${input.noteNumber}** as your reference.`
  );
  lines.push('');

  if (input.firmBankName || input.firmAccountNumber) {
    lines.push("**The firm's account**");
    lines.push('');
    if (input.firmAccountName) lines.push(`- Account name: ${input.firmAccountName}`);
    if (input.firmBankName) lines.push(`- Bank: ${input.firmBankName}`);
    if (input.firmBankBranch) lines.push(`- Branch: ${input.firmBankBranch}`);
    if (input.firmAccountNumber) lines.push(`- Account number: ${input.firmAccountNumber}`);
    lines.push('');
  }

  // ── Who you are dealing with ─────────────────────────────────────────────
  // Rule 7. A client must never be able to think the platform is their legal
  // service provider or that any part of this fee reaches it.
  lines.push('---');
  lines.push('');
  lines.push('## Who is charging you');
  lines.push('');
  lines.push(
    `This fee note is issued by **${input.firmName}**, which provided the legal services described above ` +
      'and is solely responsible for them.'
  );
  lines.push('');
  lines.push(
    'The software used to produce this document is provided to the firm by a third-party supplier. ' +
      'That supplier is **not a law firm**, is **not a party** to your engagement, does **not receive ' +
      'any part of this fee**, and does **not handle your payment**. Pay the firm directly, using the ' +
      'account details above.'
  );
  lines.push('');
  lines.push(
    'If you have a question about this fee note, raise it with the firm. Keep this document for your records.'
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Allocate the next fee note number for a firm.
 *
 * `FN-<year>-<sequence>`, sequential per firm per year. Sri Lankan tax practice
 * expects an unbroken series, so the sequence counts every note the firm has
 * ever raised in that year including cancelled ones — a cancelled note keeps its
 * number rather than freeing it for reuse, because a gap in the series is a
 * question the firm would have to answer.
 *
 * Takes a transaction client so allocation and creation happen atomically;
 * counting outside the transaction is how two notes end up sharing a number.
 */
export async function allocateFeeNoteNumber(
  tx: Pick<typeof prisma, 'feeNote'>,
  firmId: string,
  now: Date = new Date()
): Promise<string> {
  const year = now.getFullYear();
  const prefix = `FN-${year}-`;

  const latest = await tx.feeNote.findFirst({
    where: { firmId, noteNumber: { startsWith: prefix } },
    orderBy: { noteNumber: 'desc' },
    select: { noteNumber: true },
  });

  const lastSequence = latest ? Number.parseInt(latest.noteNumber.slice(prefix.length), 10) : 0;
  const next = (Number.isFinite(lastSequence) ? lastSequence : 0) + 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
}

export type FeeNoteTotals = {
  subtotal: number;
  vatAmount: number;
  total: number;
};

/**
 * Add up a fee note.
 *
 * Whole rupees throughout. The platform takes nothing, so there is no third
 * term in this arithmetic — subtotal plus VAT is the total, and the whole total
 * goes to the firm.
 */
export function calculateFeeNoteTotals(
  lines: FeeNoteLine[],
  vatRatePercent: number | null | undefined
): FeeNoteTotals {
  const subtotal = lines.reduce((sum, line) => sum + Math.max(0, Math.round(line.amount)), 0);
  const rate = vatRatePercent && vatRatePercent > 0 ? vatRatePercent : 0;
  const vatAmount = Math.round((subtotal * rate) / 100);

  return { subtotal, vatAmount, total: subtotal + vatAmount };
}
