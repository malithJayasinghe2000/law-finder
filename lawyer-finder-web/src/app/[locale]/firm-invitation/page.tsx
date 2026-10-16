'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Building2, Loader2, ShieldCheck, XCircle, Info } from 'lucide-react';

/**
 * Responding to an invitation to join a law firm.
 *
 * Deliberately explains what accepting means before offering the button.
 * Joining a practice puts a person inside a privilege boundary — they will be
 * able to see that the firm's matters exist — and a screen that presents that as
 * a routine "join team" click is a screen that got someone's consent without
 * their understanding.
 */

const ROLE_LABEL: Record<string, string> = {
  FIRM_OWNER: 'a principal (partner) of the practice',
  FIRM_ADMIN: 'a practice manager',
  ATTORNEY: 'an attorney practising in the firm',
  PARALEGAL: 'a paralegal',
};

type Invitation = {
  firmName: string;
  district: string | null;
  email: string;
  role: string;
  title: string | null;
  status: string;
  expiresAt: string;
};

export default function FirmInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('That invitation link is not valid.');
      setLoading(false);
      return;
    }

    fetch(`/api/firms/invitations/respond?token=${encodeURIComponent(token)}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) setError(d.error || 'That invitation link is not valid.');
        else setInvitation(d.invitation);
      })
      .catch(() => setError('Could not load this invitation.'))
      .finally(() => setLoading(false));
  }, [token]);

  const respond = async (action: 'accept' | 'decline') => {
    setResponding(action);
    try {
      const res = await fetch('/api/firms/invitations/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      });
      const data = await res.json();

      if (res.status === 401) {
        toast.error('Sign in with the address this invitation was sent to.');
        router.push(`/login?redirect=${encodeURIComponent(`/firm-invitation?token=${token}`)}`);
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Could not respond to the invitation.');

      if (action === 'accept') {
        toast.success(`You have joined ${data.firmName}.`);
        router.push('/dashboard/lawyer/firm');
      } else {
        toast.success('Invitation declined.');
        setInvitation((i) => (i ? { ...i, status: 'DECLINED' } : i));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setResponding(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfbf9] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {loading ? (
          <Card className="rounded-none shadow-sm">
            <CardContent className="p-8 space-y-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="rounded-none shadow-sm">
            <CardContent className="p-8 text-center space-y-4">
              <XCircle className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <h1 className="text-xl font-semibold">This invitation cannot be opened</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Link href="/" className="text-sm underline">Go to the home page</Link>
            </CardContent>
          </Card>
        ) : invitation && invitation.status !== 'PENDING' ? (
          <Card className="rounded-none shadow-sm">
            <CardContent className="p-8 text-center space-y-4">
              <Info className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <h1 className="text-xl font-semibold">
                {invitation.status === 'ACCEPTED'
                  ? 'You have already joined this practice'
                  : invitation.status === 'EXPIRED'
                    ? 'This invitation has expired'
                    : 'This invitation is no longer open'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {invitation.status === 'EXPIRED'
                  ? `Invitations stand for a limited time so that an unanswered one does not leave an open door into a firm's matters. Ask ${invitation.firmName} to send a new one.`
                  : `Ask ${invitation.firmName} if you think this is wrong.`}
              </p>
              <Link href="/" className="text-sm underline">Go to the home page</Link>
            </CardContent>
          </Card>
        ) : invitation ? (
          <Card className="rounded-none shadow-sm">
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="flex h-12 w-12 items-center justify-center bg-[#0a0a0a] text-white mx-auto">
                  <Building2 className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-normal tracking-tight">{invitation.firmName}</h1>
                {invitation.district && (
                  <p className="text-sm text-muted-foreground">{invitation.district}</p>
                )}
              </div>

              <p className="text-sm leading-relaxed text-center">
                You have been invited to join this practice as{' '}
                <strong>{ROLE_LABEL[invitation.role] ?? 'a member of the firm'}</strong>
                {invitation.title ? `, with the title ${invitation.title}` : ''}.
              </p>

              <div className="border p-4 bg-neutral-50 text-sm space-y-3 leading-relaxed">
                <p className="font-semibold">What accepting means</p>
                <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                  <li>
                    You will be able to see that the firm&apos;s matters exist.{' '}
                    <strong>What you can read about any one of them depends on your role</strong>{' '}
                    - a client&apos;s own account of their legal problem is not visible to
                    everyone in a practice.
                  </li>
                  <li>
                    If you are an attorney, your profile will show you as practising in this firm,
                    and new matters can be assigned to you.
                  </li>
                  <li>
                    You take up a seat on the firm&apos;s software licence. Seats count people who
                    can sign in - never clients or matters.
                  </li>
                  <li>You can be removed, and you can leave.</li>
                </ul>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Sent to {invitation.email}. You must be signed in with that address to accept.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-none"
                  onClick={() => respond('decline')}
                  disabled={responding !== null}
                >
                  {responding === 'decline' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Decline'
                  )}
                </Button>
                <Button
                  className="flex-1 rounded-none"
                  onClick={() => respond('accept')}
                  disabled={responding !== null}
                >
                  {responding === 'accept' ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Joining…</>
                  ) : (
                    <><ShieldCheck className="h-4 w-4 mr-2" /> Join {invitation.firmName}</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
