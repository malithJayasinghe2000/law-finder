'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Search,
  DollarSign,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SubscriptionTier } from '@prisma/client';

interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  monthlyAmount: number;
  yearlyAmount: number;
  description?: string;
  createdAt: string;
}

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    tier: 'BASIC' as SubscriptionTier,
    monthlyAmount: 0,
    yearlyAmount: 0,
    description: '',
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/subscriptions/plans');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlans(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (plan: SubscriptionPlan | null = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        tier: plan.tier,
        monthlyAmount: plan.monthlyAmount,
        yearlyAmount: plan.yearlyAmount,
        description: plan.description || '',
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        tier: 'BASIC',
        monthlyAmount: 0,
        yearlyAmount: 0,
        description: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = '/api/admin/subscriptions/plans';

      const method = editingPlan ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPlan ? { ...formData, id: editingPlan.id } : formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(editingPlan ? 'Plan updated' : 'Plan created');
      setIsModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      const res = await fetch(`/api/admin/subscriptions/plans?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || 'Failed to delete');
      }
      toast.success('Plan deleted');
      fetchPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete plan');
    }
  };

  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Subscription Plans</h1>
          <p className="text-neutral-600 mt-2">Create and manage subscription tiers</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus className="w-4 h-4" /> New Plan
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
        <Input
          placeholder="Search plans..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredPlans.map((plan) => (
          <Card key={plan.id} className="relative overflow-hidden">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription className="text-xs mt-1">{plan.tier}</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenModal(plan)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(plan.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-neutral-400" />
                <div>
                  <p className="text-sm text-neutral-600">Monthly</p>
                  <p className="text-lg font-bold text-neutral-900">${plan.monthlyAmount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-neutral-400" />
                <div>
                  <p className="text-sm text-neutral-600">Yearly</p>
                  <p className="text-lg font-bold text-neutral-900">${plan.yearlyAmount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPlans.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-neutral-600">No plans found</p>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlan ? 'Update subscription plan details' : 'Add a new subscription plan'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-700">Plan Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Professional"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Tier</label>
              <select
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value as SubscriptionTier })}
                className="w-full px-3 py-2 border rounded-md text-neutral-900"
              >
                <option value="BASIC">BASIC</option>
                <option value="PROFESSIONAL">PROFESSIONAL</option>
                <option value="PREMIUM">PREMIUM</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Monthly Amount ($)</label>
              <Input
                type="number"
                value={formData.monthlyAmount}
                onChange={(e) => setFormData({ ...formData, monthlyAmount: parseInt(e.target.value) })}
                placeholder="99"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Yearly Amount ($)</label>
              <Input
                type="number"
                value={formData.yearlyAmount}
                onChange={(e) => setFormData({ ...formData, yearlyAmount: parseInt(e.target.value) })}
                placeholder="999"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Plan description"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingPlan ? 'Update Plan' : 'Create Plan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
