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

// Format feature limit for display.
//
// Every label here must describe SOFTWARE the firm gets, never CLIENTS it gets.
// "50 Inquiries/mo" and "500 Messages/mo" used to appear on this page — a lawyer
// paying us more to receive more clients is pay-per-lead, and publishing it on a
// pricing page is the clearest possible evidence of it.
// See docs/restructure/LEGAL-GUARDRAILS.md (rules 1 and 3).
function formatFeatureLimit(name: string, limit: number): string {
  const labels: Record<string, { one: string; many: string; unlimited: string }> = {
    firm_seats: { one: '1 user', many: `${limit} users`, unlimited: 'Unlimited users' },
    storage_gb: { one: '1 GB storage', many: `${limit} GB storage`, unlimited: 'Unlimited storage' },
    articles_per_month: { one: '1 article/mo', many: `${limit} articles/mo`, unlimited: 'Unlimited articles' },
    document_templates: { one: '1 document template', many: `${limit} document templates`, unlimited: 'Unlimited document templates' },
    ai_research_queries_per_month: { one: '1 research query/mo', many: `${limit} research queries/mo`, unlimited: 'Unlimited research queries' },
  };

  const label = labels[name];
  if (!label) return limit === -1 ? 'Unlimited' : `${limit}`;
  if (limit === -1) return label.unlimited;
  return limit === 1 ? label.one : label.many;
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
    <div className="min-h-screen bg-white py-24 px-6 lg:px-12 xl:px-24 font-sans">
      <div className="max-w-[1400px] mx-auto">
        {/* Header Section */}
        <div className="text-center mb-20 space-y-6">
          <Badge variant="outline" className="px-4 py-1.5 rounded-none border-[#bfa37a]/20 text-[#bfa37a] font-bold tracking-widest uppercase text-[10px]">
            Pricing Table
          </Badge>
          <h1 className="text-4xl md:text-5xl font-serif text-neutral-900 tracking-tight">
            Our Best Pricing Plan
          </h1>
          <p className="text-neutral-500 max-w-xl mx-auto font-light text-sm leading-relaxed">
            Choose the subscription tier that perfectly aligns with your legal practice requirements.
          </p>

          {/* Billing Switcher */}
          <div className="flex justify-center pt-6">
            <div className="bg-[#faf6f0] p-1 rounded-none inline-flex items-center border border-neutral-100">
              <Tabs
                value={billingCycle}
                onValueChange={(val) => setBillingCycle(val as 'monthly' | 'yearly')}
                className="w-auto"
              >
                <TabsList className="rounded-none bg-transparent h-auto p-0">
                  <TabsTrigger
                    value="monthly"
                    className="rounded-none px-6 py-2.5 data-[state=active]:bg-[#bfa37a] data-[state=active]:text-white text-xs font-bold uppercase tracking-wider transition-all text-neutral-600"
                  >
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger
                    value="yearly"
                    className="rounded-none px-6 py-2.5 data-[state=active]:bg-[#bfa37a] data-[state=active]:text-white text-xs font-bold uppercase tracking-wider transition-all text-neutral-600 flex items-center gap-1.5"
                  >
                    Yearly <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-neutral-900 text-white rounded-none">Save 20%</Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.filter(p => p.tier !== 'BASIC').map((plan, idx) => {
            const isFeatured = plan.tier === 'PREMIUM' || idx === 1; // Highlight the middle card
            const amount = billingCycle === 'monthly' ? plan.monthlyAmount : plan.yearlyAmount;

            return (
              <div
                key={plan.id}
                className={`flex flex-col h-full rounded-none shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-neutral-100 p-8 sm:p-10 ${
                  isFeatured ? 'bg-[#1a1a1a] text-white' : 'bg-[#faf6f0] text-neutral-900'
                }`}
              >
                <div className="mb-6">
                  <h3 className={`text-xs uppercase tracking-widest font-bold mb-4 ${isFeatured ? 'text-[#bfa37a]' : 'text-neutral-500'}`}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 border-b border-neutral-200/60 pb-6 mb-8">
                    <span className={`text-4xl font-serif font-bold ${isFeatured ? 'text-white' : 'text-neutral-900'}`}>
                      LKR {amount.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      {billingCycle === 'monthly' ? '/MO' : '/YR'}
                    </span>
                  </div>
                </div>

                {/* Features List */}
                <div className="flex-1 space-y-6">
                  {/* Usage Limits */}
                  {plan.featureLimits.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400">Usage Limits</p>
                      <div className="grid grid-cols-1 gap-2">
                        {plan.featureLimits.map((fl) => (
                          <div key={fl.featureName} className={`px-3 py-2 border text-xs font-bold ${isFeatured ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-neutral-200/50 text-neutral-800'}`}>
                            {formatFeatureLimit(fl.featureName, fl.limit)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Permissions */}
                  <div className="space-y-4 pt-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400">Permissions</p>
                    <ul className="space-y-3.5">
                      {plan.permissions.map((perm) => (
                        <li key={perm.id} className="flex items-start gap-2.5 text-sm">
                          <span className="text-[#bfa37a] font-bold text-base mt-[-2px]">✓</span>
                          <div className="flex flex-col">
                            <span className={`leading-snug font-medium text-xs ${isFeatured ? 'text-neutral-200' : 'text-neutral-700'}`}>
                              {perm.description || perm.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                          </div>
                        </li>
                      ))}
                      {/* Negative features for visual symmetry if fewer permissions */}
                      {plan.permissions.length < 5 && (
                        <li className="flex items-start gap-2.5 text-sm opacity-50">
                          <span className="text-neutral-400 font-bold text-base mt-[-2px]">✗</span>
                          <span className={`text-xs ${isFeatured ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            Priority Ad Placement support
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-10">
                  <Link href={`/${locale}/dashboard/lawyer/payments/invoice/${plan.id}?cycle=${billingCycle}`} className="w-full">
                    <button className="w-full bg-[#bfa37a] hover:bg-[#a68d67] text-white py-4.5 text-xs font-bold uppercase tracking-widest rounded-none transition-all">
                      Get Start
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Back navigation options */}
        <div className="mt-16 text-center">
          <div className="flex flex-col items-center gap-4 p-8 border border-dashed border-neutral-200 bg-[#faf6f0]/50">
            <div className="flex items-center gap-2 text-neutral-500 text-xs uppercase tracking-[0.15em] font-bold">
              <ShieldCheck className="h-4 w-4 text-[#bfa37a]" /> Secured Platform Access
            </div>
            <div className="flex items-center justify-center gap-8 text-xs uppercase tracking-widest font-bold">
              <Link href={`/${locale}/dashboard/lawyer`} className="hover:text-[#bfa37a] transition-all flex items-center gap-2">
                Dashboard
              </Link>
              <span className="text-neutral-300">|</span>
              <Link href={`/${locale}`} className="hover:text-[#bfa37a] transition-all flex items-center gap-2">
                Home Page
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
