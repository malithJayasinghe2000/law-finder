'use client';

import { useState } from 'react';
import { useDirectoryEnabled } from '@/components/directory/DirectoryProvider';
import AttorneyPhoto from '@/components/lawyer/AttorneyPhoto';
import { publishableDescription } from '@/lib/selfPromotion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Star, MapPin, Languages, ShieldCheck, Phone, Clock, Calendar,
  Briefcase, Scale, Gavel, BookOpen, ArrowRight, ArrowLeft,
  MessageSquare, CalendarCheck, Send, X, Loader2, Globe, Zap,
  Facebook, Linkedin
} from 'lucide-react';

/**
 * Public attorney profile.
 *
 * Bound by the Rule 40 content limit: name, qualifications, and factual practice
 * information. No fee indication, no rating, and nothing that signals what the
 * attorney pays us. If you are adding a field here, check it against
 * docs/restructure/LEGAL-GUARDRAILS.md first — and remember the server component
 * that feeds this is where the real leak happens, not the JSX.
 */
interface LawyerData {
  id: string;
  fullName: string;
  baslNumber: string;
  address: string | null;
  contactPhone: string | null;
  profileImageUrl: string | null;
  bio: string | null;
  practiceAreas: string[];
  languages: string[];
  district: string | null;
  yearsOfExperience: number | null;
  practiceType: string | null;
  courts: string[];
  isNotary: boolean;
  isVerified: boolean;
  user: { id: string; createdAt: string } | null;
  firm: { name: string; slug: string; firmType: string } | null;
}

interface Props {
  lawyer: LawyerData;
  locale: string;
  isLoggedIn: boolean;
  currentUserId: string | null;
}

export default function LawyerProfileClient({
  lawyer,
  locale,
  isLoggedIn,
  currentUserId,
}: Props) {
  const directoryEnabled = useDirectoryEnabled();
  const router = useRouter();

  const [chatLoading, setChatLoading] = useState(false);

  const handleChatClick = async () => {
    if (!isLoggedIn) {
      router.push(`/${locale}/login`);
      return;
    }

    if (currentUserId === lawyer.user?.id) {
      toast.error("You cannot chat with yourself.");
      return;
    }

    if (!lawyer.user?.id) {
      toast.error("This lawyer does not have an active chat account.");
      return;
    }

    setChatLoading(true);
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: lawyer.user?.id || lawyer.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start chat');

      router.push(`/${locale}/messages?conv=${data.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Error starting chat');
      setChatLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#fcfbf9]">
      {/* ─── Breadcrumb ─── */}
      <div className="border-b border-[#efeae0] bg-[#faf8f6]/80 backdrop-blur-md sticky top-24 z-10">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-4 flex items-center gap-3 text-xs uppercase tracking-widest">
          <Link href={`/${locale}`} className="text-neutral-500 hover:text-[#bfa37a] transition-colors flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          {directoryEnabled && (
            <>
              <span className="text-neutral-300">/</span>
              <Link href={`/${locale}/lawyers`} className="text-neutral-500 hover:text-[#bfa37a] transition-colors">
                Lawyers
              </Link>
            </>
          )}
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-900 font-serif font-bold tracking-normal normal-case">{lawyer.fullName}</span>
        </div>
      </div>

      {/* ─── Main Product-Style Layout ─── */}
      <section className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">

          {/* ─── LEFT: Profile Card ─── */}
          <div className="lg:col-span-5">
            <div className="sticky top-40">
              {/* Profile Image Card */}
              <div className="relative group overflow-hidden bg-[#1a1a1a] rounded-none border border-[#efeae0] p-3 bg-[#fdfcfb]">
                <div className="relative overflow-hidden bg-neutral-900">
                  <AttorneyPhoto
                    src={lawyer.profileImageUrl}
                    name={lawyer.fullName}
                    className="w-full aspect-[4/5]"
                    initialsClassName="font-serif text-6xl"
                  />
                  {/* Languages - Always Visible */}
                  <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-1.5">
                    {lawyer.languages.map((lang) => (
                      <span key={lang} className="text-[9px] bg-black/45 backdrop-blur-md text-white font-bold uppercase tracking-widest px-2.5 py-1 border border-white/10">
                        {lang}
                      </span>
                    ))}
                  </div>

                  {/* Soft Hover Overlay */}
                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Verification badge only.
                      The subscription plan name used to be rendered here beside
                      it. A client could see which attorneys pay us more, which is
                      exactly the paid prominence rule 3 forbids — and it was in
                      the page source even before it was a badge. Removed.
                      See docs/restructure/LEGAL-GUARDRAILS.md (rules 3 and 4). */}
                  <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center gap-2">
                    {lawyer.isVerified && (
                      <div className="flex items-center gap-1.5 text-white text-[9px] font-bold bg-[#bfa37a] w-fit px-3 py-1.5 uppercase tracking-widest rounded-none">
                        <ShieldCheck className="h-3.5 w-3.5" /> BASL Verified
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => router.push(`/${locale}/lawyers/${lawyer.id}/book`)}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#1a1a1a] text-white py-4.5 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all rounded-none text-center leading-tight px-2"
                >
                  <CalendarCheck className="h-4 w-4 shrink-0" /> Request Consultation
                </button>
                <button
                  onClick={handleChatClick}
                  disabled={chatLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#faf8f6] border border-[#efeae0] text-[#1a1a1a] py-4.5 text-xs font-bold uppercase tracking-widest hover:bg-[#efeae0]/30 transition-all rounded-none disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  {chatLoading ? 'Starting...' : 'Chat'}
                </button>
              </div>

            </div>
          </div>

          {/* ─── RIGHT: Details ─── */}
          <div className="lg:col-span-7">
            {/* Name & Category Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                {lawyer.isVerified && (
                  <div className="flex items-center gap-1 bg-[#bfa37a] text-white text-[9px] font-bold px-3 py-1.5 uppercase tracking-widest rounded-none">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <p>Verified</p>
                  </div>
                )}
                {lawyer.practiceType && (
                  <span className="bg-[#efeae0]/40 border border-[#efeae0] text-[#1a1a1a] text-[9px] font-bold px-3 py-1.5 uppercase tracking-widest rounded-none">{lawyer.practiceType}</span>
                )}
              </div>
              <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-[#1a1a1a] mb-2">{lawyer.fullName}</h1>
              <p className="text-lg text-[#bfa37a] font-serif italic mb-4">
                {lawyer.practiceAreas.join(' · ') || 'Legal Professional'}
              </p>
              {/* The client engages the firm, not the individual (rule 7). */}
              {lawyer.firm && (
                <p className="text-sm text-neutral-600">
                  {lawyer.firm.firmType === 'SOLE_PRACTITIONER' ? 'Sole practitioner' : 'Practises at'}{' '}
                  <Link
                    href={`/${locale}/firms/${lawyer.firm.slug}`}
                    className="font-semibold text-[#1a1a1a] underline underline-offset-4 hover:text-[#bfa37a]"
                  >
                    {lawyer.firm.firmType === 'SOLE_PRACTITIONER' ? 'View practice' : lawyer.firm.name}
                  </Link>
                </p>
              )}


            </div>


            {/* Bio */}
            <div className="mb-8 pb-8 border-b border-[#efeae0]">
              <h3 className="text-xs font-bold text-[#bfa37a] uppercase tracking-[0.2em] mb-4">About</h3>
              <p className="text-neutral-600 leading-relaxed font-light">
                {/* Saved text that praises rather than describes is not published
                    (src/lib/selfPromotion.ts — Rules 39 and 49). */}
                {publishableDescription(lawyer.bio) || 'This attorney has not added a description of their practice.'}
              </p>
            </div>

            {/* Details Grid */}
            <div className="mb-8 pb-8 border-b border-[#efeae0]">
              <h3 className="text-xs font-bold text-[#bfa37a] uppercase tracking-[0.2em] mb-6">Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {lawyer.district && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-450 font-bold uppercase tracking-widest">District</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">{lawyer.district}</p>
                    </div>
                  </div>
                )}

                {lawyer.contactPhone && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-450 font-bold uppercase tracking-widest">Phone</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">{lawyer.contactPhone}</p>
                    </div>
                  </div>
                )}
                {lawyer.yearsOfExperience ? (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-455 font-bold uppercase tracking-widest">In practice</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">{lawyer.yearsOfExperience} years</p>
                    </div>
                  </div>
                ) : null}
                {lawyer.baslNumber && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <Scale className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-455 font-bold uppercase tracking-widest">BASL Number</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">{lawyer.baslNumber}</p>
                    </div>
                  </div>
                )}
                {lawyer.isNotary && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <Gavel className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-455 font-bold uppercase tracking-widest">Notary</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">Yes — Notary Public</p>
                    </div>
                  </div>
                )}
                {lawyer.address && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-455 font-bold uppercase tracking-widest">Address</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">{lawyer.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Practice Areas */}
            <div className="mb-8 pb-8 border-b border-[#efeae0]">
              <h3 className="text-xs font-bold text-[#bfa37a] uppercase tracking-[0.2em] mb-6">Practice Areas</h3>
              <div className="flex flex-wrap gap-2.5">
                {lawyer.practiceAreas.length > 0 ? (
                  lawyer.practiceAreas.map((area) => (
                    <span key={area} className="bg-[#1a1a1a] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-none border border-neutral-800">
                      {area}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-neutral-400 uppercase tracking-widest font-bold">No practice areas specified.</p>
                )}
              </div>
            </div>

            {/* Languages */}
            {lawyer.languages.length > 0 && (
              <div className="mb-8 pb-8 border-b border-[#efeae0]">
                <h3 className="text-xs font-bold text-[#bfa37a] uppercase tracking-[0.2em] mb-6">Languages</h3>
                <div className="flex flex-wrap gap-2.5">
                  {lawyer.languages.map((lang) => (
                    <span key={lang} className="bg-[#bfa37a] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-none">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Courts */}
            {lawyer.courts.length > 0 && (
              <div className="mb-8 pb-8 border-b border-[#efeae0]">
                <h3 className="text-xs font-bold text-[#bfa37a] uppercase tracking-[0.2em] mb-6">Courts</h3>
                <div className="flex flex-wrap gap-2.5">
                  {lawyer.courts.map((court) => (
                    <span key={court} className="border border-[#efeae0] bg-[#faf8f6] text-[#1a1a1a] px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-none">
                      {court}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>


      {/* The "Explore Other Lawyers" marquee was removed. It showed the first 12
          attorneys alphabetically on every other attorney's page — the same
          few names promoted everywhere, and a path from a page the client
          reached by the attorney's own link on to everyone else. */}


    </div>
  );
}
