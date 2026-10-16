'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';
import { resetPasswordSchema, ResetPasswordValues } from '@/schemas/auth.schema';
import { FieldError } from '@/components/ui/FieldError';

/** Choose a new password from an emailed link. See src/lib/passwordReset.ts. */
export default function ResetPasswordPage() {
  const { locale } = useParams();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [linkProblem, setLinkProblem] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: '' },
  });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    if (!/^[a-f0-9]{64}$/.test(token)) setLinkProblem('This reset link is not valid. Ask for a new one.');
    setValue('token', token);
  }, [setValue]);

  const onSubmit = async (data: ResetPasswordValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.status === 410) { setLinkProblem(result.error); return; }
      if (!res.ok) throw new Error(result.error || 'Something went wrong.');
      setDone(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full bg-transparent border-b border-neutral-200 text-[#0a0a0a] px-0 py-2.5 rounded-none outline-none focus:border-[#bfa37a] transition-all font-light placeholder:text-neutral-350';

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 bg-background pt-16 pb-16">
      <div className="w-full max-w-[420px]">
        <div className="bg-[#faf8f6]/50 p-6 sm:p-10 rounded-none border border-[#efeae0]">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-serif font-normal tracking-tight text-neutral-900 mb-2">New password</h1>
            <p className="text-xs uppercase font-bold tracking-widest text-neutral-400">Choose a new password</p>
          </div>

          {done ? (
            <div className="text-center space-y-6">
              <p className="text-sm text-neutral-600 font-light">Your password has been changed.</p>
              <Link href={`/${locale}/login`} className="w-full inline-flex items-center justify-center bg-[#bfa37a] text-white py-4 font-bold uppercase tracking-widest text-xs hover:bg-[#a68d67] transition-colors">
                Sign in
              </Link>
            </div>
          ) : linkProblem ? (
            <div className="text-center space-y-6">
              <p className="text-sm text-neutral-600 font-light">{linkProblem}</p>
              <Link href={`/${locale}/forgot-password`} className="w-full inline-flex items-center justify-center bg-[#bfa37a] text-white py-4 font-bold uppercase tracking-widest text-xs hover:bg-[#a68d67] transition-colors">
                Ask for a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <input type="hidden" {...register('token')} />
              <div className="space-y-2 text-left">
                <label htmlFor="reset-password" className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">New password</label>
                <input id="reset-password" type="password" autoComplete="new-password" placeholder="••••••••" {...register('password')} className={inputClass} />
                <FieldError message={errors.password?.message} />
                <p className="text-[11px] text-neutral-400">At least 8 characters, with an upper- and lower-case letter, a number and one of @$!%*?&amp;.</p>
              </div>
              <div className="space-y-2 text-left">
                <label htmlFor="reset-confirm" className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">Confirm password</label>
                <input id="reset-confirm" type="password" autoComplete="new-password" placeholder="••••••••" {...register('confirmPassword')} className={inputClass} />
                <FieldError message={errors.confirmPassword?.message} />
              </div>

              <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-[#bfa37a] text-white py-4.5 rounded-none font-bold uppercase tracking-widest text-xs hover:bg-[#a68d67] transition-colors mt-8 disabled:opacity-70">
                {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <KeyRound className="h-4.5 w-4.5" />}
                {loading ? 'Saving...' : 'Save new password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
