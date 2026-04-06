'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ShieldPlus, Search, Edit3, Trash2, Plus, X, 
  Loader2, CheckCircle2, CreditCard,
  Target, DollarSign, ListChecks
} from 'lucide-react';

interface SubscriptionDetail {
  id?: string;
  details: string;
}

interface SubscriptionPlan {
  id: string;
  tier: number;
  name: string;
  monthlyAmount: number;
  yearlyAmount: number;
  subscriptionDetails: SubscriptionDetail[];
  createdAt: string;
  updatedAt: string;
}

export default function SubscriptionConfigPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    tier: 0,
    name: '',
    monthlyAmount: 0,
    yearlyAmount: 0,
    details: ['']
  });

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/subscriptions');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubscriptions(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load subscriptions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleOpenModal = (plan: SubscriptionPlan | null = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        tier: plan.tier,
        name: plan.name,
        monthlyAmount: plan.monthlyAmount,
        yearlyAmount: plan.yearlyAmount,
        details: plan.subscriptionDetails.map(d => d.details)
      });
    } else {
      setEditingPlan(null);
      setFormData({
        tier: subscriptions.length + 1,
        name: '',
        monthlyAmount: 0,
        yearlyAmount: 0,
        details: ['']
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPlan(null);
  };

  const handleAddDetailField = () => {
    setFormData(prev => ({
      ...prev,
      details: [...prev.details, '']
    }));
  };

  const handleRemoveDetailField = (index: number) => {
    if (formData.details.length === 1) return;
    const newDetails = [...formData.details];
    newDetails.splice(index, 1);
    setFormData(prev => ({
      ...prev,
      details: newDetails
    }));
  };

  const handleDetailChange = (index: number, value: string) => {
    const newDetails = [...formData.details];
    newDetails[index] = value;
    setFormData(prev => ({
      ...prev,
      details: newDetails
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('submit');

    // Filter out empty details
    const filteredDetails = formData.details.filter(d => d.trim() !== '');

    const payload = {
      ...formData,
      details: filteredDetails,
      id: editingPlan?.id
    };

    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: editingPlan ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      toast.success(editingPlan ? 'Subscription plan updated.' : 'Subscription plan created.');
      handleCloseModal();
      fetchSubscriptions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save subscription plan.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subscription plan?')) return;
    
    setActionLoading(`delete-${id}`);
    try {
      const res = await fetch(`/api/admin/subscriptions?id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      toast.success('Subscription plan deleted.');
      setSubscriptions(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete subscription plan.');
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
            <ShieldPlus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Subscription Config</h1>
            <p className="text-sm text-neutral-500 font-medium">Configure lawyer subscription plans and pricing</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-wide hover:bg-neutral-800 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add New Plan
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white border border-neutral-200 animate-pulse" />
          ))}
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="bg-white border border-neutral-200 p-12 text-center">
          <CreditCard className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500 font-medium">No subscription plans configured yet.</p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-4 text-xs font-bold text-neutral-900 underline hover:text-[#0a0a0a]"
          >
            Create your first plan
          </button>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Plan / Tier</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Prices</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Benefits</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((plan) => (
                <tr key={plan.id} className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-100 flex items-center justify-center shrink-0 border border-neutral-200 group-hover:border-[#0a0a0a] transition-colors">
                        <Target className="w-5 h-5 text-neutral-600 group-hover:text-[#0a0a0a]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-900">Tier {plan.tier}</p>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Plan Level</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-100 flex items-center justify-center shrink-0 border border-neutral-200 group-hover:border-[#0a0a0a] transition-colors">
                        <Target className="w-5 h-5 text-neutral-600 group-hover:text-[#0a0a0a]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-900">{plan.name}</p>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Plan Name</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase w-12">Monthly:</span>
                        <span className="text-sm font-bold text-emerald-600">LKR {plan.monthlyAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase w-12">Yearly:</span>
                        <span className="text-sm font-bold text-neutral-900">LKR {plan.yearlyAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5 max-w-sm">
                      {plan.subscriptionDetails.slice(0, 3).map((detail, idx) => (
                        <span key={idx} className="text-[10px] font-medium bg-neutral-100 text-neutral-600 px-2 py-0.5 border border-neutral-200 truncate">
                          {detail.details}
                        </span>
                      ))}
                      {plan.subscriptionDetails.length > 3 && (
                        <span className="text-[10px] font-bold text-neutral-400 px-1">
                          +{plan.subscriptionDetails.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenModal(plan)}
                        className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                        title="Edit Plan"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        disabled={actionLoading === `delete-${plan.id}`}
                        className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete Plan"
                      >
                        {actionLoading === `delete-${plan.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm" onClick={handleCloseModal}>
          <div className="bg-white w-full max-w-2xl border border-neutral-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 bg-neutral-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#0a0a0a] text-white">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
                    {editingPlan ? 'Edit Subscription Plan' : 'Add New Subscription Plan'}
                  </h3>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Configuration Details</p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="text-neutral-400 hover:text-neutral-900 transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 grid grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {/* Left Side: Basic Info */}
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2 flex items-center gap-2">
                      <Target className="w-3 h-3 text-neutral-400" />
                      Plan Tier / Level (Integer)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.tier || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, tier: parseInt(e.target.value) || 0 }))}
                      className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] transition-all"
                      placeholder="e.g. 1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2 flex items-center gap-2">
                      <Target className="w-3 h-3 text-neutral-400" />
                      Plan Name (String)
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] transition-all"
                      placeholder="e.g. Basic"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2 flex items-center gap-2">
                        <DollarSign className="w-3 h-3 text-neutral-400" />
                        Monthly Amount (LKR)
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={formData.monthlyAmount || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, monthlyAmount: parseInt(e.target.value) || 0 }))}
                        className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] transition-all"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2 flex items-center gap-2">
                        <DollarSign className="w-3 h-3 text-neutral-400" />
                        Yearly Amount (LKR)
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={formData.yearlyAmount || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, yearlyAmount: parseInt(e.target.value) || 0 }))}
                        className="w-full py-3 px-4 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Side: Benefits Details */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2 flex items-center gap-2">
                    <ListChecks className="w-3 h-3 text-neutral-400" />
                    Subscription Benefits
                  </label>
                  <div className="space-y-3">
                    {formData.details.map((detail, index) => (
                      <div key={index} className="flex gap-2 group">
                        <input
                          type="text"
                          required
                          value={detail}
                          onChange={(e) => handleDetailChange(index, e.target.value)}
                          placeholder="e.g. Dedicated profile badge"
                          className="flex-1 py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveDetailField(index)}
                          className="text-neutral-400 hover:text-red-600 p-2 transition-colors disabled:opacity-0"
                          disabled={formData.details.length === 1}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDetailField}
                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#0a0a0a] hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    Add More Detail
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-neutral-200 bg-neutral-50/30">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-3 text-xs font-bold text-neutral-500 uppercase tracking-widest hover:text-neutral-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'submit'}
                  className="px-8 py-3 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-black/10"
                >
                  {actionLoading === 'submit' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
