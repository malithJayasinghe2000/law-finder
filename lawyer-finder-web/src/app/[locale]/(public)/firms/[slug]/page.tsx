import prisma from '@/lib/db';
import AttorneyPhoto from '@/components/lawyer/AttorneyPhoto';
import { publishableDescription } from '@/lib/selfPromotion';
import { inDailyOrder, DIRECTORY_ORDER_NOTICE, isListedFirm } from '@/lib/directory';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, MapPin, Phone, Mail, Globe, Clock, ShieldCheck, Scale, Languages, Gavel,
} from 'lucide-react';
import LegalDisclaimer from '@/components/shared/LegalDisclaimer';
import type { Metadata } from 'next';

/** The firm's name in the tab and in search results (it used to be the site title). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const firm = await prisma.lawFirm.findUnique({
    where: { slug },
    select: {
      name: true, district: true, practiceAreas: true, firmType: true,
      isActive: true, isRegisteredPractice: true, verificationStatus: true,
    },
  });
  if (!firm || !isListedFirm(firm)) return {};
  const kind = firm.firmType === 'SOLE_PRACTITIONER' ? 'Sole practitioner' : 'Law firm';
  const areas = firm.practiceAreas.length ? ` Practice areas: ${firm.practiceAreas.join(', ')}.` : '';
  return {
    title: firm.name,
    description: `${kind}${firm.district ? ` in ${firm.district}` : ''}, Sri Lanka.${areas}`,
  };
}

/** A BASL number is sometimes stored with its own "BASL-" prefix; say "BASL" once. */
function baslLabel(n: string): string {
  return /^BASL/i.test(n) ? n : `BASL ${n}`;
}

/**
 * Public firm profile.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Bound by the Rule 40 content limit. The `select` below is the real boundary of
 * what we publish about a practice — everything selected is serialized into the
 * RSC payload and readable in page source whether or not the JSX renders it.
 *
 * Deliberately absent, and not to be added: any fee indication, any rating or
 * review, any "featured"/"top"/"recommended" treatment, and anything derived
 * from what the firm pays us. The attorneys are listed alphabetically.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md — "The Rule 40 content limit", and
 * counsel questions 16–18 on whether this surface may exist at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default async function FirmProfilePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const firm = await prisma.lawFirm.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      firmType: true,
      description: true,
      practiceAreas: true,
      languages: true,
      courts: true,
      district: true,
      contactEmail: true,
      contactPhone: true,
      websiteUrl: true,
      officeHours: true,
      establishedYear: true,
      registrationNumber: true,
      verificationStatus: true,
      isActive: true,
      isRegisteredPractice: true,
      offices: {
        where: { isActive: true },
        orderBy: [{ isPrimary: 'desc' }, { label: 'asc' }],
        select: { label: true, address: true, district: true, contactPhone: true, isPrimary: true },
      },
      lawyers: {
        select: {
          id: true,
          fullName: true,
          baslNumber: true,
          practiceAreas: true,
          yearsOfExperience: true,
          isNotary: true,
          isVerified: true,
          profileImageUrl: true,
        },
        orderBy: { fullName: 'asc' },
      },
    },
  });

  if (!firm || !isListedFirm(firm)) notFound();

  return (
    <div className="py-8 sm:py-10">
      <div className="mx-auto max-w-[1100px] px-6 lg:px-12">
        {/* Header */}
        <div className="border-b border-neutral-100 pb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#bfa37a]">
                {firm.firmType === 'SOLE_PRACTITIONER' ? 'Sole practitioner' : 'Law firm'}
              </p>
              <h1 className="mt-2 font-serif text-3xl tracking-tight text-neutral-900 sm:text-4xl">
                {firm.name}
              </h1>
              <p className="mt-2 text-sm text-neutral-500">
                {firm.district}
                {firm.establishedYear && ` · Established ${firm.establishedYear}`}
                {firm.registrationNumber && ` · Reg. ${firm.registrationNumber}`}
              </p>
            </div>

            <div className="flex w-fit items-center gap-1.5 bg-[#bfa37a] px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified practice
            </div>
          </div>

          {/* Saved text that praises rather than describes is not published
              (src/lib/selfPromotion.ts — Rules 39 and 49). */}
          {publishableDescription(firm.description) && (
            <p className="mt-5 max-w-3xl text-sm font-light leading-relaxed text-neutral-600">
              {publishableDescription(firm.description)}
            </p>
          )}
        </div>

        <div className="grid gap-10 py-8 lg:grid-cols-3">
          {/* Left: contact + practice information */}
          <aside className="space-y-6 lg:col-span-1">
            <section>
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                Contact
              </h2>
              <ul className="space-y-2 text-sm text-neutral-700">
                {firm.contactPhone && (
                  <li className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    {firm.contactPhone}
                  </li>
                )}
                {firm.contactEmail && (
                  <li className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    <span className="break-all">{firm.contactEmail}</span>
                  </li>
                )}
                {firm.websiteUrl && (
                  <li className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    <a href={firm.websiteUrl} target="_blank" rel="noreferrer" className="break-all underline">
                      {firm.websiteUrl.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                )}
                {firm.officeHours && (
                  <li className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    {firm.officeHours}
                  </li>
                )}
              </ul>
            </section>

            {firm.offices.length > 0 && (
              <section>
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Offices
                </h2>
                <ul className="space-y-3">
                  {firm.offices.map((o, i) => (
                    <li key={i} className="text-sm">
                      <p className="flex items-center gap-1.5 font-semibold text-neutral-800">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                        {o.label}
                      </p>
                      <p className="mt-0.5 pl-5 text-neutral-600">{o.address}</p>
                      {o.contactPhone && (
                        <p className="pl-5 text-xs text-neutral-400">{o.contactPhone}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {firm.practiceAreas.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  <Scale className="h-3 w-3" /> Practice areas
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {firm.practiceAreas.map((a) => (
                    <span key={a} className="border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-600">
                      {a}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {firm.courts.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  <Gavel className="h-3 w-3" /> Courts
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {firm.courts.map((c) => (
                    <span key={c} className="border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-600">
                      {c}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {firm.languages.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  <Languages className="h-3 w-3" /> Languages
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {firm.languages.map((l) => (
                    <span key={l} className="border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-600">
                      {l}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </aside>

          {/* Right: the attorneys */}
          <div className="lg:col-span-2">
            <h2 className="mb-1 font-serif text-xl text-neutral-900">
              Attorneys at this firm
            </h2>
            <p className="mb-5 text-xs text-neutral-500">
              {DIRECTORY_ORDER_NOTICE} Choosing an attorney is entirely your decision - this
              ordering is not a recommendation.
            </p>

            {firm.lawyers.length === 0 ? (
              <p className="border border-neutral-100 p-6 text-center text-sm text-neutral-500">
                No attorneys are listed for this firm.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {inDailyOrder(firm.lawyers).map((a) => (
                  <Link
                    key={a.id}
                    href={`/${locale}/lawyers/${a.id}`}
                    className="group border border-neutral-100 p-4 transition-all hover:border-neutral-300"
                  >
                    <div className="flex items-start gap-3">
                      <AttorneyPhoto src={a.profileImageUrl} name={a.fullName} className="h-14 w-14 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-serif text-base text-neutral-900 group-hover:text-[#bfa37a]">
                          {a.fullName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          Attorney-at-Law
                          {a.isNotary && ' · Notary Public'}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {baslLabel(a.baslNumber)}
                          {a.yearsOfExperience ? ` · ${a.yearsOfExperience} yrs` : ''}
                        </p>
                        {a.practiceAreas.length > 0 && (
                          <p className="mt-1 truncate text-[11px] text-neutral-500">
                            {a.practiceAreas.slice(0, 3).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-8 border border-neutral-100 bg-neutral-50 p-5">
              <h3 className="flex items-center gap-2 font-serif text-base text-neutral-900">
                <Building2 className="h-4 w-4" />
                Engaging this firm
              </h3>
              <p className="mt-2 text-sm font-light leading-relaxed text-neutral-600">
                Legal services are provided by <strong>{firm.name}</strong>, not by this
                platform. If you send a request, the firm will check for conflicts of
                interest, assign one of its attorneys, then send you its own fee quote,
                terms and a proposed appointment. No fee is payable until you accept
                them, and any fee you agree is paid directly to the firm.
              </p>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link
                  href={`/${locale}/firms/${firm.slug}/engage`}
                  className="inline-flex items-center justify-center gap-2 bg-[#1a1a1a] px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-neutral-800"
                >
                  Request an engagement
                </Link>
                <span className="text-[10px] uppercase tracking-widest text-neutral-400">
                  No fee · No obligation
                </span>
              </div>

              {/* Requests go to the practice, which assigns the attorney (decision 8,
                  ATTORNEY_BOOKING_ENABLED off). This used to invite requesting an
                  attorney directly, which the attorney's page no longer offers. */}
              <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
                Requests go to the firm, which assigns one of its attorneys.
              </p>
            </div>

            <div className="mt-6">
              <LegalDisclaimer variant="directory" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
