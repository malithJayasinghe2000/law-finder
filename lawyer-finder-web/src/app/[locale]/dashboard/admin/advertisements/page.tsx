'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Image as ImageIcon, Plus, Loader2, Trash2, Eye,
  CheckCircle2, XCircle, Clock, Pause, Settings,
  ChevronDown, ChevronUp, Filter, FileText, ImagePlus
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import FieldError from '@/components/ui/FieldError';
import {
  AD_TYPES,
  PLACEMENT_DETAILS,
  AdminCreateAdSchema,
  formatZodFieldErrors,
  getComputedTotalBudget,
  getPlacementsForType,
  isImageRequiredType,
  formatAdLabel,
  type AdPlacementValue,
  type AdTypeValue,
  type PlacementConfigClient,
} from '@/schemas/ad.schema';

interface Campaign {
  id: string;
  advertiserId: string;
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
  advertiser: {
    id: string;
    name: string;
    category: string;
    logoUrl: string | null;
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

interface Advertiser {
  id: string;
  name: string;
  category: string;
}

interface AdvertiserApiItem {
  id: string;
  name: string;
  category: string;
}

const AD_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'REJECTED'];

const statusConfig: Record<string, { color: string; icon: LucideIcon }> = {
  DRAFT: { color: 'bg-neutral-100 text-neutral-600 border-neutral-200', icon: Clock },
  PENDING_REVIEW: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  APPROVED: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2 },
  ACTIVE: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  PAUSED: { color: 'bg-orange-50 text-orange-700 border-orange-200', icon: Pause },
  EXPIRED: { color: 'bg-neutral-100 text-neutral-500 border-neutral-200', icon: Clock },
  REJECTED: { color: 'bg-red-50 text-red-600 border-red-200', icon: XCircle },
};

export default function AdvertisementsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string || 'en';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [configs, setConfigs] = useState<PlacementConfigClient[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<PlacementConfigClient | null>(null);
  
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    advertiserId: '',
    name: '',
    type: 'BANNER_IMAGE' as AdTypeValue,
    placement: 'HOMEPAGE_BELOW_HERO' as AdPlacementValue,
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

  const validPlacements = selectedConfig ? [selectedConfig.placement] : configs.map(c => c.placement);
  const placementDetails = PLACEMENT_DETAILS[form.placement];
  const imageRequired = isImageRequiredType(form.type);
  const computedTotalBudget = getComputedTotalBudget(form.pricePerDay || selectedConfig?.pricePerDay, form.startDate, form.endDate);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/admin/ad-config');
      const data = await res.json();
      setConfigs(data.configs || []);
      if (data.configs && data.configs.length > 0) {
        const firstConf = data.configs[0] as PlacementConfigClient;
        setSelectedConfig(firstConf);
        setForm(prev => ({
          ...prev,
          placement: firstConf.placement,
          type: firstConf.allowedAdTypes[0] || 'BANNER_IMAGE',
          pricePerDay: String(firstConf.pricePerDay),
        }));
      }
    } catch {
      toast.error('Failed to load ad placement configurations.');
    }
  };

  const updateForm = (field: keyof typeof form, value: any) => {
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      
      if (field === 'type') {
        const compatibleConfigs = configs.filter(c => c.allowedAdTypes.includes(value));
        if (compatibleConfigs.length > 0) {
          updated.placement = compatibleConfigs[0].placement;
          setSelectedConfig(compatibleConfigs[0]);
          updated.pricePerDay = String(compatibleConfigs[0].pricePerDay);
        }
      }

      if (field === 'placement') {
        const conf = configs.find(c => c.placement === value);
        if (conf) {
          setSelectedConfig(conf);
          updated.pricePerDay = String(conf.pricePerDay);
          if (!conf.allowedAdTypes.includes(updated.type)) {
            updated.type = conf.allowedAdTypes[0] || 'BANNER_IMAGE';
          }
        }
      }

      return updated;
    });
  };

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

  // Only advertisers that have been confirmed non-legal can be given a
  // campaign. See docs/restructure/LEGAL-GUARDRAILS.md (rule 3).
  const fetchAdvertisers = async () => {
    try {
      const res = await fetch('/api/admin/advertisers?status=ACTIVE&limit=50');
      const data = await res.json();
      const list = (data.advertisers || []).filter((a: any) => a.nonLegalConfirmed);
      setAdvertisers(
        Array.isArray(list)
          ? list.map((a: AdvertiserApiItem) => ({ id: a.id, name: a.name, category: a.category }))
          : []
      );
    } catch {}
  };

  useEffect(() => {
    fetchCampaigns();
    fetchAdvertisers();
    fetchConfigs();
  }, [filterStatus]);

  const handleImageUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be under 5MB.');
        return;
      }

      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
          setForm(prev => ({ ...prev, imageUrl: data.url }));
          toast.success('Banner image uploaded!');
        } else {
          toast.error(data.error || 'Upload failed.');
        }
      } catch {
        toast.error('Upload failed.');
      } finally {
        setUploadingImage(false);
      }
    };
    input.click();
  };

  const handleCreate = async () => {
    const dataToSend = {
      ...form,
      pricePerDay: Number(form.pricePerDay),
    };
    const parsed = AdminCreateAdSchema.safeParse(dataToSend);
    if (!parsed.success) {
      setFormErrors(formatZodFieldErrors(parsed.error));
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setFormErrors({});
    setCreateLoading(true);
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.fieldErrors) setFormErrors(result.fieldErrors);
        throw new Error(result.error);
      }
      toast.success('Campaign created successfully.');
      setShowCreate(false);
      setForm({
        advertiserId: '', name: '', type: 'BANNER_IMAGE', placement: 'HOMEPAGE_BELOW_HERO',
        title: '', description: '', imageUrl: '', targetUrl: '', ctaText: 'View Profile',
        targetDistricts: [], targetPracticeAreas: [], startDate: '', endDate: '',
        totalBudget: '', pricePerDay: String(selectedConfig?.pricePerDay || 2000), status: 'DRAFT',
      });
      fetchCampaigns();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create campaign.');
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed.');
      toast.success(`Campaign ${newStatus.toLowerCase().replace('_', ' ')}.`);
      fetchCampaigns();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status.');
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

  // Ad invoicing was removed in Phase 4 along with attorney advertising.
  //
  // It created an Invoice against the campaign owner's LawyerProfile. Campaigns
  // belong to non-legal advertisers now, and the Invoice model is keyed to a
  // lawyer because it exists for firm subscriptions. Advertisers are billed
  // outside the platform until there is a proper advertiser billing module.


  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Ad Campaigns</h1>
            <p className="text-sm text-neutral-500 font-medium">Campaigns from non-legal advertisers. Attorneys cannot advertise here.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/${locale}/dashboard/admin/ad-config`)}
            className="text-xs font-bold uppercase tracking-wide"
          >
            <Settings className="w-3.5 h-3.5 mr-2" /> Configure Placements
          </Button>
          <Button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-[#0a0a0a] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wide"
          >
            <Plus className="w-3.5 h-3.5 mr-2" /> New Campaign
          </Button>
        </div>
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
            <option key={s} value={s}>{formatAdLabel(s)}</option>
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

          <div className="space-y-6">
            <section className="space-y-3">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-900">1. Ad Format</h4>
                <p className="text-xs text-neutral-500">Choose the campaign type first so placement options stay compatible.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Advertiser *</label>
                  <select value={form.advertiserId} onChange={(e) => updateForm('advertiserId', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]">
                    <option value="">Select advertiser</option>
                    {advertisers.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <FieldError message={formErrors.advertiserId} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Placement *</label>
                  <select value={form.placement} onChange={(e) => updateForm('placement', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]">
                    {configs.map((c) => (
                      <option key={c.placement} value={c.placement}>{c.displayName}</option>
                    ))}
                  </select>
                  <FieldError message={formErrors.placement} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Ad Type *</label>
                  <select value={form.type} onChange={(e) => updateForm('type', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]">
                    {selectedConfig?.allowedAdTypes.map((t) => (
                      <option key={t} value={t}>{formatAdLabel(t)}</option>
                    ))}
                  </select>
                  <FieldError message={formErrors.type} />
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-900">2. Creative Content</h4>
                <p className="text-xs text-neutral-500">Upload the advertiser's own creative. Nothing here may show an attorney.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Campaign Name *</label>
                  <input type="text" placeholder="e.g. January Property Law Push" value={form.name} onChange={(e) => updateForm('name', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
                  <FieldError message={formErrors.name} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Ad Title {form.type === 'BANNER_IMAGE' ? '*' : ''}</label>
                  <input type="text" placeholder="Headline text" value={form.title} onChange={(e) => updateForm('title', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
                  <FieldError message={formErrors.title} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">CTA Button Text</label>
                  <input type="text" placeholder="View Profile" value={form.ctaText} onChange={(e) => updateForm('ctaText', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
                  <FieldError message={formErrors.ctaText} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Banner Image {imageRequired ? '*' : ''}</label>
                  {imageRequired || form.imageUrl ? (
                    form.imageUrl ? (
                      <div className="relative rounded overflow-hidden border border-neutral-200 h-[42px]">
                        <img src={form.imageUrl} alt="Banner" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => updateForm('imageUrl', '')} className="absolute top-1 right-1 bg-black/60 text-white px-2 py-0.5 rounded-sm text-[10px] hover:bg-black/80 transition-colors">Remove</button>
                      </div>
                    ) : (
                      <button type="button" onClick={handleImageUpload} disabled={uploadingImage} className="flex items-center justify-center gap-2 w-full h-[42px] bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-500 hover:border-[#0a0a0a] hover:text-neutral-900 transition-colors rounded-sm">
                        {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                        {uploadingImage ? 'Uploading...' : 'Upload Image'}
                      </button>
                    )
                  ) : (
                    <div className="min-h-[42px] flex items-center px-3 bg-neutral-50 border border-neutral-200 text-sm text-neutral-500">
                      The advertiser's logo is used when no creative is uploaded.
                    </div>
                  )}
                  <FieldError message={formErrors.imageUrl} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Target Link</label>
                  <input type="text" placeholder="/lawyers/abc-123" value={form.targetUrl} onChange={(e) => updateForm('targetUrl', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
                  <FieldError message={formErrors.targetUrl} />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Description</label>
                  <textarea placeholder="Ad body text..." value={form.description} onChange={(e) => updateForm('description', e.target.value)} rows={2} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] resize-none" />
                  <FieldError message={formErrors.description} />
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-900">3. Schedule & Budget</h4>
                <p className="text-xs text-neutral-500">Set the daily rate; the total is calculated from the campaign dates.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Start Date *</label>
                  <input type="date" value={form.startDate} onChange={(e) => updateForm('startDate', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
                  <FieldError message={formErrors.startDate} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">End Date *</label>
                  <input type="date" value={form.endDate} onChange={(e) => updateForm('endDate', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
                  <FieldError message={formErrors.endDate} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Price / Day (LKR) *</label>
                  <input type="number" min="0" placeholder="500" value={form.pricePerDay} onChange={(e) => updateForm('pricePerDay', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
                  <FieldError message={formErrors.pricePerDay} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Computed Total</label>
                  <div className="w-full py-2.5 px-3 bg-neutral-100 border border-neutral-200 text-sm font-bold text-neutral-900 min-h-[42px]">
                    {computedTotalBudget ? `LKR ${computedTotalBudget.toLocaleString()}` : 'Set dates and rate'}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Initial Status</label>
                  <select value={form.status} onChange={(e) => updateForm('status', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]">
                    <option value="DRAFT">Draft</option>
                    <option value="APPROVED">Approved</option>
                    <option value="ACTIVE">Active</option>
                  </select>
                  <FieldError message={formErrors.status} />
                </div>
              </div>
            </section>
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
          <ImageIcon className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
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
                  <div className="w-12 h-12 rounded bg-neutral-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {campaign.imageUrl ? (
                      <img src={campaign.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-neutral-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-neutral-900 truncate">{campaign.name}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border ${sc.color} inline-flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" />
                        {formatAdLabel(campaign.status)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {campaign.advertiser.name} • {formatAdLabel(campaign.type)} • {formatAdLabel(campaign.placement)}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-6 text-xs text-neutral-600">
                    <div className="text-center">
                      <p className="font-bold text-neutral-900">{campaign.impressions.toLocaleString()}</p>
                      <p className="text-[10px] text-neutral-400">Views</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-neutral-900">{campaign.clicks.toLocaleString()}</p>
                      <p className="text-[10px] text-neutral-400">Clicks</p>
                    </div>
                    {campaign.status === 'ACTIVE' && (
                      <div className="text-center">
                        <p className="font-bold text-blue-600">{daysLeft}d</p>
                        <p className="text-[10px] text-neutral-400">Left</p>
                      </div>
                    )}
                  </div>

                  {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                </div>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="border-t border-neutral-100 px-5 py-5 bg-neutral-50/50 space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Schedule</p>
                        <p className="text-neutral-700">
                          {new Date(campaign.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' → '}
                          {new Date(campaign.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>

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

                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Targeting</p>
                        <p className="text-neutral-700">
                          {campaign.targetDistricts.length > 0 ? campaign.targetDistricts.join(', ') : 'All Districts'}
                          {' • '}
                          {campaign.targetPracticeAreas.length > 0 ? campaign.targetPracticeAreas.join(', ') : 'All Areas'}
                        </p>
                      </div>

                      {campaign.title && (
                        <div className="md:col-span-2">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Creative</p>
                          <p className="font-semibold text-neutral-900">{campaign.title}</p>
                          {campaign.description && <p className="text-neutral-600 mt-0.5">{campaign.description}</p>}
                        </div>
                      )}

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
