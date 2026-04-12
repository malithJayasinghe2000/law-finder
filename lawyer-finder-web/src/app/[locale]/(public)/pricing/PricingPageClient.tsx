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
    <div className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-[1200px] mx-auto">
        {/* Header Section */}
        <div className="text-center mb-16 space-y-6">
          <Badge variant="outline" className="px-4 py-1.5 rounded-none border-primary/20 text-primary font-bold tracking-widest uppercase">
            Premium Experience
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the billing cycle that fits your practice perfectly.
          </p>

          {/* Billing Switcher */}
          <div className="flex justify-center mt-10">
            <div className="bg-muted p-1.5 rounded-none inline-flex items-center">
              <Tabs 
                value={billingCycle} 
                onValueChange={(val) => setBillingCycle(val as 'monthly' | 'yearly')}
                className="w-auto"
              >
                <TabsList className="rounded-none bg-transparent">
                  <TabsTrigger 
                    value="monthly" 
                    className="rounded-none px-8 py-2.5 data-active:bg-background data-active:shadow-sm font-bold transition-all"
                  >
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger 
                    value="yearly" 
                    className="rounded-none px-8 py-2.5 data-active:bg-background data-active:shadow-sm font-bold transition-all flex items-center gap-1.5"
                  >
                    Yearly <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary hover:bg-primary/20">Save 20%</Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.filter(p => p.tier !== 'BASIC').map((plan) => {
            const isProfessional = plan.tier === 'PROFESSIONAL';
            const isPremium = plan.tier === 'PREMIUM';
            const isEnterprise = plan.tier === 'ENTERPRISE';
            const amount = billingCycle === 'monthly' ? plan.monthlyAmount : plan.yearlyAmount;
            const TierIcon = tierIcons[plan.tier] || ShieldCheck;

            return (
              <Card 
                key={plan.id}
                className={`relative flex flex-col h-full border border-border/50 rounded-none shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group bg-card`}
              >
                {/* Visual Highlights */}
                {isPremium && (
                  <div className="absolute inset-x-0 -top-px h-2 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
                )}
                
                <CardHeader className="pb-8 pt-10 px-8">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-3 rounded-none ${isPremium ? 'bg-primary text-primary-foreground' : 'bg-neutral-100 text-neutral-900'}`}>
                      <TierIcon className="h-7 w-7" />
                    </div>
                    {isPremium && (
                      <Badge className="bg-primary text-primary-foreground font-bold rounded-none px-4 py-1 tracking-tighter">Most Popular</Badge>
                    )}
                  </div>
                  <CardTitle className="text-2xl font-bold tracking-tight text-foreground mb-1">{plan.name}</CardTitle>
                  <CardDescription className="text-primary flex items-baseline gap-1 mt-6">
                    <span className="text-4xl font-extrabold text-foreground tracking-tighter">LKR {amount.toLocaleString()}</span>
                    <span className="text-xs font-bold text-muted-foreground uppercase">{billingCycle === 'monthly' ? '/mo' : '/yr'}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 space-y-8 px-8">
                  {/* Feature Limits */}
                  {plan.featureLimits.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.2em]">Usage Limits</p>
                      <div className="grid grid-cols-2 gap-2">
                        {plan.featureLimits.map((fl) => (
                          <div key={fl.featureName} className="bg-neutral-50 px-3 py-2 border border-neutral-100">
                            <span className="text-xs font-bold text-foreground">
                              {formatFeatureLimit(fl.featureName, fl.limit)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Permissions List */}
                  <div className="space-y-5">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.2em]">Included Permissions</p>
                    <ul className="space-y-3">
                      {plan.permissions.map((perm) => {
                        const PermIcon = permissionIcons[perm.name] || categoryIcons[perm.category] || Check;
                        return (
                          <li key={perm.id} className="flex items-start gap-3 group/item">
                            <div className="mt-0.5 rounded-none bg-primary/5 p-1.5 group-hover/item:bg-primary/20 transition-all shrink-0">
                              <PermIcon className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-foreground/90 leading-tight group-hover/item:text-foreground transition-colors font-semibold">
                                {perm.description || perm.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </span>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                                {perm.category}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Subscription Details (extra info from admin) */}
                  {plan.subscriptionDetails.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-neutral-100">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.2em]">Additional Benefits</p>
                      <ul className="space-y-2">
                        {plan.subscriptionDetails.map((detail) => (
                          <li key={detail.id} className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-full bg-primary/5 p-1">
                              <Check className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <span className="text-sm text-foreground/80 leading-relaxed font-medium">
                              {detail.details}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-10 pb-12 px-8">
                  <Link href={`/${locale}/dashboard/lawyer/payments/invoice/${plan.id}?cycle=${billingCycle}`} className="w-full">
                    <button className={`w-full py-7 text-sm uppercase tracking-widest rounded-none transition-all duration-300 ${isPremium ? 'bg-primary text-primary-foreground hover:scale-[1.02] shadow-lg shadow-primary/20' : 'bg-neutral-900 text-white hover:bg-neutral-800'}`}>
                      Subscribe Now
                    </button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Access info footer */}
        <div className="mt-16 text-center">
           <div className="flex flex-col items-center gap-6 p-10 border border-dashed border-border/60 bg-neutral-50/30">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.15em] font-bold">
                 <ShieldCheck className="h-4 w-4" /> Admin & Lawyer Secured Access
              </div>
              <div className="flex items-center justify-center gap-8">
                 <Link href={`/${locale}/dashboard/lawyer`} className="text-sm hover:text-primary transition-all flex items-center gap-2 font-bold group">
                   <div className="p-2 rounded-none bg-neutral-100 group-hover:bg-primary/10 transition-colors">
                     <LayoutDashboard className="h-4 w-4" />
                   </div>
                   Dashboard
                 </Link>
                 <Link href={`/${locale}`} className="text-sm hover:text-primary transition-all flex items-center gap-2 font-bold group">
                   <div className="p-2 rounded-none bg-neutral-100 group-hover:bg-primary/10 transition-colors">
                     <Scale className="h-4 w-4" />
                   </div>
                   Home Page
                 </Link>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
