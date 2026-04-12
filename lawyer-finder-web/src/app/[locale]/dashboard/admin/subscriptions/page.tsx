'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  CreditCard,
  Users,
  Key,
  BarChart3,
  Settings,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalRoles: number;
  totalPermissions: number;
}

export default function SubscriptionsPage() {
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/subscriptions/stats');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setStats(data);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const modules = [
    {
      title: 'Subscription Plans',
      description: 'Manage subscription tiers, pricing, and details',
      icon: CreditCard,
      href: '/subscriptions/plans',
      color: 'bg-blue-50 text-blue-700',
      stat: '4 Tiers'
    },
    {
      title: 'Subscription Roles',
      description: 'Manage roles and assign permissions',
      icon: Users,
      href: '/subscriptions/roles',
      color: 'bg-purple-50 text-purple-700',
      stat: `${stats?.totalRoles || 0} Roles`
    },
    {
      title: 'Permissions',
      description: 'Create and manage feature permissions',
      icon: Key,
      href: '/subscriptions/permissions',
      color: 'bg-orange-50 text-orange-700',
      stat: `${stats?.totalPermissions || 0} Permissions`
    },
    {
      title: 'Usage Tracking',
      description: 'Monitor feature usage and limits',
      icon: BarChart3,
      href: '/subscriptions/usage',
      color: 'bg-green-50 text-green-700',
      stat: `${stats?.activeSubscriptions || 0} Active`
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Subscription Management</h1>
        <p className="text-neutral-600 mt-2">Manage subscription plans, roles, permissions, and track usage</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-700">Total Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900">{stats?.totalSubscriptions || 0}</div>
            <p className="text-xs text-neutral-500 mt-1">All subscription instances</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-700">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.activeSubscriptions || 0}</div>
            <p className="text-xs text-neutral-500 mt-1">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-700">Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats?.totalRoles || 0}</div>
            <p className="text-xs text-neutral-500 mt-1">Subscription roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-700">Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.totalPermissions || 0}</div>
            <p className="text-xs text-neutral-500 mt-1">Total permissions</p>
          </CardContent>
        </Card>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((module) => {
          const IconComponent = module.icon;
          return (
            <Link key={module.href} href={`/dashboard/admin${module.href}`}>
              <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-3 rounded-lg ${module.color}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-semibold text-neutral-600 bg-neutral-100 px-2 py-1 rounded">
                      {module.stat}
                    </span>
                  </div>
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="ghost"
                    className="w-full justify-between group text-primary p-0 h-auto"
                  >
                    Manage
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
