'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormValues } from '@/schemas/auth.schema';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Check, Circle } from 'lucide-react';
import { FieldError } from '@/components/ui/FieldError';
import { currentRedirect, withRedirect } from '@/lib/safeRedirect';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

/** The same rules as `newPassword` in src/schemas/auth.schema.ts, shown as a checklist. */
const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'An uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'A number (0-9)', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One of @ $ ! % * ? &', test: (p: string) => /[@$!%*?&]/.test(p) },
];

const INPUT_CLASS =
  'w-full bg-transparent border-b border-neutral-200 text-[#0a0a0a] px-0 py-2.5 rounded-none outline-none focus:border-[#bfa37a] transition-all font-light placeholder:text-neutral-400';
const LABEL_CLASS = 'text-[11px] font-bold text-neutral-500 uppercase tracking-widest block';

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
  // Carried through to sign-in, so an invitation link survives creating an account.
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  useEffect(() => setRedirectTo(currentRedirect()), []);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          window.location.href = currentRedirect() ?? (data.role === 'CLIENT' ? `/${locale}` : `/${locale}/dashboard/${data.role.toLowerCase()}`);
        }
      });
  }, [locale]);
  const { register, handleSubmit, watch, formState: { errors, isSubmitted } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema)
  });
  const password = watch('password') ?? '';
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const showModal = (type: 'success' | 'error', title: string, message: string, details?: string) => {
    setModal({ isOpen: true, type, title, message, details });
  };

  const closeModal = () => {
    setModal({ isOpen: false, type: null, title: '', message: '' });
  };

  const handleModalClose = () => {
    closeModal();
    if (modal.type === 'success') {
      window.location.href = withRedirect(`/${locale}/login`, redirectTo);
    }
  };

  const onSubmit = async (data: RegisterFormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        // Where they were going and their language go into the email link, so
        // after verifying they come back here (src/lib/emailVerification.ts).
        body: JSON.stringify({ ...data, redirect: redirectTo, locale })
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
        'Check your email',
        `We have sent a link to ${data.email}. Open it to activate your account, then sign in. ` +
          'It can take a few minutes - check your spam folder if you cannot see it.'
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
        

        <div className="bg-[#faf8f6]/50 p-10 rounded-none border border-[#efeae0]">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-serif font-normal tracking-tight text-neutral-900 mb-2">Create Account</h1>
            <p className="text-xs uppercase font-bold tracking-widest text-neutral-400">Create a free account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Labels are tied to their inputs (screen readers, tap-to-focus), and each
                input says what it holds so phones and password managers can fill it. */}
            <div className="space-y-2 text-left">
              <label htmlFor="reg-name" className={LABEL_CLASS}>Full Name</label>
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                placeholder="e.g. Nimal Perera"
                {...register('fullName')}
                className={INPUT_CLASS}
              />
              <FieldError message={errors.fullName?.message} />
            </div>

            <div className="space-y-2 text-left">
              <label htmlFor="reg-email" className={LABEL_CLASS}>Email</label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="name@example.com"
                {...register('email')}
                className={INPUT_CLASS}
              />
              <FieldError message={errors.email?.message} />
            </div>

            <div className="space-y-2 text-left">
              <label htmlFor="reg-password" className={LABEL_CLASS}>Password</label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-describedby="reg-password-rules"
                  {...register('password')}
                  className={`${INPUT_CLASS} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-neutral-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Every rule at once, ticked as it is met. They used to arrive one per
                  failed attempt. Unmet rules turn red only after a submit. */}
              <ul id="reg-password-rules" className="space-y-1 pt-1">
                {PASSWORD_RULES.map((r) => {
                  const met = r.test(password);
                  return (
                    <li
                      key={r.label}
                      className={`flex items-center gap-2 text-[11px] ${
                        met ? 'text-emerald-700' : isSubmitted ? 'text-red-600' : 'text-neutral-500'
                      }`}
                    >
                      {met ? <Check className="h-3 w-3 shrink-0" /> : <Circle className="h-3 w-3 shrink-0" />}
                      {r.label}
                      <span className="sr-only">{met ? ' - done' : ' - not yet'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-2 text-left">
              <label htmlFor="reg-confirm" className={LABEL_CLASS}>Confirm Password</label>
              <div className="relative">
                <input
                  id="reg-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  className={`${INPUT_CLASS} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-neutral-700"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={errors.confirmPassword?.message} />
            </div>

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-[#bfa37a] text-white py-4.5 rounded-none font-bold uppercase tracking-widest text-xs hover:bg-[#a68d67] transition-colors mt-8 disabled:opacity-70">
              {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : null}
              {loading ? 'Creating...' : 'Create Account'}
            </button>

            {/*
              The PDPA expects the notice to be given at the point of
              collection, which is here.

              Note what this does NOT say. There is no "I consent to the
              processing of my data" checkbox, because your account data is
              processed to perform our contract with you — not on consent.
              Presenting it as consent would imply you could withdraw it while
              keeping the account, which is not true, and treating everything as
              consent is the common and expensive PDPA error. The three things
              that genuinely do rest on consent are optional, live on the "Your
              data" screen, and are never a precondition of signing up.
            */}
            <p className="mt-5 text-center text-xs font-light leading-relaxed text-neutral-500">
              We explain what we collect, why, and how long we keep it in the{' '}
              <Link
                href={`/${locale}/privacy`}
                className="font-bold text-[#bfa37a] underline-offset-2 hover:underline"
              >
                Privacy Notice
              </Link>
              . Creating an account does not sign you up to marketing.
            </p>
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

            <a href={`/api/auth/google/login?l=${locale}${redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : ''}`} className="mt-6 w-full flex items-center justify-center gap-2.5 bg-transparent text-[#0a0a0a] border border-[#efeae0] hover:border-[#bfa37a] hover:bg-[#faf8f6] py-4 rounded-none font-bold uppercase tracking-widest text-xs transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 0 24 24" width="18"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /><path d="M1 1h22v22H1z" fill="none" /></svg>
              Sign up with Google
            </a>
          </div>

          <p className="mt-6 border-t border-[#efeae0] pt-5 text-center text-xs font-light leading-relaxed text-neutral-500">
            <span className="font-semibold text-neutral-700">Attorney-at-Law?</span> Create an account
            here, then apply to be verified from your account menu.
          </p>

          <p className="text-center text-sm text-neutral-500 mt-4 font-light">
            Already have an account?{' '}
            <Link href={withRedirect(`/${locale}/login`, redirectTo)} className="font-bold text-[#bfa37a] hover:text-[#a68d67] hover:underline transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={modal.isOpen && modal.type === 'success'} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-md rounded-none border border-[#efeae0] p-8 bg-[#faf8f6] shadow-2xl">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-[#bfa37a]/10 p-3 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-[#bfa37a]" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl font-serif font-normal text-neutral-900">
              {modal.title}
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-neutral-500 mt-2 font-light">
              {modal.message}
            </DialogDescription>
          </DialogHeader>
          {modal.details && (
            <div className="bg-white border border-[#efeae0] rounded-none p-4 text-xs font-light text-neutral-600 mt-2">
              {modal.details}
            </div>
          )}
          <DialogFooter className="flex justify-center mt-6 bg-transparent border-none p-0 rounded-none sm:justify-center">
            <button
              onClick={handleModalClose}
              className="w-full sm:w-auto bg-[#bfa37a] text-white py-3.5 px-8 rounded-none font-bold uppercase tracking-widest text-xs hover:bg-[#a68d67] transition-colors"
            >
              Go to sign in
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Modal */}
      <Dialog open={modal.isOpen && modal.type === 'error'} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-md rounded-none border border-[#efeae0] p-8 bg-[#faf8f6] shadow-2xl">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-red-50/50 p-3 rounded-full">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl font-serif font-normal text-neutral-900">
              {modal.title}
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-neutral-500 mt-2 font-light">
              {modal.message}
            </DialogDescription>
          </DialogHeader>
          {modal.details && (
            <div className="bg-white border border-[#efeae0] rounded-none p-4 text-xs font-light text-neutral-600 mt-2">
              {modal.details}
            </div>
          )}
          <DialogFooter className="flex justify-center mt-6 bg-transparent border-none p-0 rounded-none sm:justify-center">
            <button
              onClick={closeModal}
              className="w-full sm:w-auto bg-[#bfa37a] text-white py-3.5 px-8 rounded-none font-bold uppercase tracking-widest text-xs hover:bg-[#a68d67] transition-colors"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
