'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  User, Camera, Save, Loader2, Lock,
} from 'lucide-react';

/**
 * The administrator's own account: name, photo, password.
 *
 * This page began as a copy of the attorney profile form; the attorney fields
 * (bio, NIC, practice areas, "directory card") could never render here, because
 * an admin account has no attorney profile. They were removed 2026-10-16 — the
 * attorneys' own page is dashboard/profile, unchanged.
 */
export default function AdminAccountSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
    } catch {
      toast.error('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const data = await res.json();
      setProfileImageUrl(data.url);
      toast.success('Profile picture uploaded!');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (newPassword && newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    setSaving(true);
    try {
      const payload: any = { fullName, profileImageUrl: profileImageUrl || null };
      if (newPassword) { payload.currentPassword = currentPassword; payload.newPassword = newPassword; }
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
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">My Account</h1>
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
        {/* The rules in src/schemas/auth.schema.ts (newPassword). */}
        <p className="mt-3 text-xs text-neutral-500">
          At least 8 characters, with an uppercase letter, a lowercase letter, a number and one
          of @ $ ! % * ? &amp;
        </p>
      </div>

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
