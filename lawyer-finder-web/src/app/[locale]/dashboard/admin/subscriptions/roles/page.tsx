'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Search,
  Users,
  Lock,
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

interface Permission {
  id: string;
  name: string;
  slug: string;
  category: string;
}

interface SubscriptionRole {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  createdAt: string;
}

export default function SubscriptionRolesPage() {
  const [roles, setRoles] = useState<SubscriptionRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<SubscriptionRole | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissionIds: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permissionsRes] = await Promise.all([
        fetch('/api/admin/subscriptions/roles'),
        fetch('/api/admin/subscriptions/permissions'),
      ]);

      const rolesData = await rolesRes.json();
      const permissionsData = await permissionsRes.json();

      if (!rolesRes.ok) throw new Error(rolesData.error);
      if (!permissionsRes.ok) throw new Error(permissionsData.error);

      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (role: SubscriptionRole | null = null) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description || '',
        permissionIds: role.permissions.map(p => p.id),
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: '',
        description: '',
        permissionIds: [],
      });
    }
    setIsModalOpen(true);
  };

  const handlePermissionToggle = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter(id => id !== permissionId)
        : [...prev.permissionIds, permissionId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingRole
        ? `/api/admin/subscriptions/roles/${editingRole.id}`
        : '/api/admin/subscriptions/roles';

      const method = editingRole ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(editingRole ? 'Role updated' : 'Role created');
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      const res = await fetch(`/api/admin/subscriptions/roles/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Role deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete role');
    }
  };

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase())
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
          <h1 className="text-3xl font-bold text-neutral-900">Subscription Roles</h1>
          <p className="text-neutral-600 mt-2">Manage roles and assign permissions</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus className="w-4 h-4" /> New Role
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
        <Input
          placeholder="Search roles..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
          <CardDescription>Total: {filteredRoles.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-900">Role Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-900">Permissions</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-900">Created</th>
                  <th className="text-right py-3 px-4 font-semibold text-neutral-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role) => (
                  <tr key={role.id} className="border-b hover:bg-neutral-50 transition">
                    <td className="py-3 px-4 font-medium text-neutral-900">{role.name}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 3).map(perm => (
                          <span key={perm.id} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {perm.slug}
                          </span>
                        ))}
                        {role.permissions.length > 3 && (
                          <span className="text-xs bg-neutral-100 text-neutral-800 px-2 py-1 rounded">
                            +{role.permissions.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-neutral-600">
                      {new Date(role.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenModal(role)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(role.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filteredRoles.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-neutral-600">No roles found</p>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
            <DialogDescription>
              {editingRole ? 'Update role details and permissions' : 'Create a new subscription role'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-700">Role Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., BASIC"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Role description"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 mb-3 block">
                Assign Permissions
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
                {permissions.length === 0 ? (
                  <p className="text-sm text-neutral-600">No permissions available</p>
                ) : (
                  permissions.map(permission => (
                    <label key={permission.id} className="flex items-center gap-2 cursor-pointer hover:bg-neutral-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={formData.permissionIds.includes(permission.id)}
                        onChange={() => handlePermissionToggle(permission.id)}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">{permission.name}</p>
                        <p className="text-xs text-neutral-500">{permission.category}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
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
                {editingRole ? 'Update Role' : 'Create Role'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
