import Link from 'next/link';
import { Scale, Mail, MapPin, Phone } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function Footer({ locale }: { locale: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <Link href={`/${locale}`} className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Scale className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                LawFinder<span className="text-muted-foreground font-normal ml-0.5">SL</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sri Lanka&apos;s trusted platform connecting citizens with verified legal professionals across all districts.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Platform</h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href={`/${locale}/lawyers`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Lawyer Directory
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/blog`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Legal Insights
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/register`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Join as a Lawyer
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Legal</h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <span className="text-sm text-muted-foreground">Terms of Service</span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">Privacy Policy</span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">Cookie Policy</span>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Contact</h4>
            <ul className="flex flex-col gap-3">
              <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                Colombo, Sri Lanka
              </li>
              <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                hello@lawfinder.lk
              </li>
              <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                +94 11 234 5678
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            {year} LawFinder SL. Powered by FiveNeurals (PVT) LTD.
          </p>
          <p className="text-xs text-muted-foreground">
            Verified by the Bar Association of Sri Lanka (BASL)
          </p>
        </div>
      </div>
    </footer>
  );
}
