'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormValues } from '@/schemas/auth.schema';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Scale, Loader2, CheckCircle2 } from 'lucide-react';
import { FieldError } from '@/components/ui/FieldError';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const { locale } = useParams();

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
        method: 'POST', 
        body: JSON.stringify(data)
      });
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error?.message || result.error || 'Registration failed');
      
      toast.success('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        window.location.href = `/${locale}/login`;
      }, 1500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-gradient-to-br from-white via-white to-[#fafafa] py-10">
      <div className="w-full max-w-[520px]">
        
        {/* Logo */}
        <div className="mb-12 flex flex-col items-center gap-4">
          <Link href={`/${locale}`} className="flex items-center gap-3 group">
            <Scale className="h-8 w-8 text-[#ffb84f]" />
            <span className="text-xl font-bold tracking-[0.1em] uppercase text-[#ffb84f]">
              Lawyer.ai
            </span>
          </Link>
          <h2 className="text-3xl font-medium text-[#0a0d14] text-center">Create Your Account</h2>
          <p className="text-center text-neutral-500 font-light">Join our legal network and connect with experts</p>
        </div>

        {/* Form Card */}
        <div className="bg-white p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-100">
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            
            {/* Full Name Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#0a0d14] mb-2">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                {...register('fullName')}
                className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0d14] px-4 py-3.5 rounded-xl outline-none focus:border-[#ffb84f] focus:bg-white focus:ring-2 focus:ring-[#ffb84f]/20 transition-all font-light"
              />
              <FieldError message={errors.fullName?.message} />
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#0a0d14] mb-2">Email Address</label>
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
              <label className="block text-sm font-semibold text-[#0a0d14] mb-2">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0d14] px-4 py-3.5 rounded-xl outline-none focus:border-[#ffb84f] focus:bg-white focus:ring-2 focus:ring-[#ffb84f]/20 transition-all font-light"
              />
              <FieldError message={errors.password?.message} />
              <p className="text-xs text-neutral-500 font-light mt-2">
                At least 8 characters with uppercase, lowercase, and numbers
              </p>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#0a0d14] mb-2">Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0d14] px-4 py-3.5 rounded-xl outline-none focus:border-[#ffb84f] focus:bg-white focus:ring-2 focus:ring-[#ffb84f]/20 transition-all font-light"
              />
              <FieldError message={errors.confirmPassword?.message} />
            </div>

            {/* Terms Agreement */}
            <div className="flex items-start gap-3 py-4 px-3 bg-neutral-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-[#ffb84f] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-neutral-600 font-light">
                By creating an account, you agree to our{' '}
                <Link href={`/${locale}`} className="font-medium text-[#0a0d14] hover:text-[#ffb84f]">
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link href={`/${locale}`} className="font-medium text-[#0a0d14] hover:text-[#ffb84f]">
                  Privacy Policy
                </Link>
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#ffb84f] text-black py-3.5 rounded-full font-bold hover:bg-[#e5a443] transition-all disabled:opacity-70 text-sm tracking-wide uppercase mt-6"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Sign In Link */}
          <p className="text-center text-sm text-neutral-600 mt-8 font-light">
            Already have an account?{' '}
            <Link href={`/${locale}/login`} className="font-bold text-[#ffb84f] hover:text-[#e5a443] transition-colors">
              Sign In Here
            </Link>
          </p>
        </div>

        {/* Features */}
        <div className="mt-10 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="h-10 w-10 rounded-full bg-[#ffb84f]/10 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="h-5 w-5 text-[#ffb84f]" />
            </div>
            <p className="text-xs font-medium text-neutral-700">Instant Signup</p>
          </div>
          <div className="text-center">
            <div className="h-10 w-10 rounded-full bg-[#ffb84f]/10 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="h-5 w-5 text-[#ffb84f]" />
            </div>
            <p className="text-xs font-medium text-neutral-700">Secure & Safe</p>
          </div>
          <div className="text-center">
            <div className="h-10 w-10 rounded-full bg-[#ffb84f]/10 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="h-5 w-5 text-[#ffb84f]" />
            </div>
            <p className="text-xs font-medium text-neutral-700">Free to Start</p>
          </div>
        </div>
      </div>
    </div>
  );
}
