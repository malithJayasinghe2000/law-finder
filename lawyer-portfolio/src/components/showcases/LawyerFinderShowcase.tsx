import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Search, Star, ChevronRight, RefreshCw } from 'lucide-react';
import MockHeader from '../MockHeader';

interface Lawyer {
  id: string;
  fullName: string;
  profileImageUrl: string;
  bio: string;
  practiceAreas: string[];
  languages: string[];
  district: string;
  avgRating: number;
}

export default function LawyerFinderShowcase() {
  const allLawyers: Lawyer[] = [
    {
      id: 'dir-1',
      fullName: 'Dr. Lakmal Perera',
      practiceAreas: ['Family Law', 'Child Custody', 'Tenancy Disputes'],
      district: 'Colombo',
      avgRating: 4.9,
      profileImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&h=500&q=80',
      languages: ['English', 'Sinhala'],
      bio: 'Over 14 years of litigation experience in tenancy disputes, rent board representation, and family mediation.'
    },
    {
      id: 'dir-2',
      fullName: 'Anjali Senanayake',
      practiceAreas: ['Corporate Law', 'Contract Drafting', 'IP Law'],
      district: 'Colombo',
      avgRating: 4.8,
      profileImageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=500&q=80',
      languages: ['English', 'Sinhala', 'Tamil'],
      bio: 'Specialized in commercial contract compliance, trademarks registration, and board governance audits.'
    },
    {
      id: 'dir-3',
      fullName: 'Nalinda Jayasinghe',
      practiceAreas: ['Criminal Defense', 'Advocacy', 'Bail Hearings'],
      district: 'Kandy',
      avgRating: 4.7,
      profileImageUrl: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=400&h=500&q=80',
      languages: ['Sinhala', 'English'],
      bio: 'Dedicated defense advocate representing clients in summary trials, bail applications, and penal representation.'
    },
    {
      id: 'dir-4',
      fullName: 'Priyantha Fernando',
      practiceAreas: ['Civil Litigation', 'Property Disputes', 'Wills & Trust'],
      district: 'Galle',
      avgRating: 4.9,
      profileImageUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&h=500&q=80',
      languages: ['English', 'Sinhala'],
      bio: 'Expert civil litigation chambers handling land partitioning, wills, trust administration, and family deeds.'
    }
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('All Areas');
  const [selectedDistrict, setSelectedDistrict] = useState('All Districts');
  const [lawyers, setLawyers] = useState<Lawyer[]>(allLawyers);
  const [isReindexing, setIsReindexing] = useState(false);
  const [key, setKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.2 });

  const targetQuery = "Family Law Colombo";

  useEffect(() => {
    if (!isInView) return;

    let active = true;
    setSearchQuery('');
    setSelectedArea('All Areas');
    setSelectedDistrict('All Districts');
    setLawyers(allLawyers);
    setIsReindexing(false);

    const runSimulation = async () => {
      // 1. Wait a moment
      await new Promise(r => setTimeout(r, 800));
      if (!active) return;

      // 2. Typing Search Query
      setIsReindexing(true);
      let currentQuery = '';
      for (let i = 0; i < targetQuery.length; i++) {
        if (!active) return;
        currentQuery += targetQuery[i];
        setSearchQuery(currentQuery);
        await new Promise(r => setTimeout(r, 25));
      }

      // 3. Dropdown selection simulation
      await new Promise(r => setTimeout(r, 500));
      if (!active) return;
      setSelectedArea('Family Law');
      setSelectedDistrict('Colombo');

      // 4. Update listings
      await new Promise(r => setTimeout(r, 600));
      if (!active) return;
      const filtered = allLawyers.filter(l => 
        l.practiceAreas.includes('Family Law') && l.district === 'Colombo'
      );
      setLawyers(filtered);
      setIsReindexing(false);
    };

    runSimulation();

    return () => {
      active = false;
    };
  }, [isInView, key]);

  return (
    <div 
      ref={containerRef}
      className="w-full bg-[#faf8f5] rounded-xl overflow-hidden border border-neutral-200 text-left font-sans text-neutral-800 flex flex-col shadow-lg select-none"
    >
      
      {/* Header */}
      <MockHeader activeTab="FIND LAWYER" />

      {/* Directory Page Content */}
      <div className="p-6 sm:p-8 space-y-6 max-h-[550px] overflow-y-auto">
        
        {/* Main Title section */}
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-light tracking-tight text-neutral-900">Lawyer Directory</h1>
            <p className="text-neutral-500 text-xs font-light leading-relaxed">
              Browse verified Sri Lankan legal professionals. Use the filters to find the right match.
            </p>
          </div>

          <button 
            onClick={() => setKey(prev => prev + 1)}
            className="p-2 rounded bg-white border border-neutral-200 hover:border-gold/30 text-neutral-450 hover:text-white hover:bg-[#030303] transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider shadow-sm"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Replay</span>
          </button>
        </div>

        {/* Lawyer Filter Form Layout from actual page */}
        <div className="p-4 bg-white border border-neutral-100 shadow-[0_4px_12px_rgba(0,0,0,0.02)] grid grid-cols-1 sm:grid-cols-4 gap-4">
          
          {/* Search Input */}
          <div className="relative">
            <input 
              type="text" 
              readOnly 
              value={searchQuery}
              placeholder="Search by name, bio, district..." 
              className="w-full bg-transparent border border-neutral-200 rounded px-3.5 pl-8 py-2 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-3" />
          </div>

          {/* Area select */}
          <div className="bg-transparent border border-neutral-200 rounded px-3 py-2 text-xs text-neutral-500 flex justify-between items-center cursor-pointer">
            <span>{selectedArea}</span>
            <ChevronRight className="w-3 h-3 rotate-90 opacity-60" />
          </div>

          {/* District select */}
          <div className="bg-transparent border border-neutral-200 rounded px-3 py-2 text-xs text-neutral-500 flex justify-between items-center cursor-pointer">
            <span>{selectedDistrict}</span>
            <ChevronRight className="w-3 h-3 rotate-90 opacity-60" />
          </div>

          {/* Language select */}
          <div className="bg-transparent border border-neutral-200 rounded px-3 py-2 text-xs text-neutral-500 flex justify-between items-center cursor-pointer">
            <span>All Languages</span>
            <ChevronRight className="w-3 h-3 rotate-90 opacity-60" />
          </div>

        </div>

        {/* Results Metadata */}
        <div className="flex items-center justify-between text-xs text-neutral-500 pb-2 border-b border-neutral-100 font-bold uppercase tracking-wider">
          <span>{lawyers.length} verified {lawyers.length === 1 ? 'lawyer' : 'lawyers'} found</span>
          {isReindexing && <span className="text-[#bfa37a] animate-pulse">Running DB reindex...</span>}
        </div>

        {/* Catalog Grid matching exact UI styles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <AnimatePresence mode="popLayout">
            {lawyers.map((lawyer, index) => (
              <motion.div
                key={lawyer.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="group flex flex-col items-start bg-white border border-neutral-100 p-4 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 relative"
              >
                {/* Image Frame with languages */}
                <div className="relative w-full h-[180px] overflow-hidden bg-neutral-100 shrink-0">
                  <img src={lawyer.profileImageUrl} alt={lawyer.fullName} className="h-full w-full object-cover object-top" />
                  
                  {/* Language Badges */}
                  <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1">
                    {lawyer.languages.map((lang) => (
                      <span key={lang} className="text-[7px] bg-black/45 backdrop-blur-md text-white font-bold uppercase tracking-widest px-2 py-0.5 border border-white/10 rounded-none">
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Display Info below card */}
                <div className="w-full pt-4 space-y-1.5 text-left">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#bfa37a]">
                    {lawyer.practiceAreas[0]}
                  </span>
                  
                  <h4 className="text-neutral-900 font-serif font-bold text-base transition-colors group-hover:text-[#bfa37a] leading-none">
                    {lawyer.fullName}
                  </h4>
                  
                  <p className="text-neutral-450 text-[11px] font-light leading-normal line-clamp-2">
                    {lawyer.bio}
                  </p>

                  <div className="flex items-center gap-2 pt-2">
                    <div className="flex items-center gap-0.5 text-[9px] font-bold text-neutral-600 bg-neutral-100 px-2 py-1 rounded">
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                      {lawyer.avgRating.toFixed(1)}
                    </div>
                    <div className="text-[8px] font-bold uppercase tracking-widest text-neutral-400 bg-neutral-100 px-2 py-1 rounded">
                      {lawyer.district}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
