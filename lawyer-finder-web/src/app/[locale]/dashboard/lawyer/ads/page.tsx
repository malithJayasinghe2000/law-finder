'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Image as ImageIcon, Plus, Loader2, Eye, Pause, Play,
  Calendar, CheckCircle2, Send,
  MousePointerClick, TrendingUp,
  ChevronDown, ChevronUp, ArrowRight, Megaphone, ImagePlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import FieldError from '@/components/ui/FieldError';
import {
  AD_TYPES,
  PLACEMENT_DETAILS,
  LawyerCreateAdSchema,
  formatZodFieldErrors,
  getPlacementsForType,
  isImageRequiredType,
  type AdPlacementValue,
} from '@/schemas/ad.schema';

interface Campaign {
  id: string;
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
  pricePerDay: number | null;
  pausedBy: string | null;
  impressions: number;
  clicks: number;
  rejectionReason: string | null;
  createdAt: string;
  analytics: { date: string; impressions: number; clicks: number }[];
}

interface Stats {
  total: number;
  active: number;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: string;
}

function formatLabel(str: string) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ctr(impressions: number, clicks: number) {
  if (impressions === 0) return '0.00';
  return ((clicks / impressions) * 100).toFixed(2);
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  DRAFT: { color: 'text-neutral-600', bg: 'bg-neutral-100 border-neutral-200', label: 'Draft' },
  PENDING_REVIEW: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Pending Review' },
  APPROVED: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'Approved' },
  ACTIVE: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Live' },
  PAUSED: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'Paused' },
  EXPIRED: { color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200', label: 'Expired' },
  REJECTED: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Rejected' },
};

export default function LawyerAdsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: '',
    type: 'SPONSORED_LISTING',
    placement: 'DIRECTORY_TOP',
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
  });

  const validPlacements = getPlacementsForType(form.type);
  const placementDetails = PLACEMENT_DETAILS[form.placement as AdPlacementValue];
  const imageRequired = isImageRequiredType(form.type);

  const updateForm = (field: keyof typeof form, value: string) => {
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

    setForm((prev) => {
      if (field === 'type') {
        const [nextPlacement] = getPlacementsForType(value);
        return { ...prev, type: value, placement: nextPlacement || prev.placement };
      }
      return { ...prev, [field]: value };
    });
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lawyer/ads');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      setStats(data.stats || null);
    } catch {
      toast.error('Failed to load your campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

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
    const parsed = LawyerCreateAdSchema.safeParse(form);
    if (!parsed.success) {
      setFormErrors(formatZodFieldErrors(parsed.error));
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setFormErrors({});
    setCreateLoading(true);
    try {
      const res = await fetch('/api/lawyer/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.fieldErrors) setFormErrors(result.fieldErrors);
        throw new Error(result.error);
      }
      toast.success('Campaign submitted for review!');
      setShowCreate(false);
      setForm({
        name: '', type: 'SPONSORED_LISTING', placement: 'DIRECTORY_TOP',
        title: '', description: '', imageUrl: '', targetUrl: '', ctaText: 'View Profile',
        targetDistricts: [], targetPracticeAreas: [], startDate: '', endDate: '',
        totalBudget: '',
      });
      fetchCampaigns();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create campaign.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/lawyer/ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.message || 'Campaign updated.');
      fetchCampaigns();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update campaign.');
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
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">My Ad Campaigns</h1>
            <p className="text-sm text-neutral-500 font-medium">Promote your profile and gain more clients</p>
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total Campaigns', value: stats.total, icon: Megaphone, color: 'text-neutral-900' },
            { label: 'Active Now', value: stats.active, icon: CheckCircle2, color: 'text-emerald-600' },
            { label: 'Total Views', value: stats.totalImpressions.toLocaleString(), icon: Eye, color: 'text-blue-600' },
            { label: 'Total Clicks', value: stats.totalClicks.toLocaleString(), icon: MousePointerClick, color: 'text-purple-600' },
            { label: 'Avg. CTR', value: `${stats.avgCtr}%`, icon: TrendingUp, color: 'text-amber-600' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className="w-4 h-4 text-neutral-400" />
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{s.label}</p>
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* How It Works */}
      {campaigns.length === 0 && !loading && !showCreate && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-8 text-center space-y-4">
          <Megaphone className="w-12 h-12 text-blue-500 mx-auto" />
          <h2 className="text-xl font-bold text-neutral-900">Grow Your Practice with Ads</h2>
          <p className="text-sm text-neutral-600 max-w-lg mx-auto">
            Create an ad campaign to appear at the top of search results, on the homepage, or alongside blog posts. 
            Reach thousands of potential clients looking for legal services.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-neutral-500 pt-2">
            <div className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">1</span> Create Campaign</div>
            <ArrowRight className="w-3 h-3" />
            <div className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-[10px]">2</span> Admin Reviews</div>
            <ArrowRight className="w-3 h-3" />
            <div className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[10px]">3</span> Goes Live!</div>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-[#0a0a0a] hover:bg-neutral-800 text-white mt-2">
            <Plus className="w-4 h-4 mr-2" /> Create Your First Campaign
          </Button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white border border-neutral-200 p-6 space-y-5 animate-in fade-in duration-300">
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">Create New Campaign</h3>
          <p className="text-sm text-neutral-500">Your campaign will be reviewed by our team before it goes live. This usually takes 24-48 hours.</p>

          <div className="space-y-6">
            <section className="space-y-3">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-900">1. Ad Format</h4>
                <p className="text-xs text-neutral-500">Pick a format to see only the placements that fit that ad.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Ad Type *</label>
                  <select value={form.type} onChange={(e) => updateForm('type', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]">
                    {AD_TYPES.map((t) => (
                      <option key={t} value={t}>{formatLabel(t)}</option>
                    ))}
                  </select>
                  <FieldError message={formErrors.type} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Placement *</label>
                  <select value={form.placement} onChange={(e) => updateForm('placement', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]">
                    {validPlacements.map((p) => (
                      <option key={p} value={p}>{formatLabel(p)}</option>
                    ))}
                  </select>
                  {placementDetails && (
                    <p className="text-[11px] text-neutral-500 mt-1">{placementDetails.description} • {placementDetails.dimensions}</p>
                  )}
                  <FieldError message={formErrors.placement} />
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-900">2. Creative Content</h4>
                <p className="text-xs text-neutral-500">For sponsored listings and featured profiles, your profile photo is used automatically.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Campaign Name *</label>
                  <input type="text" placeholder="e.g. January Criminal Law Push" value={form.name} onChange={(e) => updateForm('name', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
                  <FieldError message={formErrors.name} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Ad Headline {form.type === 'BANNER' ? '*' : ''}</label>
                  <input type="text" placeholder="e.g. Expert Criminal Defense in Colombo" value={form.title} onChange={(e) => updateForm('title', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
                  <FieldError message={formErrors.title} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">CTA Button Text</label>
                  <input type="text" placeholder="View Profile" value={form.ctaText} onChange={(e) => updateForm('ctaText', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
                  <FieldError message={formErrors.ctaText} />
                </div>
                <div>
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
                      Your profile photo will be used automatically.
                    </div>
                  )}
                  <FieldError message={formErrors.imageUrl} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Description</label>
                  <textarea placeholder="A brief description of your services..." value={form.description} onChange={(e) => updateForm('description', e.target.value)} rows={2} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] resize-none" />
                  <FieldError message={formErrors.description} />
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-900">3. Schedule & Budget</h4>
                <p className="text-xs text-neutral-500">Pricing is based on placement and duration. The admin team will confirm the final daily rate.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Budget (LKR) *</label>
                  <input type="number" min="500" placeholder="15000" value={form.totalBudget} onChange={(e) => updateForm('totalBudget', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
                  <p className="text-[11px] text-neutral-500 mt-1">Minimum LKR 500. Price per day is confirmed during review.</p>
                  <FieldError message={formErrors.totalBudget} />
                </div>
              </div>
            </section>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} disabled={createLoading} className="bg-[#0a0a0a] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wide">
              {createLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Send className="w-3 h-3 mr-2" />}
              Submit for Review
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-neutral-600">Cancel</Button>
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
      ) : campaigns.length > 0 && (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const sc = statusConfig[campaign.status] || statusConfig.DRAFT;
            const isExpanded = expandedId === campaign.id;
            const daysLeft = Math.max(0, Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            const canLawyerResume = campaign.status === 'PAUSED' && campaign.pausedBy === 'LAWYER';
            const isAdminPaused = campaign.status === 'PAUSED' && campaign.pausedBy !== 'LAWYER';

            return (
              <div key={campaign.id} className="bg-white border border-neutral-200 overflow-hidden transition-shadow hover:shadow-sm">
                {/* Main Row */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : campaign.id)}
                >
                  <div className="w-10 h-10 rounded bg-neutral-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {campaign.imageUrl ? (
                      <img src={campaign.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-neutral-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-neutral-900 truncate">{campaign.name}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border ${sc.bg} ${sc.color}`}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">{formatLabel(campaign.type)} • {formatLabel(campaign.placement)}</p>
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
                    <div className="text-center">
                      <p className="font-bold text-neutral-900">{ctr(campaign.impressions, campaign.clicks)}%</p>
                      <p className="text-[10px] text-neutral-400">CTR</p>
                    </div>
                  </div>

                  {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-neutral-100 px-5 py-5 bg-neutral-50/50 space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Schedule</p>
                        <p className="text-neutral-700 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          {new Date(campaign.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' → '}
                          {new Date(campaign.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {campaign.status === 'ACTIVE' && <span className="text-blue-600 font-semibold ml-2">({daysLeft} days left)</span>}
                        </p>
                      </div>

                      {campaign.title && (
                        <div className="md:col-span-2">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Headline</p>
                          <p className="font-semibold text-neutral-900">{campaign.title}</p>
                          {campaign.description && <p className="text-neutral-600 mt-0.5">{campaign.description}</p>}
                        </div>
                      )}

                      {campaign.totalBudget && (
                        <div>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Budget</p>
                          <p className="text-neutral-700 font-semibold">LKR {campaign.totalBudget.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Rejection notice */}
                    {campaign.rejectionReason && (
                      <div className="bg-red-50 border border-red-200 p-3 rounded text-sm">
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Rejection Reason</p>
                        <p className="text-red-700">{campaign.rejectionReason}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <Separator />
                    <div className="flex gap-2">
                      {campaign.status === 'ACTIVE' && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(campaign.id, 'PAUSED')} disabled={actionLoading === campaign.id} className="text-orange-600 border-orange-200 hover:bg-orange-50 text-xs font-bold">
                          <Pause className="w-3.5 h-3.5 mr-1.5" /> Pause Campaign
                        </Button>
                      )}
                      {canLawyerResume && (
                        <Button size="sm" onClick={() => handleStatusChange(campaign.id, 'ACTIVE')} disabled={actionLoading === campaign.id} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                          <Play className="w-3.5 h-3.5 mr-1.5" /> Resume Campaign
                        </Button>
                      )}
                      {isAdminPaused && (
                        <p className="text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 px-3 py-2">
                          This campaign was paused by an admin. Please contact support to resume it.
                        </p>
                      )}
                      {campaign.status === 'REJECTED' && (
                        <Button size="sm" onClick={() => handleStatusChange(campaign.id, 'PENDING_REVIEW')} disabled={actionLoading === campaign.id} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
                          <Send className="w-3.5 h-3.5 mr-1.5" /> Resubmit for Review
                        </Button>
                      )}
                      {actionLoading === campaign.id && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
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
