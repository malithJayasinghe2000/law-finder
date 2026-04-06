'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ShieldCheck, Zap, Crown, Loader2, Scale, LayoutDashboard, ChessQueen, ChessKing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import Link from 'next/link';

interface SubscriptionPlan {
  id: string;
  name: string;
  tier: number;
  monthlyAmount: number;
  yearlyAmount: number;
  subscriptionDetails: { id: string; details: string }[];
}

export default function PricingPageClient({ locale }: { locale: string }) {
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch('/api/subscriptions/plans');
        if (!res.ok) {
          if (res.status === 401) {
            router.push(`/${locale}/login`);
            return;
          }
          throw new Error('Failed to fetch pricing plans');
        }
        const data = await res.json();
        setPlans(data);
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
          {plans.map((plan, index) => {
            const isPremium = plan.tier > 0;
            const isUltra = plan.tier > 1 &&  plan.tier <3;
            const isSuperUltra = plan.tier > 2;
            const amount = billingCycle === 'monthly' ? plan.monthlyAmount : plan.yearlyAmount;

            return (
              <Card 
                key={plan.id}
                className={`relative flex flex-col h-full border border-border/50 rounded-none shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group bg-card`}
              >
                {/* Visual Highlights */}
                {isUltra && (
                  <div className="absolute inset-x-0 -top-px h-2 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
                )}
                
                <CardHeader className="pb-8 pt-10 px-8">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-3 rounded-none ${isUltra ? 'bg-primary text-primary-foreground' : 'bg-neutral-100 text-neutral-900'}`}>
                      {isUltra 
                        ? <ChessQueen className="h-7 w-7" /> 
                        : isPremium 
                          ? <Zap className="h-7 w-7" /> 
                          : isSuperUltra ? <ChessKing className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />
                      }
                    </div>
                    {isUltra && (
                      <Badge className="bg-primary text-primary-foreground font-bold rounded-none px-4 py-1 tracking-tighter">Most Selling</Badge>
                    )}
                   
                  </div>
                  <CardTitle className="text-2xl font-bold tracking-tight text-foreground mb-1">{plan.name}</CardTitle>
                  <CardDescription className="text-primary flex items-baseline gap-1 mt-6">
                    <span className="text-4xl font-extrabold text-foreground tracking-tighter">LKR {amount.toLocaleString()}</span>
                    <span className="text-xs font-bold text-muted-foreground uppercase">{billingCycle === 'monthly' ? '/mo' : '/yr'}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 space-y-8 px-8">
                  <div className="space-y-5">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.2em]">What you'll get</p>
                    <ul className="space-y-4">
                      {plan.subscriptionDetails.map((detail) => (
                        <li key={detail.id} className="flex items-start gap-4 group/item">
                          <div className="mt-0.5 rounded-full bg-primary/5 p-1 group-hover/item:bg-primary/20 transition-all">
                            <Check className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm text-foreground/80 leading-relaxed group-hover/item:text-foreground transition-colors font-medium">
                            {detail.details}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>

                <CardFooter className="pt-10 pb-12 px-8">
                  <Button 
                    asChild
                    className={`w-full py-7 text-sm uppercase tracking-widest rounded-none transition-all duration-300 ${isUltra ? 'bg-primary text-primary-foreground hover:scale-[1.02] shadow-lg shadow-primary/20' : 'bg-neutral-900 text-white hover:bg-neutral-800'}`}
                  >
                    <Link href={`/${locale}/dashboard/lawyer/payments/invoice/${plan.id}?cycle=${billingCycle}`}>
                      Subscribe Now
                    </Link>
                  </Button>
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
