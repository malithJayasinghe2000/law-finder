'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface FeatureUsage {
  name: string
  current: number
  limit: string | number
  percentage: number
}

interface SubscriptionStats {
  subscriptionId: string
  tier: string
  status: string
  billingCycle: string
  features: FeatureUsage[]
}

export function SubscriptionViewer() {
  const [stats, setStats] = useState<SubscriptionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSubscriptionStats()
  }, [])

  async function fetchSubscriptionStats() {
    try {
      setLoading(true)
      const response = await fetch('/api/subscriptions/my-subscription')

      if (response.status === 404) {
        setError('No subscription found')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch subscription')
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      toast.error('Failed to load subscription')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-4">Loading subscription...</div>
  }

  if (error) {
    return (
      <Card className="p-6 border-yellow-200 bg-yellow-50">
        <h3 className="font-semibold text-yellow-800">{error}</h3>
        <p className="text-sm text-yellow-700 mt-2">
          Please contact support to create or activate a subscription.
        </p>
      </Card>
    )
  }

  if (!stats) {
    return null
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'EXPIRED':
        return 'bg-red-100 text-red-800'
      case 'CANCELED':
        return 'bg-gray-100 text-gray-800'
      case 'PAST_DUE':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-orange-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold">Your Subscription</h2>
            <p className="text-gray-600 text-sm mt-1">
              Subscription ID: {stats.subscriptionId.slice(0, 8)}...
            </p>
          </div>
          <div className="text-right">
            <Badge className={`${getStatusColor(stats.status)}`}>{stats.status}</Badge>
            <p className="text-sm text-gray-600 mt-2">{stats.billingCycle} Billing</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8 pb-8 border-b">
          <div>
            <p className="text-gray-600 text-sm">Tier</p>
            <p className="text-2xl font-bold capitalize">{stats.tier.toLowerCase()}</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Status</p>
            <p className="text-2xl font-bold capitalize">{stats.status.toLowerCase()}</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Billing Cycle</p>
            <p className="text-lg font-semibold">{stats.billingCycle}</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-4">Usage & Limits</h3>

        <div className="space-y-4">
          {stats.features.map((feature) => (
            <div key={feature.name} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="font-medium capitalize">
                    {feature.name.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">
                    {feature.current} / {feature.limit === 'Unlimited' ? '∞' : feature.limit}
                  </p>
                </div>
              </div>

              {typeof feature.limit === 'number' ? (
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all ${getUsageColor(feature.percentage)}`}
                    style={{ width: `${Math.min(feature.percentage, 100)}%` }}
                  />
                </div>
              ) : (
                <div className="bg-green-100 rounded-full h-2 flex items-center justify-center">
                  <span className="text-xs text-green-700 font-semibold">Unlimited</span>
                </div>
              )}

              {typeof feature.limit === 'number' && (
                <p className="text-xs text-gray-600 mt-1">
                  {feature.percentage}% used
                  {feature.percentage >= 90 && (
                    <span className="ml-2 text-red-600 font-semibold">⚠️ Limit soon</span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Need More?</h3>
        <p className="text-sm text-blue-800 mb-4">
          Upgrade your subscription to access more features and higher limits.
        </p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          Upgrade Now
        </button>
      </Card>
    </div>
  )
}
