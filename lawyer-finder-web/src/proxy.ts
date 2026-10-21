import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/auth';
import { TRANSLATED_LOCALES_ENABLED } from '@/lib/translatedLocales';

const intlMiddleware = createMiddleware(routing);

// Extract locale from pathname
function getLocale(pathname: string): string {
  const segments = pathname.split('/');
  const potentialLocale = segments[1];
  if (['en', 'si', 'ta'].includes(potentialLocale)) return potentialLocale;
  return 'en';
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Sinhala and Tamil are switched off until the public pages are translated:
  // send /si/... and /ta/... to the same page in English. 307, not 308, so the
  // addresses are not dropped for good once translations exist.
  if (!TRANSLATED_LOCALES_ENABLED && /^\/(si|ta)(\/|$)/.test(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/(si|ta)(?=\/|$)/, '/en');
    return NextResponse.redirect(url, 307);
  }

  const locale = getLocale(pathname);

  // Protect /dashboard routes
  if (pathname.includes('/dashboard')) {
    const sessionCookie = request.cookies.get('session');

    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }

    const payload = await decrypt(sessionCookie.value);

    if (!payload) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }

    // Role-Based Access
    if (pathname.includes('/dashboard/admin') && payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL(`/${locale}/dashboard/lawyer`, request.url));
    }

    // NOTE: /dashboard/lawyer is deliberately NOT gated on role here.
    //
    // The firm-side dashboard is for everyone who works at a law firm, and a
    // practice manager or paralegal is not an admitted attorney — their platform
    // role is CLIENT. Deciding that here is impossible anyway: membership lives
    // in the database and this middleware runs on the Edge, where there is no
    // Prisma client.
    //
    // So this stays coarse (are you signed in at all?) and the real check runs
    // in src/app/[locale]/dashboard/lawyer/layout.tsx, which queries the live
    // membership and redirects anyone who is not firm-side. That is the same
    // split this file already uses for role changes — the layout reads the
    // database precisely so a stale JWT claim cannot decide anything.
    //
    // Nothing is loosened by this: the layout redirects, and every /api/firms
    // route resolves authority through src/lib/firms/access.ts independently.
  }

  // Protect API routes that require auth
  if (pathname.startsWith('/api/admin') || pathname.startsWith('/api/lawyers/profile')) {
    const sessionCookie = request.cookies.get('session');

    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const payload = await decrypt(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
    }

    // Admin-only routes
    if (pathname.startsWith('/api/admin') && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
  }

  // i18n middleware for non-API routes
  if (!pathname.startsWith('/api')) {
    return intlMiddleware(request);
  }

  return NextResponse.next();
}

export const config = {
  // The library upload route is left out: the proxy buffers a request body
  // only up to 10 MB (proxyClientMaxBodySize), and a scanned Act is 25-300 MB,
  // so the route received a cut-off PDF. Raising that limit would apply to
  // every route, public ones included. The route checks for an ADMIN session
  // itself, on every method (api/admin/legal-documents/route.ts).
  matcher: ['/((?!_next|api/admin/legal-documents$|.*\\..*).*)'],
};
