'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormValues } from '@/schemas/auth.schema';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Scale, Loader2 } from 'lucide-react';
import { FieldError } from '@/components/ui/FieldError';

export default function RegisterPage() {
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
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema)
  });


  const onSubmit = async (data: RegisterFormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', body: JSON.stringify(data)
      });
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error?.message || result.error || 'Registration failed');
      
      toast.success('Account created successfully! Please log in.');
      window.location.href = '/en/login';
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 bg-background py-10">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <Link href={`/en`} className="flex items-center gap-2 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-none bg-[#0a0a0a] text-white shadow-md transition-transform group-hover:scale-105">
              <Scale className="h-6 w-6" />
            </div>
            <span className="text-2xl font-semibold tracking-tight text-[#0a0a0a]">
              LawFinder<span className="font-light opacity-60 ml-0.5">SL</span>
            </span>
          </Link>
        </div>

        <div className="bg-white p-10 rounded-none shadow-md border border-neutral-200">
          <div className="mb-8 text-center">
            <h1 className="text-[26px] font-semibold tracking-tight text-[#0a0a0a] mb-2">Create Account</h1>
            <p className="text-[15px] font-light text-neutral-500">Join the digital legal network.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-neutral-900 uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                {...register('fullName')}
                className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3.5 rounded-none outline-none focus:border-[#0a0a0a] focus:bg-white transition-all shadow-sm"
              />
              <FieldError message={errors.fullName?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-neutral-900 uppercase tracking-wide">Email</label>
              <input
                type="email"
                placeholder="hello@example.com"
                {...register('email')}
                className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3.5 rounded-none outline-none focus:border-[#0a0a0a] focus:bg-white transition-all shadow-sm"
              />
              <FieldError message={errors.email?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-neutral-900 uppercase tracking-wide">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3.5 rounded-none outline-none focus:border-[#0a0a0a] focus:bg-white transition-all shadow-sm"
              />
              <FieldError message={errors.password?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-neutral-900 uppercase tracking-wide">Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3.5 rounded-none outline-none focus:border-[#0a0a0a] focus:bg-white transition-all shadow-sm"
              />
              <FieldError message={errors.confirmPassword?.message} />
            </div>

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-[#0a0a0a] text-white py-4 rounded-none font-medium hover:bg-neutral-800 transition-colors mt-6 disabled:opacity-70">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-neutral-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-neutral-500 font-medium">Or continue with</span>
              </div>
            </div>
            
            <a href="/api/auth/google/login" className="mt-6 w-full flex items-center justify-center gap-2 bg-white text-[#0a0a0a] border border-neutral-200 py-4 rounded-none font-medium hover:bg-neutral-50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
              Sign up with Google
            </a>
          </div>

          <p className="text-center text-[15px] text-neutral-600 mt-6 font-light">
            Already have an account?{' '}
            <Link href={`/en/login`} className="font-medium text-[#0a0a0a] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
