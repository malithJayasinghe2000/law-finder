import Link from 'next/link';
import { Scale, Mail, MapPin, Phone } from 'lucide-react';

export default function Footer({ locale }: { locale: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0a0d14] text-white border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <Link href={`/${locale}`} className="flex items-center gap-3">
              <Scale className="h-6 w-6 text-[#ffb84f]" />
              <span className="text-base font-bold tracking-[0.1em] uppercase text-[#ffb84f]">
                Lawyer.ai
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-white/50 font-light">
              Sri Lanka&apos;s trusted AI platform connecting citizens with verified legal professionals.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-white">Platform</h4>
            <ul className="flex flex-col gap-3">
              <li>
                <Link href={`/${locale}/lawyers`} className="text-sm text-white/60 font-light transition-colors hover:text-white">
                  Lawyer Directory
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/blog`} className="text-sm text-white/60 font-light transition-colors hover:text-white">
                  Legal Insights
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/register`} className="text-sm text-white/60 font-light transition-colors hover:text-white">
                  Join as a Lawyer
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-white">Legal</h4>
            <ul className="flex flex-col gap-3">
              <li>
                <span className="text-sm text-white/60 font-light cursor-pointer hover:text-white transition-colors">Terms of Service</span>
              </li>
              <li>
                <span className="text-sm text-white/60 font-light cursor-pointer hover:text-white transition-colors">Privacy Policy</span>
              </li>
              <li>
                <span className="text-sm text-white/60 font-light cursor-pointer hover:text-white transition-colors">Cookie Policy</span>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-white">Contact</h4>
            <ul className="flex flex-col gap-3">
              <li className="flex items-center gap-3 text-sm text-white/60 font-light">
                <MapPin className="h-4 w-4 shrink-0 text-[#ffb84f]" />
                Colombo, Sri Lanka
              </li>
              <li className="flex items-center gap-3 text-sm text-white/60 font-light">
                <Mail className="h-4 w-4 shrink-0 text-[#ffb84f]" />
                hello@lawyer.ai
              </li>
              <li className="flex items-center gap-3 text-sm text-white/60 font-light">
                <Phone className="h-4 w-4 shrink-0 text-[#ffb84f]" />
                +94 11 234 5678
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-white/40 font-light">
            © {year} Lawyer.ai Platform. Powered by FiveNeurals (PVT) LTD.
          </p>
          <p className="text-xs text-white/40 font-light">
            Verified by the Bar Association of Sri Lanka (BASL)
          </p>
        </div>
      </div>
    </footer>
  );
}
