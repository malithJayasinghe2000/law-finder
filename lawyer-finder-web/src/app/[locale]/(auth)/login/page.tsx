'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormValues } from '@/schemas/auth.schema';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Scale, LogIn, Loader2, ArrowLeft } from 'lucide-react';
import { FieldError } from '@/components/ui/FieldError';
import { currentRedirect, withRedirect } from '@/lib/safeRedirect';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { locale } = useParams();
  const router = useRouter();
  // Where to go after signing in — an invitation link, or a page that asked for
  // a session. Read once on mount; only paths on this site (see safeRedirect).
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    setRedirectTo(currentRedirect());
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          window.location.href = currentRedirect() ?? (data.role === 'CLIENT' ? `/${locale}` : `/${locale}/dashboard/${data.role.toLowerCase()}`);
        }
      });

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('verified') === 'true') {
        toast.success('Email verified successfully. You can now log in.');
      }
    }
  }, [locale]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Load cooldown from localStorage when modal opens
  useEffect(() => {
    if (unverifiedEmail && typeof window !== 'undefined') {
      const savedTime = localStorage.getItem(`resend_cooldown_${unverifiedEmail}`);
      if (savedTime) {
        const timePassed = Math.floor((Date.now() - parseInt(savedTime)) / 1000);
        if (timePassed < 60) {
          setResendCooldown(60 - timePassed);
        } else {
          localStorage.removeItem(`resend_cooldown_${unverifiedEmail}`);
        }
      }
    }
  }, [unverifiedEmail]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (!res.ok) {
        if (res.status === 403 && result.unverifiedEmail) {
          setUnverifiedEmail(result.unverifiedEmail);
          setShowVerificationModal(true);
          return;
        }
        throw new Error(result.error || 'Login failed');
      }

      toast.success('Signed in successfully.');
      window.location.href =
        redirectTo ??
        (result.role === 'CLIENT'
          ? `/${locale}`
          : `/${locale}/dashboard/${result.role.toLowerCase()}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail || resendCooldown > 0) return;
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail })
      });
      if (res.ok) {
        toast.success('Verification email resent. Please check your inbox.');
        setResendCooldown(60);
        localStorage.setItem(`resend_cooldown_${unverifiedEmail}`, Date.now().toString());
      } else {
        const result = await res.json();
        toast.error(result.error || 'Failed to resend verification email.');
      }
    } catch {
      toast.error('An error occurred while resending.');
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 bg-background pt-16 pb-16">
      <div className="w-full max-w-[420px]">
  

        <div className="bg-[#faf8f6]/50 p-10 rounded-none border border-[#efeae0]">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-serif font-normal tracking-tight text-neutral-900 mb-2">Welcome Back</h1>
            <p className="text-xs uppercase font-bold tracking-widest text-neutral-400">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">Email</label>
              <input
                type="email"
                placeholder="hello@example.com"
                {...register('email')}
                className="w-full bg-transparent border-b border-neutral-200 text-[#0a0a0a] px-0 py-2.5 rounded-none outline-none focus:border-[#bfa37a] transition-all font-light placeholder:text-neutral-350"
              />
              <FieldError message={errors.email?.message} />
            </div>

            <div className="space-y-2 text-left">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="w-full bg-transparent border-b border-neutral-200 text-[#0a0a0a] px-0 py-2.5 rounded-none outline-none focus:border-[#bfa37a] transition-all font-light placeholder:text-neutral-350"
              />
              <FieldError message={errors.password?.message} />
              <div className="text-right">
                <Link href={`/${locale}/forgot-password`} className="text-[11px] font-bold text-[#bfa37a] hover:text-[#a68d67] hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-[#bfa37a] text-white py-4.5 rounded-none font-bold uppercase tracking-widest text-xs hover:bg-[#a68d67] transition-colors mt-8 disabled:opacity-70">
              {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <LogIn className="h-4.5 w-4.5" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#efeae0]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#faf8f6] px-3 text-neutral-400 font-bold tracking-widest text-[9px]">Or continue with</span>
              </div>
            </div>

            <a href="/api/auth/google/login" className="mt-6 w-full flex items-center justify-center gap-2.5 bg-transparent text-[#0a0a0a] border border-[#efeae0] hover:border-[#bfa37a] hover:bg-[#faf8f6] py-4 rounded-none font-bold uppercase tracking-widest text-xs transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 0 24 24" width="18"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /><path d="M1 1h22v22H1z" fill="none" /></svg>
              Sign in with Google
            </a>
          </div>

          <p className="text-center text-sm text-neutral-500 mt-8 font-light">
            Don&apos;t have an account?{' '}
            <Link href={withRedirect(`/${locale}/register`, redirectTo)} className="font-bold text-[#bfa37a] hover:text-[#a68d67] hover:underline transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {showVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-8 max-w-md w-full shadow-xl border border-neutral-200 rounded-none transform transition-all">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="h-12 w-12 bg-neutral-100 flex items-center justify-center mb-4 text-[#0a0a0a]">
                <Scale className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-[#0a0a0a] tracking-tight">Verify Your Email</h3>
              <p className="text-[15px] text-neutral-500 mt-2 font-light">
                Your email address <span className="font-medium text-[#0a0a0a]">{unverifiedEmail}</span> has not been verified yet.
              </p>
              <p className="text-[14px] text-neutral-500 mt-1 font-light">
                Please check your inbox for the verification link.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendCooldown > 0}
                className="w-full flex items-center justify-center py-3.5 bg-[#0a0a0a] text-white font-medium hover:bg-neutral-800 disabled:opacity-70 disabled:hover:bg-[#0a0a0a] transition-colors rounded-none"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
              </button>
              <button
                type="button"
                onClick={() => setShowVerificationModal(false)}
                className="w-full py-3.5 bg-white text-[#0a0a0a] border border-neutral-200 font-medium hover:bg-neutral-50 transition-colors rounded-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
