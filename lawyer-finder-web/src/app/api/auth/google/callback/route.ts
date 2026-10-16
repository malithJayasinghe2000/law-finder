import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/db';
import { getSubscriptionForProfile } from '@/lib/firms/billing';
import { createSession, SessionPayload } from '@/lib/auth';
import { safeRedirect } from '@/lib/safeRedirect';
import { verificationLocale } from '@/lib/emailVerification';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');

    // Set by api/auth/google/login: the state to match, and where to return.
    const jar = await cookies();
    let back: { state?: string; redirect?: string | null; locale?: string } = {};
    try { back = JSON.parse(jar.get('google_oauth')?.value ?? '{}'); } catch { back = {}; }
    jar.delete({ name: 'google_oauth', path: '/api/auth/google' });
    const locale = verificationLocale(back.locale);
    const fail = (reason: string) =>
      NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/login?error=${reason}`);

    // A reply we did not ask for (login CSRF), or a cancelled sign-in.
    if (!code || !back.state || url.searchParams.get('state') !== back.state) {
      return fail('GoogleFailed');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

    if (!clientId || !clientSecret || !process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json(
        { error: 'Google OAuth is not configured on the server.' },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2',
    });

    const userInfo = await oauth2.userinfo.get();
    const { id: googleId, name, picture } = userInfo.data;
    const email = userInfo.data.email?.toLowerCase().trim();

    if (!email || !googleId) return fail('GoogleFailed');

    // Only an address Google has verified may sign in, or be joined to an
    // existing account here. Joining on an unverified address would let whoever
    // typed it into a Google account take over the account that owns it.
    if (userInfo.data.verified_email !== true) return fail('GoogleUnverified');

    // Try to find an existing user by email or googleId
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: googleId },
          { email: email }
        ]
      }
    });

    // A closed account stays closed, whichever way someone signs in.
    if (user && user.status !== 'ACTIVE') return fail('AccountClosed');

    if (user) {
      // Join Google to the existing account. authProvider is left as it was: an
      // account with a password keeps it, and "Forgot password" keeps working.
      // A verified Google address proves the inbox, as the email link would.
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, isEmailVerified: true },
        });
      }
    } else {
      // Create new user if they don't exist
      user = await prisma.user.create({
        data: {
          email: email,
          fullName: name,
          profileImageUrl: picture,
          role: 'CLIENT',
          authProvider: 'GOOGLE',
          googleId: googleId,
          isEmailVerified: true,
        }
      });
    }

    const sessionPayload: SessionPayload = {
      userId: user.id,
      role: user.role,
      fullName: user.fullName,
      profileImageUrl: user.profileImageUrl
    };

    // If lawyer, fetch subscription info and profileId for the session
    if (user.role === 'LAWYER') {
      const profile = await prisma.lawyerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (profile) {
        sessionPayload.profileId = profile.id;

        // The licence belongs to the attorney's firm, not to the attorney.
        const subscription = await getSubscriptionForProfile(profile.id);

        if (subscription) {
          sessionPayload.subscriptionRole = subscription.role.name;
          sessionPayload.subscriptionStatus = subscription.status;
        }
      }
    }

    await createSession(sessionPayload);

    // Back where they started, else their home.
    const redirectUrl =
      safeRedirect(back.redirect) ??
      (user.role === 'CLIENT' ? `/${locale}` : `/${locale}/dashboard/${user.role.toLowerCase()}`);

    // Note: We need to redirect to absolute URL if we are using NextResponse.redirect
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${redirectUrl}`);
  } catch (error) {
    console.error('Google OAuth callback error:', error instanceof Error ? error.message : error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/en/login?error=GoogleFailed`);
  }
}
