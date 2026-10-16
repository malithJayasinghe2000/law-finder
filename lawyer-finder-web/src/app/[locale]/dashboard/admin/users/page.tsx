'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Users, Search, Edit3, Key, ShieldCheck, ShieldOff,
  Loader2, X, CheckCircle2, User, Mail, MapPin, ChevronLeft, ChevronRight
} from 'lucide-react';
import { ADMIN_ROLE_EDIT_ENABLED, ADMIN_SET_PASSWORD_ENABLED } from '@/lib/admin/userTools';
import { AdminRevokeVerificationSchema } from '@/schemas/adminUser.schema';

interface PlatformUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'LAWYER' | 'CLIENT';
  createdAt: string;
  fullName: string | null;
  isVerified: boolean;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  baslNumber: string | null;
  profileId: string | null;
  applicationStatus: string | null;
  accountStatus: 'ACTIVE' | 'DEACTIVATED' | 'ERASED';
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Edit modal state
  const [editUser, setEditUser] = useState<PlatformUser | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');

  // Withdraw-verification modal state
  const [revokeUser, setRevokeUser] = useState<PlatformUser | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  // Password modal state
  const [passwordUser, setPasswordUser] = useState<PlatformUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (roleFilter !== 'ALL') params.set('role', roleFilter);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);

    fetch(`/api/admin/users?${params.toString()}`)
      .then(res => res.json())
      .then(d => setUsers(d.users || []))
      .catch(() => toast.error('Failed to load users.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPage(1);
    fetchUsers();
  }, [search, roleFilter, statusFilter]);

  const handleUpdateDetails = async () => {
    if (!editUser) return;
    setActionLoading('edit');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: editUser.id, 
          action: 'update-details', 
          email: editEmail, 
          ...(ADMIN_ROLE_EDIT_ENABLED ? { role: editRole } : {}),
          latitude: editUser.role === 'LAWYER' ? editLatitude : undefined,
          longitude: editUser.role === 'LAWYER' ? editLongitude : undefined
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.message || 'User details updated.');
      setEditUser(null);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update.');
    } finally {
      setActionLoading(null);
    }
  };

  // The person chooses their own password from the emailed link.
  const handleSendReset = async () => {
    if (!passwordUser) return;
    setActionLoading('password');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: passwordUser.id, action: 'send-password-reset' }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.message);
      setPasswordUser(null);
    } catch (e: any) {
      toast.error(e.message || 'Could not send the link.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordUser) return;
    if (newPassword.length < 6) return toast.error('Password must be at least 6 characters.');
    setActionLoading('password');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: passwordUser.id, action: 'update-password', password: newPassword }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success('Password updated.');
      setPasswordUser(null);
      setNewPassword('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update password.');
    } finally {
      setActionLoading(null);
    }
  };

  // Withdraw only. Verification is granted from an application on the
  // Verification page, never here.
  const handleRevokeVerification = async () => {
    if (!revokeUser) return;
    const parsed = AdminRevokeVerificationSchema.safeParse({ userId: revokeUser.id, action: 'revoke-verification', reason: revokeReason });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? 'A reason is required.');
    setActionLoading('revoke');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.message);
      setRevokeUser(null);
      setRevokeReason('');
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || 'Could not withdraw verification.');
    } finally {
      setActionLoading(null);
    }
  };

  const roleColor = (role: string) => {
    if (role === 'ADMIN') return 'bg-[#0a0a0a] text-white';
    if (role === 'LAWYER') return 'bg-neutral-100 text-neutral-800 border border-neutral-300';
    return 'bg-neutral-50 text-neutral-600 border border-neutral-200';
  };

  // The account's real state first; a lawyer's verification only on an active account.
  const statusBadge = (user: PlatformUser) => {
    if (user.accountStatus !== 'ACTIVE') {
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 border bg-neutral-100 text-neutral-600 border-neutral-300">
          {user.accountStatus === 'ERASED' ? 'Erased' : 'Deactivated'}
        </span>
      );
    }
    if (user.role === 'LAWYER') {
      return (
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 border ${user.isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          {user.isVerified ? 'Verified' : 'Unverified'}
        </span>
      );
    }
    return <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 text-neutral-500 border border-neutral-200">Active</span>;
  };

  // An erased account was anonymised under a data request: nothing to edit.
  const renderActions = (user: PlatformUser) => user.accountStatus === 'ERASED' ? (
      <p className="text-right text-[11px] text-neutral-400">No actions</p>
    ) : (
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => { 
            setEditUser(user); 
            setEditEmail(user.email); 
            setEditRole(user.role); 
            setEditLatitude(user.latitude?.toString() || '');
            setEditLongitude(user.longitude?.toString() || '');
          }}
          title="Edit Details"
          className="p-2 hover:bg-neutral-100 transition-colors text-neutral-500 hover:text-neutral-900"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => { setPasswordUser(user); setNewPassword(''); }}
          title={ADMIN_SET_PASSWORD_ENABLED ? 'Change Password' : 'Send password reset link'}
          className="p-2 hover:bg-neutral-100 transition-colors text-neutral-500 hover:text-neutral-900"
        >
          <Key className="w-3.5 h-3.5" />
        </button>
        {user.role === 'LAWYER' && user.isVerified && (
          <button
            onClick={() => { setRevokeUser(user); setRevokeReason(''); }}
            title="Withdraw verification"
            className="p-2 transition-colors text-red-600 hover:bg-red-50"
          >
            <ShieldOff className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
  );

  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(users.length / limit));
  const paginatedUsers = users.slice((page - 1) * limit, page * limit);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">User Management</h1>
          <p className="text-sm text-neutral-500 font-medium">Manage all platform users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-neutral-200 p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] transition-colors placeholder:text-neutral-400"
            />
          </div>
          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider shrink-0">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] min-w-[130px]"
            >
              <option value="ALL">All Roles</option>
              <option value="CLIENT">Client</option>
              <option value="LAWYER">Lawyer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] min-w-[130px]"
            >
              <option value="ALL">All Status</option>
              <option value="VERIFIED">Verified</option>
              <option value="UNVERIFIED">Unverified</option>
            </select>
          </div>
        </div>
      </div>

      {/* Count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wide">
          {users.length} User{users.length !== 1 ? 's' : ''} Found
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white border border-neutral-200 animate-pulse" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white border border-neutral-200 p-12 text-center">
          <Users className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500 font-medium">No users found.</p>
        </div>
      ) : (
        <>
        {/* Phones: one card per person, every action reachable. */}
        <ul className="md:hidden space-y-3">
          {paginatedUsers.map((user) => (
            <li key={user.id} className="bg-white border border-neutral-200 p-4" data-user-card>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{user.fullName || 'No name'}</p>
                  <p className="text-[11px] text-neutral-500 break-all">{user.email}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${roleColor(user.role)}`}>{user.role}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-neutral-500">
                {statusBadge(user)}
                {user.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{user.district}</span>}
                <span>Joined {new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="mt-3 border-t border-neutral-100 pt-2">{renderActions(user)}</div>
            </li>
          ))}
        </ul>

        <div className="hidden md:block bg-white border border-neutral-200 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">User</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">District</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Joined</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-neutral-100 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-neutral-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{user.fullName || 'No name'}</p>
                        <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 ${roleColor(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {statusBadge(user)}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-neutral-700 font-medium flex items-center gap-1.5">
                      {user.district ? (
                        <>
                          <MapPin className="w-3 h-3 text-neutral-400" />
                          {user.district}
                        </>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-neutral-600 font-medium">
                      {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {renderActions(user)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page === 1} 
            className="flex items-center justify-center border border-neutral-250 hover:bg-neutral-50 px-3 py-1.5 rounded-none disabled:opacity-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-neutral-600">Page {page} of {totalPages}</span>
          <button 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
            disabled={page === totalPages} 
            className="flex items-center justify-center border border-neutral-250 hover:bg-neutral-50 px-3 py-1.5 rounded-none disabled:opacity-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setEditUser(null)}>
          <div className="bg-white w-full max-w-md border border-neutral-200 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-neutral-200">
              <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">Edit User Details</h3>
              <button onClick={() => setEditUser(null)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
                />
              </div>
              {/* Off: see src/lib/admin/userTools.ts. */}
              {ADMIN_ROLE_EDIT_ENABLED && (
              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
                >
                  <option value="CLIENT">Client</option>
                  <option value="LAWYER">Lawyer</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              )}
              {editUser.role === 'LAWYER' && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Latitude (Optional)</label>
                    <input
                      type="text"
                      value={editLatitude}
                      onChange={(e) => setEditLatitude(e.target.value)}
                      placeholder="e.g. 6.927079"
                      className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Longitude (Optional)</label>
                    <input
                      type="text"
                      value={editLongitude}
                      onChange={(e) => setEditLongitude(e.target.value)}
                      placeholder="e.g. 79.861244"
                      className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-neutral-200">
              <button onClick={() => setEditUser(null)} className="px-5 py-2.5 text-xs font-bold text-neutral-600 hover:text-neutral-900">
                Cancel
              </button>
              <button
                onClick={handleUpdateDetails}
                disabled={actionLoading === 'edit'}
                className="px-5 py-2.5 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-wide hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading === 'edit' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Verification Modal */}
      {revokeUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 sm:p-6" onClick={() => setRevokeUser(null)}>
          <div className="bg-white w-full max-w-md border border-neutral-200 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-neutral-200">
              <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">Withdraw verification</h3>
              <button onClick={() => setRevokeUser(null)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-neutral-600">
                <span className="font-bold text-neutral-900">{revokeUser.fullName || revokeUser.email}</span> will no longer be
                shown as verified or listed. They are emailed the reason. Verification can only be granted again from an application.
              </p>
              <div>
                <label htmlFor="revoke-reason" className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Reason (sent to the attorney)</label>
                <textarea
                  id="revoke-reason"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  rows={3}
                  className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-neutral-200">
              <button onClick={() => setRevokeUser(null)} className="px-5 py-2.5 text-xs font-bold text-neutral-600 hover:text-neutral-900">
                Cancel
              </button>
              <button
                onClick={handleRevokeVerification}
                disabled={actionLoading === 'revoke'}
                className="px-5 py-2.5 bg-red-600 text-white text-xs font-bold uppercase tracking-wide hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading === 'revoke' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldOff className="w-3 h-3" />}
                Withdraw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setPasswordUser(null)}>
          <div className="bg-white w-full max-w-md border border-neutral-200 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-neutral-200">
              <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">{ADMIN_SET_PASSWORD_ENABLED ? 'Change Password' : 'Password reset'}</h3>
              <button onClick={() => setPasswordUser(null)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            {!ADMIN_SET_PASSWORD_ENABLED ? (
              <>
                <div className="p-5 space-y-3">
                  <p className="text-xs text-neutral-600">
                    Email <span className="font-bold text-neutral-900 break-all">{passwordUser.email}</span> a link to choose a
                    new password. It works once, for one hour. You never see or set their password.
                  </p>
                </div>
                <div className="flex justify-end gap-2 p-5 border-t border-neutral-200">
                  <button onClick={() => setPasswordUser(null)} className="px-5 py-2.5 text-xs font-bold text-neutral-600 hover:text-neutral-900">
                    Cancel
                  </button>
                  <button
                    onClick={handleSendReset}
                    disabled={actionLoading === 'password'}
                    className="px-5 py-2.5 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-wide hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {actionLoading === 'password' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                    Send reset link
                  </button>
                </div>
              </>
            ) : (<>
            <div className="p-5 space-y-4">
              <p className="text-xs text-neutral-500 font-medium">
                Changing password for: <span className="font-bold text-neutral-900">{passwordUser.email}</span>
              </p>
              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-neutral-200">
              <button onClick={() => setPasswordUser(null)} className="px-5 py-2.5 text-xs font-bold text-neutral-600 hover:text-neutral-900">
                Cancel
              </button>
              <button
                onClick={handleUpdatePassword}
                disabled={actionLoading === 'password' || newPassword.length < 6}
                className="px-5 py-2.5 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-wide hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading === 'password' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
                Update Password
              </button>
            </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
