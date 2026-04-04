'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormValues } from '@/schemas/auth.schema';
import { useState } from 'react';
import { toast } from 'sonner';import Link from 'next/link';
import { Scale, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
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
                className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3.5 rounded-none outline-none focus:border-[#0a0a0a] focus:bg-white transition-all"
              />
              {errors.fullName && <p className="text-sm text-red-500 mt-1">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-neutral-900 uppercase tracking-wide">Email</label>
              <input
                type="email"
                placeholder="hello@example.com"
                {...register('email')}
                className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3.5 rounded-none outline-none focus:border-[#0a0a0a] focus:bg-white transition-all"
              />
              {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-neutral-900 uppercase tracking-wide">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3.5 rounded-none outline-none focus:border-[#0a0a0a] focus:bg-white transition-all"
              />
              {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-[#0a0a0a] text-white py-4 rounded-none font-medium hover:bg-neutral-800 transition-colors mt-6 disabled:opacity-70">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
          
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
