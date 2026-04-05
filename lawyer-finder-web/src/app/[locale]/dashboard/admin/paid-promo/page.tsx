'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Megaphone, Plus, Loader2, Trash2, RefreshCw,
  Calendar, CreditCard, FileText, CheckCircle2, XCircle
} from 'lucide-react';

interface Promo {
  id: string;
  lawyerId: string;
  fromDate: string;
  toDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  paymentStatus: 'PAID' | 'UNPAID' | 'PENDING';
  invoiceId: string | null;
  createdAt: string;
  lawyer: {
    fullName: string;
    baslNumber: string;
    district: string;
  };
}

interface Lawyer {
  id: string;
  fullName: string;
  baslNumber: string;
}

export default function PaidPromoPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [form, setForm] = useState({
    lawyerId: '',
    fromDate: '',
    toDate: '',
    status: 'INACTIVE',
    paymentStatus: 'UNPAID',
    invoiceId: '',
  });

  const fetchPromos = () => {
    setLoading(true);
    fetch('/api/admin/paid-promo')
      .then(res => res.json())
      .then(d => setPromos(d.promos || []))
      .catch(() => toast.error('Failed to load promos.'))
      .finally(() => setLoading(false));
  };

  const fetchLawyers = () => {
    fetch('/api/lawyers')
      .then(res => res.json())
      .then(d => {
        const list = d.lawyers || d || [];
        setLawyers(Array.isArray(list) ? list.map((l: any) => ({ id: l.id, fullName: l.fullName, baslNumber: l.baslNumber })) : []);
      })
      .catch(() => {});
  };

  useEffect(() => { fetchPromos(); fetchLawyers(); }, []);

  const handleCreate = async () => {
    if (!form.lawyerId || !form.fromDate || !form.toDate) {
      return toast.error('Lawyer, From Date, and To Date are required.');
    }
    setCreateLoading(true);
    try {
      const res = await fetch('/api/admin/paid-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success('Promo created successfully.');
      setShowCreate(false);
      setForm({ lawyerId: '', fromDate: '', toDate: '', status: 'INACTIVE', paymentStatus: 'UNPAID', invoiceId: '' });
      fetchPromos();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create promo.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    setActionLoading(`status-${id}`);
    try {
      const res = await fetch('/api/admin/paid-promo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
      });
      if (!res.ok) throw new Error('Failed.');
      toast.success('Status updated.');
      fetchPromos();
    } catch {
      toast.error('Failed to update status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePaymentUpdate = async (id: string, paymentStatus: string) => {
    setActionLoading(`payment-${id}`);
    try {
      const res = await fetch('/api/admin/paid-promo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, paymentStatus }),
      });
      if (!res.ok) throw new Error('Failed.');
      toast.success('Payment status updated.');
      fetchPromos();
    } catch {
      toast.error('Failed to update payment.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this promo entry?')) return;
    setActionLoading(`delete-${id}`);
    try {
      const res = await fetch(`/api/admin/paid-promo?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed.');
      toast.success('Promo deleted.');
      fetchPromos();
    } catch {
      toast.error('Failed to delete.');
    } finally {
      setActionLoading(null);
    }
  };

  const statusColor = (status: string) => {
    return status === 'ACTIVE'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-neutral-100 text-neutral-600 border-neutral-200';
  };

  const paymentColor = (status: string) => {
    if (status === 'PAID') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'PENDING') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-600 border-red-200';
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
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Paid Promotions</h1>
            <p className="text-sm text-neutral-500 font-medium">Manage lawyer promotional campaigns</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-wide hover:bg-neutral-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Promo
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white border border-neutral-200 p-6 space-y-4 animate-in fade-in duration-300">
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">Create New Promotion</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Lawyer</label>
              <select
                value={form.lawyerId}
                onChange={(e) => setForm({ ...form, lawyerId: e.target.value })}
                className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
              >
                <option value="">Select Lawyer</option>
                {lawyers.map(l => (
                  <option key={l.id} value={l.id}>{l.fullName} ({l.baslNumber})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">From Date</label>
              <input
                type="date"
                value={form.fromDate}
                onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
                className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">To Date</label>
              <input
                type="date"
                value={form.toDate}
                onChange={(e) => setForm({ ...form, toDate: e.target.value })}
                className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
              >
                <option value="INACTIVE">Inactive</option>
                <option value="ACTIVE">Active</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Payment Status</label>
              <select
                value={form.paymentStatus}
                onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
                className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
              >
                <option value="UNPAID">Unpaid</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">Invoice ID (Optional)</label>
              <input
                type="text"
                placeholder="e.g. INV-001"
                value={form.invoiceId}
                onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}
                className="w-full py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a]"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              disabled={createLoading}
              className="px-6 py-2.5 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-wide hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-1.5"
            >
              {createLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Create Promo
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-6 py-2.5 text-xs font-bold text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-white border border-neutral-200 animate-pulse" />
          ))}
        </div>
      ) : promos.length === 0 ? (
        <div className="bg-white border border-neutral-200 p-12 text-center">
          <Megaphone className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500 font-medium">No promotions yet.</p>
          <p className="text-xs text-neutral-400 mt-1">Create a new promotion to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Lawyer</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">From Date</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">To Date</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Payment</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Invoice</th>
                <th className="text-right px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((promo) => (
                <tr key={promo.id} className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-neutral-900">{promo.lawyer.fullName}</p>
                    <p className="text-[11px] text-neutral-500">{promo.lawyer.baslNumber}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-neutral-700 font-medium flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-neutral-400" />
                      {new Date(promo.fromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-neutral-700 font-medium flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-neutral-400" />
                      {new Date(promo.toDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleStatusToggle(promo.id, promo.status)}
                      disabled={actionLoading === `status-${promo.id}`}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 border cursor-pointer hover:opacity-80 transition-opacity ${statusColor(promo.status)}`}
                    >
                      {actionLoading === `status-${promo.id}` ? <Loader2 className="w-3 h-3 animate-spin inline" /> : promo.status}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={promo.paymentStatus}
                      onChange={(e) => handlePaymentUpdate(promo.id, e.target.value)}
                      disabled={actionLoading === `payment-${promo.id}`}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border cursor-pointer outline-none ${paymentColor(promo.paymentStatus)}`}
                    >
                      <option value="UNPAID">Unpaid</option>
                      <option value="PENDING">Pending</option>
                      <option value="PAID">Paid</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-neutral-700 font-mono font-medium">
                      {promo.invoiceId || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleDelete(promo.id)}
                      disabled={actionLoading === `delete-${promo.id}`}
                      className="text-red-500 hover:text-red-700 transition-colors p-1.5 hover:bg-red-50"
                    >
                      {actionLoading === `delete-${promo.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
