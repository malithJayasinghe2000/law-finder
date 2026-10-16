import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ApplicationClientForm from './ApplicationClientForm';
import Link from 'next/link';

export const metadata = { title: 'Apply as an Attorney' };

export default async function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  // Signed out: sign in, then come back here. An attorney or admin has nothing to apply for.
  if (!session) redirect(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/apply`)}`);
  if (session.role !== 'CLIENT') redirect(`/${locale}/dashboard`);

  // Fetch PostgreSQL Draft State
  const app = await prisma.lawyerApplication.findUnique({
    where: { userId: session.userId }
  });

  // Already sent: say where it stands (this used to bounce silently to the home page).
  if (app && (app.status === 'SUBMITTED' || app.status === 'IN_REVIEW')) {
    return (
      <div className="min-h-[70vh] bg-background px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-xl border border-[#efeae0] bg-[#faf8f6]/50 p-8 text-center sm:p-12">
          <h1 className="font-serif text-3xl text-neutral-900">Your application is being reviewed</h1>
          <p className="mt-4 text-sm font-light leading-relaxed text-neutral-600">
            We check your details against your Attorney-at-Law ID card and will email you when it
            is done. After you are approved, you register your practice (a firm or a sole
            practice), or accept an invitation from your firm.
          </p>
          <Link href={`/${locale}`} className="mt-8 inline-block bg-[#bfa37a] px-8 py-3.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#a68d67]">
            Back to home
          </Link>
        </div>
      </div>
    );
  }
  if (app?.status === 'APPROVED') redirect(`/${locale}/dashboard`);

  // Safely infer the Draft Object, obliterating it if REJECTED so they start entirely fresh.
  let draftData = {};
  let startingStep = 1;
  const isRejected = app?.status === 'REJECTED';

  if (app && !isRejected) {
    draftData = typeof app.draftData === 'string' ? JSON.parse(app.draftData) : app.draftData;
    startingStep = app.currentStep || 1;
  }

  // Also include an alert banner property for Rejected users.
  const rejectedReason = isRejected ? app.adminNotes : null;

  return (
    <div className="min-h-[85vh] bg-background py-16 px-4 sm:px-6 flex items-center justify-center">
       <div className="w-full max-w-2xl">
          {isRejected && (
            <div className="mb-6 p-5 rounded-none bg-red-50 text-red-900 border border-red-200 shadow-sm">
               <h3 className="font-normal text-lg">Your previous application was not approved</h3>
               <p className="text-sm mt-1">{rejectedReason || 'No reason was given.'}</p>
               <p className="text-sm text-red-700 mt-3">You can correct the details below and apply again.</p>
            </div>
          )}
          <ApplicationClientForm locale={locale} initialStep={startingStep} initialData={draftData} />
       </div>
    </div>
  );
}
