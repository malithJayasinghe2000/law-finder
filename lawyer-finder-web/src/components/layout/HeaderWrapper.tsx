import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import Header from './Header';

export default async function HeaderWrapper({ locale }: { locale: string }) {
  const session = await getSession();
  let appStatus = null;
  let userProfile = null;
  
  if (session) {
    // Fetch User Profile for Avatar and Name
    userProfile = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { fullName: true, profileImageUrl: true }
    });

    if (session.role === 'CLIENT') {
      const application = await prisma.lawyerApplication.findUnique({
        where: { userId: session.userId },
        select: { status: true }
      });
      if (application) {
        appStatus = application.status;
      }
    }
  }

  return (
    <Header 
      locale={locale} 
      userRole={session?.role} 
      appStatus={appStatus} 
      userProfile={userProfile}
    />
  );
}
