import Link from 'next/link';
import Image from 'next/image';
import { Scale, Mail, MapPin, Phone, Facebook, Youtube, Instagram, Twitter, Send } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function Footer({ locale }: { locale: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#141414] text-white pt-16">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24">
        {/* Top Info Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-12 border-b border-white/10">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#bfa37a] font-bold mb-2">Send Email</span>
            <a href="mailto:hello@thelawyr.lk" className="text-lg font-serif text-white hover:text-[#bfa37a] transition-colors">
              hello@thelawyr.lk
            </a>
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

          <div className="flex flex-col items-center md:items-end text-center md:text-right">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#bfa37a] font-bold mb-2">Call Now</span>
            <a href="tel:+94112345678" className="text-lg font-serif text-white hover:text-[#bfa37a] transition-colors">
              +94 11 234 5678
            </a>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 py-16">
          {/* About Us */}
          <div className="space-y-6">
            <h4 className="text-base font-serif text-white tracking-wider">About Us</h4>
            <p className="text-sm text-neutral-400 leading-relaxed font-light">
              Sri Lanka&apos;s trusted SaaS platform connecting citizens with verified legal professionals across all districts, delivering instant AI-assisted legal intelligence.
            </p>
            {/* Social Icons */}
            <div className="flex items-center gap-3">
              <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#bfa37a]/10 hover:bg-[#bfa37a] text-[#bfa37a] hover:text-white transition-all">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#bfa37a]/10 hover:bg-[#bfa37a] text-[#bfa37a] hover:text-white transition-all">
                <Youtube className="h-4 w-4" />
              </a>
              <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#bfa37a]/10 hover:bg-[#bfa37a] text-[#bfa37a] hover:text-white transition-all">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#bfa37a]/10 hover:bg-[#bfa37a] text-[#bfa37a] hover:text-white transition-all">
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Services/Platform */}
          <div className="space-y-6">
            <h4 className="text-base font-serif text-white tracking-wider">Services</h4>
            <ul className="space-y-3">
              <li>
                <Link href={`/${locale}/lawyers?practiceArea=Civil`} className="text-sm text-neutral-400 hover:text-[#bfa37a] transition-colors flex items-center gap-2">
                  <span className="w-1 h-1 bg-[#bfa37a] rounded-full"></span>
                  Civil Litigation
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/lawyers?practiceArea=Criminal`} className="text-sm text-neutral-400 hover:text-[#bfa37a] transition-colors flex items-center gap-2">
                  <span className="w-1 h-1 bg-[#bfa37a] rounded-full"></span>
                  Criminal Defense
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/lawyers?practiceArea=Corporate`} className="text-sm text-neutral-400 hover:text-[#bfa37a] transition-colors flex items-center gap-2">
                  <span className="w-1 h-1 bg-[#bfa37a] rounded-full"></span>
                  Real Estate & Corporate Law
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/lawyers?practiceArea=Employment`} className="text-sm text-neutral-400 hover:text-[#bfa37a] transition-colors flex items-center gap-2">
                  <span className="w-1 h-1 bg-[#bfa37a] rounded-full"></span>
                  Labor & Workplace Injuries
                </Link>
              </li>
            </ul>
          </div>

          {/* Location */}
          <div className="space-y-6">
            <h4 className="text-base font-serif text-white tracking-wider">Location</h4>
            <div className="space-y-4 text-sm text-neutral-400">
              <div>
                <p className="font-bold text-white mb-1">Colombo Office</p>
                <p className="font-light">Address: 123 Galle Road, Colombo 03, Sri Lanka</p>
              </div>
              <div>
                <p className="font-bold text-white mb-1">Kandy Branch</p>
                <p className="font-light">Address: 456 Peradeniya Road, Kandy, Sri Lanka</p>
              </div>
            </div>
          </div>

          {/* Newsletter */}
          <div className="space-y-6">
            <h4 className="text-base font-serif text-white tracking-wider">Newsletter</h4>
            <p className="text-sm text-neutral-400 leading-relaxed font-light">
              Sign up for the latest legal tech updates, SaaS product releases and news.
            </p>
            <div className="flex max-w-sm items-center bg-white/5 border border-white/10 p-1">
              <input
                type="email"
                placeholder="Enter Your Email"
                className="w-full bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none px-3 font-light"
              />
              <button className="bg-[#bfa37a] hover:bg-[#bfa37a]/90 text-white p-3 transition-colors">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Gold bottom banner */}
      <div className="bg-[#bfa37a] py-6 text-center text-xs tracking-wider uppercase font-bold text-neutral-900">
        Copyright © TheLawyr {year}. All Rights Reserved. Powered by FiveNeurals.
      </div>
    </footer>
  );
}
