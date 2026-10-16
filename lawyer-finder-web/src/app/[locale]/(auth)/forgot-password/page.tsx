'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';
import { forgotPasswordSchema, ForgotPasswordValues } from '@/schemas/auth.schema';
import { FieldError } from '@/components/ui/FieldError';

/** Ask for a link to choose a new password. See src/lib/passwordReset.ts. */
export default function ForgotPasswordPage() {
  const { locale } = useParams();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Something went wrong.');
      setSent(result.message);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 bg-background pt-16 pb-16">
      <div className="w-full max-w-[420px]">
        <div className="bg-[#faf8f6]/50 p-6 sm:p-10 rounded-none border border-[#efeae0]">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-serif font-normal tracking-tight text-neutral-900 mb-2">Forgot password</h1>
            <p className="text-xs uppercase font-bold tracking-widest text-neutral-400">We will email you a link</p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <Mail className="h-8 w-8 mx-auto text-[#bfa37a]" />
              <p className="text-sm text-neutral-600 font-light">{sent}</p>
              <p className="text-xs text-neutral-400">The link works once and expires in one hour. Check your spam folder if it does not arrive.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2 text-left">
                <label htmlFor="forgot-email" className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  placeholder="hello@example.com"
                  {...register('email')}
                  className="w-full bg-transparent border-b border-neutral-200 text-[#0a0a0a] px-0 py-2.5 rounded-none outline-none focus:border-[#bfa37a] transition-all font-light placeholder:text-neutral-350"
                />
                <FieldError message={errors.email?.message} />
              </div>

              <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-[#bfa37a] text-white py-4.5 rounded-none font-bold uppercase tracking-widest text-xs hover:bg-[#a68d67] transition-colors mt-8 disabled:opacity-70">
                {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Mail className="h-4.5 w-4.5" />}
                {loading ? 'Sending...' : 'Send me a link'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-neutral-500 mt-8 font-light">
            <Link href={`/${locale}/login`} className="font-bold text-[#bfa37a] hover:text-[#a68d67] hover:underline transition-colors">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
