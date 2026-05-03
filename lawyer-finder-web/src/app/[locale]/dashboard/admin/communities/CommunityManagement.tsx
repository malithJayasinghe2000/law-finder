'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Users, FileText, Plus, Pencil, Archive } from 'lucide-react';
import { toast } from 'sonner';

interface Community {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string | null;
  category: string;
  status: string;
  memberCount: number;
  postCount: number;
}

interface PendingRequest {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  reason: string;
  requester: { id: string; fullName: string | null; role: string };
}

interface Props {
  communities: Community[];
  pendingRequests: PendingRequest[];
  locale: string;
}

export default function CommunityManagement({ communities, pendingRequests, locale }: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState(pendingRequests);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newCommunity, setNewCommunity] = useState({
    name: '', displayName: '', description: '', category: 'general', icon: '📋',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: '', description: '', category: '', icon: ''
  });

  const startEditing = (community: Community) => {
    setEditingId(community.id);
    setEditForm({
      displayName: community.displayName,
      description: community.description,
      category: community.category,
      icon: community.icon || '📋'
    });
  };

  const handleEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/communities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        toast.success('Community updated!');
        setEditingId(null);
        router.refresh();
      } else {
        toast.error('Failed to update.');
      }
    } catch {
      toast.error('Error updating.');
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Are you sure you want to archive/disable this community?')) return;
    try {
      const res = await fetch(`/api/communities/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Community archived.');
        router.refresh();
      } else {
        toast.error('Failed to archive.');
      }
    } catch {
      toast.error('Error archiving.');
    }
  };

  const handleReviewRequest = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/communities/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        toast.success(`Request ${status.toLowerCase()}.`);
      } else {
        toast.error('Failed to process request.');
      }
    } catch {
      toast.error('Error processing request.');
    } finally {
      setProcessing(null);
    }
  };

  const handleCreateCommunity = async () => {
    if (!newCommunity.name || !newCommunity.displayName || !newCommunity.description) {
      toast.error('Please fill all fields.');
      return;
    }
    try {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCommunity),
      });
      if (res.ok) {
        toast.success('Community created!');
        setShowCreate(false);
        setNewCommunity({ name: '', displayName: '', description: '', category: 'general', icon: '📋' });
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(typeof data.error === 'string' ? data.error : 'Failed to create.');
      }
    } catch {
      toast.error('Error creating community.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Pending Requests */}
      {requests.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Pending Community Requests</h2>
          <div className="space-y-3">
            {requests.map((req) => (
              <Card key={req.id} className="border-amber-200 dark:border-amber-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{req.displayName}</span>
                        <Badge variant="secondary" className="text-xs">{req.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{req.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Requested by <strong>{req.requester.fullName}</strong> ({req.requester.role})
                      </p>
                      <p className="text-xs text-muted-foreground mt-1"><strong>Reason:</strong> {req.reason}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleReviewRequest(req.id, 'APPROVED')}
                        disabled={processing === req.id}
                        className="gap-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReviewRequest(req.id, 'REJECTED')}
                        disabled={processing === req.id}
                        className="gap-1 text-red-500 border-red-200 hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Communities */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">All Communities</h2>
          <Button onClick={() => setShowCreate(!showCreate)} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Create Community
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <Card className="mb-4 border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="slug (e.g., family-law)"
                  value={newCommunity.name}
                  onChange={(e) => setNewCommunity({ ...newCommunity, name: e.target.value })}
                  className="p-2 text-sm border rounded-lg"
                />
                <input
                  placeholder="Display Name"
                  value={newCommunity.displayName}
                  onChange={(e) => setNewCommunity({ ...newCommunity, displayName: e.target.value })}
                  className="p-2 text-sm border rounded-lg"
                />
              </div>
              <input
                placeholder="Description"
                value={newCommunity.description}
                onChange={(e) => setNewCommunity({ ...newCommunity, description: e.target.value })}
                className="w-full p-2 text-sm border rounded-lg"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newCommunity.category}
                  onChange={(e) => setNewCommunity({ ...newCommunity, category: e.target.value })}
                  className="p-2 text-sm border rounded-lg"
                >
                  <option value="civil">Civil</option>
                  <option value="criminal">Criminal</option>
                  <option value="commercial">Commercial</option>
                  <option value="advisory">Advisory</option>
                  <option value="general">General</option>
                </select>
                <input
                  placeholder="Icon (emoji)"
                  value={newCommunity.icon}
                  onChange={(e) => setNewCommunity({ ...newCommunity, icon: e.target.value })}
                  className="p-2 text-sm border rounded-lg"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button size="sm" onClick={handleCreateCommunity}>Create</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {communities.map((community) => (
            <Card key={community.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                {editingId === community.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        placeholder="Display Name"
                        value={editForm.displayName}
                        onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                        className="p-2 text-sm border rounded-lg"
                      />
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="p-2 text-sm border rounded-lg"
                      >
                        <option value="civil">Civil</option>
                        <option value="criminal">Criminal</option>
                        <option value="commercial">Commercial</option>
                        <option value="advisory">Advisory</option>
                        <option value="general">General</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input
                        placeholder="Icon (emoji)"
                        value={editForm.icon}
                        onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                        className="p-2 text-sm border rounded-lg"
                      />
                      <input
                        placeholder="Description"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="sm:col-span-3 p-2 text-sm border rounded-lg"
                      />
                    </div>
                    <div className="flex gap-2 justify-end mt-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => handleEdit(community.id)}>Save Changes</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-2xl">{community.icon || '📋'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{community.displayName}</span>
                          <Badge variant={community.status === 'ACTIVE' ? 'secondary' : 'outline'} className="text-xs">
                            {community.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                          c/{community.name} • {community.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {community.memberCount}</span>
                        <span className="flex items-center gap-1"><FileText className="h-4 w-4" /> {community.postCount}</span>
                      </div>
                      
                      <div className="flex gap-1 sm:ml-2 sm:border-l sm:pl-4">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => startEditing(community)} title="Edit Community">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleArchive(community.id)} title="Archive Community">
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
