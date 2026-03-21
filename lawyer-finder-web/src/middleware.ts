import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/auth';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /dashboard and internal API boundaries
  if (pathname.includes('/dashboard') || pathname.startsWith('/api/protected')) {
    const sessionCookie = request.cookies.get('session');
    
    // Auth Check
    if (!sessionCookie?.value) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/en/login', request.url));
    }

    const payload = await decrypt(sessionCookie.value);
    
    // Invalid Token Check
    if (!payload) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Invalid Session' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/en/login', request.url));
    }

    // Role-Based Auth Check for Admin
    if (pathname.includes('/dashboard/admin') && payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/en/dashboard/lawyer', request.url));
    }
    
    // Role-Based Auth Check for Lawyer
    if (pathname.includes('/dashboard/lawyer') && payload.role !== 'LAWYER' && payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/en', request.url));
    }
  }

  // Pass to i18n Next-Intl Middleware if not an API route
  if (!pathname.startsWith('/api')) {
    return intlMiddleware(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'] 
};
