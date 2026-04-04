'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, User, Scale, Camera as CameraIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ApplicationClientForm({ locale, initialStep, initialData }: any) {
  const [step, setStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  
  // Local JSON state syncing with Postgres `draftData` JSON blob
  const [formData, setFormData] = useState<any>(initialData?.step1 ? initialData : {
    step1: { fullName: '', gender: '', languages: '', bio: '', phone: '', address: '', district: '' },
    step2: { baslNumber: '', yearsOfExperience: '', practiceType: '', courts: '', isNotary: false },
    step3: { practiceAreas: '', baseFeeRange: '' },
    step4: { licenseImage: '', identityImage: '' }
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(s);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = s;
      }, 100);
    } catch (e) {
      toast.error('Camera access denied. Please allow camera permissions.');
    }
  };

  const captureFace = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const url = canvas.toDataURL('image/jpeg');
    setFormData((prev: any) => ({ ...prev, step4: { ...prev.step4, identityImage: url } }));
    stopCamera();
    toast.success('Face snapshot captured successfully!');
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  const handleLicenseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev: any) => ({ ...prev, step4: { ...prev.step4, licenseImage: reader.result } }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateStep = (s: number) => {
    if (s === 1) {
      if (!formData.step1.fullName.trim()) return 'Full Name is required.';
      if (!formData.step1.phone.trim()) return 'Mobile number is required.';
      if (!formData.step1.address.trim()) return 'Office Address is legally required.';
      if (!formData.step1.district.trim()) return 'District is required.';
    }
    if (s === 2) {
      if (!formData.step2.baslNumber.trim()) return 'BASL registration number is critically required.';
    }
    if (s === 3) {
      if (!formData.step3.practiceAreas.trim()) return 'Please select at least one specialization.';
    }
    if (s === 4) {
      if (!formData.step4.identityImage) return 'Face identity capture is legally required.';
      if (!formData.step4.licenseImage) return 'Attorney License upload is required.';
    }
    return null;
  };

  const handleSaveDraft = async (nextStep: number) => {
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
    const errorMsg = validateStep(4);
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    try {
      await fetch('/api/applications/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStep: 4, draftData: formData })
      });

      const res = await fetch('/api/applications/submit', { method: 'POST' });
      if (!res.ok) throw new Error('Application verification failure.');
      
      toast.success('Your application is under review! Await email confirmation.');
      setTimeout(() => window.location.href = `/${locale}`, 2000);
    } catch (e: any) {
      toast.error(e.message);
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-neutral-50 border border-neutral-200 p-4 rounded-none outline-none focus:ring-0 focus:border-[#0a0a0a] transition-all font-medium text-[#0a0a0a]";

  return (
    <div className="bg-white rounded-none shadow-md border border-neutral-200 p-8 sm:p-12 transition-all">
      <div className="mb-10 text-center">
        <h1 className="text-[28px] font-semibold text-[#0a0a0a] tracking-tight">Attorney Application</h1>
        <p className="text-neutral-500 mt-1 font-light">BASL Verified professionals only.</p>
      </div>

      {/* Progress visualizer block */}
      <div className="flex items-center justify-between mb-12 relative before:absolute before:inset-0 before:top-1/2 before:-translate-y-1/2 before:h-[2px] before:bg-neutral-100 before:z-0">
        {[ { s: 1, label: 'Profile' }, 
           { s: 2, label: 'Credentials' }, 
           { s: 3, label: 'Specializations' },
           { s: 4, label: 'Verification' } ].map(i => (
          <div key={i.s} className={`relative z-10 flex flex-col items-center gap-3 transition-colors ${step >= i.s ? 'text-[#0a0a0a]' : 'text-neutral-400'}`}>
            <div className={`w-10 h-10 rounded-none flex items-center justify-center font-bold border-4 border-white transition-all duration-300 ${step >= i.s ? 'bg-[#0a0a0a] text-white scale-110' : 'bg-neutral-200 text-neutral-500'}`}>
              {i.s}
            </div>
          </div>
        ))}
      </div>

      {/* Logic Form Matrix */}
      <div className="min-h-[350px]">
        {step === 1 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col gap-5">
            <h2 className="text-xl font-semibold tracking-tight uppercase text-neutral-800">1. Basic Profile & Contact</h2>
            <div>
              <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">Full Name (As Registerd)</label>
              <input type="text" placeholder="e.g. John Doe" value={formData.step1?.fullName || ''} onChange={(e) => setFormData({...formData, step1: {...formData.step1, fullName: e.target.value}})} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">Mobile Number</label>
                <input type="tel" placeholder="07XXXXXXXX" value={formData.step1?.phone || ''} onChange={(e) => setFormData({...formData, step1: {...formData.step1, phone: e.target.value}})} className={inputClass} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">Gender (Optional)</label>
                <select value={formData.step1?.gender || ''} onChange={(e) => setFormData({...formData, step1: {...formData.step1, gender: e.target.value}})} className={inputClass}>
                   <option value="">Select Gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">Spoken Languages</label>
                <input type="text" placeholder="Sinhala, Tamil, English" value={formData.step1?.languages || ''} onChange={(e) => setFormData({...formData, step1: {...formData.step1, languages: e.target.value}})} className={inputClass} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">District / Service Area</label>
                <input type="text" placeholder="e.g. Colombo" value={formData.step1?.district || ''} onChange={(e) => setFormData({...formData, step1: {...formData.step1, district: e.target.value}})} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">Office / Physical Address (Legal Required)</label>
              <input type="text" placeholder="e.g. 123, Hulftsdorp Street, Colombo 12" value={formData.step1?.address || ''} onChange={(e) => setFormData({...formData, step1: {...formData.step1, address: e.target.value}})} className={inputClass} />
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">Short Bio / Description</label>
              <textarea placeholder="Brief summary of your legal profile..." value={formData.step1?.bio || ''} onChange={(e) => setFormData({...formData, step1: {...formData.step1, bio: e.target.value}})} className={`${inputClass} min-h-[100px] resize-none`} />
            </div>
            <Button onClick={() => handleSaveDraft(2)} disabled={loading} className="w-full h-14 text-sm font-semibold mt-4 bg-[#0a0a0a] hover:bg-neutral-800 rounded-none uppercase tracking-wide">Save & Continue</Button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col gap-5">
            <h2 className="text-xl font-semibold tracking-tight uppercase text-neutral-800">2. Professional Credentials</h2>
            <div>
              <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">BASL Registration / License</label>
              <input type="text" placeholder="e.g. BASL-3498" value={formData.step2?.baslNumber || ''} onChange={(e) => setFormData({...formData, step2: {...formData.step2, baslNumber: e.target.value}})} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">Years of Experience</label>
                <input type="number" placeholder="5" value={formData.step2?.yearsOfExperience || ''} onChange={(e) => setFormData({...formData, step2: {...formData.step2, yearsOfExperience: e.target.value}})} className={inputClass} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">Practice Type</label>
                <select value={formData.step2?.practiceType || ''} onChange={(e) => setFormData({...formData, step2: {...formData.step2, practiceType: e.target.value}})} className={inputClass}>
                   <option value="">Select Type</option><option value="Independent">Independent Attorney</option><option value="Law Firm">Law Firm Partner/Associate</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">Courts Practice In</label>
              <input type="text" placeholder="Supreme Court, District Court, etc" value={formData.step2?.courts || ''} onChange={(e) => setFormData({...formData, step2: {...formData.step2, courts: e.target.value}})} className={inputClass} />
            </div>
            <div className="flex items-center gap-3 bg-neutral-50 p-4 border border-neutral-200">
               <input type="checkbox" checked={formData.step2?.isNotary} onChange={(e) => setFormData({...formData, step2: {...formData.step2, isNotary: e.target.checked}})} className="w-5 h-5 accent-[#0a0a0a]" id="isNotary" />
               <label htmlFor="isNotary" className="text-[13px] font-bold text-neutral-900 uppercase cursor-pointer">I am a sworn Notary Public</label>
            </div>
            <div className="flex gap-4 mt-6">
              <Button onClick={() => handleSaveDraft(1)} variant="outline" disabled={loading} className="w-1/3 h-14 rounded-none font-semibold uppercase tracking-wide border-neutral-300">Back</Button>
              <Button onClick={() => handleSaveDraft(3)} disabled={loading} className="w-2/3 h-14 text-sm font-semibold bg-[#0a0a0a] hover:bg-neutral-800 rounded-none uppercase tracking-wide">Save & Continue</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col gap-6">
            <h2 className="text-xl font-semibold tracking-tight uppercase text-neutral-800">3. Specializations Data</h2>
            <div>
              <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">Law Specializations</label>
              <select value={formData.step3?.practiceAreas || ''} onChange={(e) => setFormData({...formData, step3: {...formData.step3, practiceAreas: e.target.value}})} className={inputClass}>
                   <option value="">Select Core Specialization</option>
                   <option value="Criminal Law">Criminal Law</option>
                   <option value="Civil Law">Civil Law</option>
                   <option value="Property Law">Property Law</option>
                   <option value="Family Law">Family Law</option>
                   <option value="Corporate Law">Corporate Law</option>
                   <option value="Immigration">Immigration</option>
                   <option value="Tax">Tax Law</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase">Consultation Fee Base (Optional)</label>
              <input type="text" placeholder="e.g. 5,000 LKR / hr" value={formData.step3?.baseFeeRange || ''} onChange={(e) => setFormData({...formData, step3: {...formData.step3, baseFeeRange: e.target.value}})} className={inputClass} />
            </div>
            <div className="flex gap-4 mt-6">
              <Button onClick={() => handleSaveDraft(2)} variant="outline" disabled={loading} className="w-1/3 h-14 rounded-none font-semibold uppercase tracking-wide border-neutral-300">Back</Button>
              <Button onClick={() => handleSaveDraft(4)} disabled={loading} className="w-2/3 h-14 text-sm font-semibold bg-[#0a0a0a] hover:bg-neutral-800 rounded-none uppercase tracking-wide">Save Securely</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col gap-6">
            <h2 className="text-xl font-semibold tracking-tight uppercase text-neutral-800">4. Final Verification</h2>
            
            <div className="p-6 border border-neutral-200 bg-neutral-50 flex flex-col gap-4">
               <div>
                  <h3 className="font-semibold text-sm uppercase mb-1 flex items-center gap-2"><Scale className="w-4 h-4"/> Attorney License Document</h3>
                  <p className="text-xs text-neutral-600 mb-3">Upload a clean image or PDF scan of your verified License certificate.</p>
                  <input type="file" accept="image/*,application/pdf" onChange={handleLicenseUpload} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-semibold file:bg-[#0a0a0a] file:text-white hover:file:bg-neutral-800 transition-all cursor-pointer"/>
                  {formData.step4?.licenseImage && <span className="ml-3 text-xs font-bold text-green-700">✓ Attached</span>}
               </div>
            </div>

            <div className="p-6 border border-neutral-200 bg-neutral-50 flex flex-col items-center gap-4 text-center">
               <div>
                  <h3 className="font-semibold text-sm uppercase mb-1 flex items-center justify-center gap-2"><CameraIcon className="w-4 h-4"/> Live Identity Verification</h3>
                  <p className="text-xs text-neutral-600 mb-3">Please grant camera access to match your ID with a live face image.</p>
               </div>
               
               {!stream && !formData.step4?.identityImage && (
                 <Button type="button" onClick={startCamera} variant="outline" className="rounded-none border-[#0a0a0a] text-[#0a0a0a] font-bold h-12 px-6">
                    Launch Secure Camera
                 </Button>
               )}

               {stream && (
                 <div className="flex flex-col items-center gap-4">
                   <video ref={videoRef} autoPlay playsInline muted className="w-64 h-48 bg-black object-cover border-4 border-white shadow-xl" />
                   <div className="flex gap-2">
                     <Button type="button" onClick={captureFace} className="rounded-none bg-[#0a0a0a] text-white">Capture Match</Button>
                     <Button type="button" variant="outline" onClick={stopCamera} className="rounded-none">Discard</Button>
                   </div>
                 </div>
               )}

               {formData.step4?.identityImage && !stream && (
                 <div className="flex flex-col items-center gap-3">
                   <img src={formData.step4.identityImage} alt="Identity Secure Match" className="w-32 h-32 object-cover border-4 border-white shadow-sm" />
                   <span className="text-xs font-bold text-green-700 uppercase tracking-wide">✓ Authorized Face Match</span>
                   <button type="button" onClick={() => setFormData((p:any) => ({...p, step4: {...p.step4, identityImage: ''}}))} className="text-xs font-semibold underline text-red-600">Retake</button>
                 </div>
               )}
            </div>

            <div className="flex gap-4 mt-6">
              <Button onClick={() => handleSaveDraft(3)} variant="outline" disabled={loading} className="w-1/3 h-14 rounded-none font-semibold uppercase tracking-wide border-neutral-300">Back</Button>
              <Button onClick={handleSubmitFinal} disabled={loading} className="w-2/3 h-14 text-sm font-semibold bg-[#0a0a0a] hover:bg-neutral-800 text-white rounded-none uppercase tracking-wide">Submit Verification</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
