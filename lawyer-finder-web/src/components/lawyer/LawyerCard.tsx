import Link from 'next/link';
import { Star } from 'lucide-react';

interface LawyerCardProps {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  bio: string | null;
  practiceAreas: string[];
  languages: string[];
  district: string | null;
  avgRating?: number;
  locale: string;
  imageHeight?: string; // e.g. "h-[280px]" or "h-[360px]"
}

export default function LawyerCard({
  id,
  fullName,
  profileImageUrl,
  bio,
  practiceAreas,
  languages,
  district,
  avgRating = 0,
  locale,
  imageHeight = 'h-[280px]'
}: LawyerCardProps) {
  const primaryArea = practiceAreas[0] || 'Legal Counsel';

  return (
    <Link href={`/${locale}/lawyers/${id}`} className="w-full">
      <div className="group flex flex-col items-start bg-white border border-neutral-100 p-4 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
        {/* Image Frame */}
        <div className={`relative w-full ${imageHeight} overflow-hidden bg-neutral-100`}>
          <img
            src={profileImageUrl || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'}
            alt={fullName}
            className="h-full w-full object-cover transition-all duration-750 group-hover:grayscale"
          />
          {/* Languages - Always Visible */}
          <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-1.5">
            {languages.map((lang) => (
              <span key={lang} className="text-[8px] bg-black/45 backdrop-blur-md text-white font-bold uppercase tracking-widest px-2 py-0.5 border border-white/10 rounded-none">
                {lang}
              </span>
            ))}
          </div>
          {/* Hover Overlay - Soft darkening shadow */}
          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          </div>
        </div>

        {/* Display Info below card */}
        <div className="w-full pt-4 space-y-2 text-left">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#bfa37a]">
            {primaryArea}
          </span>
          <h4 className="text-neutral-900 font-serif font-bold text-base transition-colors group-hover:text-[#bfa37a]">
            {fullName}
          </h4>
          <p className="text-neutral-450 text-xs font-light line-clamp-1">
            {bio || 'Vetted legal counsel ready for guidance.'}
          </p>
          {(avgRating > 0 || district) && (
            <div className="flex items-center gap-3 pt-2">
              {avgRating > 0 && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-600 bg-neutral-100 px-2 py-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {avgRating.toFixed(1)}
                </div>
              )}
              {district && (
                <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 bg-neutral-100 px-2 py-1">
                  {district}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
