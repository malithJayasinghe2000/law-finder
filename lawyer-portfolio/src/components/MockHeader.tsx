import { MessageCircle } from 'lucide-react';

interface MockHeaderProps {
  activeTab: 'FIND LAWYER' | 'AI CHAT' | 'LEGAL LIBRARY' | 'COMMUNITY HUB' | 'ABOUT' | 'MESSAGES' | 'DASHBOARD';
}

export default function MockHeader({ activeTab }: MockHeaderProps) {
  const navLinks = [
    { label: 'FIND LAWYER', active: activeTab === 'FIND LAWYER' },
    { label: 'AI CHAT', active: activeTab === 'AI CHAT' },
    { label: 'LEGAL LIBRARY', active: activeTab === 'LEGAL LIBRARY' },
    { label: 'COMMUNITY HUB', active: activeTab === 'COMMUNITY HUB' },
    { label: 'ABOUT', active: activeTab === 'ABOUT' }
  ];

  return (
    <div className="w-full bg-white h-16 border-b border-neutral-150 px-6 sm:px-8 flex items-center justify-between font-sans text-neutral-800 select-none">
      
      {/* Platform Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <img 
          src="/logo.png" 
          alt="TheLawyr Logo" 
          className="h-10 object-contain" 
          onError={(e) => {
            // Fallback wordmark SVG
            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 30%22><text x=%220%22 y=%2220%22 font-family=%22Georgia, serif%22 font-weight=%22bold%22 font-size=%2216%22 fill=%22%230a0a0a%22>TheLawyr</text></svg>';
          }}
        />
      </div>

      {/* Center Nav Links */}
      <div className="hidden lg:flex items-center gap-6">
        {navLinks.map((link) => (
          <span 
            key={link.label}
            className={`text-[10px] font-bold tracking-wider cursor-pointer transition-colors ${
              link.active 
                ? 'text-neutral-900 border border-neutral-300 rounded px-3 py-1 bg-neutral-50/50' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {link.label}
          </span>
        ))}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Messages */}
        <div className={`flex items-center gap-1.5 cursor-pointer text-xs transition-colors ${
          activeTab === 'MESSAGES' ? 'text-neutral-950 font-bold' : 'text-neutral-500 hover:text-neutral-900'
        }`}>
          <MessageCircle className="w-4.5 h-4.5 text-neutral-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">MESSAGES</span>
        </div>

        {/* Profile Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden border border-neutral-200 cursor-pointer">
          <img 
            src="/avatar.png" 
            alt="Profile avatar" 
            className="w-full h-full object-cover" 
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80';
            }}
          />
        </div>
      </div>

    </div>
  );
}
