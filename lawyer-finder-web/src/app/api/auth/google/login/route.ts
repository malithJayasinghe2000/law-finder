import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { randomBytes } from 'crypto';
import { safeRedirect } from '@/lib/safeRedirect';
import { verificationLocale } from '@/lib/emailVerification';

/**
 * Start "Sign in with Google".
 *
 * A random `state` goes to Google and into a short-lived httpOnly cookie; the
 * callback refuses a reply whose state does not match. Without it, another site
 * could finish a Google sign-in in someone's browser into an account of the
 * attacker's choosing (login CSRF). The cookie also carries where the person was
 * going and their language, so they come back there.
 */
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

  if (!clientId || !clientSecret || !process.env.NEXT_PUBLIC_APP_URL) {
    console.error('Google OAuth credentials not configured in environment variables.');
    return NextResponse.json(
      { error: 'Google OAuth is not configured on the server.' },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const state = randomBytes(24).toString('hex');
  const back = {
    state,
    redirect: safeRedirect(url.searchParams.get('redirect')),
    locale: verificationLocale(url.searchParams.get('l')),
  };

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const authorizationUrl = oauth2Client.generateAuthUrl({
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    include_granted_scopes: true,
    state,
  });

  const res = NextResponse.redirect(authorizationUrl);
  res.cookies.set('google_oauth', JSON.stringify(back), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/google',
    maxAge: 10 * 60,
  });
  return res;
}
