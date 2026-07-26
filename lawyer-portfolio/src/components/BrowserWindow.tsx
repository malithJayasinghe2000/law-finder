import React from 'react';
import { Lock } from 'lucide-react';

interface BrowserWindowProps {
  children: React.ReactNode;
  url: string;
}

export default function BrowserWindow({ children, url }: BrowserWindowProps) {
  return (
    <div className="w-full rounded-xl border border-neutral-250 bg-white shadow-2xl overflow-hidden transition-all duration-500 hover:border-neutral-400/80">
      {/* Top Header/Address Bar */}
      <div className="h-10 px-4 bg-neutral-50 border-b border-neutral-150 flex items-center justify-between gap-4 select-none">
        {/* macOS Style Window Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400 opacity-80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 opacity-80"></div>
        </div>

        {/* Address Bar Input */}
        <div className="flex-1 max-w-md h-6.5 bg-white border border-neutral-200 rounded-md px-3 flex items-center justify-center gap-1.5 mx-auto">
          <Lock className="w-2.5 h-2.5 text-[#bfa37a]" />
          <span className="text-[10px] text-neutral-550 tracking-wide truncate select-all">{url}</span>
        </div>

        {/* Dummy spacer */}
        <div className="w-8 shrink-0"></div>
      </div>

      {/* Content Area */}
      <div className="bg-white p-1 sm:p-4">
        {children}
      </div>
    </div>
  );
}
