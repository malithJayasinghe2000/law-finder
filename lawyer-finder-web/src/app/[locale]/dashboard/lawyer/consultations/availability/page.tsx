'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Clock, Plus, Trash2, Save, CalendarDays, Ban, CheckCircle } from 'lucide-react';
import { DAY_ORDER, DAY_LABELS } from '@/schemas/consultation.schema';
import { formatDateOnlyString } from '@/lib/utils';

interface AvailabilitySlot {
  id?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  bufferTime: number;
  mode: string;
  isActive: boolean;
}

interface Override {
  id: string;
  date: string;
  isBlocked: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState<AvailabilitySlot[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Override form
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideBlocked, setOverrideBlocked] = useState(true);
  const [overrideStart, setOverrideStart] = useState('09:00');
  const [overrideEnd, setOverrideEnd] = useState('17:00');
  const [overrideReason, setOverrideReason] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [schedRes, overRes] = await Promise.all([
        fetch('/api/consultations/availability'),
        fetch('/api/consultations/availability/overrides'),
      ]);
      const schedData = await schedRes.json();
      const overData = await overRes.json();

      if (Array.isArray(schedData)) {
        setSchedule(schedData);
      }
      if (Array.isArray(overData)) {
        setOverrides(overData.map((o: any) => ({
          ...o,
          date: o.date?.split('T')[0] || o.date,
        })));
      }
    } catch {
      toast.error('Failed to load availability data');
    } finally {
      setLoading(false);
    }
  }

  function addSlot(day: string) {
    setSchedule(prev => [...prev, {
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '17:00',
      slotDuration: 60,
      bufferTime: 15,
      mode: 'BOTH',
      isActive: true,
    }]);
  }

  function updateSlot(index: number, field: string, value: any) {
    setSchedule(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function removeSlot(index: number) {
    setSchedule(prev => prev.filter((_, i) => i !== index));
  }

  async function saveSchedule() {
    setSaving(true);
    try {
      const activeSlots = schedule.filter(s => s.isActive || s.startTime);
      const res = await fetch('/api/consultations/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: activeSlots }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Weekly schedule saved successfully');
        setSchedule(data.availability || activeSlots);
      } else {
        toast.error(data.error?.toString() || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  }

  async function addOverride() {
    if (!overrideDate) { toast.error('Select a date'); return; }
    setSavingOverride(true);
    try {
      const res = await fetch('/api/consultations/availability/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: overrideDate,
          isBlocked: overrideBlocked,
          startTime: overrideBlocked ? undefined : overrideStart,
          endTime: overrideBlocked ? undefined : overrideEnd,
          reason: overrideReason || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(overrideBlocked ? 'Date blocked' : 'Override added');
        setOverrideDate('');
        setOverrideReason('');
        loadData();
      } else {
        toast.error(data.error || 'Failed to add override');
      }
    } catch {
      toast.error('Failed to add override');
    } finally {
      setSavingOverride(false);
    }
  }

  async function deleteOverride(id: string) {
    try {
      const res = await fetch(`/api/consultations/availability/overrides?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Override removed');
        setOverrides(prev => prev.filter(o => o.id !== id));
      }
    } catch {
      toast.error('Failed to remove override');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 rounded-none" />
        <div className="grid gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-none" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-4xl font-normal tracking-tight text-neutral-900">Availability Management</h1>
            <p className="text-sm text-neutral-500 font-medium">Set your weekly schedule and manage date-specific overrides</p>
          </div>
        </div>
        <Button
          onClick={saveSchedule}
          disabled={saving}
          className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-10 px-6 text-sm font-bold uppercase tracking-wide"
        >
          <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Schedule'}
        </Button>
      </div>

      {/* Weekly Schedule */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-2">
          <Clock className="w-4 h-4" /> Weekly Recurring Schedule
        </h2>

        {DAY_ORDER.map((day) => {
          const daySlots = schedule
            .map((s, idx) => ({ ...s, _idx: idx }))
            .filter(s => s.dayOfWeek === day);

          return (
            <Card key={day} className="rounded-none shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-neutral-900">{DAY_LABELS[day]}</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addSlot(day)}
                    className="rounded-none h-8 text-xs font-semibold"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Slot
                  </Button>
                </div>

                {daySlots.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic">No availability set — Day off</p>
                ) : (
                  <div className="space-y-3">
                    {daySlots.map((slot) => (
                      <div key={slot._idx} className="flex flex-wrap items-center gap-3 p-3 border border-neutral-100 bg-neutral-50">
                        {/* Time Range */}
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => updateSlot(slot._idx, 'startTime', e.target.value)}
                            className="border border-neutral-200 px-1 py-1.5 text-xs font-mono bg-white w-[100px]"
                          />
                          <span className="text-xs text-neutral-400">to</span>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => updateSlot(slot._idx, 'endTime', e.target.value)}
                            className="border border-neutral-200 px-1 py-1.5 text-xs font-mono bg-white w-[100px]"
                          />
                        </div>

                        {/* Slot Duration */}
                        <select
                          value={slot.slotDuration}
                          onChange={(e) => updateSlot(slot._idx, 'slotDuration', parseInt(e.target.value))}
                          className="border border-neutral-200 px-2 py-1.5 text-xs bg-white"
                        >
                          <option value={30}>30 min</option>
                          <option value={45}>45 min</option>
                          <option value={60}>60 min</option>
                          <option value={90}>90 min</option>
                          <option value={120}>2 hrs</option>
                        </select>

                        {/* Buffer */}
                        <select
                          value={slot.bufferTime}
                          onChange={(e) => updateSlot(slot._idx, 'bufferTime', parseInt(e.target.value))}
                          className="border border-neutral-200 px-2 py-1.5 text-xs bg-white"
                        >
                          <option value={0}>No buffer</option>
                          <option value={10}>10min gap</option>
                          <option value={15}>15min gap</option>
                          <option value={30}>30min gap</option>
                        </select>

                        {/* Mode */}
                        <select
                          value={slot.mode}
                          onChange={(e) => updateSlot(slot._idx, 'mode', e.target.value)}
                          className="border border-neutral-200 px-2 py-1.5 text-xs bg-white"
                        >
                          <option value="BOTH">Physical & Online</option>
                          <option value="PHYSICAL">Physical Only</option>
                          <option value="ONLINE">Online Only</option>
                        </select>

                        {/* Remove */}
                        <button
                          onClick={() => removeSlot(slot._idx)}
                          className="ml-auto p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Date Overrides */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-2">
          <Ban className="w-4 h-4" /> Date-Specific Overrides
        </h2>

        {/* Add Override Form */}
        <Card className="rounded-none shadow-sm border-dashed border-2 border-neutral-300">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Date</label>
                <input
                  type="date"
                  value={overrideDate}
                  onChange={(e) => setOverrideDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="border border-neutral-200 px-3 py-2 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Type</label>
                <select
                  value={overrideBlocked ? 'blocked' : 'custom'}
                  onChange={(e) => setOverrideBlocked(e.target.value === 'blocked')}
                  className="border border-neutral-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="blocked">Block Entire Day</option>
                  <option value="custom">Custom Hours</option>
                </select>
              </div>

              {!overrideBlocked && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">From</label>
                    <input type="time" value={overrideStart} onChange={(e) => setOverrideStart(e.target.value)} className="border border-neutral-200 px-3 py-2 text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">To</label>
                    <input type="time" value={overrideEnd} onChange={(e) => setOverrideEnd(e.target.value)} className="border border-neutral-200 px-3 py-2 text-sm bg-white" />
                  </div>
                </>
              )}

              <div className="flex-1 min-w-[150px]">
                <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g., Public holiday"
                  className="border border-neutral-200 px-3 py-2 text-sm bg-white w-full"
                />
              </div>

              <Button
                onClick={addOverride}
                disabled={savingOverride}
                className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-10 px-5 text-xs font-bold uppercase tracking-wide"
              >
                {savingOverride ? 'Saving...' : 'Add Override'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Existing Overrides */}
        {overrides.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-6">No date overrides configured</p>
        ) : (
          <div className="grid gap-2">
            {overrides.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-4 border border-neutral-200 bg-white">
                <div className="flex items-center gap-3">
                  {o.isBlocked ? (
                    <Ban className="w-4 h-4 text-red-500" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {formatDateOnlyString(o.date, 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {o.isBlocked ? 'Blocked — Day off' : `Custom hours: ${o.startTime} – ${o.endTime}`}
                      {o.reason && ` · ${o.reason}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => deleteOverride(o.id)} className="p-1.5 text-red-500 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
