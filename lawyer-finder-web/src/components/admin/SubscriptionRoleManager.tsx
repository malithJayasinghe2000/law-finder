'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

interface Permission {
  id: string
  name: string
  slug: string
  description?: string
  category: string
}

interface SubscriptionRole {
  id: string
  name: string
  description?: string
  permissions: {
    permissionId: string
    permission: Permission
  }[]
}

export function SubscriptionRoleManager() {
  const [roles, setRoles] = useState<SubscriptionRole[]>([])
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState<SubscriptionRole | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const [rolesRes, permissionsRes] = await Promise.all([
        fetch('/api/admin/roles'),
        fetch('/api/admin/permissions'),
      ])

      if (!rolesRes.ok || !permissionsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const rolesData = await rolesRes.json()
      const permissionsData = await permissionsRes.json()

      setRoles(rolesData)
      setAllPermissions(permissionsData)
    } catch (error) {
      toast.error('Failed to load roles and permissions')
    } finally {
      setLoading(false)
    }
  }

  function handleSelectRole(role: SubscriptionRole) {
    setSelectedRole(role)
    setSelectedPermissions(role.permissions.map((rp) => rp.permission.id))
  }

  async function handleSavePermissions() {
    if (!selectedRole) return

    try {
      const response = await fetch(`/api/admin/roles/${selectedRole.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissionIds: selectedPermissions,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update permissions')
      }

      toast.success('Permissions updated successfully')
      fetchData()
      setSelectedRole(null)
      setSelectedPermissions([])
    } catch (error) {
      toast.error('Failed to update permissions')
    }
  }

  function togglePermission(permissionId: string) {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    )
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Subscription Roles</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => handleSelectRole(role)}
              className={`p-4 border rounded-lg text-left transition ${
                selectedRole?.id === role.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <h3 className="font-semibold text-lg">{role.name}</h3>
              <p className="text-sm text-gray-600">{role.description}</p>
              <p className="text-xs text-gray-500 mt-2">
                {role.permissions.length} permissions assigned
              </p>
            </button>
          ))}
        </div>

        {selectedRole && (
          <div className="border-t pt-6">
            <h3 className="text-xl font-semibold mb-4">
              Manage Permissions for {selectedRole.name}
            </h3>

            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
              {allPermissions.map((permission) => (
                <label
                  key={permission.id}
                  className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(permission.id)}
                    onChange={() => togglePermission(permission.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{permission.name}</div>
                    <div className="text-sm text-gray-600">{permission.description}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Category: {permission.category}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSavePermissions} className="bg-blue-600 hover:bg-blue-700">
                Save Permissions
              </Button>
              <Button
                onClick={() => {
                  setSelectedRole(null)
                  setSelectedPermissions([])
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
