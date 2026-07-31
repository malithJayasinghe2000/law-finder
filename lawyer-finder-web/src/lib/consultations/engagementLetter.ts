import type { FeeBasis } from '@prisma/client';

/**
 * Engagement letter generation.
 *
 * Produced when a client accepts a quote. This is the artefact that makes the
 * relationship legally clean — it records who is engaged, on what scope, on what
 * fee basis, and states plainly that the FIRM provides the legal service while
 * this platform is only software the firm uses.
 *
 * Valid as an electronic record under the Electronic Transactions Act No. 19 of
 * 2006. The rendered body is snapshotted onto the EngagementLetter row so it
 * always reflects the terms as agreed, even if profiles or quotes change later.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 7).
 *
 * NOTE FOR COUNSEL REVIEW: the wording below is a good-faith draft written to be
 * defensible by design. It must be reviewed by a BASL-member attorney before this
 * ships to real clients. Tracked as open question #3 in LEGAL-GUARDRAILS.md.
 */

export interface EngagementLetterInput {
  reference: string;
  issuedAt: Date;

  firmName: string;
  firmBaslNumber: string;
  firmAddress?: string | null;
  firmContact?: string | null;

  clientName: string;
  clientEmail: string;

  matterSubject: string;
  scopeOfWork: string;
  exclusions?: string | null;

  feeBasis: FeeBasis;
  feeAmount: number;
  currency: string;
  hourlyRate?: number | null;
  estimatedHours?: number | null;
  paymentInstructions: string;

  consultationDate: string; // ISO date, e.g. "2026-08-14"
  consultationTime: string; // "10:00 - 11:00"
  mode: string;
}

const FEE_BASIS_LABELS: Record<FeeBasis, string> = {
  CONSULTATION_FEE: 'a flat fee for this consultation',
  FIXED_FEE: 'a fixed fee for the scope of work described',
  HOURLY: 'an hourly rate',
};

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-LK')}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Renders the engagement letter body as Markdown. */
export function renderEngagementLetter(input: EngagementLetterInput): string {
  const {
    reference, issuedAt,
    firmName, firmBaslNumber, firmAddress, firmContact,
    clientName, clientEmail,
    matterSubject, scopeOfWork, exclusions,
    feeBasis, feeAmount, currency, hourlyRate, estimatedHours,
    paymentInstructions,
    consultationDate, consultationTime, mode,
  } = input;

  const feeLines: string[] = [
    `The fee for this engagement is **${formatCurrency(feeAmount, currency)}**, charged as ${FEE_BASIS_LABELS[feeBasis]}.`,
  ];

  if (feeBasis === 'HOURLY' && hourlyRate) {
    feeLines.push(
      `The hourly rate is ${formatCurrency(hourlyRate, currency)}${
        estimatedHours ? `, with an initial estimate of ${estimatedHours} hour(s)` : ''
      }. Where work exceeds the estimate, the firm will inform you before continuing.`
    );
  }

  return `# Letter of Engagement

**Reference:** ${reference}
**Date:** ${formatDate(issuedAt)}

---

## 1. Parties

**The Firm**
${firmName}
Attorney-at-Law, BASL Registration No. ${firmBaslNumber}${firmAddress ? `\n${firmAddress}` : ''}${firmContact ? `\n${firmContact}` : ''}

**The Client**
${clientName}
${clientEmail}

## 2. Who is providing the legal service

The legal services described in this letter are provided by **${firmName}** and by
no one else. ${firmName} alone is responsible for the advice given, and your
attorney-client relationship is with ${firmName}.

The online platform through which this engagement was arranged is software used by
the firm for scheduling and administration. It is **not** a law firm, it is **not**
a party to this engagement, it does not provide legal advice, and it receives no
part of the fee set out below.

## 3. The matter

**Subject:** ${matterSubject}

**Consultation:** ${consultationDate}, ${consultationTime} (${mode.toLowerCase()})

## 4. Scope of work

${scopeOfWork}
${exclusions ? `\n**Not included in this engagement:**\n\n${exclusions}` : ''}

Work outside this scope will be undertaken only by separate agreement, and where
relevant a further quote will be provided before any additional work begins.

## 5. Fees and payment

${feeLines.join('\n\n')}

Payment is made **directly to the firm**, using the following details:

${paymentInstructions}

The firm will confirm receipt once the payment reaches its account. No payment is
made to, held by, or processed through the platform.

## 6. Confidentiality and privilege

Communications between you and the firm for the purpose of obtaining legal advice
are confidential and attract legal professional privilege under section 126 of the
Evidence Ordinance. The firm will not disclose them except where you consent, or
where the firm is required to do so by law.

Your account of this matter is not readable by platform staff.

## 7. Your personal data

The firm processes your personal data in order to act for you, in accordance with
the Personal Data Protection Act No. 9 of 2022. The platform stores that data on
the firm's behalf as a data processor, under the firm's instructions.

## 8. Ending the engagement

You may end this engagement at any time by notifying the firm in writing. The firm
may decline to continue where it is professionally obliged to do so — for example
where a conflict of interest emerges. Fees for work properly carried out before
that point remain payable, and any cancellation terms notified to you at the time
of booking will apply.

## 9. Governing law

This engagement is governed by the laws of Sri Lanka.

---

*This letter was generated electronically and is valid as an electronic record
under the Electronic Transactions Act No. 19 of 2006. It records the terms you
accepted on ${formatDate(issuedAt)}.*
`;
}

/** Generates the next engagement letter reference for a given year. */
export function buildLetterReference(year: number, sequence: number): string {
  return `EL-${year}-${String(sequence).padStart(4, '0')}`;
}
