'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Image, Plus, Loader2, Trash2, Eye, EyeOff,
  Calendar, CheckCircle2, XCircle, Clock, Pause,
  BarChart3, MousePointerClick, TrendingUp,
  ChevronDown, ChevronUp, Search, Filter, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface Campaign {
  id: string;
  lawyerId: string;
  name: string;
  type: string;
  placement: string;
  status: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  targetUrl: string | null;
  ctaText: string | null;
  targetDistricts: string[];
  targetPracticeAreas: string[];
  startDate: string;
  endDate: string;
  totalBudget: number | null;
  dailyBudget: number | null;
  pricePerDay: number | null;
  impressions: number;
  clicks: number;
  adminNotes: string | null;
  rejectionReason: string | null;
  invoiceId: string | null;
  createdAt: string;
  lawyer: {
    id: string;
    fullName: string;
    baslNumber: string;
    district: string | null;
    profileImageUrl: string | null;
  };
}

interface Stats {
  total: number;
  active: number;
  pending: number;
  draft: number;
  paused: number;
  expired: number;
  rejected: number;
}

interface Lawyer {
  id: string;
  fullName: string;
  baslNumber: string;
}

const AD_TYPES = ['BANNER', 'SPONSORED_LISTING', 'FEATURED_PROFILE', 'IN_FEED', 'SIDEBAR'];
const AD_PLACEMENTS = ['HOMEPAGE_HERO', 'HOMEPAGE_MID', 'DIRECTORY_TOP', 'DIRECTORY_INLINE', 'BLOG_SIDEBAR', 'BLOG_FEED', 'BLOG_POST_BOTTOM'];
const AD_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'REJECTED'];

const DISTRICTS = ['Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya', 'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee', 'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle'];
const PRACTICE_AREAS = ['Criminal Law', 'Family Law', 'Property Law', 'Labor Law', 'Corporate Law', 'Civil Law', 'Constitutional Law', 'Tax Law', 'Immigration Law', 'Environmental Law', 'Intellectual Property', 'Human Rights'];

function formatLabel(str: string) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ctr(impressions: number, clicks: number) {
  if (impressions === 0) return '0.00';
  return ((clicks / impressions) * 100).toFixed(2);
}

const statusConfig: Record<string, { color: string; icon: any }> = {
  DRAFT: { color: 'bg-neutral-100 text-neutral-600 border-neutral-200', icon: Clock },
  PENDING_REVIEW: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  APPROVED: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2 },
  ACTIVE: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  PAUSED: { color: 'bg-orange-50 text-orange-700 border-orange-200', icon: Pause },
  EXPIRED: { color: 'bg-neutral-100 text-neutral-500 border-neutral-200', icon: Clock },
  REJECTED: { color: 'bg-red-50 text-red-600 border-red-200', icon: XCircle },
};

export default function AdvertisementsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [form, setForm] = useState({
    lawyerId: '',
    name: '',
    type: 'BANNER',
    placement: 'HOMEPAGE_HERO',
    title: '',
    description: '',
    imageUrl: '',
    targetUrl: '',
    ctaText: 'View Profile',
    targetDistricts: [] as string[],
    targetPracticeAreas: [] as string[],
    startDate: '',
    endDate: '',
    totalBudget: '',
    pricePerDay: '',
    status: 'DRAFT',
  });

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const url = filterStatus
        ? `/api/admin/ads?status=${filterStatus}`
        : '/api/admin/ads';
      const res = await fetch(url);
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      setStats(data.stats || null);
    } catch {
      toast.error('Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLawyers = async () => {
    try {
      const res = await fetch('/api/lawyers');
      const data = await res.json();
      const list = data.lawyers || data || [];
      setLawyers(
        Array.isArray(list)
          ? list.map((l: any) => ({ id: l.id, fullName: l.fullName, baslNumber: l.baslNumber }))
          : []
      );
    } catch {}
  };

  useEffect(() => {
    fetchCampaigns();
    fetchLawyers();
  }, [filterStatus]);

  const handleCreate = async () => {
    if (!form.lawyerId || !form.name || !form.startDate || !form.endDate) {
      return toast.error('Lawyer, campaign name, start date, and end date are required.');
    }
    setCreateLoading(true);
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success('Campaign created successfully.');
      setShowCreate(false);
      setForm({
        lawyerId: '', name: '', type: 'BANNER', placement: 'HOMEPAGE_HERO',
        title: '', description: '', imageUrl: '', targetUrl: '', ctaText: 'View Profile',
        targetDistricts: [], targetPracticeAreas: [], startDate: '', endDate: '',
        totalBudget: '', pricePerDay: '', status: 'DRAFT',
      });
      fetchCampaigns();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create campaign.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoading(`status-${id}`);
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed.');
      toast.success(`Campaign ${newStatus.toLowerCase().replace('_', ' ')}.`);
      fetchCampaigns();
    } catch {
      toast.error('Failed to update status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setActionLoading(`reject-${rejectId}`);
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rejectId, status: 'REJECTED', rejectionReason: rejectReason }),
      });
      if (!res.ok) throw new Error('Failed.');
      toast.success('Campaign rejected.');
      setRejectId(null);
      setRejectReason('');
      fetchCampaigns();
    } catch {
      toast.error('Failed to reject.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign permanently?')) return;
    setActionLoading(`delete-${id}`);
    try {
      const res = await fetch(`/api/admin/ads?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed.');
      toast.success('Campaign deleted.');
      fetchCampaigns();
    } catch {
      toast.error('Failed to delete.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateInvoice = async (id: string) => {
    setActionLoading(`invoice-${id}`);
    try {
      const res = await fetch('/api/admin/ads/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Invoice generated successfully.');
      fetchCampaigns();
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate invoice.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
            <Image className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Ad Campaigns</h1>
            <p className="text-sm text-neutral-500 font-medium">Manage lawyer advertisements & promotions</p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-[#0a0a0a] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wide"
        >
          <Plus className="w-3.5 h-3.5 mr-2" /> New Campaign
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-neutral-900' },
            { label: 'Active', value: stats.active, color: 'text-emerald-600' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
            { label: 'Draft', value: stats.draft, color: 'text-neutral-500' },
            { label: 'Paused', value: stats.paused, color: 'text-orange-600' },
            { label: 'Expired', value: stats.expired, color: 'text-neutral-400' },
            { label: 'Rejected', value: stats.rejected, color: 'text-red-500' },
          ].map((s) => (
            <Card key={s.label} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setFilterStatus(s.label === 'Total' ? '' : s.label.toUpperCase().replace(' ', '_'))}>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-neutral-400" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border rounded-md px-3 py-1.5 bg-white text-neutral-700 font-medium"
        >
          <option value="">All Statuses</option>
          {AD_STATUSES.map((s) => (
            <option key={s} value={s}>{formatLabel(s)}</option>
          ))}
        </select>
        {filterStatus && (
          <button onClick={() => setFilterStatus('')} className="text-xs text-blue-600 hover:underline">
            Clear filter
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white border border-neutral-200 p-6 space-y-5 animate-in fade-in duration-300">
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">Create New Campaign</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Lawyer */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Lawyer *</label>
              <select value={form.lawyerId} onChange={(e) => setForm({ ...form, lawyerId: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]">
                <option value="">Select Lawyer</option>
                {lawyers.map((l) => (
                  <option key={l.id} value={l.id}>{l.fullName} ({l.baslNumber})</option>
                ))}
              </select>
            </div>

            {/* Campaign Name */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Campaign Name *</label>
              <input type="text" placeholder="e.g. January Property Law Push" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
            </div>

            {/* Ad Type */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Ad Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]">
                {AD_TYPES.map((t) => (
                  <option key={t} value={t}>{formatLabel(t)}</option>
                ))}
              </select>
            </div>

            {/* Placement */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Placement *</label>
              <select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]">
                {AD_PLACEMENTS.map((p) => (
                  <option key={p} value={p}>{formatLabel(p)}</option>
                ))}
              </select>
            </div>

            {/* Ad Title */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Ad Title</label>
              <input type="text" placeholder="Headline text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
            </div>

            {/* CTA Text */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">CTA Button Text</label>
              <input type="text" placeholder="View Profile" value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
            </div>

            {/* Image URL */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Banner Image URL</label>
              <input type="text" placeholder="https://..." value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
            </div>

            {/* Target URL */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Target Link</label>
              <input type="text" placeholder="/lawyers/abc-123" value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
            </div>

            {/* Description */}
            <div className="md:col-span-3">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Description</label>
              <textarea placeholder="Ad body text..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] resize-none" />
            </div>

            <Separator className="md:col-span-3" />

            {/* Start Date */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Start Date *</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
            </div>

            {/* End Date */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">End Date *</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
            </div>

            {/* Price Per Day */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Price / Day (LKR)</label>
              <input type="number" placeholder="500" value={form.pricePerDay} onChange={(e) => setForm({ ...form, pricePerDay: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
            </div>

            {/* Total Budget */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Total Budget (LKR)</label>
              <input type="number" placeholder="15000" value={form.totalBudget} onChange={(e) => setForm({ ...form, totalBudget: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
            </div>

            {/* Initial Status */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Initial Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]">
                <option value="DRAFT">Draft</option>
                <option value="APPROVED">Approved</option>
                <option value="ACTIVE">Active</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} disabled={createLoading} className="bg-[#0a0a0a] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wide">
              {createLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Plus className="w-3 h-3 mr-2" />}
              Create Campaign
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-neutral-600">Cancel</Button>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {rejectId && (
        <div className="bg-red-50 border border-red-200 p-5 space-y-3 animate-in fade-in duration-200">
          <h3 className="text-xs font-bold text-red-800 uppercase tracking-wide">Reject Campaign</h3>
          <textarea
            placeholder="Reason for rejection (optional but recommended)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            className="w-full py-2.5 px-3 bg-white border border-red-200 text-sm text-neutral-900 outline-none focus:border-red-400 resize-none"
          />
          <div className="flex gap-2">
            <Button onClick={handleReject} disabled={actionLoading === `reject-${rejectId}`} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold">
              {actionLoading === `reject-${rejectId}` ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
              Confirm Rejection
            </Button>
            <Button variant="ghost" onClick={() => { setRejectId(null); setRejectReason(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Campaign List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white border border-neutral-200 animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white border border-neutral-200 p-12 text-center">
          <Image className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500 font-medium">No campaigns found.</p>
          <p className="text-xs text-neutral-400 mt-1">Create a new campaign to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const sc = statusConfig[campaign.status] || statusConfig.DRAFT;
            const StatusIcon = sc.icon;
            const isExpanded = expandedId === campaign.id;
            const daysLeft = Math.max(0, Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

            return (
              <div key={campaign.id} className="bg-white border border-neutral-200 overflow-hidden transition-shadow hover:shadow-sm">
                {/* Main Row */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : campaign.id)}
                >
                  {/* Preview */}
                  <div className="w-12 h-12 rounded bg-neutral-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {campaign.imageUrl ? (
                      <img src={campaign.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Image className="w-5 h-5 text-neutral-300" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-neutral-900 truncate">{campaign.name}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border ${sc.color} inline-flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" />
                        {formatLabel(campaign.status)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {campaign.lawyer.fullName} • {formatLabel(campaign.type)} • {formatLabel(campaign.placement)}
                    </p>
                  </div>

                  {/* Metrics */}
                  <div className="hidden sm:flex items-center gap-6 text-xs text-neutral-600">
                    <div className="text-center">
                      <p className="font-bold text-neutral-900">{campaign.impressions.toLocaleString()}</p>
                      <p className="text-[10px] text-neutral-400">Views</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-neutral-900">{campaign.clicks.toLocaleString()}</p>
                      <p className="text-[10px] text-neutral-400">Clicks</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-neutral-900">{ctr(campaign.impressions, campaign.clicks)}%</p>
                      <p className="text-[10px] text-neutral-400">CTR</p>
                    </div>
                    {campaign.status === 'ACTIVE' && (
                      <div className="text-center">
                        <p className="font-bold text-blue-600">{daysLeft}d</p>
                        <p className="text-[10px] text-neutral-400">Left</p>
                      </div>
                    )}
                  </div>

                  {/* Expand Arrow */}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                </div>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="border-t border-neutral-100 px-5 py-5 bg-neutral-50/50 space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      {/* Schedule */}
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Schedule</p>
                        <p className="text-neutral-700">
                          {new Date(campaign.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' → '}
                          {new Date(campaign.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>

                      {/* Budget */}
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Pricing</p>
                        <p className="text-neutral-700">
                          {campaign.pricePerDay ? `LKR ${campaign.pricePerDay}/day` : '—'}
                          {campaign.totalBudget ? ` • Budget: LKR ${campaign.totalBudget}` : ''}
                        </p>
                        {campaign.invoiceId && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-indigo-600 font-bold">
                            <FileText className="w-3 h-3" /> Invoice Generated
                          </div>
                        )}
                      </div>

                      {/* Targeting */}
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Targeting</p>
                        <p className="text-neutral-700">
                          {campaign.targetDistricts.length > 0 ? campaign.targetDistricts.join(', ') : 'All Districts'}
                          {' • '}
                          {campaign.targetPracticeAreas.length > 0 ? campaign.targetPracticeAreas.join(', ') : 'All Areas'}
                        </p>
                      </div>

                      {/* Creative */}
                      {campaign.title && (
                        <div className="md:col-span-2">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Creative</p>
                          <p className="font-semibold text-neutral-900">{campaign.title}</p>
                          {campaign.description && <p className="text-neutral-600 mt-0.5">{campaign.description}</p>}
                        </div>
                      )}

                      {/* Rejection Reason */}
                      {campaign.rejectionReason && (
                        <div className="md:col-span-3 bg-red-50 border border-red-200 p-3 rounded">
                          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Rejection Reason</p>
                          <p className="text-sm text-red-700">{campaign.rejectionReason}</p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      {/* Approve */}
                      {['DRAFT', 'PENDING_REVIEW'].includes(campaign.status) && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(campaign.id, 'APPROVED')}
                          disabled={actionLoading === `status-${campaign.id}`}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve
                        </Button>
                      )}

                      {/* Activate */}
                      {['APPROVED', 'PAUSED'].includes(campaign.status) && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(campaign.id, 'ACTIVE')}
                          disabled={actionLoading === `status-${campaign.id}`}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" /> Activate
                        </Button>
                      )}

                      {/* Pause */}
                      {campaign.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(campaign.id, 'PAUSED')}
                          disabled={actionLoading === `status-${campaign.id}`}
                          className="text-orange-600 border-orange-200 hover:bg-orange-50 text-xs font-bold"
                        >
                          <Pause className="w-3.5 h-3.5 mr-1.5" /> Pause
                        </Button>
                      )}

                      {/* Reject */}
                      {!['REJECTED', 'EXPIRED'].includes(campaign.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectId(campaign.id)}
                          className="text-red-600 border-red-200 hover:bg-red-50 text-xs font-bold"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                        </Button>
                      )}

                      {/* Generate Invoice */}
                      {!campaign.invoiceId && ['APPROVED', 'ACTIVE'].includes(campaign.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerateInvoice(campaign.id)}
                          disabled={actionLoading === `invoice-${campaign.id}`}
                          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-xs font-bold"
                        >
                          {actionLoading === `invoice-${campaign.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
                          Generate Invoice
                        </Button>
                      )}

                      {/* Delete */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(campaign.id)}
                        disabled={actionLoading === `delete-${campaign.id}`}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-bold ml-auto"
                      >
                        {actionLoading === `delete-${campaign.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
