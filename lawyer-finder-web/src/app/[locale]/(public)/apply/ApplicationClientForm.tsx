'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, User, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ApplicationClientForm({ locale, initialStep, initialData }: any) {
  const [step, setStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  
  // Local JSON state syncing with Postgres `draftData` JSON blob
  const [formData, setFormData] = useState<any>(initialData?.step1 ? initialData : {
    step1: { fullName: '', phone: '', nic: '', address: '' },
    step2: { enrollmentYear: '', baslNumber: '' },
    step3: { district: '', practiceAreas: '', languages: '' }
  });

  const validateStep = (s: number) => {
    if (s === 1) {
      if (!formData.step1.fullName.trim()) return 'Full Name is required.';
      if (!formData.step1.phone.trim()) return 'Phone number is required.';
      if (!formData.step1.nic.trim()) return 'NIC Number is required.';
      if (!formData.step1.address.trim()) return 'Physical Address is required.';
    }
    if (s === 2) {
      if (!formData.step2.baslNumber.trim()) return 'BASL number is critically required.';
      if (!formData.step2.enrollmentYear.trim()) return 'Supreme Court Enrollment Year is required.';
    }
    if (s === 3) {
      if (!formData.step3.district.trim()) return 'Primary District is required.';
      if (!formData.step3.practiceAreas.trim()) return 'Please list at least one practice domain.';
    }
    return null;
  };

  const handleSaveDraft = async (nextStep: number) => {
    // Only run downstream validation if they are moving FORWARD.
    if (nextStep > step) {
      const errorMsg = validateStep(step);
      if (errorMsg) {
        toast.error(errorMsg);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/applications/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStep: nextStep, draftData: formData })
      });
      if (!res.ok) throw new Error('Failed to synchronize draft state to Cloud.');
      setStep(nextStep);
      toast.success('Progress saved securely.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFinal = async () => {
    const errorMsg = validateStep(3);
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    try {
      // 1. Force a final persistence save
      await fetch('/api/applications/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStep: 3, draftData: formData })
      });

      // 2. Lock the transaction globally
      const res = await fetch('/api/applications/submit', { method: 'POST' });
      if (!res.ok) throw new Error('Application verification failure.');
      
      toast.success('Your application is under review! Await email confirmation.');
      setTimeout(() => window.location.href = `/${locale}`, 2000);
    } catch (e: any) {
      toast.error(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-2xl shadow-blue-900/5 border border-gray-100 p-8 sm:p-12 transition-all">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Attorney Application</h1>
        <p className="text-gray-500 mt-2 font-medium">BASL Verified professionals only.</p>
      </div>

      {/* Progress visualizer block */}
      <div className="flex items-center justify-between mb-12 relative before:absolute before:inset-0 before:top-1/2 before:-translate-y-1/2 before:h-1.5 before:bg-gray-100 before:z-0 before:rounded-full">
        {[ { s: 1, icon: User, label: 'Identity' }, 
           { s: 2, icon: ShieldCheck, label: 'Verification' }, 
           { s: 3, icon: Scale, label: 'Practice' } ].map(i => (
          <div key={i.s} className={`relative z-10 flex flex-col items-center gap-3 transition-colors ${step >= i.s ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold border-[6px] border-white shadow-sm transition-all duration-500 delay-100 ${step >= i.s ? 'bg-blue-100 scale-110' : 'bg-gray-100'}`}>
              <i.icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest">{i.label}</span>
          </div>
        ))}
      </div>

      {/* Logic Form Matrix */}
      <div className="min-h-[350px]">
        {step === 1 && (
          <div className="animate-in fade-in zoom-in-95 slide-in-from-right-4 duration-500 flex flex-col gap-5">
            <h2 className="text-2xl font-bold tracking-tight">1. Legal Identity & Contact</h2>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Full Name (As per NIC)</label>
              <input type="text" placeholder="e.g. John Doe" value={formData.step1?.fullName || ''} onChange={(e) => setFormData({...formData, step1: {...formData.step1, fullName: e.target.value}})} className="w-full bg-gray-50/50 border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium text-gray-900" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Primary Contact Phone</label>
                <input type="tel" placeholder="07XXXXXXXX" value={formData.step1?.phone || ''} onChange={(e) => setFormData({...formData, step1: {...formData.step1, phone: e.target.value}})} className="w-full bg-gray-50/50 border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">NIC Number</label>
                <input type="text" placeholder="XXXXXXXV / XXXXXXXX" value={formData.step1?.nic || ''} onChange={(e) => setFormData({...formData, step1: {...formData.step1, nic: e.target.value}})} className="w-full bg-gray-50/50 border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium text-gray-900" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Office / Chambers Address</label>
              <input type="text" placeholder="e.g. 123, Hulftsdorp Street, Colombo 12" value={formData.step1?.address || ''} onChange={(e) => setFormData({...formData, step1: {...formData.step1, address: e.target.value}})} className="w-full bg-gray-50/50 border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium text-gray-900" />
            </div>
            <Button onClick={() => handleSaveDraft(2)} disabled={loading} className="w-full h-14 text-lg font-bold mt-2 shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 rounded-xl">Save & Continue securely</Button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in zoom-in-95 slide-in-from-right-4 duration-500 flex flex-col gap-6">
            <h2 className="text-2xl font-bold tracking-tight">2. BASL Verification</h2>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Official BASL Registration Number</label>
              <input type="text" placeholder="e.g. BASL-3498" value={formData.step2?.baslNumber || ''} onChange={(e) => setFormData({...formData, step2: {...formData.step2, baslNumber: e.target.value}})} className="w-full bg-gray-50/50 border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Supreme Court Enrollment Year</label>
              <input type="text" placeholder="e.g. 2012" value={formData.step2?.enrollmentYear || ''} onChange={(e) => setFormData({...formData, step2: {...formData.step2, enrollmentYear: e.target.value}})} className="w-full bg-gray-50/50 border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium text-gray-900" />
            </div>
            <div className="flex gap-4 mt-6">
              <Button onClick={() => handleSaveDraft(1)} variant="outline" disabled={loading} className="w-1/3 h-14 rounded-xl">Back</Button>
              <Button onClick={() => handleSaveDraft(3)} disabled={loading} className="w-2/3 h-14 text-lg font-bold shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 rounded-xl">Save & Continue</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in zoom-in-95 slide-in-from-right-4 duration-500 flex flex-col gap-6">
            <h2 className="text-2xl font-bold tracking-tight">3. Practice Configuration</h2>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Primary Legal District</label>
              <input type="text" placeholder="e.g. Colombo, Galle" value={formData.step3?.district || ''} onChange={(e) => setFormData({...formData, step3: {...formData.step3, district: e.target.value}})} className="w-full bg-gray-50/50 border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Legal Domains (Comma separated)</label>
              <input type="text" placeholder="e.g. Family Law, Intellectual Property" value={formData.step3?.practiceAreas || ''} onChange={(e) => setFormData({...formData, step3: {...formData.step3, practiceAreas: e.target.value}})} className="w-full bg-gray-50/50 border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Consultation Languages (Comma separated)</label>
              <input type="text" placeholder="e.g. Sinhala, English, Tamil" value={formData.step3?.languages || ''} onChange={(e) => setFormData({...formData, step3: {...formData.step3, languages: e.target.value}})} className="w-full bg-gray-50/50 border border-gray-200 p-4 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium text-gray-900" />
            </div>
            <div className="flex gap-4 mt-6">
              <Button onClick={() => handleSaveDraft(2)} variant="outline" disabled={loading} className="w-1/3 h-14 rounded-xl">Back</Button>
              <Button onClick={handleSubmitFinal} disabled={loading} className="w-2/3 h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-500/20 rounded-xl rounded-xl">Finalize Application</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
