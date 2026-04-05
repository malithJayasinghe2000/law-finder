'use client';

import { Image, Plus, Settings, Layout, Monitor, Globe, BarChart3, Calendar, Clock } from 'lucide-react';

export default function AdvertisementsPage() {
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
            <Image className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Advertisement Management</h1>
            <p className="text-sm text-neutral-500 font-medium">Manage platform advertisements and banner placements</p>
          </div>
        </div>
        <button
          disabled
          className="flex items-center gap-2 px-5 py-2.5 bg-neutral-300 text-neutral-500 text-xs font-bold uppercase tracking-wide cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" /> New Campaign
        </button>
      </div>

      {/* Coming Soon Banner */}
      <div className="bg-[#0a0a0a] text-white p-8 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-white/10 flex items-center justify-center mb-4">
          <Image className="w-8 h-8 text-white/80" />
        </div>
        <h2 className="text-xl font-bold tracking-tight mb-2">Advertisement Module</h2>
        <p className="text-sm text-neutral-400 max-w-md font-medium">
          This module is under development. You will be able to manage homepage banners, sidebar ads, and promotional content from here.
        </p>
        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mt-4 border border-neutral-700 px-3 py-1.5">Coming Soon</span>
      </div>

      {/* Planned Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            icon: Layout,
            title: 'Banner Management',
            description: 'Upload and manage homepage hero banners, sidebar advertisements, and in-content promotional blocks.',
          },
          {
            icon: Monitor,
            title: 'Placement Zones',
            description: 'Configure ad placements across homepage, lawyer directory, blog pages, and search results.',
          },
          {
            icon: Globe,
            title: 'Targeting Options',
            description: 'Target ads by district, practice area, language preference, and user behavior patterns.',
          },
          {
            icon: BarChart3,
            title: 'Analytics Dashboard',
            description: 'Track impressions, clicks, CTR, and conversion rates for each campaign.',
          },
          {
            icon: Calendar,
            title: 'Schedule Campaigns',
            description: 'Set start and end dates, define budgets, and schedule ads for peak engagement times.',
          },
          {
            icon: Clock,
            title: 'Auto-Expiry',
            description: 'Campaigns automatically deactivate after their end date or when budget is exhausted.',
          },
        ].map((feature) => (
          <div key={feature.title} className="bg-white border border-neutral-200 p-6 hover:shadow-sm transition-shadow">
            <div className="w-9 h-9 bg-neutral-100 flex items-center justify-center mb-4">
              <feature.icon className="w-4 h-4 text-neutral-600" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900 mb-1">{feature.title}</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Placeholder Table */}
      <div className="bg-white border border-neutral-200 overflow-x-auto">
        <table className="w-full opacity-40">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Campaign Name</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Placement</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Start Date</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">End Date</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Impressions</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-100">
              <td colSpan={7} className="px-5 py-8 text-center text-xs text-neutral-400 font-medium">
                No advertisement campaigns configured yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
