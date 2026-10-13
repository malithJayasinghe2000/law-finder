import Link from 'next/link';

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
 * ─────────────────────────────────────────────────────────────────────────────
 */
interface LawyerCardProps {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  practiceAreas: string[];
  languages: string[];
  district: string | null;
  locale: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function LawyerCard({
  id,
  fullName,
  profileImageUrl,
  practiceAreas,
  languages,
  district,
  locale,
}: LawyerCardProps) {
  return (
    <Link href={`/${locale}/lawyers/${id}`} className="w-full">
      <div className="group flex h-full items-start gap-4 border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-400">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden bg-neutral-100">
          {profileImageUrl ? (
            <img src={profileImageUrl} alt={fullName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-neutral-500" aria-hidden="true">
              {initials(fullName)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5 text-left">
          <h4 className="font-serif text-base font-bold text-neutral-900 group-hover:underline">
            {fullName}
          </h4>
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
