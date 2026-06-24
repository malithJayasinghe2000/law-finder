'use client';

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Scale, Camera as CameraIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  applicationStep1Schema,
  applicationStep2Schema,
  applicationStep3Schema,
  applicationStep4Schema,
  COURT_OPTIONS,
} from '@/schemas/application.schema';
import { PRACTICE_AREAS, LANGUAGES, DISTRICTS } from '@/schemas/profile.schema';
// ── Types ────────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string>;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse Zod validation result into a flat field→message map.
 */
function extractFieldErrors(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }): FieldErrors {
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error?.issues ?? []) {
    const key = issue.path.join('.');
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ApplicationClientForm({ locale, initialStep, initialData }: any) {
  const [step, setStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Local JSON state syncing with Postgres `draftData` JSON blob
  const [formData, setFormData] = useState<any>(initialData?.step1 ? initialData : {
    step1: { fullName: '', gender: '', languages: [], bio: '', phone: '', address: '', district: '', latitude: '', longitude: '' },
    step2: { baslNumber: '', yearsOfExperience: '', practiceType: 'Independent', courts: '', isNotary: false },
    step3: { practiceAreas: [] },
    step4: { licenseImage: '', identityImage: '' }
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Camera controls ────────────────────────────────────────────────────────

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
    clearFieldError('identityImage');
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
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('License file must be under 5 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev: any) => ({ ...prev, step4: { ...prev.step4, licenseImage: reader.result } }));
        clearFieldError('licenseImage');
      };
      reader.readAsDataURL(file);
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const stepSchemaMap = {
    1: applicationStep1Schema,
    2: applicationStep2Schema,
    3: applicationStep3Schema,
    4: applicationStep4Schema,
  } as const;

  const validateStep = (s: number): FieldErrors => {
    const schema = stepSchemaMap[s as keyof typeof stepSchemaMap];
    const stepKey = `step${s}` as keyof typeof formData;
    const result = schema.safeParse(formData[stepKey]);
    return extractFieldErrors(result);
  };

  // ── Draft save / navigation ────────────────────────────────────────────────

  const handleSaveDraft = async (nextStep: number) => {
    // Validate current step when moving forward
    if (nextStep > step) {
      const errors = validateStep(step);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        const firstErrorMsg = Object.values(errors)[0];
        toast.error(firstErrorMsg);
        return;
      }
      setFieldErrors({});
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
    // Validate all steps on final submission
    const allErrors: FieldErrors = {};
    for (let s = 1; s <= 4; s++) {
      const errors = validateStep(s);
      for (const [key, msg] of Object.entries(errors)) {
        allErrors[`step${s}.${key}`] = msg;
      }
    }

    // Also validate step 4 inline (current view)
    const step4Errors = validateStep(4);
    if (Object.keys(step4Errors).length > 0) {
      setFieldErrors(step4Errors);
      const firstErrorMsg = Object.values(step4Errors)[0];
      toast.error(firstErrorMsg);
      return;
    }

    if (Object.keys(allErrors).length > 0) {
      toast.error('Some earlier steps have incomplete fields. Please review all steps.');
      return;
    }

    setFieldErrors({});
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

  // ── Shared styles ──────────────────────────────────────────────────────────

  const inputClass = (field: string) =>
    `w-full bg-neutral-50 border p-4 rounded-none outline-none focus:ring-0 transition-all font-medium text-[#0a0a0a] ${
      fieldErrors[field]
        ? 'border-red-400 focus:border-red-500 bg-red-50/30'
        : 'border-neutral-200 focus:border-[#0a0a0a]'
    }`;

  const ErrorMessage = ({ field }: { field: string }) => {
    const msg = fieldErrors[field];
    if (!msg) return null;
    return (
      <p className="mt-1.5 text-[12px] font-medium text-red-600 flex items-center gap-1" role="alert">
        <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
        {msg}
      </p>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-none shadow-md border border-neutral-200 p-8 sm:p-12 transition-all">
      <div className="mb-10 text-center">
        <h1 className="text-[28px] font-semibold text-[#0a0a0a] tracking-tight">Attorney Application</h1>
        <p className="text-neutral-500 mt-1 font-light">BASL Verified professionals only.</p>
      </div>

      {/* Progress visualizer block */}
      <div className="flex items-center justify-between mb-12 relative before:absolute before:inset-0 before:top-1/2 before:-translate-y-1/2 before:h-[2px] before:bg-neutral-100 before:z-0">
        {[{ s: 1, label: 'Profile' },
        { s: 2, label: 'Credentials' },
        { s: 3, label: 'Specializations' },
        { s: 4, label: 'Verification' }].map(i => (
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

            {/* Full Name */}
            <div>
              <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase" htmlFor="fullName">
                Full Name (As Registered) <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                placeholder="e.g. John Doe"
                value={formData.step1?.fullName || ''}
                onChange={(e) => {
                  setFormData({ ...formData, step1: { ...formData.step1, fullName: e.target.value } });
                  clearFieldError('fullName');
                }}
                className={inputClass('fullName')}
                aria-invalid={!!fieldErrors.fullName}
                aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
              />
              <ErrorMessage field="fullName" />
            </div>

            {/* Phone + Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase" htmlFor="phone">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="07XXXXXXXX"
                  maxLength={12}
                  value={formData.step1?.phone || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, step1: { ...formData.step1, phone: e.target.value } });
                    clearFieldError('phone');
                  }}
                  className={inputClass('phone')}
                  aria-invalid={!!fieldErrors.phone}
                />
                <ErrorMessage field="phone" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase" htmlFor="gender">Gender (Optional)</label>
                <select
                  id="gender"
                  value={formData.step1?.gender || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, step1: { ...formData.step1, gender: e.target.value } });
                    clearFieldError('gender');
                  }}
                  className={inputClass('gender')}
                >
                  <option value="">Select Gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
                <ErrorMessage field="gender" />
              </div>
            </div>

            {/* Languages */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-[11px] font-bold mb-4 text-neutral-900 uppercase tracking-widest font-sans">
                  Languages <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {(LANGUAGES as readonly string[]).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => {
                        const current = formData.step1.languages || [];
                        const next = current.includes(lang)
                          ? current.filter((l: string) => l !== lang)
                          : [...current, lang];
                        setFormData({ ...formData, step1: { ...formData.step1, languages: next } });
                        clearFieldError('languages');
                      }}
                      className={`px-6 py-3 text-sm font-medium transition-all duration-200 border-none rounded-none shadow-none focus:outline-none ${(formData.step1.languages || []).includes(lang)
                          ? 'bg-[#0a0a0a] text-white'
                          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                        }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <ErrorMessage field="languages" />
              </div>

              {/* District */}
              <div className="mt-2">
                <label className="block text-[11px] font-bold mb-2 text-neutral-900 uppercase tracking-widest font-sans" htmlFor="district">
                  District / Service Area <span className="text-red-500">*</span>
                </label>
                <select
                  id="district"
                  value={formData.step1?.district || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, step1: { ...formData.step1, district: e.target.value } });
                    clearFieldError('district');
                  }}
                  className={inputClass('district')}
                  aria-invalid={!!fieldErrors.district}
                >
                  <option value="">Select District</option>
                  {(DISTRICTS as readonly string[]).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <ErrorMessage field="district" />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase" htmlFor="address">
                Office / Physical Address (Legally Required) <span className="text-red-500">*</span>
              </label>
              <input
                id="address"
                type="text"
                placeholder="e.g. 123, Hulftsdorp Street, Colombo 12"
                value={formData.step1?.address || ''}
                onChange={(e) => {
                  setFormData({ ...formData, step1: { ...formData.step1, address: e.target.value } });
                  clearFieldError('address');
                }}
                className={inputClass('address')}
                aria-invalid={!!fieldErrors.address}
              />
              <ErrorMessage field="address" />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase" htmlFor="bio">Short Bio / Description</label>
              <textarea
                id="bio"
                placeholder="Brief summary of your legal profile..."
                maxLength={2000}
                value={formData.step1?.bio || ''}
                onChange={(e) => {
                  setFormData({ ...formData, step1: { ...formData.step1, bio: e.target.value } });
                  clearFieldError('bio');
                }}
                className={`${inputClass('bio')} min-h-[100px] resize-none`}
              />
              <div className="flex items-center justify-between mt-1">
                <ErrorMessage field="bio" />
                <span className="text-[11px] text-neutral-400 ml-auto">
                  {(formData.step1?.bio || '').length} / 2,000
                </span>
              </div>
            </div>

            <Button onClick={() => handleSaveDraft(2)} disabled={loading} className="w-full h-14 text-sm font-semibold mt-4 bg-[#0a0a0a] hover:bg-neutral-800 rounded-none uppercase tracking-wide">Save & Continue</Button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col gap-5">
            <h2 className="text-xl font-semibold tracking-tight uppercase text-neutral-800">2. Professional Credentials</h2>

            {/* BASL Number */}
            <div>
              <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase" htmlFor="baslNumber">
                BASL Registration / License <span className="text-red-500">*</span>
              </label>
              <input
                id="baslNumber"
                type="text"
                placeholder="e.g. BASL-3498"
                value={formData.step2?.baslNumber || ''}
                onChange={(e) => {
                  setFormData({ ...formData, step2: { ...formData.step2, baslNumber: e.target.value } });
                  clearFieldError('baslNumber');
                }}
                className={inputClass('baslNumber')}
                aria-invalid={!!fieldErrors.baslNumber}
              />
              <ErrorMessage field="baslNumber" />
            </div>

            {/* Years of Experience + Practice Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase" htmlFor="yearsOfExperience">
                  Years of Experience <span className="text-red-500">*</span>
                </label>
                <input
                  id="yearsOfExperience"
                  type="number"
                  min={0}
                  max={70}
                  placeholder="5"
                  value={formData.step2?.yearsOfExperience || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, step2: { ...formData.step2, yearsOfExperience: e.target.value } });
                    clearFieldError('yearsOfExperience');
                  }}
                  className={inputClass('yearsOfExperience')}
                  aria-invalid={!!fieldErrors.yearsOfExperience}
                />
                <ErrorMessage field="yearsOfExperience" />
              </div>
              {/* Courts */}
            <div>
              <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase" htmlFor="courts">
                Courts Practice In <span className="text-red-500">*</span>
              </label>
              <select
                id="courts"
                value={formData.step2?.courts || ''}
                onChange={(e) => {
                  setFormData({ ...formData, step2: { ...formData.step2, courts: e.target.value } });
                  clearFieldError('courts');
                }}
                className={inputClass('courts')}
                aria-invalid={!!fieldErrors.courts}
              >
                <option value="">Select Courts</option>
                {COURT_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ErrorMessage field="courts" />
            </div>
              {/* <div>
                <label className="block text-[13px] font-semibold mb-2 text-neutral-900 uppercase" htmlFor="practiceType">
                  Practice Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="practiceType"
                  value={formData.step2?.practiceType || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, step2: { ...formData.step2, practiceType: e.target.value } });
                    clearFieldError('practiceType');
                  }}
                  className={inputClass('practiceType')}
                  aria-invalid={!!fieldErrors.practiceType}
                >
                  <option value="">Select Type</option>
                  <option value="Independent">Independent Attorney</option>
                  <option value="Law Firm">Law Firm Partner/Associate</option>
                </select>
                <ErrorMessage field="practiceType" />
              </div> */}
            </div>

            

            {/* Notary */}
            <div className="flex items-center gap-3 bg-neutral-50 p-4 border border-neutral-200">
              <input type="checkbox" checked={formData.step2?.isNotary} onChange={(e) => setFormData({ ...formData, step2: { ...formData.step2, isNotary: e.target.checked } })} className="w-5 h-5 accent-[#0a0a0a]" id="isNotary" />
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

            {/* Practice Areas */}
            <div>
              <label className="block text-[11px] font-bold mb-6 text-neutral-900 uppercase tracking-[0.2em] font-sans">
                Practice Areas <span className="text-red-500">*</span>
                <span className="ml-2 text-neutral-400 font-normal normal-case tracking-normal">
                  ({(formData.step3.practiceAreas || []).length}/6 selected)
                </span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(PRACTICE_AREAS as readonly string[]).map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => {
                      const current = formData.step3.practiceAreas || [];
                      const isSelected = current.includes(area);
                      if (!isSelected && current.length >= 6) {
                        toast.error('You may select up to 6 specializations.');
                        return;
                      }
                      const next = isSelected
                        ? current.filter((a: string) => a !== area)
                        : [...current, area];
                      setFormData({ ...formData, step3: { ...formData.step3, practiceAreas: next } });
                      clearFieldError('practiceAreas');
                    }}
                    className={`px-5 py-3 text-sm font-medium transition-all duration-200 border-none rounded-none shadow-none focus:outline-none ${(formData.step3.practiceAreas || []).includes(area)
                        ? 'bg-[#0a0a0a] text-white'
                        : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                      }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
              <ErrorMessage field="practiceAreas" />
              <div className="w-full h-px bg-neutral-100 my-10" />
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

            {/* License Upload */}
            <div className={`p-6 border bg-neutral-50 flex flex-col gap-4 ${fieldErrors.licenseImage ? 'border-red-400' : 'border-neutral-200'}`}>
              <div>
                <h3 className="font-semibold text-sm uppercase mb-1 flex items-center gap-2"><Scale className="w-4 h-4" /> Attorney License Document <span className="text-red-500">*</span></h3>
                <p className="text-xs text-neutral-600 mb-3">Upload a clean image or PDF scan of your verified License certificate. Max 5 MB.</p>
                <input type="file" accept="image/*,application/pdf" onChange={handleLicenseUpload} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-semibold file:bg-[#0a0a0a] file:text-white hover:file:bg-neutral-800 transition-all cursor-pointer" />
                {formData.step4?.licenseImage && <span className="ml-3 text-xs font-bold text-green-700">✓ Attached</span>}
              </div>
              <ErrorMessage field="licenseImage" />
            </div>

            {/* Face Capture */}
            <div className={`p-6 border bg-neutral-50 flex flex-col items-center gap-4 text-center ${fieldErrors.identityImage ? 'border-red-400' : 'border-neutral-200'}`}>
              <div>
                <h3 className="font-semibold text-sm uppercase mb-1 flex items-center justify-center gap-2"><CameraIcon className="w-4 h-4" /> Live Identity Verification <span className="text-red-500">*</span></h3>
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
                  <button type="button" onClick={() => setFormData((p: any) => ({ ...p, step4: { ...p.step4, identityImage: '' } }))} className="text-xs font-semibold underline text-red-600">Retake</button>
                </div>
              )}
              <ErrorMessage field="identityImage" />
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
