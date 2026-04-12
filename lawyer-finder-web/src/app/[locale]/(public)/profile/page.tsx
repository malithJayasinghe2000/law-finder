'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  User, Mail, Lock, Camera, Save, Loader2, ArrowLeft, Scale,
  Phone, MapPin, Briefcase, Languages, Globe, Gavel, BookOpen,
  Shield, Calendar, CreditCard, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, Zap, Crown,
} from 'lucide-react';

const LANGUAGES = ['Sinhala', 'Tamil', 'English'];

export default function ProfileSettingsPage() {
  const { locale } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCard, setUploadingCard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardFileInputRef = useRef<HTMLInputElement>(null);

  // User fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [role, setRole] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Lawyer fields
  const [isLawyer, setIsLawyer] = useState(false);
  const [lawyerData, setLawyerData] = useState<any>(null);
  const [lFullName, setLFullName] = useState('');
  const [bio, setBio] = useState('');
  const [practiceAreas, setPracticeAreas] = useState<string[]>([]);
  const [languages, setLanguagesState] = useState<string[]>([]);
  const [district, setDistrict] = useState('');
  const [baseFeeRange, setBaseFeeRange] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [practiceType, setPracticeType] = useState('');
  const [courts, setCourts] = useState<string[]>([]);
  const [isNotary, setIsNotary] = useState(false);
  const [nic, setNic] = useState('');
  const [lawyerProfileImageUrl, setLawyerProfileImageUrl] = useState('');

  // Subscription state
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [renewingSubscription, setRenewingSubscription] = useState(false);

  const [lookups, setLookups] = useState<{ districts: string[], practiceAreas: string[], practiceTypes: string[] }>({
    districts: [],
    practiceAreas: [],
    practiceTypes: []
  });

  useEffect(() => {
    fetch('/api/lookups')
      .then(res => res.json())
      .then(data => {
        if (data.districts) setLookups(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    setSubscriptionLoading(true);
    try {
      const res = await fetch('/api/subscriptions/status');
      if (res.ok) {
        const data = await res.json();
        setSubscriptionData(data);
      }
    } catch {
      // Non-critical, fail silently
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will retain access until your current billing period ends.')) return;
    setCancellingSubscription(true);
    try {
      const res = await fetch('/api/subscriptions/cancel', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      fetchSubscription();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel subscription');
    } finally {
      setCancellingSubscription(false);
    }
  };

  const handleRenewSubscription = async () => {
    setRenewingSubscription(true);
    try {
      const res = await fetch('/api/subscriptions/renew', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      fetchSubscription();
    } catch (err: any) {
      toast.error(err.message || 'Failed to renew subscription');
    } finally {
      setRenewingSubscription(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile', { credentials: 'omit' });
      // We will actually just use default... Wait. Default is `same-origin`.
      // Let's explicitly do 'same-origin'
      const resNew = await fetch('/api/profile', { credentials: 'same-origin' });
      if (!resNew.ok) {
        console.error('Failed to fetch profile', resNew.status);
        if (resNew.status === 401) {
             router.push(`/${locale}/login`);
        }
        return;
      }
      const data = await resNew.json();
      const u = data.user;
      setFullName(u.fullName || '');
      setEmail(u.email);
      setProfileImageUrl(u.profileImageUrl || '');
      setRole(u.role);

      if (u.role === 'LAWYER' && data.lawyerProfile) {
        setIsLawyer(true);
        const lp = data.lawyerProfile;
        setLawyerData(lp);
        setLFullName(lp.fullName || '');
        setBio(lp.bio || '');
        setPracticeAreas(lp.practiceAreas || []);
        setLanguagesState(lp.languages || []);
        setDistrict(lp.district || '');
        setBaseFeeRange(lp.baseFeeRange || '');
        setContactPhone(lp.contactPhone || '');
        setAddress(lp.address || '');
        setGender(lp.gender || '');
        setYearsOfExperience(lp.yearsOfExperience?.toString() || '');
        setPracticeType(lp.practiceType || '');
        setCourts(lp.courts || []);
        setIsNotary(lp.isNotary || false);
        setNic(lp.nic || '');
        setLawyerProfileImageUrl(lp.profileImageUrl || '');
      }
    } catch {
      toast.error('Failed to load profile. Please log in.');
      router.push(`/${locale}/login`);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImage = async (file: File, isCard: boolean = false) => {
    if (isCard) setUploadingCard(true);
    else setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed.');
      }

      const data = await res.json();
      if (isCard) {
        setLawyerProfileImageUrl(data.url);
        toast.success('Card image uploaded!');
      } else {
        setProfileImageUrl(data.url);
        toast.success('Profile picture uploaded!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed.');
    } finally {
      if (isCard) setUploadingCard(false);
      else setUploading(false);
    }
  };

  const handleSave = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        fullName,
        profileImageUrl: profileImageUrl || null,
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      if (isLawyer) {
        payload.lawyerProfile = {
          fullName: lFullName,
          bio,
          practiceAreas,
          languages,
          district,
          baseFeeRange,
          contactPhone,
          address,
          gender,
          yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
          practiceType,
          courts,
          isNotary,
          nic,
          profileImageUrl: lawyerProfileImageUrl || null,
        };
      }

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Profile updated successfully!');
      router.refresh();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayItem = (arr: string[], setter: (a: string[]) => void, item: string) => {
    if (arr.includes(item)) {
      setter(arr.filter(a => a !== item));
    } else {
      setter([...arr, item]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header Breadcrumb */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-4 flex items-center gap-3 text-sm">
          <Link href={`/${locale}`} className="text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-900 font-semibold">Profile Settings</span>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-10 lg:py-16">
        <div className="max-w-4xl">
          {/* Page Title */}
          <div className="flex items-center gap-4 mb-10">
            <div className="flex h-12 w-12 items-center justify-center bg-[#0a0a0a] text-white">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Profile Settings</h1>
              <p className="text-sm text-neutral-500 font-medium">Manage your account information</p>
            </div>
          </div>

          {/* Profile Picture Section */}
          <div className="mb-10 pb-10 border-b border-neutral-200">
            <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-widest mb-6">Profile Picture</h3>
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div className="h-24 w-24 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200 shadow-sm">
                  <img
                    src={profileImageUrl || '/avatar.png'}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full"
                >
                  {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadImage(file, false);
                  }}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0a0a0a]">Upload a new profile picture</p>
                <p className="text-xs text-neutral-400 mt-1">JPG, PNG or WebP. Max 5MB. This image appears in the navbar.</p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="mb-10 pb-10 border-b border-neutral-200">
            <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-widest mb-6">Basic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">Email</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full bg-neutral-100 border border-neutral-200 text-neutral-500 px-4 py-3 outline-none text-sm cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Password Change */}
          <div className="mb-10 pb-10 border-b border-neutral-200">
            <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-widest mb-6">Change Password</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                />
              </div>
            </div>
          </div>

          {/* Lawyer-Specific Fields */}
          {isLawyer && (
            <>
              {/* Lawyer Card Image */}
              <div className="mb-10 pb-10 border-b border-neutral-200">
                <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-widest mb-6">Lawyer Card Image</h3>
                <p className="text-xs text-neutral-400 mb-4">This image is shown on your lawyer directory card. Separate from your profile picture.</p>
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="h-32 w-24 bg-neutral-100 overflow-hidden">
                      <img
                        src={lawyerProfileImageUrl || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'}
                        alt="Card"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <button
                      onClick={() => cardFileInputRef.current?.click()}
                      disabled={uploadingCard}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      {uploadingCard ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                    </button>
                    <input
                      ref={cardFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadImage(file, true);
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0a0a0a]">Card display image</p>
                    <p className="text-xs text-neutral-400 mt-1">This image appears on your lawyer directory card and profile page.</p>
                  </div>
                </div>
              </div>

              {/* Lawyer Details */}
              <div className="mb-10 pb-10 border-b border-neutral-200">
                <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-widest mb-6">Lawyer Profile Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">Display Name</label>
                    <input
                      type="text"
                      value={lFullName}
                      onChange={(e) => setLFullName(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">NIC</label>
                    <input
                      type="text"
                      value={nic}
                      onChange={(e) => setNic(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">Contact Phone</label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">Years of Experience</label>
                    <input
                      type="number"
                      value={yearsOfExperience}
                      onChange={(e) => setYearsOfExperience(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">Practice Type</label>
                    <select
                      value={practiceType}
                      onChange={(e) => setPracticeType(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                    >
                      <option value="">Select</option>
                      {lookups.practiceTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">District</label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                    >
                      <option value="">Select</option>
                      {lookups.districts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">Fee Range (LKR)</label>
                    <input
                      type="text"
                      value={baseFeeRange}
                      onChange={(e) => setBaseFeeRange(e.target.value)}
                      placeholder="e.g. 5000 - 15000"
                      className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={4}
                      className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Notary Toggle */}
              <div className="mb-10 pb-10 border-b border-neutral-200">
                <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-widest mb-6">Additional</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isNotary}
                    onChange={(e) => setIsNotary(e.target.checked)}
                    className="w-5 h-5 accent-[#0a0a0a]"
                  />
                  <span className="text-sm font-medium text-[#0a0a0a]">I am a registered Notary Public</span>
                </label>
              </div>

              <div className="mb-10 pb-10 border-b border-neutral-200">
                <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-[0.2em] mb-8 font-sans">Practice Areas</h3>
                <div className="flex flex-wrap gap-2">
                  {lookups.practiceAreas.map(area => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => toggleArrayItem(practiceAreas, setPracticeAreas, area)}
                      className={`px-5 py-3 text-sm font-medium transition-all duration-200 border-none rounded-none focus:outline-none ${
                        practiceAreas.includes(area)
                          ? 'bg-[#0a0a0a] text-white'
                          : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div className="mb-10 pb-10 border-b border-neutral-200">
                <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-[0.2em] mb-8 font-sans">Languages</h3>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleArrayItem(languages, setLanguagesState, lang)}
                      className={`px-6 py-3 text-sm font-medium transition-all duration-200 border-none rounded-none focus:outline-none ${
                        languages.includes(lang)
                          ? 'bg-[#0a0a0a] text-white'
                          : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Subscription Management Section */}
          {isLawyer && (
            <div className="mb-10 pb-10 border-b border-neutral-200">
              <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-[0.2em] mb-8 font-sans">Subscription</h3>
              
              {subscriptionLoading ? (
                <div className="flex items-center gap-2 text-neutral-400 py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading subscription info...</span>
                </div>
              ) : subscriptionData?.hasSubscription ? (
                <div className="space-y-6">
                  {/* Plan & Status Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50 p-5 border border-neutral-200">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 bg-[#0a0a0a] flex items-center justify-center shrink-0">
                        {subscriptionData.subscription.tier === 'PREMIUM' ? <Crown className="h-5 w-5 text-white" /> :
                         subscriptionData.subscription.tier === 'PROFESSIONAL' ? <Zap className="h-5 w-5 text-white" /> :
                         <Shield className="h-5 w-5 text-white" />}
                      </div>
                      <div>
                        <p className="font-bold text-[#0a0a0a] text-base">{subscriptionData.subscription.planName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            subscriptionData.subscription.status === 'ACTIVE' ? 'bg-[#0a0a0a] text-white' :
                            subscriptionData.subscription.status === 'CANCELED' ? 'bg-neutral-200 text-neutral-700' :
                            subscriptionData.subscription.status === 'EXPIRED' ? 'bg-red-100 text-red-700' :
                            'bg-neutral-200 text-neutral-600'
                          }`}>
                            {subscriptionData.subscription.status}
                          </span>
                          <span className="text-xs text-neutral-400">{subscriptionData.subscription.billingCycle}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-neutral-200 border border-neutral-200">
                    <div className="bg-white p-4">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Started</p>
                      <p className="text-sm font-semibold text-[#0a0a0a]">{new Date(subscriptionData.subscription.startDate).toLocaleDateString()}</p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Expires</p>
                      <p className="text-sm font-semibold text-[#0a0a0a]">{subscriptionData.subscription.endDate ? new Date(subscriptionData.subscription.endDate).toLocaleDateString() : '—'}</p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Days Left</p>
                      <p className="text-sm font-semibold text-[#0a0a0a]">{subscriptionData.subscription.daysRemaining ?? '—'}</p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Auto Renew</p>
                      <p className={`text-sm font-semibold ${subscriptionData.subscription.autoRenew ? 'text-[#0a0a0a]' : 'text-neutral-400'}`}>
                        {subscriptionData.subscription.autoRenew ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>

                  {/* Status Messages */}
                  {subscriptionData.subscription.status === 'CANCELED' && (
                    <p className="text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 p-4">
                      Your subscription has been cancelled. You retain access until {subscriptionData.subscription.endDate ? new Date(subscriptionData.subscription.endDate).toLocaleDateString() : 'expiry'}.
                    </p>
                  )}
                  {subscriptionData.subscription.status === 'EXPIRED' && (
                    <p className="text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 p-4">
                      Your subscription has expired. Subscribe to a new plan to regain access to premium features.
                    </p>
                  )}
                  {subscriptionData.subscription.status === 'PAST_DUE' && (
                    <p className="text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 p-4">
                      Your payment is pending approval. Your subscription will activate once payment is verified.
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    {subscriptionData.subscription.status === 'ACTIVE' && (
                      <button
                        onClick={handleCancelSubscription}
                        disabled={cancellingSubscription}
                        className="flex items-center gap-2 border border-neutral-200 text-neutral-600 px-5 py-3 font-semibold hover:bg-neutral-50 transition-colors disabled:opacity-50 text-sm"
                      >
                        {cancellingSubscription ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        {cancellingSubscription ? 'Cancelling...' : 'Cancel Subscription'}
                      </button>
                    )}
                    {subscriptionData.subscription.status === 'CANCELED' && (
                      <button
                        onClick={handleRenewSubscription}
                        disabled={renewingSubscription}
                        className="flex items-center gap-2 bg-[#0a0a0a] text-white px-5 py-3 font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50 text-sm"
                      >
                        {renewingSubscription ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        {renewingSubscription ? 'Renewing...' : 'Renew Subscription'}
                      </button>
                    )}
                    {subscriptionData.subscription.status === 'EXPIRED' && (
                      <Link href={`/${locale}/pricing`}>
                        <button className="flex items-center gap-2 bg-[#0a0a0a] text-white px-5 py-3 font-semibold hover:bg-neutral-800 transition-colors text-sm">
                          <CreditCard className="h-4 w-4" />
                          Subscribe to New Plan
                        </button>
                      </Link>
                    )}
                    <Link href={`/${locale}/pricing`}>
                      <button className="flex items-center gap-2 border border-neutral-200 text-neutral-600 px-5 py-3 font-semibold hover:bg-neutral-50 transition-colors text-sm">
                        View Plans
                      </button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="bg-neutral-50 border border-neutral-200 p-8 text-center">
                  <CreditCard className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500 mb-4">No active subscription found.</p>
                  <Link href={`/${locale}/pricing`}>
                    <button className="inline-flex items-center gap-2 bg-[#0a0a0a] text-white px-6 py-3 font-semibold hover:bg-neutral-800 transition-colors text-sm">
                      <CreditCard className="h-4 w-4" />
                      Browse Subscription Plans
                    </button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-[#0a0a0a] text-white px-8 py-4 font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
