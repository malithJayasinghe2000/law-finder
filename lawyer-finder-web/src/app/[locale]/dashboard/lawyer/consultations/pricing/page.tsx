'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { DollarSign, Save, Info, Percent, Gift, Clock, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ATTORNEY_BOOKING_ENABLED } from '@/lib/directoryLinks';

function PricingEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pricingType, setPricingType] = useState('PER_SESSION');
  const [freeInitial, setFreeInitial] = useState(false);
  const [freeDuration, setFreeDuration] = useState(15);
  const [minAdvanceNoticeHours, setMinAdvanceNoticeHours] = useState(24);
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankBranch, setBankBranch] = useState('');

  useEffect(() => {
    loadPricing();
  }, []);

  async function loadPricing() {
    try {
      const res = await fetch('/api/consultations/pricing');
      const data = await res.json();
      if (data.pricing) {
        setPricingType(data.pricing.pricingType);
        setFreeInitial(data.pricing.freeInitialConsultation);
        setFreeDuration(data.pricing.freeConsultationDuration || 15);
        setMinAdvanceNoticeHours(data.pricing.minAdvanceNoticeHours || 24);
        setBankName(data.pricing.bankName || '');
        setAccountName(data.pricing.accountName || '');
        setAccountNumber(data.pricing.accountNumber || '');
        setBankBranch(data.pricing.bankBranch || '');
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
          // No price fields. A fee exists only on a Quote, issued for one
          // matter after a conflict check — never as a standing price attached
          // to a practitioner. The columns were dropped in Phase 3.
          pricingType,
          freeInitialConsultation: freeInitial,
          freeConsultationDuration: freeInitial ? freeDuration : undefined,
          minAdvanceNoticeHours,
          bankName: bankName.trim() || null,
          accountName: accountName.trim() || null,
          accountNumber: accountNumber.trim() || null,
          bankBranch: bankBranch.trim() || null,
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


  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-4xl font-normal tracking-tight text-neutral-900">Consultation Settings</h1>
            <p className="text-sm text-neutral-500 font-medium">Booking preferences and the bank details used to pre-fill your quotes</p>
          </div>
        </div>
        <Button
          onClick={savePricing}
          disabled={saving}
          className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-10 px-6 text-sm font-bold uppercase tracking-wide"
        >
          <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>

      {/* Free Consultation */}
      {/* <Card className="rounded-none shadow-sm">
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
      </Card> */}

      {/* Advance Notice Setting */}
      <Card className="rounded-none shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Minimum Advance Notice
          </h3>
          <div className="space-y-2">
            <p className="text-xs text-neutral-500 mb-3">
              How much notice do you need before a consultation? Slots within this timeframe will be shown as "Call to Book" rather than allowing instant booking.
            </p>
            <select
              value={minAdvanceNoticeHours}
              onChange={(e) => setMinAdvanceNoticeHours(parseInt(e.target.value))}
              className="border border-neutral-200 px-4 py-3 w-full md:w-64 text-sm bg-white outline-none focus:border-[#0a0a0a]"
            >
              <option value={12}>12 Hours</option>
              <option value={24}>24 Hours (1 Day)</option>
              <option value={48}>48 Hours (2 Days)</option>
              <option value={72}>72 Hours (3 Days)</option>
              <option value={168}>168 Hours (1 Week)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bank Details Setting */}
      <Card className="rounded-none shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Default Bank Details
          </h3>
          <div className="space-y-4">
            <p className="text-xs text-neutral-500 mb-3">
              Set your default bank account details here. This will automatically populate when you accept a consultation request and choose the Bank Transfer payment method.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Commercial Bank"
                  className="w-full mt-1.5 border border-neutral-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-[#0a0a0a]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Branch</label>
                <input
                  type="text"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  placeholder="e.g. Colombo 01"
                  className="w-full mt-1.5 border border-neutral-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-[#0a0a0a]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Account Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full mt-1.5 border border-neutral-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-[#0a0a0a]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 1234567890"
                  className="w-full mt-1.5 border border-neutral-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-[#0a0a0a]"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Internal Reference Only</p>
          <p>These fees are for your internal reference and scheduling purposes. To comply with BASL Rule 39, your fees will <strong>not</strong> be publicly advertised or displayed on your profile. You will discuss fees directly with clients after accepting their consultation request.</p>
        </div>
      </div>
    </div>
  );
}

/**
 * This page held no prices: minimum advance notice (only attorney-first slot
 * booking used it, off for launch) and the attorney's own bank details (quotes
 * pre-fill from the practice's Bank and tax details since 2026-10-14 — two places
 * for bank details is how a client could be sent to the wrong account). Hidden
 * from the menu; this notice is for the old link. Returns with the switch.
 */
export default function PricingPage() {
  const { locale } = useParams<{ locale: string }>();
  if (!ATTORNEY_BOOKING_ENABLED) {
    return (
      <div className="max-w-xl border border-neutral-200 bg-white p-6">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">These settings are not used at the moment</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          The bank details on your quotes and fee notes are your practice&apos;s, set in{' '}
          <Link href={`/${locale}/dashboard/lawyer/firm#account`} className="font-semibold underline underline-offset-2">
            My Firm → Practice → Bank and tax details
          </Link>
          . Fees are agreed with each client in your fee proposal.
        </p>
      </div>
    );
  }
  return <PricingEditor />;
}
