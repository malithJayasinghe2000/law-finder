import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { 
  CheckCircle, UploadCloud, RefreshCw, Megaphone
} from 'lucide-react';
import MockDashboardSidebar from '../MockDashboardSidebar';
import MockDashboardHeader from '../MockDashboardHeader';

interface AdSlot {
  id: string;
  name: string;
  price: string;
  reach: string;
  status: 'available' | 'active';
  description: string;
}

export default function AdPlacementShowcase() {
  const slots: AdSlot[] = [
    { id: 'ad-s1', name: 'Homepage Premium Banner', price: 'Rs. 4,500/day', reach: '5,000+ views/day', status: 'available', description: 'Large horizontal banner positioned directly below the primary search widget.' },
    { id: 'ad-s2', name: 'Sponsored Search Spotlight', price: 'Rs. 2,000/day', reach: '3,200+ views/day', status: 'available', description: 'Pins your profile card to the top of all local search results matching your practice.' },
    { id: 'ad-s3', name: 'Sidebar Law Firm Banner', price: 'Rs. 1,500/day', reach: '2,000+ views/day', status: 'available', description: 'Vertical display card visible during article reads and lawyer directories.' }
  ];

  const [activeSlotId, setActiveSlotId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [key, setKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.2 });

  useEffect(() => {
    if (!isInView) return;

    let active = true;
    setActiveSlotId('');
    setIsUploading(false);
    setIsLive(false);

    const runSimulation = async () => {
      // Wait 1.5s
      await new Promise(r => setTimeout(r, 1500));
      if (!active) return;

      // Select Spotlight slot
      setActiveSlotId('ad-s2');

      // Wait 2.0s (lawyer configuring ad media)
      await new Promise(r => setTimeout(r, 2000));
      if (!active) return;

      // Uploading creative
      setIsUploading(true);

      // Wait 1.5s
      await new Promise(r => setTimeout(r, 1500));
      if (!active) return;

      setIsUploading(false);
      setIsLive(true);
    };

    runSimulation();

    return () => {
      active = false;
    };
  }, [isInView, key]);

  return (
    <div 
      ref={containerRef}
      className="w-full bg-[#fbf9f6] rounded-xl overflow-hidden border border-neutral-200 text-left font-sans text-neutral-800 flex flex-col shadow-lg select-none"
    >
      
      {/* Top dashboard header */}
      <MockDashboardHeader title="Lawyer Portal" />

      {/* Main dashboard body */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 flex-grow min-h-[500px]">
        
        {/* LEFT COLUMN: Sidebar */}
        <div className="md:col-span-3">
          <MockDashboardSidebar activeTab="My Ads" />
        </div>

        {/* RIGHT COLUMN: Campaign placement zones & homepage wireframe */}
        <div className="md:col-span-9 p-6 grid grid-cols-1 sm:grid-cols-12 gap-6 bg-neutral-50 max-h-[520px] overflow-y-auto">
          
          {/* Ad slots checklist (Left half) */}
          <div className="sm:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
              <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider flex items-center gap-1">
                <Megaphone className="w-3.5 h-3.5 text-[#bfa37a]" />
                Sponsored Ad Placements
              </span>
              
              <button 
                onClick={() => setKey(prev => prev + 1)}
                className="p-1 rounded bg-white border border-neutral-200 hover:border-gold/30 text-neutral-455 hover:bg-[#030303] hover:text-white transition-colors shadow-sm"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3.5">
              {slots.map((slot) => {
                const isSelected = activeSlotId === slot.id;
                return (
                  <div 
                    key={slot.id} 
                    className={`p-3.5 rounded-xl border text-[11px] transition-all duration-350 bg-white ${
                      isSelected 
                        ? isLive 
                          ? 'border-emerald-500/40 bg-emerald-50/20' 
                          : 'border-[#bfa37a]/50 bg-[#bfa37a]/5'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-neutral-900 leading-none">{slot.name}</h4>
                      <p className="text-[9px] text-neutral-500 font-light mt-1 leading-snug">{slot.description}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-neutral-100 text-[9px] font-bold">
                      <span className="text-[#bfa37a]">{slot.price}</span>
                      <span className="text-neutral-450 font-light">{slot.reach}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Homepage Mock layout wireframe (Right half) */}
          <div className="sm:col-span-5 flex flex-col justify-between min-h-[350px]">
            
            <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
              <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Placement Map</span>
              <span className="text-[8px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Wireframe View</span>
            </div>

            {/* Mock layout grid */}
            <div className="flex-grow border border-neutral-200 rounded-xl p-3 bg-white flex flex-col gap-2.5 relative overflow-hidden font-sans shadow-sm my-3">
              
              {/* Wireframe Hero */}
              <div className="p-2.5 bg-neutral-50 rounded border border-neutral-150 text-[9px] text-neutral-400 text-center uppercase tracking-widest font-bold">
                Hero Search Container
              </div>

              {/* Wireframe Spotlight slot-2 */}
              <div className="relative">
                {activeSlotId === 'ad-s2' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute -inset-1 border border-dashed border-[#bfa37a] rounded-lg pointer-events-none"
                  />
                )}

                <div className={`p-3 rounded-lg border transition-all duration-500 ${
                  activeSlotId === 'ad-s2' 
                    ? isLive 
                      ? 'border-emerald-500/30 bg-neutral-50' 
                      : 'border-[#bfa37a]/30 bg-[#bfa37a]/5'
                    : 'border-neutral-150 bg-neutral-50 text-neutral-350 opacity-40'
                }`}>
                  {activeSlotId === 'ad-s2' && isLive ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 3 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-2.5 items-center"
                    >
                      <div className="w-8 h-8 rounded bg-neutral-100 overflow-hidden border border-neutral-200 shrink-0">
                        <img 
                          src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=80&h=80&q=80" 
                          className="w-full h-full object-cover" 
                          alt="Lakmal Perera thumbnail" 
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 leading-none">
                          <span className="text-[10px] font-bold text-neutral-900">Dr. Lakmal Perera</span>
                          <span className="text-[7px] bg-[#bfa37a]/15 text-[#bfa37a] px-1 rounded font-bold uppercase tracking-wider">Sponsor</span>
                        </div>
                        <p className="text-[8px] text-neutral-500 font-light truncate mt-1">Family &amp; Custody Chambers - Colombo</p>
                      </div>
                    </motion.div>
                  ) : activeSlotId === 'ad-s2' && isUploading ? (
                    <div className="flex flex-col items-center justify-center gap-1 py-1 text-center">
                      <UploadCloud className="w-4 h-4 text-[#bfa37a] animate-bounce" />
                      <span className="text-[9px] font-bold text-neutral-450">Uploading banner assets...</span>
                    </div>
                  ) : activeSlotId === 'ad-s2' ? (
                    <div className="text-[9px] text-[#bfa37a] font-bold text-center">
                      Selected. Uploading creatives...
                    </div>
                  ) : (
                    <div className="text-[9px] font-medium text-neutral-450 text-center py-1 uppercase tracking-wide">
                      Spotlight Pinned Area
                    </div>
                  )}
                </div>
              </div>

              {/* Wireframe results */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2 bg-neutral-50 rounded border border-neutral-150 text-[8px] text-neutral-400 text-center uppercase">
                  Search Result 1
                </div>
                <div className="p-2 bg-neutral-50 rounded border border-neutral-150 text-[8px] text-neutral-400 text-center uppercase">
                  Search Result 2
                </div>
              </div>
            </div>

            {/* Campaign Status bar */}
            <div className="p-3 bg-white border border-neutral-250 rounded-xl flex items-center justify-between text-[11px] shadow-sm">
              <span className="text-neutral-550 font-light">Status:</span>
              {isLive ? (
                <span className="flex items-center gap-1 font-bold text-emerald-600 uppercase text-[9px] tracking-wider">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Active on platform
                </span>
              ) : isUploading ? (
                <span className="text-[#bfa37a] font-bold animate-pulse text-[9px] uppercase tracking-wider">
                  Publishing Campaign...
                </span>
              ) : activeSlotId ? (
                <span className="text-neutral-550 font-bold text-[9px] uppercase tracking-wider">
                  Drafting banner...
                </span>
              ) : (
                <span className="text-neutral-400 text-[9px] uppercase tracking-wider">
                  Select ad zone above
                </span>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
