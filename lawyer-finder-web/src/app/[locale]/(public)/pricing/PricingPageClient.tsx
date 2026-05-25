'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check, ShieldCheck, Zap, Crown, Loader2, Scale, LayoutDashboard,
  FileText, MessageSquare, Users, Eye, Upload, Megaphone, BarChart3,
  Trash2, Settings, Send, PenLine, BookOpen, Download, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import Link from 'next/link';

interface Permission {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
}

interface FeatureLimit {
  featureName: string;
  limit: number;
  description: string | null;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  tier: string;
  monthlyAmount: number;
  yearlyAmount: number;
  subscriptionDetails: { id: string; details: string }[];
  permissions: Permission[];
  featureLimits: FeatureLimit[];
}

// Map permission categories to icons
const categoryIcons: Record<string, React.ElementType> = {
  articles: FileText,
  inquiries: Users,
  chat: MessageSquare,
  profile: Settings,
  promotion: Megaphone,
  analytics: BarChart3,
};

// Map individual permissions to icons
const permissionIcons: Record<string, React.ElementType> = {
  create_article: PenLine,
  edit_article: FileText,
  delete_article: Trash2,
  publish_article: BookOpen,
  receive_inquiries: Users,
  post_inquiry: Send,
  manage_inquiries: Eye,
  access_chat: MessageSquare,
  send_message: Send,
  edit_profile: Settings,
  upload_documents: Upload,
  access_paid_promo: Megaphone,
  create_promo: Crown,
  view_analytics: BarChart3,
  export_data: Download,
};

// Tier icons
const tierIcons: Record<string, React.ElementType> = {
  BASIC: ShieldCheck,
  PROFESSIONAL: Zap,
  PREMIUM: Crown,
  ENTERPRISE: Scale,
};

// Tier order for display
const tierOrder = ['BASIC', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE'];

// Format feature limit for display
function formatFeatureLimit(name: string, limit: number): string {
  if (limit === -1) return 'Unlimited';
  const labels: Record<string, string> = {
    articles_per_month: `${limit} Articles/mo`,
    inquiries_per_month: `${limit} Inquiries/mo`,
    chat_messages_per_month: `${limit} Messages/mo`,
    promo_campaigns_per_month: `${limit} Promos/mo`,
    storage_gb: `${limit} GB Storage`,
  };
  return labels[name] || `${limit}`;
}

export default function PricingPageClient({ locale }: { locale: string }) {
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch('/api/subscriptions/plans-with-permissions');
        if (!res.ok) {
          if (res.status === 401) {
            router.push(`/${locale}/login`);
            return;
          }
          throw new Error('Failed to fetch pricing plans');
        }
        const data = await res.json();
        // Sort by tier order
        const sorted = data.sort((a: SubscriptionPlan, b: SubscriptionPlan) =>
          tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
        );
        setPlans(sorted);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, [locale, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Hero Section */}
      <div className="bg-[#0d1017] text-white py-24 px-6 lg:px-12 xl:px-24">
        <div className="max-w-[1200px] mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20">
            <Zap className="h-4 w-4 text-[#ffb84f]" />
            <span className="text-sm font-semibold uppercase tracking-widest text-[#ffb84f]">Premium Plans</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-medium tracking-tight leading-tight">
            Choose Your Perfect Plan
          </h1>
          <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed">
            Professional features designed for legal experts. Scale your practice and reach more clients.
          </p>

          {/* Billing Switcher */}
          <div className="flex justify-center mt-12">
            <div className="bg-white/5 p-1 rounded-full inline-flex items-center border border-white/10">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-8 py-3 rounded-full font-semibold uppercase text-sm tracking-wider transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-[#ffb84f] text-black'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-8 py-3 rounded-full font-semibold uppercase text-sm tracking-wider transition-all flex items-center gap-2 ${
                  billingCycle === 'yearly'
                    ? 'bg-[#ffb84f] text-black'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Yearly
                {billingCycle === 'yearly' && <span className="bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded-full">Save 20%</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-screen bg-white py-24 px-6 lg:px-12 xl:px-24">
      <div className="max-w-[1200px] mx-auto">

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch mb-20">
          {plans.filter(p => p.tier !== 'BASIC').map((plan) => {
            const isProfessional = plan.tier === 'PROFESSIONAL';
            const isPremium = plan.tier === 'PREMIUM';
            const isEnterprise = plan.tier === 'ENTERPRISE';
            const amount = billingCycle === 'monthly' ? plan.monthlyAmount : plan.yearlyAmount;
            const TierIcon = tierIcons[plan.tier] || ShieldCheck;

            return (
              <div 
                key={plan.id}
                className={`relative flex flex-col h-full rounded-3xl border transition-all duration-300 group ${
                  isPremium
                    ? 'bg-gradient-to-br from-[#ffb84f]/10 to-[#ffb84f]/5 border-[#ffb84f]/30 shadow-[0_20px_40px_rgb(255,184,79,0.15)] hover:shadow-[0_30px_60px_rgb(255,184,79,0.2)] hover:-translate-y-2'
                    : 'bg-white border-[#ffb84f] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-2'
                }`}
              >
                {/* Premium Badge */}
                {isPremium && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-[#ffb84f] text-black px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                      ⭐ Most Popular
                    </div>
                  </div>
                )}
                
                <div className="pt-10 px-8 pb-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className={`p-3 rounded-full ${isPremium ? 'bg-[#ffb84f] text-black' : 'bg-neutral-100 text-neutral-600'}`}>
                      <TierIcon className="h-6 w-6" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-[#0a0d14] mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-2 mt-6 mb-2">
                    <span className="text-4xl font-bold text-[#0a0d14]">LKR {amount.toLocaleString()}</span>
                    <span className="text-neutral-500 font-light text-sm">{billingCycle === 'monthly' ? '/month' : '/year'}</span>
                  </div>
                  {isPremium && <p className="text-[#ffb84f] text-xs font-semibold">Save 20% with yearly billing</p>}
                </div>
                
                <div className="flex-1 px-8 py-8 space-y-8 border-t border-neutral-100/50">
                  {/* Feature Limits */}
                  {plan.featureLimits.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Usage Limits</p>
                      <div className="grid grid-cols-2 gap-2">
                        {plan.featureLimits.map((fl) => (
                          <div key={fl.featureName} className="bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-100">
                            <span className="text-xs font-medium text-[#0a0d14]">
                              {formatFeatureLimit(fl.featureName, fl.limit)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Permissions List */}
                  <div className="space-y-4">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Included Features</p>
                    <ul className="space-y-3">
                      {plan.permissions.map((perm) => {
                        const PermIcon = permissionIcons[perm.name] || categoryIcons[perm.category] || Check;
                        return (
                          <li key={perm.id} className="flex items-start gap-3">
                            <div className="mt-0.5 p-1.5 bg-[#ffb84f]/10 rounded-lg flex-shrink-0">
                              <PermIcon className="h-4 w-4 text-[#ffb84f]" />
                            </div>
                            <span className="text-sm text-[#0a0d14] font-light">
                              {perm.description || perm.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Subscription Details */}
                  {plan.subscriptionDetails.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-neutral-100">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Additional Benefits</p>
                      <ul className="space-y-2">
                        {plan.subscriptionDetails.map((detail) => (
                          <li key={detail.id} className="flex items-start gap-3">
                            <Check className="h-4 w-4 text-[#ffb84f] mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-neutral-600 font-light">{detail.details}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="px-8 py-8 border-t border-neutral-100/50">
                  <Link href={`/${locale}/dashboard/lawyer/payments/invoice/${plan.id}?cycle=${billingCycle}`} className="w-full block">
                    <button className={`w-full py-4 rounded-full font-bold uppercase text-sm tracking-widest transition-all ${
                      isPremium
                        ? 'bg-[#ffb84f] text-black hover:bg-[#e5a443] shadow-lg shadow-[#ffb84f]/20'
                        : 'bg-[#0a0d14] text-white hover:bg-[#1a1d24]'
                    }`}>
                      Subscribe Now
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Help Section */}
        <div className="bg-[#fafafa] rounded-3xl p-12 border border-neutral-100">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <ShieldCheck className="h-12 w-12 text-[#ffb84f] mx-auto" />
            <h2 className="text-2xl font-bold text-[#0a0d14]">Not Sure Which Plan?</h2>
            <p className="text-neutral-600 font-light leading-relaxed">
              All plans include 24/7 support, secure payments, and monthly analytics. Upgrade or downgrade your plan at any time without penalties.
            </p>
            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Link href={`/${locale}/dashboard/lawyer`} className="inline-flex items-center gap-2 px-6 py-3 bg-[#0a0d14] text-white rounded-full font-bold hover:bg-[#1a1d24] transition-colors">
                <LayoutDashboard className="h-5 w-5" />
                Go to Dashboard
              </Link>
              <Link href={`/${locale}`} className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#0a0d14] rounded-full font-bold border-2 border-[#ffb84f] hover:bg-[#ffb84f]/10 transition-colors">
                <Scale className="h-5 w-5" />
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
