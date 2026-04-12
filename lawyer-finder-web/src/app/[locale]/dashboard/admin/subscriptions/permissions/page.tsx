'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Search,
  Key,
  Tag,
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
  description?: string;
  createdAt: string;
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    category: '',
    description: '',
  });

  const categories = [
    'features',
    'posts',
    'inquiries',
    'reviews',
    'messaging',
    'analytics',
    'billing',
    'settings',
  ];

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/subscriptions/permissions');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPermissions(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (permission: Permission | null = null) => {
    if (permission) {
      setEditingPermission(permission);
      setFormData({
        name: permission.name,
        slug: permission.slug,
        category: permission.category,
        description: permission.description || '',
      });
    } else {
      setEditingPermission(null);
      setFormData({
        name: '',
        slug: '',
        category: '',
        description: '',
      });
    }
    setIsModalOpen(true);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: !editingPermission ? generateSlug(name) : prev.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingPermission
        ? `/api/admin/subscriptions/permissions/${editingPermission.id}`
        : '/api/admin/subscriptions/permissions';

      const method = editingPermission ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(editingPermission ? 'Permission updated' : 'Permission created');
      setIsModalOpen(false);
      fetchPermissions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save permission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this permission?')) return;

    try {
      const res = await fetch(`/api/admin/subscriptions/permissions/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Permission deleted');
      fetchPermissions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete permission');
    }
  };

  const filteredPermissions = permissions.filter(permission =>
    permission.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    permission.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedByCategory = filteredPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

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
          <h1 className="text-3xl font-bold text-neutral-900">Permissions</h1>
          <p className="text-neutral-600 mt-2">Create and manage feature permissions</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus className="w-4 h-4" /> New Permission
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
        <Input
          placeholder="Search permissions..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Permissions by Category */}
      <div className="space-y-6">
        {Object.entries(groupedByCategory).map(([category, categoryPermissions]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-semibold text-neutral-900 capitalize">{category}</h2>
              <span className="text-sm text-neutral-500">({categoryPermissions.length})</span>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryPermissions.map(permission => (
                    <div
                      key={permission.id}
                      className="p-4 border rounded-lg hover:border-primary/50 transition"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-neutral-900">{permission.name}</p>
                          <p className="text-xs text-neutral-500 font-mono mt-1">{permission.slug}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenModal(permission)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(permission.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {permission.description && (
                        <p className="text-xs text-neutral-600 mt-2">{permission.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {filteredPermissions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-neutral-600">No permissions found</p>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPermission ? 'Edit Permission' : 'Create New Permission'}</DialogTitle>
            <DialogDescription>
              {editingPermission ? 'Update permission details' : 'Create a new feature permission'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-700">Permission Name</label>
              <Input
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Create Posts"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Slug (auto-generated)</label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="e.g., create_posts"
                required
              />
              <p className="text-xs text-neutral-500 mt-1">Machine-readable identifier</p>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-neutral-900"
                required
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What does this permission do?"
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
                {editingPermission ? 'Update Permission' : 'Create Permission'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
