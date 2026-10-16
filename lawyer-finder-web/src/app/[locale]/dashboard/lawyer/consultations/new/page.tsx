'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Send, UserPlus } from 'lucide-react';
import { PRACTICE_AREAS } from '@/schemas/profile.schema';
import { CreateClientIntakeSchema } from '@/schemas/clientIntake.schema';

/**
 * A practice opening a request for a client who came to it directly.
 *
 * The client is emailed and must sign in and accept before the request exists.
 * Principal or practice manager only. See src/lib/firms/clientIntake.ts.
 */

type Attorney = { id: string; fullName: string };
type Invitation = {
  id: string;
  email: string;
  practiceArea: string | null;
  attorneyName: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
};

const EMPTY = {
  email: '',
  subject: '',
  description: '',
  practiceArea: '',
  mode: 'PHYSICAL' as 'PHYSICAL' | 'ONLINE',
  attorneyId: '',
  clientAskedUs: false,
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Waiting for client',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  REVOKED: 'Withdrawn',
  EXPIRED: 'Expired',
};

export default function NewClientRequestPage() {
  const { locale } = useParams<{ locale: string }>();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/firms/me/client-requests');
    const data = await res.json();
    if (!res.ok) {
      setForbidden(data.error || 'You cannot open requests for this practice.');
    } else {
      setAttorneys(data.attorneys);
      setInvitations(data.invitations);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const parsed = CreateClientIntakeSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await fetch('/api/firms/me/client-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not open the request.');
      toast.success(`Sent to ${parsed.data.email} to confirm.`);
      setForm(EMPTY);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: string) => {
    const res = await fetch('/api/firms/me/client-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId: id }),
    });
    if (res.ok) {
      toast.success('Request withdrawn.');
      load();
    } else {
      toast.error('Could not withdraw it.');
    }
  };

  const field = (name: string) =>
    errors[name] ? <p className="text-xs text-destructive mt-1">{errors[name]}</p> : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href={`/${locale}/dashboard/lawyer/consultations`}
        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" /> Consultation bookings
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#0a0a0a] text-white">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-neutral-900">New request</h1>
          <p className="text-sm text-neutral-500 font-medium">For a client who contacted your practice directly</p>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-96 rounded-none" />
      ) : forbidden ? (
        <Card className="rounded-none"><CardContent className="p-6 text-sm">{forbidden}</CardContent></Card>
      ) : (
        <>
          <Card className="rounded-none shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                The client gets an email asking them to sign in and confirm. Nothing reaches their account,
                and nothing appears in your queue, until they accept. It then starts at conflict check like
                any other request.
              </p>

              <div>
                <Label htmlFor="email">Client&apos;s email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="rounded-none"
                />
                {field('email')}
              </div>

              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="rounded-none"
                />
                {field('subject')}
              </div>

              <div>
                <Label htmlFor="description">What the client told you</Label>
                <Textarea
                  id="description"
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="rounded-none"
                />
                <p className="text-xs text-muted-foreground mt-1">The client sees this before accepting. It is encrypted.</p>
                {field('description')}
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="practiceArea">Area of law</Label>
                  <select
                    id="practiceArea"
                    value={form.practiceArea}
                    onChange={(e) => setForm({ ...form, practiceArea: e.target.value })}
                    className="w-full h-9 border px-3 text-sm rounded-none bg-background"
                  >
                    <option value="">Not specified</option>
                    {PRACTICE_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="mode">Meeting</Label>
                  <select
                    id="mode"
                    value={form.mode}
                    onChange={(e) => setForm({ ...form, mode: e.target.value as 'PHYSICAL' | 'ONLINE' })}
                    className="w-full h-9 border px-3 text-sm rounded-none bg-background"
                  >
                    <option value="PHYSICAL">In person</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="attorneyId">Attorney</Label>
                  <select
                    id="attorneyId"
                    value={form.attorneyId}
                    onChange={(e) => setForm({ ...form, attorneyId: e.target.value })}
                    className="w-full h-9 border px-3 text-sm rounded-none bg-background"
                  >
                    <option value="">Assign later</option>
                    {attorneys.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
                  </select>
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.clientAskedUs}
                  onChange={(e) => setForm({ ...form, clientAskedUs: e.target.checked })}
                  className="mt-1"
                />
                <span>This client asked our practice to act for them.</span>
              </label>
              {field('clientAskedUs')}

              <Button onClick={submit} disabled={saving} className="rounded-none w-full sm:w-auto">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send to client to confirm
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-900">Sent requests</h2>
            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              invitations.map((i) => (
                <Card key={i.id} className="rounded-none shadow-sm">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold truncate">{i.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {[i.practiceArea, i.attorneyName ?? 'Unassigned', `sent ${new Date(i.createdAt).toLocaleDateString()}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="rounded-sm text-[10px] uppercase tracking-wider">
                        {STATUS_LABEL[i.status] ?? i.status}
                      </Badge>
                      {i.status === 'PENDING' && (
                        <Button variant="outline" size="sm" className="rounded-none" onClick={() => revoke(i.id)}>
                          Withdraw
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
