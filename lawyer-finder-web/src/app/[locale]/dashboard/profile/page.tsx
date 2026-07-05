'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  User, Mail, Camera, Save, Loader2,
  Phone, MapPin, Briefcase, Languages, Globe, Gavel, BookOpen,
  Shield, Calendar, CreditCard, AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react';
import { DISTRICTS, PRACTICE_AREAS } from '@/schemas/profile.schema';

const LANGUAGES = ['Sinhala', 'Tamil', 'English'];
const PRACTICE_TYPES = ['Independent', 'Law Firm'];

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
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [gender, setGender] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [practiceType, setPracticeType] = useState('');
  const [courts, setCourts] = useState<string[]>([]);
  const [isNotary, setIsNotary] = useState(false);
  const [nic, setNic] = useState('');
  const [googleMeetLink, setGoogleMeetLink] = useState('');
  const [lawyerProfileImageUrl, setLawyerProfileImageUrl] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
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
        setPracticeAreas((lp.practiceAreas || []).filter((a: string) => PRACTICE_AREAS.includes(a as any)));
        setLanguagesState((lp.languages || []).filter((l: string) => LANGUAGES.includes(l as any)));
        setDistrict(DISTRICTS.includes(lp.district as any) ? lp.district : '');
        setBaseFeeRange(lp.baseFeeRange || '');
        setContactPhone(lp.contactPhone || '');
        setAddress(lp.address || '');
        setLatitude(lp.latitude?.toString() || '');
        setLongitude(lp.longitude?.toString() || '');
        setGender(['MALE', 'FEMALE', 'OTHER', 'Male', 'Female', 'Other'].includes(lp.gender as any) ? lp.gender : '');
        setYearsOfExperience(lp.yearsOfExperience?.toString() || '');
        setPracticeType(PRACTICE_TYPES.includes(lp.practiceType as any) ? lp.practiceType : '');
        setCourts(lp.courts || []);
        setIsNotary(lp.isNotary || false);
        setNic(lp.nic || '');
        setGoogleMeetLink(lp.onlineMeetingLink || '');
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
          latitude: latitude || undefined,
          longitude: longitude || undefined,
          gender,
          yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
          practiceType,
          courts,
          isNotary,
          nic,
          onlineMeetingLink: googleMeetLink || null,
          profileImageUrl: lawyerProfileImageUrl || null,
        };
      }

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile.');

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
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#bfa37a]" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-2 lg:py-4">
      <div className="bg-white rounded-none shadow-sm border border-neutral-200 p-8 sm:p-12">
        {/* Page Title */}
        <div className="flex items-center gap-4 mb-10 pb-6 border-b border-neutral-100">
          <div className="flex h-12 w-12 items-center justify-center bg-[#121212] text-white">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-4xl font-serif font-normal tracking-tight text-neutral-900">Profile Settings</h1>
            <p className="text-sm text-neutral-500 font-medium mt-0.5">Manage your account information</p>
          </div>
        </div>

        {/* Profile Picture Section */}
        <div className="mb-10 pb-10 border-b border-neutral-200">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6">Profile Picture</h3>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="h-24 w-24 bg-neutral-50 rounded-full overflow-hidden border border-neutral-200 shadow-sm">
                <img
                  src={profileImageUrl || '/avatar.png'}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full cursor-pointer border-none outline-none"
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
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6">Basic Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full bg-neutral-50 border border-neutral-200 text-neutral-450 px-4 py-3 outline-none text-sm cursor-not-allowed rounded-none"
              />
            </div>
          </div>
        </div>

        {/* Password Change */}
        <div className="mb-10 pb-10 border-b border-neutral-200">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6">Change Password</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
              />
            </div>
          </div>
        </div>

        {/* Lawyer-Specific Fields */}
        {isLawyer && (
          <>
            {/* Lawyer Card Image */}
            <div className="mb-10 pb-10 border-b border-neutral-200">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6">Lawyer Card Image</h3>
              <p className="text-xs text-neutral-400 mb-4">This image is shown on your lawyer directory card. Separate from your profile picture.</p>
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <div className="h-32 w-24 bg-neutral-50 overflow-hidden border border-neutral-200 shadow-sm">
                    <img
                      src={lawyerProfileImageUrl || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'}
                      alt="Card"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => cardFileInputRef.current?.click()}
                    disabled={uploadingCard}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer border-none outline-none"
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
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6">Lawyer Profile Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Display Name</label>
                  <input
                    type="text"
                    value={lFullName}
                    onChange={(e) => setLFullName(e.target.value)}
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">NIC</label>
                  <input
                    type="text"
                    value={nic}
                    onChange={(e) => setNic(e.target.value)}
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Contact Phone</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Google Meet URL</label>
                  <input
                    type="url"
                    value={googleMeetLink}
                    onChange={(e) => setGoogleMeetLink(e.target.value)}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
                  />
                  <p className="text-xs text-neutral-400">Your clients will use this link for online consultations. Leave blank for physical-only sessions.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Years of Experience</label>
                  <input
                    type="number"
                    value={yearsOfExperience}
                    onChange={(e) => setYearsOfExperience(e.target.value)}
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Practice Type</label>
                  <select
                    value={practiceType}
                    onChange={(e) => setPracticeType(e.target.value)}
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
                  >
                    <option value="">Select</option>
                    {PRACTICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">District</label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
                  >
                    <option value="">Select</option>
                    {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Fee Range (LKR)</label>
                  <input
                    type="text"
                    value={baseFeeRange}
                    onChange={(e) => setBaseFeeRange(e.target.value)}
                    placeholder="e.g. 5000 - 15000"
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Latitude (Optional)</label>
                  <input
                    type="text"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 6.927079"
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Longitude (Optional)</label>
                  <input
                    type="text"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 79.861244"
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className="w-full bg-white border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all text-sm rounded-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Notary Toggle */}
            <div className="mb-10 pb-10 border-b border-neutral-200">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6">Additional</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isNotary}
                  onChange={(e) => setIsNotary(e.target.checked)}
                  className="w-4 h-4 accent-[#bfa37a]"
                />
                <span className="text-sm font-medium text-neutral-700">I am a registered Notary Public</span>
              </label>
            </div>

            {/* Practice Areas */}
            <div className="mb-10 pb-10 border-b border-neutral-200">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6">Practice Areas</h3>
              <div className="flex flex-wrap gap-2">
                {PRACTICE_AREAS.map(area => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleArrayItem(practiceAreas, setPracticeAreas, area)}
                    className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-200 border rounded-none focus:outline-none ${practiceAreas.includes(area)
                        ? 'bg-[#bfa37a] text-white border-[#bfa37a]'
                        : 'bg-transparent text-neutral-500 border-[#efeae0] hover:bg-[#faf8f6]'
                      }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div className="mb-10 pb-10 border-b border-neutral-200">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6">Languages</h3>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleArrayItem(languages, setLanguagesState, lang)}
                    className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-200 border rounded-none focus:outline-none ${languages.includes(lang)
                        ? 'bg-[#bfa37a] text-white border-[#bfa37a]'
                        : 'bg-transparent text-neutral-500 border-[#efeae0] hover:bg-[#faf8f6]'
                      }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Save Button */}
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2.5 bg-[#bfa37a] text-white px-8 py-4 font-bold uppercase tracking-widest text-xs hover:bg-[#a68d67] transition-all disabled:opacity-50 rounded-none border-none outline-none cursor-pointer"
          >
            {saving ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Save className="h-4.5 w-4.5" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
