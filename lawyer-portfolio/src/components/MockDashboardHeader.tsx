import { Menu } from 'lucide-react';

interface MockDashboardHeaderProps {
  title: string;
}

export default function MockDashboardHeader({ title }: MockDashboardHeaderProps) {
  return (
    <header className="h-14 border-b border-neutral-200 bg-white flex items-center justify-between px-6 font-sans text-neutral-800 select-none">
      
      {/* Left Title */}
      <div className="flex items-center gap-3">
        <button className="md:hidden p-1 hover:bg-neutral-100 rounded">
          <Menu className="w-4 h-4 text-neutral-600" />
        </button>
        <span className="text-xs font-bold text-neutral-900 tracking-tight">{title}</span>
      </div>

      {/* Right User Meta */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-neutral-500 font-bold bg-neutral-100 px-2 py-0.5 rounded uppercase tracking-wider">
          Lawyer Account
        </span>
        <div className="w-8 h-8 rounded-full overflow-hidden border border-neutral-200">
          <img 
            src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=80&q=80" 
            className="w-full h-full object-cover" 
            alt="Profile Avatar" 
          />
        </div>
      </div>

    </header>
  );
}
