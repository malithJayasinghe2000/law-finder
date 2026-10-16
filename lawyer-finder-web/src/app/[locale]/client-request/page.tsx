'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Building2, Loader2, ShieldCheck, XCircle, Info } from 'lucide-react';
import { withRedirect } from '@/lib/safeRedirect';

/**
 * A client confirming a request a practice opened for them.
 *
 * The matter is shown only to someone signed in with the address it was sent
 * to; anyone else holding the link sees which practice sent it and nothing more.
 * See src/lib/firms/clientIntake.ts.
 */

type Details = {
  subject: string | null;
  description: string | null;
  practiceArea: string | null;
  mode: string;
  attorneyName: string | null;
};

type IntakeRequest = {
  firmName: string;
  district: string | null;
  email: string;
  status: string;
  expiresAt: string;
  signedIn: boolean;
  isAddressee: boolean;
  details: Details | null;
};

export default function ClientRequestPage() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const token = useSearchParams().get('token');

  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null);
  const [request, setRequest] = useState<IntakeRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const here = `/${locale}/client-request?token=${token ?? ''}`;

  const load = useCallback(() => {
    if (!token) {
      setError('That link is not valid.');
      setLoading(false);
      return;
    }
    fetch(`/api/client-requests/respond?token=${encodeURIComponent(token)}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) setError(d.error || 'That link is not valid.');
        else setRequest(d.request);
      })
      .catch(() => setError('Could not load this request.'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(load, [load]);

  const respond = async (action: 'accept' | 'decline') => {
    setResponding(action);
    try {
      const res = await fetch('/api/client-requests/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not answer the request.');

      if (action === 'accept') {
        toast.success(`Request ${data.bookingNumber} sent to ${request?.firmName}.`);
        router.push(`/${locale}/dashboard/client/consultations`);
      } else {
        toast.success('Request declined.');
        setRequest((r) => (r ? { ...r, status: 'DECLINED', details: null } : r));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setResponding(null);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#fcfbf9] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        <Card className="rounded-none shadow-sm">
          <CardContent className="p-6 sm:p-8 space-y-5">{children}</CardContent>
        </Card>
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </>
    );
  }

  if (error || !request) {
    return shell(
      <div className="text-center space-y-4">
        <XCircle className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <h1 className="text-xl font-semibold">This request cannot be opened</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link href={`/${locale}`} className="text-sm underline">Go to the home page</Link>
      </div>
    );
  }

  const header = (
    <div className="text-center space-y-2">
      <div className="flex h-12 w-12 items-center justify-center bg-[#0a0a0a] text-white mx-auto">
        <Building2 className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-normal tracking-tight">{request.firmName}</h1>
      {request.district && <p className="text-sm text-muted-foreground">{request.district}</p>}
    </div>
  );

  if (request.status !== 'PENDING') {
    return shell(
      <div className="text-center space-y-4">
        <Info className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <h1 className="text-xl font-semibold">
          {request.status === 'ACCEPTED'
            ? 'You have already accepted this request'
            : request.status === 'EXPIRED'
              ? 'This request has expired'
              : 'This request is no longer open'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {request.status === 'ACCEPTED'
            ? 'You can follow it under My consultations.'
            : `Ask ${request.firmName} to send it again if you still want them to act for you.`}
        </p>
        <Link
          href={request.status === 'ACCEPTED' ? `/${locale}/dashboard/client/consultations` : `/${locale}`}
          className="text-sm underline"
        >
          {request.status === 'ACCEPTED' ? 'My consultations' : 'Go to the home page'}
        </Link>
      </div>
    );
  }

  if (!request.signedIn) {
    return shell(
      <>
        {header}
        <p className="text-sm leading-relaxed text-center">
          {request.firmName} has opened a request for you. Sign in with <strong>{request.email}</strong> — or
          create an account with that address — to see it and accept or decline.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={withRedirect(`/${locale}/register`, here)}
            className={buttonVariants({ variant: 'outline', className: 'flex-1 rounded-none' })}
          >
            Create an account
          </Link>
          <Link
            href={withRedirect(`/${locale}/login`, here)}
            className={buttonVariants({ className: 'flex-1 rounded-none' })}
          >
            Sign in
          </Link>
        </div>
      </>
    );
  }

  if (!request.isAddressee) {
    return shell(
      <>
        {header}
        <p className="text-sm leading-relaxed text-center">
          This request was sent to <strong>{request.email}</strong>. You are signed in with a different
          address. Sign out and sign in with that one to see it.
        </p>
      </>
    );
  }

  const d = request.details;
  return shell(
    <>
      {header}
      <p className="text-sm leading-relaxed text-center">
        {request.firmName} says you asked them to act for you, and has written up your request. Check it
        before you accept.
      </p>

      <dl className="border p-4 bg-neutral-50 text-sm space-y-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</dt>
          <dd className="mt-1 wrap-break-word">{d?.subject ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</dt>
          <dd className="mt-1 whitespace-pre-line wrap-break-word">{d?.description ?? '—'}</dd>
        </div>
        {d?.practiceArea && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Area of law</dt>
            <dd className="mt-1">{d.practiceArea}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meeting</dt>
          <dd className="mt-1">{d?.mode === 'PHYSICAL' ? 'In person' : 'Online'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attorney</dt>
          <dd className="mt-1">{d?.attorneyName ?? 'The practice will assign one'}</dd>
        </div>
      </dl>

      <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1.5 leading-relaxed">
        <li>Accepting sends this request to {request.firmName}. They will check for conflicts and, if they can act, send you their terms and fee.</li>
        <li>You are not committed to anything until you accept their terms.</li>
        <li>{request.firmName} provides the legal service. TheLawyr is only the software they use.</li>
      </ul>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1 rounded-none"
          onClick={() => respond('decline')}
          disabled={responding !== null}
        >
          {responding === 'decline' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Decline'}
        </Button>
        <Button className="flex-1 rounded-none" onClick={() => respond('accept')} disabled={responding !== null}>
          {responding === 'accept' ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
          ) : (
            <><ShieldCheck className="h-4 w-4 mr-2" /> Accept and send</>
          )}
        </Button>
      </div>
    </>
  );
}
