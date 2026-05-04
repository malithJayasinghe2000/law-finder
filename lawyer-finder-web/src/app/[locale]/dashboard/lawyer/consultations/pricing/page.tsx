'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { DollarSign, Save, Info, Percent, Gift } from 'lucide-react';

export default function PricingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pricingType, setPricingType] = useState('PER_SESSION');
  const [physicalPrice, setPhysicalPrice] = useState(5000);
  const [onlinePrice, setOnlinePrice] = useState(3000);
  const [freeInitial, setFreeInitial] = useState(false);
  const [freeDuration, setFreeDuration] = useState(15);

  const COMMISSION_RATE = 0.15;

  useEffect(() => {
    loadPricing();
  }, []);

  async function loadPricing() {
    try {
      const res = await fetch('/api/consultations/pricing');
      const data = await res.json();
      if (data.pricing) {
        setPricingType(data.pricing.pricingType);
        setPhysicalPrice(data.pricing.physicalPrice);
        setOnlinePrice(data.pricing.onlinePrice);
        setFreeInitial(data.pricing.freeInitialConsultation);
        setFreeDuration(data.pricing.freeConsultationDuration || 15);
      }
    } catch {
      toast.error('Failed to load pricing');
    } finally {
      setLoading(false);
    }
  }

  async function savePricing() {
    setSaving(true);
    try {
      const res = await fetch('/api/consultations/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pricingType,
          physicalPrice,
          onlinePrice,
          freeInitialConsultation: freeInitial,
          freeConsultationDuration: freeInitial ? freeDuration : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Pricing saved successfully');
      } else {
        toast.error(data.error?.toString() || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save pricing');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 rounded-none" />
        <Skeleton className="h-64 rounded-none" />
      </div>
    );
  }

  const physicalPlatformFee = Math.round(physicalPrice * COMMISSION_RATE);
  const physicalClientPays = physicalPrice + physicalPlatformFee;
  const onlinePlatformFee = Math.round(onlinePrice * COMMISSION_RATE);
  const onlineClientPays = onlinePrice + onlinePlatformFee;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Consultation Pricing</h1>
            <p className="text-sm text-neutral-500 font-medium">Set your consultation fees for clients</p>
          </div>
        </div>
        <Button
          onClick={savePricing}
          disabled={saving}
          className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-10 px-6 text-sm font-bold uppercase tracking-wide"
        >
          <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Pricing'}
        </Button>
      </div>

      {/* Pricing Type */}
      <Card className="rounded-none shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Percent className="w-4 h-4" /> Pricing Model
          </h3>
          <div className="flex gap-4">
            {(['PER_SESSION', 'HOURLY'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setPricingType(type)}
                className={`flex-1 p-4 border-2 text-left transition-all ${pricingType === type ? 'border-[#0a0a0a] bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'}`}
              >
                <p className="text-sm font-bold text-neutral-900">{type === 'PER_SESSION' ? 'Per Session' : 'Hourly'}</p>
                <p className="text-xs text-neutral-500 mt-1">{type === 'PER_SESSION' ? 'Fixed price per consultation session' : 'Price calculated per hour'}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Price Settings */}
      <Card className="rounded-none shadow-sm">
        <CardContent className="p-6 space-y-6">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Consultation Fees
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Physical */}
            <div className="space-y-3 p-5 border border-neutral-200">
              <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Physical Consultation (LKR)</label>
              <input
                type="number"
                value={physicalPrice}
                onChange={(e) => setPhysicalPrice(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full border border-neutral-200 px-4 py-3 text-lg font-bold bg-white"
                min={0}
              />
              <div className="space-y-1 pt-2 border-t border-neutral-100">
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Your fee</span>
                  <span className="font-semibold text-neutral-900">Rs. {physicalPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Platform fee (15%)</span>
                  <span className="text-amber-600 font-semibold">Rs. {physicalPlatformFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-neutral-900 pt-1 border-t border-neutral-100">
                  <span>Client pays</span>
                  <span>Rs. {physicalClientPays.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Online */}
            <div className="space-y-3 p-5 border border-neutral-200">
              <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Online Consultation (LKR)</label>
              <input
                type="number"
                value={onlinePrice}
                onChange={(e) => setOnlinePrice(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full border border-neutral-200 px-4 py-3 text-lg font-bold bg-white"
                min={0}
              />
              <div className="space-y-1 pt-2 border-t border-neutral-100">
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Your fee</span>
                  <span className="font-semibold text-neutral-900">Rs. {onlinePrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Platform fee (15%)</span>
                  <span className="text-amber-600 font-semibold">Rs. {onlinePlatformFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-neutral-900 pt-1 border-t border-neutral-100">
                  <span>Client pays</span>
                  <span>Rs. {onlineClientPays.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Free Consultation */}
      <Card className="rounded-none shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Gift className="w-4 h-4" /> Free Initial Consultation
          </h3>
          <div className="flex items-start gap-4">
            <button
              onClick={() => setFreeInitial(!freeInitial)}
              className={`mt-0.5 w-10 h-6 rounded-full transition-colors relative ${freeInitial ? 'bg-[#0a0a0a]' : 'bg-neutral-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${freeInitial ? 'left-5' : 'left-1'}`} />
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold text-neutral-900">Offer free initial consultation</p>
              <p className="text-xs text-neutral-500 mt-0.5">Attract new clients by offering a short free consultation</p>
              {freeInitial && (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs text-neutral-600 font-medium">Duration:</label>
                  <select
                    value={freeDuration}
                    onChange={(e) => setFreeDuration(parseInt(e.target.value))}
                    className="border border-neutral-200 px-3 py-1.5 text-sm bg-white"
                  >
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 space-y-1">
          <p className="font-semibold">How pricing works</p>
          <p>You set your consultation fee. The platform adds a 15% service fee on top. The total is what the client sees and pays. You receive your full fee after the consultation is completed.</p>
        </div>
      </div>
    </div>
  );
}
