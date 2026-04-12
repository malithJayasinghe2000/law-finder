'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Search,
  Activity,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface UsageRecord {
  id: string;
  lawyerName: string;
  subscriptionTier: string;
  featureName: string;
  usageCount: number;
  limit: number;
  percentageUsed: number;
  status: 'safe' | 'warning' | 'exceeded';
  lastUsed: string;
}

interface UsageStats {
  totalLawyers: number;
  activeSubscriptions: number;
  featuresTracked: number;
  averageUsagePercent: number;
  topUsedFeature: string;
}

export default function UsageTrackingPage() {
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recordsRes, statsRes] = await Promise.all([
        fetch('/api/admin/subscriptions/usage'),
        fetch('/api/admin/subscriptions/usage/stats'),
      ]);

      const recordsData = await recordsRes.json();
      const statsData = await statsRes.json();

      if (!recordsRes.ok) throw new Error(recordsData.error);
      if (!statsRes.ok) throw new Error(statsData.error);

      setRecords(recordsData);
      setStats(statsData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.lawyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         record.featureName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = filterTier === 'all' || record.subscriptionTier === filterTier;
    const matchesStatus = filterStatus === 'all' || record.status === filterStatus;
    return matchesSearch && matchesTier && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe':
        return 'bg-green-50 text-green-800';
      case 'warning':
        return 'bg-yellow-50 text-yellow-800';
      case 'exceeded':
        return 'bg-red-50 text-red-800';
      default:
        return 'bg-neutral-50 text-neutral-800';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'safe':
        return 'Safe';
      case 'warning':
        return 'Warning';
      case 'exceeded':
        return 'Exceeded';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Usage Tracking</h1>
        <p className="text-neutral-600 mt-2">Monitor feature usage across subscriptions</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-700">Total Lawyers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{stats.totalLawyers}</div>
              <p className="text-xs text-neutral-500 mt-1">Active users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-700">Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeSubscriptions}</div>
              <p className="text-xs text-neutral-500 mt-1">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-700">Features Tracked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.featuresTracked}</div>
              <p className="text-xs text-neutral-500 mt-1">Total features</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-700">Avg. Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.averageUsagePercent}%</div>
              <p className="text-xs text-neutral-500 mt-1">Overall</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Search lawyers or features..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className="px-3 py-2 border rounded-md text-neutral-900 whitespace-nowrap"
        >
          <option value="all">All Tiers</option>
          <option value="BASIC">BASIC</option>
          <option value="PROFESSIONAL">PROFESSIONAL</option>
          <option value="PREMIUM">PREMIUM</option>
          <option value="ENTERPRISE">ENTERPRISE</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-md text-neutral-900 whitespace-nowrap"
        >
          <option value="all">All Status</option>
          <option value="safe">Safe</option>
          <option value="warning">Warning</option>
          <option value="exceeded">Exceeded</option>
        </select>
      </div>

      {/* Usage Table */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Usage</CardTitle>
          <CardDescription>Total: {filteredRecords.length} records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-900">Lawyer</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-900">Tier</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-900">Feature</th>
                  <th className="text-center py-3 px-4 font-semibold text-neutral-900">Usage</th>
                  <th className="text-center py-3 px-4 font-semibold text-neutral-900">Limit</th>
                  <th className="text-center py-3 px-4 font-semibold text-neutral-900">Progress</th>
                  <th className="text-center py-3 px-4 font-semibold text-neutral-900">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-900">Last Used</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-neutral-50 transition">
                    <td className="py-3 px-4 font-medium text-neutral-900">{record.lawyerName}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {record.subscriptionTier}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-700">{record.featureName}</td>
                    <td className="py-3 px-4 text-center font-semibold text-neutral-900">
                      {record.usageCount}
                    </td>
                    <td className="py-3 px-4 text-center text-neutral-600">
                      {record.limit === -1 ? 'Unlimited' : record.limit}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-neutral-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              record.status === 'safe'
                                ? 'bg-green-500'
                                : record.status === 'warning'
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(record.percentageUsed, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-neutral-900 w-10">
                          {record.percentageUsed}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusColor(record.status)}`}>
                        {getStatusBadge(record.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-600 text-xs">
                      {new Date(record.lastUsed).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filteredRecords.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-neutral-600">No usage records found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
