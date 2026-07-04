import { 
  LayoutDashboard, CalendarDays, MessageCircle, 
  Image as ImageIcon, Settings, ChevronDown
} from 'lucide-react';

interface MockDashboardSidebarProps {
  activeTab: 'Dashboard' | 'Bookings' | 'Earnings & Payouts' | 'Messages' | 'My Ads' | 'Profile Settings';
}

export default function MockDashboardSidebar({ activeTab }: MockDashboardSidebarProps) {
  const isConsultationsActive = activeTab === 'Bookings' || activeTab === 'Earnings & Payouts';

  return (
    <div className="w-full bg-[#fbf9f6] h-full border-r border-[#efeae0] flex flex-col font-sans select-none text-neutral-850">
      
      {/* Sidebar Header */}
      <div className="h-20 flex flex-col justify-center px-6 border-b border-[#efeae0]">
        <h2 className="text-[13px] font-bold tracking-widest text-neutral-900 uppercase font-serif">Lawyer Portal</h2>
        <p className="text-[9px] text-[#bfa37a] font-bold tracking-wider uppercase">Manage your practice</p>
      </div>

      {/* Sidebar Links */}
      <div className="flex-grow px-4 py-6 space-y-4">
        <div>
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-3 px-3 block">Menu</span>
          <div className="space-y-1.5">
            {/* Dashboard */}
            <button className={`flex items-center gap-3 w-full h-11 px-4 rounded-xl border text-xs font-bold transition-all duration-200 ${
              activeTab === 'Dashboard' 
                ? 'bg-white border-[#efeae0] text-[#bfa37a] shadow-[0_4px_12px_rgba(0,0,0,0.03)]' 
                : 'border-transparent text-neutral-600 hover:bg-white/50 hover:text-neutral-900'
            }`}>
              <LayoutDashboard className={`w-4 h-4 ${activeTab === 'Dashboard' ? 'text-[#bfa37a]' : 'text-neutral-400'}`} />
              <span>Dashboard</span>
            </button>

            {/* Consultations Group */}
            <div className="space-y-1">
              <button className={`flex items-center justify-between w-full h-11 px-4 rounded-xl border text-xs font-bold transition-all duration-200 ${
                isConsultationsActive 
                  ? 'bg-white border-[#efeae0] text-[#bfa37a]' 
                  : 'border-transparent text-neutral-600 hover:bg-white/50 hover:text-neutral-900'
              }`}>
                <div className="flex items-center gap-3">
                  <CalendarDays className={`w-4 h-4 ${isConsultationsActive ? 'text-[#bfa37a]' : 'text-neutral-400'}`} />
                  <span>Consultations</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 opacity-55" />
              </button>

              {/* Submenu links */}
              <div className="pl-6 space-y-1.5 pt-1.5">
                <button className={`flex items-center gap-2 w-full py-1.5 px-3 text-[11px] font-bold transition-colors ${
                  activeTab === 'Bookings' ? 'text-[#bfa37a]' : 'text-neutral-500 hover:text-neutral-900'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'Bookings' ? 'bg-[#bfa37a]' : 'bg-transparent'}`} />
                  <span>Bookings</span>
                </button>
                <button className={`flex items-center gap-2 w-full py-1.5 px-3 text-[11px] font-bold transition-colors ${
                  activeTab === 'Earnings & Payouts' ? 'text-[#bfa37a]' : 'text-neutral-500 hover:text-neutral-900'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'Earnings & Payouts' ? 'bg-[#bfa37a]' : 'bg-transparent'}`} />
                  <span>Earnings &amp; Payouts</span>
                </button>
              </div>
            </div>

            {/* Messages */}
            <button className={`flex items-center gap-3 w-full h-11 px-4 rounded-xl border text-xs font-bold transition-all duration-200 ${
              activeTab === 'Messages' 
                ? 'bg-white border-[#efeae0] text-[#bfa37a] shadow-[0_4px_12px_rgba(0,0,0,0.03)]' 
                : 'border-transparent text-neutral-600 hover:bg-white/50 hover:text-neutral-900'
            }`}>
              <MessageCircle className={`w-4 h-4 ${activeTab === 'Messages' ? 'text-[#bfa37a]' : 'text-neutral-400'}`} />
              <span>Messages</span>
            </button>

            {/* My Ads */}
            <button className={`flex items-center gap-3 w-full h-11 px-4 rounded-xl border text-xs font-bold transition-all duration-200 ${
              activeTab === 'My Ads' 
                ? 'bg-white border-[#efeae0] text-[#bfa37a] shadow-[0_4px_12px_rgba(0,0,0,0.03)]' 
                : 'border-transparent text-neutral-600 hover:bg-white/50 hover:text-neutral-900'
            }`}>
              <ImageIcon className={`w-4 h-4 ${activeTab === 'My Ads' ? 'text-[#bfa37a]' : 'text-neutral-400'}`} />
              <span>My Ads</span>
            </button>

            {/* Profile Settings */}
            <button className={`flex items-center gap-3 w-full h-11 px-4 rounded-xl border text-xs font-bold transition-all duration-200 ${
              activeTab === 'Profile Settings' 
                ? 'bg-white border-[#efeae0] text-[#bfa37a] shadow-[0_4px_12px_rgba(0,0,0,0.03)]' 
                : 'border-transparent text-neutral-600 hover:bg-white/50 hover:text-neutral-900'
            }`}>
              <Settings className={`w-4 h-4 ${activeTab === 'Profile Settings' ? 'text-[#bfa37a]' : 'text-neutral-400'}`} />
              <span>Profile Settings</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
