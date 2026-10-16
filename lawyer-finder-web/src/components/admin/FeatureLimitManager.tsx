'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface FeatureLimitConfig {
  id: string
  roleId: string
  featureName: string
  limit: number
  description?: string
}

interface SubscriptionRole {
  id: string
  name: string
  featureLimits: FeatureLimitConfig[]
}

export function FeatureLimitManager() {
  const [roles, setRoles] = useState<SubscriptionRole[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [limits, setLimits] = useState<FeatureLimitConfig[]>([])
  const [saving, setSaving] = useState(false)
  const [newFeatureName, setNewFeatureName] = useState('')

  useEffect(() => {
    fetchRoles()
  }, [])

  async function fetchRoles() {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/roles')
      if (!response.ok) throw new Error('Failed to fetch roles')
      const rolesData = await response.json()
      setRoles(rolesData)
    } catch (error) {
      toast.error('Failed to load roles')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectRole(roleId: string) {
    try {
      setSelectedRoleId(roleId)
      const response = await fetch(`/api/admin/roles/${roleId}/feature-limits`)
      if (!response.ok) throw new Error('Failed to fetch feature limits')
      const limitsData = await response.json()
      setLimits(limitsData)
    } catch (error) {
      toast.error('Failed to load feature limits')
    }
  }

  function handleLimitChange(featureName: string, value: string) {
    setLimits((prev) =>
      prev.map((limit) =>
        limit.featureName === featureName
          ? { ...limit, limit: value === 'unlimited' ? -1 : parseInt(value) || 0 }
          : limit
      )
    )
  }

  function handleAddLimit() {
    if (!newFeatureName.trim()) return
    // Check if it already exists
    if (limits.some(l => l.featureName === newFeatureName.trim())) {
      toast.error('Limit for this feature already exists')
      return
    }
    
    setLimits(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        roleId: selectedRoleId!,
        featureName: newFeatureName.trim(),
        limit: -1,
      }
    ])
    setNewFeatureName('')
  }

  async function handleSaveLimits() {
    if (!selectedRoleId) return

    try {
      setSaving(true)
      const response = await fetch(`/api/admin/roles/${selectedRoleId}/feature-limits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limits: limits.map((limit) => ({
            featureName: limit.featureName,
            limit: limit.limit,
          })),
        }),
      })

      if (!response.ok) throw new Error('Failed to update limits')
      toast.success('Feature limits updated successfully')
      fetchRoles()
    } catch (error) {
      toast.error('Failed to update feature limits')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId)

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Feature Limits</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select Role</label>
          <select
            value={selectedRoleId || ''}
            onChange={(e) => handleSelectRole(e.target.value)}
            className="w-full border rounded-lg p-2"
          >
            <option value="">Choose a role...</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>

        {selectedRole && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Limits for {selectedRole.name}</h3>

            <div className="mb-6 flex gap-2">
              <Input
                placeholder="Enter new feature name (e.g. document_templates)"
                value={newFeatureName}
                onChange={(e) => setNewFeatureName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLimit()}
              />
              <Button onClick={handleAddLimit} variant="secondary">
                Add Limit
              </Button>
            </div>

            {limits.length > 0 ? (
              <div className="space-y-4 mb-6">
                {limits.map((limit) => (
                  <div key={limit.id} className="border rounded-lg p-4 relative group">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setLimits(prev => prev.filter(l => l.featureName !== limit.featureName))}
                    >
                      Remove
                    </Button>
                    <label className="block text-sm font-medium mb-2">
                      {limit.featureName}
                      {limit.description && (
                        <span className="text-gray-600 text-xs block mt-1">
                          {limit.description}
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        value={limit.limit === -1 ? '' : limit.limit}
                        onChange={(e) => handleLimitChange(limit.featureName, e.target.value)}
                        placeholder="Enter limit (or -1 for unlimited)"
                        min="-1"
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-600 min-w-max">
                        {limit.limit === -1 ? '∞ Unlimited' : `${limit.limit} units`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border rounded-lg mb-6 bg-gray-50/50">
                No feature limits configured for this role. Add one above.
              </div>
            )}

            <Button
              onClick={handleSaveLimits}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? 'Saving...' : 'Save Feature Limits'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
