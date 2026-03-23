'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormValues } from '@/schemas/auth.schema';
import { useState } from 'react';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scale, UserPlus, Loader2, ArrowLeft, Shield } from 'lucide-react';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const { locale } = useParams();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'CLIENT' },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterFormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error?.message || result.error || 'Registration failed');

      toast.success('Account created successfully. Please sign in.');
      window.location.href = `/${locale}/login`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Scale className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              LawFinder<span className="text-muted-foreground font-normal ml-0.5">SL</span>
            </span>
          </Link>
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Join LawFinder SL as a citizen or legal professional
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your full name"
                  {...register('fullName')}
                  className={errors.fullName ? 'border-destructive' : ''}
                />
                {errors.fullName && (
                  <p className="text-xs text-destructive">{errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="hello@example.com"
                  {...register('email')}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  {...register('password')}
                  className={errors.password ? 'border-destructive' : ''}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>I am a</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(val) => setValue('role', val as 'CLIENT' | 'LAWYER')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLIENT">Citizen seeking legal help</SelectItem>
                    <SelectItem value="LAWYER">Legal Professional / Lawyer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedRole === 'LAWYER' && (
                <div className="space-y-2 rounded-lg border border-dashed p-4 bg-muted/30">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <Shield className="h-4 w-4" />
                    Lawyer Verification
                  </div>
                  <Label htmlFor="baslNumber">BASL Registration Number</Label>
                  <Input
                    id="baslNumber"
                    type="text"
                    placeholder="e.g. BASL-12345"
                    {...register('baslNumber')}
                    className={errors.baslNumber ? 'border-destructive' : ''}
                  />
                  {errors.baslNumber && (
                    <p className="text-xs text-destructive">{errors.baslNumber.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Your BASL number will be verified by our admin team before your profile goes live.
                  </p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="mt-2 w-full gap-2 font-semibold">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href={`/${locale}/login`} className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link href={`/${locale}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
