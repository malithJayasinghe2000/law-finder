'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ShieldCheck, Search, CheckCircle2, XCircle, Loader2,
  User, Scale, Phone, MapPin, Globe, FileText, Camera, Briefcase,
  ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { RejectApplicationSchema } from '@/schemas/application.schema';

interface Application {
  id: string;
  userId: string;
  fullName: string;
  gender: string;
  phone: string;
  address: string;
  district: string;
  languages: string;
  bio: string;
  baslNumber: string;
  yearsOfExperience: string;
  practiceType: string;
  courts: string;
  isNotary: boolean;
  practiceAreas: string;
  licenseImage: string | null;
  identityImage: string | null;
  email: string;
  submittedAt: string;
  userCreatedAt: string;
  status: string;
}

export default function VerificationPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    fetch(`/api/admin/verification?search=${encodeURIComponent(search)}`)
      .then(res => res.json())
      .then(d => setApplications(d.applications || []))
      .catch(() => toast.error('Failed to load verification data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [search]);

  const handleApprove = async (id: string) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await fetch(`/api/applications/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.message || 'Attorney verified.');
      fetchData();
    } catch (err) {
      // The server says why: an incomplete application, or a BASL number
      // already on another profile. "Failed" alone left the admin guessing.
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to approve.', { duration: 10000 });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const parsed = RejectApplicationSchema.safeParse({ reason: rejectReason });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? 'A reason is required.');
    setActionLoading(`reject-${id}`);
    try {
      const res = await fetch(`/api/applications/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.message || 'Application rejected.');
      setRejectId(null);
      setRejectReason('');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to reject.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Verification</h1>
          <p className="text-sm text-neutral-500 font-medium">Review and verify pending lawyer applications</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-neutral-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by lawyer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] transition-colors placeholder:text-neutral-400"
          />
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wide">
          {applications.length} Application{applications.length !== 1 ? 's' : ''} Found
        </p>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white border border-neutral-200 animate-pulse" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white border border-neutral-200 p-12 text-center">
          <ShieldCheck className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500 font-medium">No pending verifications found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="bg-white border border-neutral-200 hover:shadow-sm transition-shadow">
              {/* Summary Row */}
              <div
                className="flex items-center justify-between gap-3 p-4 sm:p-5 cursor-pointer"
                onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 shrink-0 bg-neutral-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-neutral-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-neutral-900">{app.fullName}</p>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-neutral-500">BASL: {app.baslNumber}</span>
                      <span className="text-xs text-neutral-500 break-all">{app.email}</span>
                      <span className="text-xs text-neutral-500">{app.district}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 uppercase tracking-wider">Pending</span>
                  {expandedId === app.id ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === app.id && (
                <div className="border-t border-neutral-200 p-4 sm:p-6 space-y-6 animate-in fade-in duration-300">
                  {/* Profile Info */}
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <User className="w-3.5 h-3.5" /> Personal Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-neutral-50 border border-neutral-100 p-4 sm:p-5">
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Full Name</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">{app.fullName}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Gender</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">{app.gender}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Phone</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">{app.phone}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Email</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5 break-all">{app.email}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">District</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">{app.district}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Languages</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">{app.languages}</p>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Address</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">{app.address}</p>
                      </div>
                      {app.bio && (
                        <div className="sm:col-span-2 lg:col-span-3">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Bio</span>
                          <p className="text-sm text-neutral-700 mt-0.5">{app.bio}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Professional Info */}
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5" /> Professional Credentials
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-neutral-50 border border-neutral-100 p-4 sm:p-5">
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">BASL Number</span>
                        <p className="text-base font-bold text-neutral-900 mt-0.5">{app.baslNumber}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Experience</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">{app.yearsOfExperience} years</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Practice Type</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">{app.practiceType}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Courts</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">{app.courts}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Notary Status</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">{app.isNotary ? 'Sworn Notary Public' : 'Not a Notary'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Practice Areas</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">{app.practiceAreas}</p>
                      </div>
                    </div>
                  </div>

                  {/* Verification Documents */}
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" /> Verification Documents
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="bg-neutral-50 border border-neutral-100 p-5">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                          <Scale className="w-3 h-3" /> Attorney-at-Law ID card
                        </span>
                        {app.licenseImage ? (
                          <div className="mt-3 relative group cursor-pointer" onClick={() => setPreviewImage(app.licenseImage)}>
                            <img src={app.licenseImage} alt="Attorney-at-Law ID card" className="w-full h-48 object-contain bg-white border border-neutral-200" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-red-500 font-semibold mt-2">Not Uploaded</p>
                        )}
                      </div>
                      <div className="bg-neutral-50 border border-neutral-100 p-5">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                          <Camera className="w-3 h-3" /> Photo taken during the application
                        </span>
                        {app.identityImage ? (
                          <div className="mt-3 relative group cursor-pointer" onClick={() => setPreviewImage(app.identityImage)}>
                            <img src={app.identityImage} alt="Photo of the applicant" className="w-full h-48 object-contain bg-white border border-neutral-200" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-red-500 font-semibold mt-2">Not Captured</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-neutral-500 border-t border-neutral-100 pt-4">
                    <span>Submitted: {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
                    <span>Account Created: {new Date(app.userCreatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>

                  {/* Reject Panel */}
                  {rejectId === app.id && (
                    <div className="border border-red-200 bg-red-50/50 p-5 space-y-3">
                      <p className="text-xs font-bold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> Rejection Reason (Required)
                      </p>
                      <textarea
                        placeholder="Enter specific reason for rejection..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full min-h-[100px] px-4 py-3 bg-white border border-red-200 text-sm font-medium text-neutral-900 outline-none focus:border-red-400 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(app.id)}
                          disabled={!rejectReason.trim() || actionLoading !== null}
                          className="px-5 py-2.5 bg-red-600 text-white text-xs font-bold uppercase tracking-wide hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          {actionLoading === `reject-${app.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                          Confirm Rejection
                        </button>
                        <button
                          onClick={() => { setRejectId(null); setRejectReason(''); }}
                          className="px-5 py-2.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleApprove(app.id)}
                      disabled={actionLoading !== null}
                      className="flex-1 py-3 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-wide hover:bg-neutral-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {actionLoading === `approve-${app.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Approve & Verify
                    </button>
                    <button
                      onClick={() => setRejectId(rejectId === app.id ? null : app.id)}
                      disabled={actionLoading !== null}
                      className="px-6 py-3 border border-red-300 text-red-600 text-xs font-bold uppercase tracking-wide hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8" onClick={() => setPreviewImage(null)}>
          <div className="max-w-3xl max-h-[80vh] relative">
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[80vh] object-contain border-4 border-white" />
            <button onClick={() => setPreviewImage(null)} className="absolute -top-10 right-0 text-white text-sm font-bold hover:underline">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
