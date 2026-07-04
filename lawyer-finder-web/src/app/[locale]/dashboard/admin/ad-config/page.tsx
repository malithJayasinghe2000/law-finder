'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Settings2, Loader2, Check, X, Timer, Layers, DollarSign,
  ToggleLeft, ToggleRight, Monitor, Pen, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AD_TYPES, AD_TYPE_LABELS, type AdTypeValue } from '@/schemas/ad.schema';

interface PlacementConfig {
  id: string;
  placement: string;
  displayName: string;
  description: string | null;
  pricePerDay: number;
  isSlider: boolean;
  sliderInterval: number;
  maxAdsPerSlot: number;
  recommendedWidth: number | null;
  recommendedHeight: number | null;
  isActive: boolean;
  allowedAdTypes: string[];
}

export default function AdConfigPage() {
  const [configs, setConfigs] = useState<PlacementConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PlacementConfig>>({});
  const [saving, setSaving] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ad-config');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load ad configs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const startEdit = (config: PlacementConfig) => {
    setEditingId(config.id);
    setEditForm({ ...config });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editForm.placement) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ad-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Config updated successfully.');
      setEditingId(null);
      setEditForm({});
      fetchConfigs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (config: PlacementConfig) => {
    try {
      const res = await fetch('/api/admin/ad-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement: config.placement, isActive: !config.isActive }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`${config.displayName} ${config.isActive ? 'disabled' : 'enabled'}.`);
      fetchConfigs();
    } catch {
      toast.error('Failed to toggle status.');
    }
  };

  const toggleAdType = (adType: string) => {
    const current = editForm.allowedAdTypes || [];
    if (current.includes(adType)) {
      setEditForm({ ...editForm, allowedAdTypes: current.filter(t => t !== adType) });
    } else {
      setEditForm({ ...editForm, allowedAdTypes: [...current, adType] });
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
          <Settings2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Ad Placement Configuration</h1>
          <p className="text-sm text-neutral-500 font-medium">Configure pricing, slider settings, and availability for each ad placement</p>
        </div>
      </div>

      {/* Config List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white border border-neutral-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map((config) => {
            const isEditing = editingId === config.id;

            return (
              <Card key={config.id} className={`border ${config.isActive ? 'border-neutral-200' : 'border-neutral-200 opacity-60'} rounded-none overflow-hidden`}>
                <CardContent className="p-0">
                  {/* Row Header */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Status Toggle */}
                    <button onClick={() => toggleActive(config)} title={config.isActive ? 'Click to disable' : 'Click to enable'}>
                      {config.isActive ? (
                        <ToggleRight className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-neutral-400" />
                      )}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-neutral-900">{config.displayName}</p>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border ${config.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}>
                          {config.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">{config.description}</p>
                    </div>

                    {/* Quick Stats */}
                    <div className="hidden sm:flex items-center gap-6 text-xs">
                      <div className="text-center">
                        <p className="font-bold text-neutral-900">LKR {config.pricePerDay.toLocaleString()}</p>
                        <p className="text-[10px] text-neutral-400">Per Day</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-neutral-900">{config.maxAdsPerSlot}</p>
                        <p className="text-[10px] text-neutral-400">Max Ads</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-bold ${config.isSlider ? 'text-blue-600' : 'text-neutral-400'}`}>
                          {config.isSlider ? `${(config.sliderInterval / 1000).toFixed(1)}s` : 'Off'}
                        </p>
                        <p className="text-[10px] text-neutral-400">Slider</p>
                      </div>
                      <div className="text-center min-w-[60px]">
                        <p className="font-bold text-neutral-900 text-[10px]">
                          {config.allowedAdTypes.map(t => AD_TYPE_LABELS[t as AdTypeValue] || t).join(', ')}
                        </p>
                        <p className="text-[10px] text-neutral-400">Ad Types</p>
                      </div>
                    </div>

                    {/* Edit Button */}
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(config)}
                        className="text-xs font-bold"
                      >
                        <Pen className="w-3 h-3 mr-1.5" /> Edit
                      </Button>
                    )}
                  </div>

                  {/* Edit Panel */}
                  {isEditing && (
                    <div className="border-t border-neutral-100 px-5 py-5 bg-neutral-50/50 space-y-4 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Display Name */}
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Display Name</label>
                          <input
                            type="text"
                            value={editForm.displayName || ''}
                            onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                            className="w-full py-2.5 px-3 bg-white border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
                          />
                        </div>

                        {/* Price Per Day */}
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                            <DollarSign className="w-3 h-3 inline mr-1" />Price Per Day (LKR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editForm.pricePerDay || ''}
                            onChange={(e) => setEditForm({ ...editForm, pricePerDay: parseInt(e.target.value) || 0 })}
                            className="w-full py-2.5 px-3 bg-white border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
                          />
                        </div>

                        {/* Max Ads Per Slot */}
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                            <Layers className="w-3 h-3 inline mr-1" />Max Ads Per Slot
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={editForm.maxAdsPerSlot || ''}
                            onChange={(e) => setEditForm({ ...editForm, maxAdsPerSlot: parseInt(e.target.value) || 1 })}
                            className="w-full py-2.5 px-3 bg-white border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
                          />
                        </div>

                        {/* Slider Interval */}
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                            <Timer className="w-3 h-3 inline mr-1" />Slider Interval (ms)
                          </label>
                          <input
                            type="number"
                            min="1000"
                            max="30000"
                            step="500"
                            value={editForm.sliderInterval || ''}
                            onChange={(e) => setEditForm({ ...editForm, sliderInterval: parseInt(e.target.value) || 3000 })}
                            disabled={!editForm.isSlider}
                            className="w-full py-2.5 px-3 bg-white border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Recommended Dimensions */}
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                            <Monitor className="w-3 h-3 inline mr-1" />Width (px)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editForm.recommendedWidth ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, recommendedWidth: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="Auto"
                            className="w-full py-2.5 px-3 bg-white border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Height (px)</label>
                          <input
                            type="number"
                            min="0"
                            value={editForm.recommendedHeight ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, recommendedHeight: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="Auto"
                            className="w-full py-2.5 px-3 bg-white border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
                          />
                        </div>

                        {/* Slider Toggle */}
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Slider</label>
                          <button
                            onClick={() => setEditForm({ ...editForm, isSlider: !editForm.isSlider })}
                            className={`w-full py-2.5 px-3 border text-sm font-bold flex items-center justify-center gap-2 transition-colors ${editForm.isSlider
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-white border-neutral-200 text-neutral-400'
                              }`}
                          >
                            {editForm.isSlider ? (
                              <><Check className="w-4 h-4" /> Enabled</>
                            ) : (
                              <><X className="w-4 h-4" /> Disabled</>
                            )}
                          </button>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Description</label>
                          <input
                            type="text"
                            value={editForm.description || ''}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full py-2.5 px-3 bg-white border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
                          />
                        </div>
                      </div>

                      {/* Allowed Ad Types */}
                      <div>
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">Allowed Ad Types</label>
                        <div className="flex flex-wrap gap-2">
                          {AD_TYPES.map((adType) => {
                            const isSelected = (editForm.allowedAdTypes || []).includes(adType);
                            return (
                              <button
                                key={adType}
                                onClick={() => toggleAdType(adType)}
                                className={`text-xs font-bold px-3 py-1.5 border transition-colors ${isSelected
                                  ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                                  : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400'
                                  }`}
                              >
                                {AD_TYPE_LABELS[adType]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <Separator />

                      <div className="flex gap-2">
                        <Button
                          onClick={saveEdit}
                          disabled={saving}
                          className="bg-[#0a0a0a] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wide"
                        >
                          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2" />}
                          Save Changes
                        </Button>
                        <Button variant="ghost" onClick={cancelEdit} className="text-neutral-600">Cancel</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
