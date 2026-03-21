'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormValues } from '@/schemas/auth.schema';
import { useState } from 'react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', body: JSON.stringify(data)
      });
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error || 'Login failed');
      
      toast.success('Successfully logged in!');
      // Hard redirect to correctly load layouts rather than router.push which preserves state
      window.location.href = result.role === 'CLIENT' ? '/en' : `/en/dashboard/${result.role.toLowerCase()}`;
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100">
        <h2 className="text-4xl font-black text-center mb-2 tracking-tight text-gray-900">Welcome Back</h2>
        <p className="text-center text-gray-500 mb-8">Please enter your credentials to log in.</p>
        
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Email Address</label>
            <input 
              type="email" 
              placeholder="hello@example.com"
              {...register('email')} 
              className={`w-full border p-4 rounded-xl outline-none focus:ring-4 transition-all ${errors.email ? 'border-red-300 focus:ring-red-100' : 'focus:ring-blue-100 border-gray-200'}`} 
            />
            {errors.email && <p className="text-red-500 text-sm mt-2">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              {...register('password')} 
              className={`w-full border p-4 rounded-xl outline-none focus:ring-4 transition-all ${errors.password ? 'border-red-300 focus:ring-red-100' : 'focus:ring-blue-100 border-gray-200'}`} 
            />
            {errors.password && <p className="text-red-500 text-sm mt-2">{errors.password.message}</p>}
          </div>
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-blue-600 text-white font-bold p-4 rounded-xl hover:bg-blue-700 transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
