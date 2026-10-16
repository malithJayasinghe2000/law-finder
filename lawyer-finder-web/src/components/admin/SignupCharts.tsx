'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/** Monthly sign-ups on the admin dashboard. Data is counted on the server. */

type Month = { month: string; lawyers: number; clients: number };

const TOOLTIP_STYLE = {
  backgroundColor: '#0a0a0a',
  border: 'none',
  borderRadius: '0',
  color: '#fff',
  fontSize: '12px',
  fontWeight: '600',
};

function Chart({ data, dataKey, name, title }: { data: Month[]; dataKey: 'lawyers' | 'clients'; name: string; title: string }) {
  return (
    <div className="bg-white border border-neutral-200 p-5 sm:p-6">
      <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">{title}</h3>
      <p className="text-xs text-neutral-500 mt-0.5 mb-4">New accounts per month, last 12 months</p>
      <div className="h-48 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -20, right: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} />
            <YAxis tick={{ fontSize: 11, fill: '#999' }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f5f5f5' }} />
            <Bar dataKey={dataKey} fill="#0a0a0a" name={name} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SignupCharts({ data }: { data: Month[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <Chart data={data} dataKey="lawyers" name="Attorneys" title="Attorney sign-ups" />
      <Chart data={data} dataKey="clients" name="Clients" title="Client sign-ups" />
    </div>
  );
}
