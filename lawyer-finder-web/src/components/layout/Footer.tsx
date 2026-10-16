'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Facebook, Youtube, Instagram, Twitter, ArrowUpRight } from 'lucide-react';
import { useDirectoryEnabled } from '@/components/directory/DirectoryProvider';
import { directoryPath } from '@/lib/directoryLinks';
import { SITE_CONTACT } from '@/lib/siteContact';

const SOCIAL_ICONS = [
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'x', label: 'X', Icon: Twitter },
] as const;

const LINK_CLASS = 'text-sm text-neutral-400 hover:text-[#bfa37a] transition-colors flex items-center gap-2';

export default function Footer({ locale }: { locale: string }) {
  const year = new Date().getFullYear();
  const directoryEnabled = useDirectoryEnabled();
  const { email, phone, company, social } = SITE_CONTACT;
  const socials = SOCIAL_ICONS.filter((s) => social[s.key]);

  // Plain links to what the site has. This column used to be "Services" (Civil
  // Litigation, Criminal Defense…), which read as legal services offered by us
  // (rule 7), and its practice-area links never matched a firm: every one showed
  // "0 firms found".
  const explore = [
    ...(directoryEnabled ? [{ href: directoryPath(locale), label: 'Find a Law Firm' }] : []),
    { href: `/${locale}/legal-library`, label: 'Legal Library' },
    { href: `/${locale}/chat`, label: 'AI Chat' },
    { href: `/${locale}/blog`, label: 'Community Hub' },
    { href: `/${locale}/about`, label: 'About' },
  ];

  return (
    <footer className="bg-[#141414] text-white pt-16">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24">
        {/* Top Info Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-12 border-b border-white/10">
          {/* Contact details live in src/lib/siteContact.ts; an empty one is not shown. */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left md:w-56">
            {email && (
              <>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#bfa37a] font-bold mb-2">Send Email</span>
                <a href={`mailto:${email}`} className="text-lg font-serif text-white hover:text-[#bfa37a] transition-colors">
                  {email}
                </a>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Image
              src="/logowhite.png"
              alt="TheLawyr Logo"
              width={200}
              height={35}
              className="h-18 w-auto object-contain"
            />
          </div>

          <div className="flex flex-col items-center md:items-end text-center md:text-right md:w-56">
            {phone && (
              <>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#bfa37a] font-bold mb-2">Call Now</span>
                <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="text-lg font-serif text-white hover:text-[#bfa37a] transition-colors">
                  {phone}
                </a>
              </>
            )}
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 py-16">
          {/* About Us */}
          <div className="space-y-6">
            <h4 className="text-base font-serif text-white tracking-wider">About Us</h4>
            <p className="text-sm text-neutral-400 leading-relaxed font-light">
              TheLawyr is software for law practices in Sri Lanka, with a library of Sri Lankan
              legislation and an assistant that explains the law. We are not a law firm and do
              not give legal advice.
            </p>
            {socials.length > 0 && (
              <div className="flex items-center gap-3">
                {socials.map(({ key, label, Icon }) => (
                  <a
                    key={key}
                    href={social[key]!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#bfa37a]/10 hover:bg-[#bfa37a] text-[#bfa37a] hover:text-white transition-all"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h4 className="text-base font-serif text-white tracking-wider">Explore</h4>
            <ul className="space-y-3">
              {explore.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={LINK_CLASS}>
                    <span className="w-1 h-1 bg-[#bfa37a] rounded-full"></span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* The company behind the product (two invented offices used to stand here). */}
          <div className="space-y-6">
            <h4 className="text-base font-serif text-white tracking-wider">Company</h4>
            <div className="space-y-2 text-sm text-neutral-400 font-light leading-relaxed">
              <p>
                TheLawyr is a product of{' '}
                {company.url ? (
                  <a href={company.url} target="_blank" rel="noopener noreferrer" className="font-bold text-white hover:text-[#bfa37a] transition-colors">
                    {company.name}
                  </a>
                ) : (
                  <span className="font-bold text-white">{company.name}</span>
                )}
                .
              </p>
              {company.description && <p>{company.description}</p>}
              {company.address && <p>{company.address}</p>}
              {company.url && (
                <a
                  href={company.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 pt-2 text-sm text-[#bfa37a] hover:text-white transition-colors"
                >
                  Visit {company.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>

          {/*
            A newsletter sign-up box stood here: an email field and a send
            button with no handler on either. Removed in Phase 8 rather than
            wired up, for two reasons.

            It was a false statement about what we do with your data — it looked
            like it collected your address and silently discarded it, which is
            the same defect as the `ChatWidget` input removed in Phase 5.

            And making it work would have been worse. Marketing email is one of
            the three purposes that genuinely rest on consent, and consent has
            to be recorded against a person and the version of the notice they
            were shown. A footer box collecting a bare address from someone with
            no account cannot do either, so it would have been marketing consent
            with no record behind it. The place to opt in is the "Your data"
            screen, where the record is written properly.
          */}

          {/* Your data */}
          <div className="space-y-6">
            <h4 className="text-base font-serif text-white tracking-wider">Your data</h4>
            <p className="text-sm text-neutral-400 leading-relaxed font-light">
              What we collect, why, who can reach it, and how long we keep it - including
              why our own staff cannot read what you tell your attorney.
            </p>
            <ul className="space-y-3">
              <li>
                <Link
                  href={`/${locale}/privacy`}
                  className={LINK_CLASS}
                >
                  <span className="w-1 h-1 bg-[#bfa37a] rounded-full"></span>
                  Privacy Notice
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/dashboard/profile/privacy`}
                  className={LINK_CLASS}
                >
                  <span className="w-1 h-1 bg-[#bfa37a] rounded-full"></span>
                  Your data: consents, export, deletion
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Gold bottom banner */}
      <div className="bg-[#bfa37a] py-6 text-center text-xs tracking-wider uppercase font-bold text-neutral-900">
        © {year} {company.name}. All rights reserved.
      </div>
    </footer>
  );
}
