import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/auth';

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

    if (pathname.includes('/dashboard/lawyer') && payload.role !== 'LAWYER' && payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
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
  matcher: ['/((?!_next|.*\\..*).*)'],
};
