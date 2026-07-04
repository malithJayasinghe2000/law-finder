'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Image as ImageIcon, Plus, Loader2, Eye, Pause, Play,
  Calendar, CheckCircle2, Send,
  MousePointerClick, TrendingUp,
  ChevronDown, ChevronUp, ArrowRight, Megaphone, ImagePlus, CreditCard
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
  formatAdLabel,
  type AdPlacementValue,
  type AdTypeValue,
  type PlacementConfigClient,
} from '@/schemas/ad.schema';
import { PlacementPreview } from '@/components/ads/PlacementPreview';

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
  invoiceId?: string | null;
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

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  DRAFT: { color: 'text-neutral-600', bg: 'bg-neutral-100 border-neutral-200', label: 'Draft' },
  PENDING_REVIEW: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Pending Review' },
  APPROVED: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'Approved' },
  ACTIVE: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Live' },
  PAUSED: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'Paused' },
  EXPIRED: { color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200', label: 'Expired' },
  REJECTED: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Rejected' },
};

function ctr(impressions: number, clicks: number) {
  if (impressions === 0) return '0.00';
  return ((clicks / impressions) * 100).toFixed(2);
}

export default function LawyerAdsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string || 'en';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Config and Availability states
  const [configs, setConfigs] = useState<PlacementConfigClient[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<PlacementConfigClient | null>(null);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [form, setForm] = useState({
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
  });

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/ads/config');
      const data = await res.json();
      setConfigs(data.configs || []);
      if (data.configs && data.configs.length > 0) {
        // Find configuration compatible with current form state
        const firstActive = data.configs[0] as PlacementConfigClient;
        setSelectedConfig(firstActive);
        setForm(prev => ({
          ...prev,
          placement: firstActive.placement,
          type: firstActive.allowedAdTypes[0] || 'BANNER_IMAGE'
        }));
      }
    } catch {
      toast.error('Failed to load ad configurations.');
    }
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
    fetchConfigs();
  }, []);

  // Fetch availability when placement or dates change
  useEffect(() => {
    if (!form.placement) return;
    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      try {
        const today = new Date();
        const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const res = await fetch(`/api/ads/availability?placement=${form.placement}&month=${monthStr}`);
        const data = await res.json();
        setBlockedDates(data.blockedDates || []);
      } catch {
        console.error('Failed to load slot availability.');
      } finally {
        setLoadingAvailability(false);
      }
    };
    fetchAvailability();
  }, [form.placement]);

  const validPlacements = selectedConfig ? [selectedConfig.placement] : configs.map(c => c.placement);
  const imageRequired = isImageRequiredType(form.type);

  // Auto-calculated days and cost
  const startDateObj = form.startDate ? new Date(form.startDate) : null;
  const endDateObj = form.endDate ? new Date(form.endDate) : null;
  const totalDays = startDateObj && endDateObj && endDateObj >= startDateObj
    ? Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;
  const totalCost = selectedConfig ? selectedConfig.pricePerDay * totalDays : 0;

  // Unique images from previous campaigns
  const previousImages = Array.from(new Set(
    campaigns
      .map(c => c.imageUrl)
      .filter((url): url is string => typeof url === 'string' && url.length > 0)
  ));

  const updateForm = (field: keyof typeof form, value: any) => {
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      
      // If changing type, find first compatible config & placement
      if (field === 'type') {
        const compatibleConfigs = configs.filter(c => c.allowedAdTypes.includes(value));
        if (compatibleConfigs.length > 0) {
          updated.placement = compatibleConfigs[0].placement;
          setSelectedConfig(compatibleConfigs[0]);
        }
      }

      // If changing placement, update active placement config
      if (field === 'placement') {
        const conf = configs.find(c => c.placement === value);
        if (conf) {
          setSelectedConfig(conf);
          // If current type not allowed, set first allowed
          if (!conf.allowedAdTypes.includes(updated.type)) {
            updated.type = conf.allowedAdTypes[0] || 'BANNER_IMAGE';
          }
        }
      }

      return updated;
    });
  };

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
    // Validate date selections against blocked dates
    if (form.startDate && blockedDates.includes(form.startDate)) {
      toast.error('Selected start date is fully booked.');
      return;
    }
    if (form.endDate && blockedDates.includes(form.endDate)) {
      toast.error('Selected end date is fully booked.');
      return;
    }

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
        name: '', type: 'BANNER_IMAGE', placement: 'HOMEPAGE_BELOW_HERO',
        title: '', description: '', imageUrl: '', targetUrl: '', ctaText: 'View Profile',
        targetDistricts: [], targetPracticeAreas: [], startDate: '', endDate: '',
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
            <h1 className="text-4xl font-normal tracking-tight text-neutral-900">My Ad Campaigns</h1>
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
          <h2 className="text-xl font-normal text-neutral-900">Grow Your Practice with Ads</h2>
          <p className="text-sm text-neutral-600 max-w-lg mx-auto">
            Create an ad campaign to appear at the top of search results, on the homepage, or alongside blog posts. 
            Reach thousands of potential clients looking for legal services.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-neutral-500 pt-2">
            <div className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-blue-100 text-neutral-700 font-normal flex items-center justify-center text-[10px]">1</span> Create Campaign</div>
            <ArrowRight className="w-3 h-3" />
            <div className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-amber-100 text-neutral-700 font-normal flex items-center justify-center text-[10px]">2</span> Admin Reviews</div>
            <ArrowRight className="w-3 h-3" />
            <div className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-emerald-100 text-neutral-700 font-normal flex items-center justify-center text-[10px]">3</span> Goes Live!</div>
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
          <p className="text-sm text-neutral-500 font-medium">Your campaign will be reviewed by our team before it goes live. Price is automatically calculated based on placement and duration.</p>

          <div className="space-y-6">
            <section className="space-y-3">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-900">1. Placement & Format</h4>
                <p className="text-xs text-neutral-500">Pick where your ad appears, and select a compatible layout format.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5 font-sans">Placement Zone *</label>
                  <select value={form.placement} onChange={(e) => updateForm('placement', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-semibold text-neutral-900 outline-none focus:border-[#0a0a0a]">
                    {configs.map((c) => (
                      <option key={c.placement} value={c.placement}>{c.displayName} (LKR {c.pricePerDay}/day)</option>
                    ))}
                  </select>
                  <FieldError message={formErrors.placement} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Ad Format Style *</label>
                  <select value={form.type} onChange={(e) => updateForm('type', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-semibold text-neutral-900 outline-none focus:border-[#0a0a0a]">
                    {selectedConfig?.allowedAdTypes.map((t) => (
                      <option key={t} value={t}>{formatAdLabel(t)}</option>
                    ))}
                  </select>
                  <FieldError message={formErrors.type} />
                </div>
              </div>

              {/* Placement Skeleton Preview */}
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <PlacementPreview placement={form.placement} />
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-900">2. Creative Content</h4>
                <p className="text-xs text-neutral-500">Add banner image, title, and body text. For profile-based formats, your profile details are used automatically.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Campaign Name *</label>
                  <input type="text" placeholder="e.g. Colombo Civil Law Promotion" value={form.name} onChange={(e) => updateForm('name', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
                  <FieldError message={formErrors.name} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Ad Headline {form.type === 'BANNER_IMAGE' ? '*' : ''}</label>
                  <input type="text" placeholder="e.g. Trusted Land & Property Dispute Lawyer" value={form.title} onChange={(e) => updateForm('title', e.target.value)} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" />
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
                      <>
                        <button type="button" onClick={handleImageUpload} disabled={uploadingImage} className="flex items-center justify-center gap-2 w-full h-[42px] bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-500 hover:border-[#0a0a0a] hover:text-neutral-900 transition-colors rounded-sm">
                          {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                          {uploadingImage ? 'Uploading...' : 'Upload Image'}
                        </button>
                        {previousImages.length > 0 && (
                          <div className="mt-2.5">
                            <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider mb-1.5">Or choose a previous image:</p>
                            <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto p-1 border border-neutral-200/60 bg-neutral-50/50">
                              {previousImages.map((url, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => updateForm('imageUrl', url)}
                                  className="w-10 h-10 border border-neutral-200 hover:border-[#bfa37a] hover:scale-105 transition-all overflow-hidden relative shrink-0"
                                >
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  ) : (
                    <>
                      <div className="min-h-[42px] flex items-center px-3 bg-neutral-50 border border-neutral-200 text-sm text-neutral-500 rounded-sm">
                        Your profile photo will be used automatically.
                      </div>
                      {previousImages.length > 0 && (
                        <div className="mt-2.5">
                          <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider mb-1.5">Or choose a custom image:</p>
                          <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto p-1 border border-neutral-200/60 bg-neutral-50/50">
                            {previousImages.map((url, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => updateForm('imageUrl', url)}
                                className="w-10 h-10 border border-neutral-200 hover:border-[#bfa37a] hover:scale-105 transition-all overflow-hidden relative shrink-0"
                              >
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <FieldError message={formErrors.imageUrl} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Description / Body Text</label>
                  <textarea placeholder="Briefly describe your services..." value={form.description} onChange={(e) => updateForm('description', e.target.value)} rows={2} className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] resize-none" />
                  <FieldError message={formErrors.description} />
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-900">3. Campaign Dates & Pricing</h4>
                <p className="text-xs text-neutral-500">Select available dates. Booked slots are blocked automatically. Price calculates based on duration.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Start Date *</label>
                  <input 
                    type="date" 
                    value={form.startDate} 
                    onChange={(e) => updateForm('startDate', e.target.value)} 
                    className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" 
                  />
                  {form.startDate && blockedDates.includes(form.startDate) && (
                    <p className="text-[11px] text-red-500 font-semibold mt-1">⚠️ Fully booked on this date</p>
                  )}
                  <FieldError message={formErrors.startDate} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">End Date *</label>
                  <input 
                    type="date" 
                    value={form.endDate} 
                    onChange={(e) => updateForm('endDate', e.target.value)} 
                    className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]" 
                  />
                  {form.endDate && blockedDates.includes(form.endDate) && (
                    <p className="text-[11px] text-red-500 font-semibold mt-1">⚠️ Fully booked on this date</p>
                  )}
                  <FieldError message={formErrors.endDate} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Price Breakdown</label>
                  <div className="w-full py-2.5 px-3 bg-neutral-100 border border-neutral-200 text-sm font-bold text-neutral-900 min-h-[42px] flex items-center justify-between">
                    <span>{totalDays > 0 ? `${totalDays} days × LKR ${selectedConfig?.pricePerDay}` : 'Select dates'}</span>
                    {totalCost > 0 && <span className="text-emerald-700">LKR {totalCost.toLocaleString()}</span>}
                  </div>
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
                      {campaign.status === 'APPROVED' && campaign.invoiceId && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border bg-rose-50 text-rose-700 border-rose-200 animate-pulse">
                          Payment Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">{formatAdLabel(campaign.type)} • {formatAdLabel(campaign.placement)}</p>
                    {campaign.status === 'APPROVED' && campaign.invoiceId && (
                      <p className="text-xs font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        ⚠️ Requires payment to activate
                      </p>
                    )}
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
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Total Cost</p>
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
                      {campaign.status === 'APPROVED' && campaign.invoiceId && (
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/${locale}/dashboard/lawyer/payments/offline/${campaign.invoiceId}`);
                          }} 
                          className="bg-[#bfa37a] hover:bg-[#a68d67] text-white text-xs font-bold uppercase tracking-wider"
                        >
                          <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Pay Invoice to Activate
                        </Button>
                      )}
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
