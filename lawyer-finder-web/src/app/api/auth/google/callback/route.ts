import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/db';
import { getSubscriptionForProfile } from '@/lib/firms/billing';
import { createSession, SessionPayload } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
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
    const { id: googleId, email, name, picture } = userInfo.data;

    if (!email || !googleId) {
      return NextResponse.json({ error: 'Failed to retrieve email or google ID from Google' }, { status: 400 });
    }

    // Try to find an existing user by email or googleId
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: googleId },
          { email: email }
        ]
      }
    });

    if (user) {
      // If user exists but doesn't have a googleId, link the account
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleId,
            authProvider: 'GOOGLE',
          }
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

    // Redirect based on role
    const locale = 'en'; // Ideally, we should capture locale from state or a cookie, but default to 'en'
    const redirectUrl = user.role === 'CLIENT' 
      ? `/${locale}` 
      : `/${locale}/dashboard/${user.role.toLowerCase()}`;

    // Note: We need to redirect to absolute URL if we are using NextResponse.redirect
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${redirectUrl}`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.json({ error: 'Internal Server Error during Google Auth' }, { status: 500 });
  }
}
