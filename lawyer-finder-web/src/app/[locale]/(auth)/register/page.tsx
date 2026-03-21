'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormValues } from '@/schemas/auth.schema';
import { useState } from 'react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'CLIENT' }
  });

  const selectedRole = watch('role');

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100">
        <h2 className="text-4xl font-black text-center mb-2 tracking-tight text-gray-900">Create Account</h2>
        <p className="text-center text-gray-500 mb-8">Join LawFinder SL today.</p>
        
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Full Name</label>
            <input type="text" {...register('fullName')} className="w-full border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 transition-all text-gray-900" />
            {errors.fullName && <p className="text-red-500 text-sm mt-2">{errors.fullName.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Email Address</label>
            <input type="email" placeholder="example@email.com" {...register('email')} className="w-full border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 transition-all text-gray-900" />
            {errors.email && <p className="text-red-500 text-sm mt-2">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Password</label>
            <input type="password" placeholder="••••••••" {...register('password')} className="w-full border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 transition-all text-gray-900" />
            {errors.password && <p className="text-red-500 text-sm mt-2">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">I am a...</label>
            <select {...register('role')} className="w-full border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 transition-all bg-white text-gray-900">
              <option value="CLIENT">Citizen seeking legal help</option>
              <option value="LAWYER">Legal Professional / Lawyer</option>
            </select>
          </div>

          {selectedRole === 'LAWYER' && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-semibold mb-2 text-gray-700">BASL Registration Number</label>
              <input type="text" {...register('baslNumber')} placeholder="Ex: BASL-12345" className="w-full border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 transition-all text-gray-900" />
              {errors.baslNumber && <p className="text-red-500 text-sm mt-2">{errors.baslNumber.message}</p>}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold p-4 rounded-xl hover:bg-blue-700 transition-colors mt-4 shadow-lg shadow-blue-500/25 disabled:opacity-50">
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
