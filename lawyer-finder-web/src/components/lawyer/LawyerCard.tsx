import Link from 'next/link';
import AttorneyPhoto from '@/components/lawyer/AttorneyPhoto';

/**
 * One attorney in the public directory.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Rule 45 of the 1988 Rules lets an attorney appear in a Legal Directory with
 * "name, address and description". This card shows that and nothing more:
 *
 *   - No bio. Attorneys' own text read "Expert in…", "Specialist in…", "Senior
 *     attorney with 15 years…" — self-promotion, and Rule 49 bars publishing
 *     particulars of one's practice. The bio stays on the attorney's own page.
 *   - A small photo, the same size for everyone. A large portrait card is an
 *     advertisement; a passport-sized one identifies the person.
 *   - No stock photo. Every attorney without a photo used to show the SAME
 *     stranger's face; initials instead.
 *   - The firm. The client engages the firm, not the individual (rule 7), so
 *     the card says which practice the attorney belongs to.
 * ─────────────────────────────────────────────────────────────────────────────
 */
interface LawyerCardProps {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  practiceAreas: string[];
  languages: string[];
  district: string | null;
  firm?: { name: string; firmType: string } | null;
  locale: string;
}

export default function LawyerCard({
  id,
  fullName,
  profileImageUrl,
  practiceAreas,
  languages,
  district,
  firm,
  locale,
}: LawyerCardProps) {
  return (
    <Link href={`/${locale}/lawyers/${id}`} className="w-full">
      <div className="group flex h-full items-start gap-4 border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-400">
        <AttorneyPhoto src={profileImageUrl} name={fullName} className="h-16 w-16 shrink-0" />

        <div className="min-w-0 flex-1 space-y-1.5 text-left">
          <h4 className="font-serif text-base font-bold text-neutral-900 group-hover:underline">
            {fullName}
          </h4>
          {firm && (
            <p className="text-xs text-neutral-500">
              {firm.firmType === 'SOLE_PRACTITIONER' ? 'Sole practitioner' : firm.name}
            </p>
          )}
          {practiceAreas.length > 0 && (
            <p className="text-xs text-neutral-600">{practiceAreas.join(', ')}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {district && (
              <span className="bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                {district}
              </span>
            )}
            {languages.map((lang) => (
              <span
                key={lang}
                className="border border-neutral-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
