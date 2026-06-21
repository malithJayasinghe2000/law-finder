'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormValues } from '@/schemas/auth.schema';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Scale, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { FieldError } from '@/components/ui/FieldError';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ModalState {
  isOpen: boolean;
  type: 'success' | 'error' | null;
  title: string;
  message: string;
  details?: string;
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: null,
    title: '',
    message: '',
  });
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

  const showModal = (type: 'success' | 'error', title: string, message: string, details?: string) => {
    setModal({ isOpen: true, type, title, message, details });
  };

  const closeModal = () => {
    setModal({ isOpen: false, type: null, title: '', message: '' });
  };

  const handleModalClose = () => {
    closeModal();
    if (modal.type === 'success') {
      window.location.href = '/en/login';
    }
  };

  const onSubmit = async (data: RegisterFormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      const result = await res.json();

      if (!res.ok) {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'Registration failed';
        throw new Error(errorMessage);
      }

      showModal(
        'success',
        'Account Created Successfully! ✓',
        'Please check your email to verify your account before logging in.'
      );
    } catch (err: any) {
      showModal(
        'error',
        'Registration Failed',
        err.message || 'An error occurred during registration',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 bg-background pt-16 pb-16">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
            <div className="flex items-center justify-center text-[#bfa37a] transition-transform group-hover:scale-105">
              <Scale className="h-7 w-7 stroke-[1.8]" />
            </div>
            <span className="text-xl font-serif tracking-[0.15em] font-medium uppercase text-neutral-900">
              LAWFINDER
            </span>
          </Link>
        </div>

        <div className="bg-[#faf8f6]/50 p-10 rounded-none border border-[#efeae0]">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-serif font-bold tracking-tight text-neutral-900 mb-2">Create Account</h1>
            <p className="text-xs uppercase font-bold tracking-widest text-neutral-400">Join the digital legal network</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                {...register('fullName')}
                className="w-full bg-transparent border-b border-neutral-200 text-[#0a0a0a] px-0 py-2.5 rounded-none outline-none focus:border-[#bfa37a] transition-all font-light placeholder:text-neutral-350"
              />
              <FieldError message={errors.fullName?.message} />
            </div>

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
            </div>

            <div className="space-y-2 text-left">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                className="w-full bg-transparent border-b border-neutral-200 text-[#0a0a0a] px-0 py-2.5 rounded-none outline-none focus:border-[#bfa37a] transition-all font-light placeholder:text-neutral-350"
              />
              <FieldError message={errors.confirmPassword?.message} />
            </div>

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-[#bfa37a] text-white py-4.5 rounded-none font-bold uppercase tracking-widest text-xs hover:bg-[#a68d67] transition-colors mt-8 disabled:opacity-70">
              {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : null}
              {loading ? 'Creating...' : 'Create Account'}
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
              Sign up with Google
            </a>
          </div>

          <p className="text-center text-sm text-neutral-500 mt-6 font-light">
            Already have an account?{' '}
            <Link href={`/${locale}/login`} className="font-bold text-[#bfa37a] hover:text-[#a68d67] hover:underline transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={modal.isOpen && modal.type === 'success'} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-50 p-3 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl font-bold text-green-700">
              {modal.title}
            </DialogTitle>
            <DialogDescription className="text-center text-base text-neutral-600 mt-2">
              {modal.message}
            </DialogDescription>
          </DialogHeader>
          {modal.details && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-neutral-700">
              {modal.details}
            </div>
          )}
          <DialogFooter className="flex justify-center mt-6">
            <Button
              onClick={handleModalClose}
              className="bg-green-600 hover:bg-green-700 text-white px-8"
            >
              Go to Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Modal */}
      <Dialog open={modal.isOpen && modal.type === 'error'} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-red-50 p-3 rounded-full">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl font-bold text-red-700">
              {modal.title}
            </DialogTitle>
            <DialogDescription className="text-center text-base text-neutral-600 mt-2">
              {modal.message}
            </DialogDescription>
          </DialogHeader>
          {modal.details && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-neutral-700">
              {modal.details}
            </div>
          )}
          <DialogFooter className="flex justify-center mt-6">
            <Button
              onClick={closeModal}
              className="bg-red-600 hover:bg-red-700 text-white px-8"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
