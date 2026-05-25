import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ApplicationClientForm from './ApplicationClientForm';

export default async function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  // Strict Authorization Guard
  if (!session || session.role !== 'CLIENT') {
    redirect(`/${locale}/login`);
  }

  // Fetch PostgreSQL Draft State
  const app = await prisma.lawyerApplication.findUnique({
    where: { userId: session.userId }
  });

  // Protect already submitted applications from malicious client mutation attempts
  if (app && (app.status === 'SUBMITTED' || app.status === 'IN_REVIEW' || app.status === 'APPROVED')) {
    redirect(`/${locale}`);
  }

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
            <div className="mb-6 p-6 rounded-3xl bg-red-50 text-red-900 border border-red-200 shadow-sm">
               <h3 className="font-bold text-lg">Previous Application Rejected</h3>
               <p className="text-sm mt-1">{rejectedReason || 'No specific reasoning provided by administration.'}</p>
               <p className="text-sm text-red-700 mt-3 font-semibold uppercase tracking-wide">Please correct the information above and submit a new application.</p>
            </div>
          )}
          <ApplicationClientForm locale={locale} initialStep={startingStep} initialData={draftData} />
       </div>
    </div>
  );
}
