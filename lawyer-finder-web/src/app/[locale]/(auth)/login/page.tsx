'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormValues } from '@/schemas/auth.schema';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Scale, LogIn, Loader2 } from 'lucide-react';
import { FieldError } from '@/components/ui/FieldError';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { locale } = useParams();
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          window.location.href = data.role === 'CLIENT' ? `/${locale}` : `/${locale}/dashboard/${data.role.toLowerCase()}`;
        }
      });
  }, [locale]);

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

      if (!res.ok) throw new Error(result.error || 'Login failed');

      toast.success('Signed in successfully.');
      window.location.href =
        result.role === 'CLIENT'
          ? `/${locale}`
          : `/${locale}/dashboard/${result.role.toLowerCase()}`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-gradient-to-br from-white via-white to-[#fafafa]">
      <div className="w-full max-w-[480px]">
        
        {/* Logo */}
        <div className="mb-12 flex flex-col items-center gap-4">
          <Link href={`/${locale}`} className="flex items-center gap-3 group">
            <Scale className="h-8 w-8 text-[#ffb84f]" />
            <span className="text-xl font-bold tracking-[0.1em] uppercase text-[#ffb84f]">
              Lawyer.ai
            </span>
          </Link>
          <h2 className="text-3xl font-medium text-[#0a0d14] text-center">Welcome Back</h2>
          <p className="text-center text-neutral-500 font-light">Sign in to access your legal workspace</p>
        </div>

        {/* Form Card */}
        <div className="bg-white p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-100">
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#0a0d14] mb-3">Email Address</label>
              <input
                type="email"
                placeholder="hello@example.com"
                {...register('email')}
                className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0d14] px-4 py-3.5 rounded-xl outline-none focus:border-[#ffb84f] focus:bg-white focus:ring-2 focus:ring-[#ffb84f]/20 transition-all font-light"
              />
              <FieldError message={errors.email?.message} />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-[#0a0d14]">Password</label>
                <Link href={`/${locale}/forgot-password`} className="text-xs font-medium text-[#ffb84f] hover:text-[#e5a443] transition-colors">
                  Forgot?
                </Link>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0d14] px-4 py-3.5 rounded-xl outline-none focus:border-[#ffb84f] focus:bg-white focus:ring-2 focus:ring-[#ffb84f]/20 transition-all font-light"
              />
              <FieldError message={errors.password?.message} />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#ffb84f] text-black py-3.5 rounded-full font-bold hover:bg-[#e5a443] transition-all mt-8 disabled:opacity-70 text-sm tracking-wide uppercase"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-8">
            <div className="flex-1 h-px bg-neutral-200" />
            <span className="text-xs text-neutral-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-neutral-200" />
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-neutral-600 font-light">
            Don't have an account?{' '}
            <Link href={`/${locale}/register`} className="font-bold text-[#ffb84f] hover:text-[#e5a443] transition-colors">
              Create Account
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-neutral-400 mt-8 font-light">
          By signing in, you agree to our{' '}
          <Link href={`/${locale}`} className="text-neutral-600 hover:text-[#0a0d14] transition-colors">
            Terms of Service
          </Link>
          {' '}and{' '}
          <Link href={`/${locale}`} className="text-neutral-600 hover:text-[#0a0d14] transition-colors">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

