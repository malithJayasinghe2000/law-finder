'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  User, Camera, Save, Loader2, Lock,
} from 'lucide-react';

const PRACTICE_AREAS = [
  'Criminal Law', 'Family Law', 'Property Law', 'Labor Law', 'Corporate Law',
  'Civil Law', 'Constitutional Law', 'Tax Law', 'Immigration Law',
  'Environmental Law', 'Intellectual Property', 'Human Rights',
];

const LANGUAGES = ['Sinhala', 'Tamil', 'English'];

const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar',
  'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee',
  'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla',
  'Monaragala', 'Ratnapura', 'Kegalle',
];

export default function DashboardProfileSettings() {
  const { locale } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCard, setUploadingCard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardFileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [role, setRole] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLawyer, setIsLawyer] = useState(false);
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

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) return;
      const data = await res.json();
      const u = data.user;
      setFullName(u.fullName || '');
      setEmail(u.email);
      setProfileImageUrl(u.profileImageUrl || '');
      setRole(u.role);

      if (u.role === 'LAWYER' && data.lawyerProfile) {
        setIsLawyer(true);
        const lp = data.lawyerProfile;
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
      toast.error('Failed to load profile.');
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
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const data = await res.json();
      if (isCard) { setLawyerProfileImageUrl(data.url); toast.success('Card image uploaded!'); }
      else { setProfileImageUrl(data.url); toast.success('Profile picture uploaded!'); }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed.');
    } finally {
      if (isCard) setUploadingCard(false);
      else setUploading(false);
    }
  };

  const handleSave = async () => {
    if (newPassword && newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    setSaving(true);
    try {
      const payload: any = { fullName, profileImageUrl: profileImageUrl || null };
      if (newPassword) { payload.currentPassword = currentPassword; payload.newPassword = newPassword; }
      if (isLawyer) {
        payload.lawyerProfile = {
          fullName: lFullName, bio, practiceAreas, languages, district,
          baseFeeRange, contactPhone, address, gender,
          yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
          practiceType, courts, isNotary, nic,
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
      toast.success('Profile updated!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayItem = (arr: string[], setter: (a: string[]) => void, item: string) => {
    setter(arr.includes(item) ? arr.filter(a => a !== item) : [...arr, item]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Profile Settings</h1>
          <p className="text-sm text-neutral-500 font-medium">Manage your account</p>
        </div>
      </div>

      {/* Profile Picture */}
      <div className="bg-white border border-neutral-200 p-6">
        <h3 className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest mb-4">Profile Picture</h3>
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="h-20 w-20 bg-neutral-100 overflow-hidden">
              <img src={profileImageUrl || '/avatar.png'} alt="Profile" className="h-full w-full object-cover" />
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadImage(file); }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">Upload photo</p>
            <p className="text-xs text-neutral-400 mt-1">JPG, PNG, WebP. Max 5MB.</p>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white border border-neutral-200 p-6">
        <h3 className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest mb-4">Account Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 focus:bg-white transition-all text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">Email</label>
            <input type="email" value={email} disabled
              className="w-full bg-neutral-100 border border-neutral-200 text-neutral-400 px-4 py-3 text-sm cursor-not-allowed" />
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="bg-white border border-neutral-200 p-6">
        <h3 className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Lock className="h-3.5 w-3.5" /> Change Password
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current"
            className="bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 focus:bg-white transition-all text-sm" />
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New"
            className="bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 focus:bg-white transition-all text-sm" />
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm"
            className="bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 focus:bg-white transition-all text-sm" />
        </div>
      </div>

      {/* Lawyer Fields */}
      {isLawyer && (
        <>
          <div className="bg-white border border-neutral-200 p-6">
            <h3 className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest mb-4">Card Image</h3>
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div className="h-24 w-20 bg-neutral-100 overflow-hidden">
                  <img src={lawyerProfileImageUrl || '/avatar.png'} alt="Card" className="h-full w-full object-cover" />
                </div>
                <button onClick={() => cardFileInputRef.current?.click()} disabled={uploadingCard}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  {uploadingCard ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Camera className="h-4 w-4 text-white" />}
                </button>
                <input ref={cardFileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadImage(file, true); }} />
              </div>
              <p className="text-xs text-neutral-400">Shown on your lawyer directory card.</p>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 p-6">
            <h3 className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest mb-4">Lawyer Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">Display Name</label>
                <input type="text" value={lFullName} onChange={(e) => setLFullName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">Phone</label>
                <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 text-sm">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">Experience (years)</label>
                <input type="number" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">District</label>
                <select value={district} onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 text-sm">
                  <option value="">Select</option>
                  {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">Fee Range</label>
                <input type="text" value={baseFeeRange} onChange={(e) => setBaseFeeRange(e.target.value)} placeholder="5000 - 15000"
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">NIC</label>
                <input type="text" value={nic} onChange={(e) => setNic(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">Practice Type</label>
                <select value={practiceType} onChange={(e) => setPracticeType(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 text-sm">
                  <option value="">Select</option>
                  <option value="Solo">Solo</option>
                  <option value="Firm">Law Firm</option>
                  <option value="Government">Government</option>
                  <option value="Corporate">Corporate</option>
                </select>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">Address</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 text-sm" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 outline-none focus:border-neutral-900 text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 p-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isNotary} onChange={(e) => setIsNotary(e.target.checked)} className="w-4 h-4 accent-neutral-900" />
              <span className="text-sm font-medium text-neutral-900">Registered Notary Public</span>
            </label>
          </div>

          <div className="bg-white border border-neutral-200 p-6">
            <h3 className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest mb-4">Practice Areas</h3>
            <div className="flex flex-wrap gap-2">
              {PRACTICE_AREAS.map(area => (
                <button key={area} type="button" onClick={() => toggleArrayItem(practiceAreas, setPracticeAreas, area)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${practiceAreas.includes(area) ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                  {area}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-neutral-200 p-6">
            <h3 className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest mb-4">Languages</h3>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(lang => (
                <button key={lang} type="button" onClick={() => toggleArrayItem(languages, setLanguagesState, lang)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${languages.includes(lang) ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-[#0a0a0a] text-white px-6 py-3 text-sm font-bold hover:bg-neutral-800 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
