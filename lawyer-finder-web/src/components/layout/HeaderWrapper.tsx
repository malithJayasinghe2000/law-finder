import prisma from '@/lib/db';
import { getSubscriptionForProfile } from '@/lib/firms/billing';
import { getSession } from '@/lib/auth';
import Header from './Header';

export default async function HeaderWrapper({ locale }: { locale: string }) {
  const session = await getSession();
  let appStatus = null;
  let userProfile = null;
  let subscriptionTier = null;
  
  if (!session) {
    return <Header locale={locale} />;
  }

  // Get live user data from DB (not JWT) so role changes work without re-login
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { fullName: true, profileImageUrl: true, role: true }
  });

  const liveRole = user?.role || session.role;
  userProfile = user ? { fullName: user.fullName, profileImageUrl: user.profileImageUrl } : null;

  if (liveRole === 'CLIENT') {
    const application = await prisma.lawyerApplication.findUnique({
      where: { userId: session.userId },
      select: { status: true }
    });
    if (application) {
      appStatus = application.status;
    }
  } else if (liveRole === 'LAWYER') {
    const profile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    // The plan shown belongs to the attorney's firm (Phase 3).
    const subscription = await getSubscriptionForProfile(profile?.id);
    if (subscription) {
      subscriptionTier = subscription.plan.name;
    }
  }

  return (
    <Header 
      locale={locale} 
      userRole={liveRole} 
      appStatus={appStatus} 
      userProfile={userProfile}
      subscriptionTier={subscriptionTier}
      userId={session.userId}
    />
  );
}

