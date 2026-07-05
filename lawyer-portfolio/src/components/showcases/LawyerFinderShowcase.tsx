import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { 
  Search, Star, ChevronRight, RefreshCw, 
  ArrowLeft, ShieldCheck, MapPin, Phone, 
  Scale, Gavel, Calendar, MessageSquare
} from 'lucide-react';
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
  yearsOfExperience: number;
  baslNumber: string;
  contactPhone: string;
}

export default function LawyerFinderShowcase() {
  const allLawyers: Lawyer[] = [
    {
      id: 'dir-1',
      fullName: 'Dr. Lakmal Perera',
      practiceAreas: ['Family Law', 'Tenancy Disputes', 'Land disputes'],
      district: 'Colombo',
      avgRating: 4.9,
      profileImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&h=500&q=80',
      languages: ['English', 'Sinhala'],
      bio: 'Over 14 years of litigation experience in tenancy disputes, rent board representation, and family mediation.',
      yearsOfExperience: 14,
      baslNumber: 'BASL/8821/COL',
      contactPhone: '+94 77 123 4567'
    },
    {
      id: 'dir-2',
      fullName: 'Anjali Senanayake',
      practiceAreas: ['Corporate Law', 'Contract Drafting', 'IP Law'],
      district: 'Colombo',
      avgRating: 4.8,
      profileImageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=500&q=80',
      languages: ['English', 'Sinhala', 'Tamil'],
      bio: 'Specialized in commercial contract compliance, trademarks registration, and board governance audits.',
      yearsOfExperience: 8,
      baslNumber: 'BASL/9924/COL',
      contactPhone: '+94 77 987 6543'
    },
    {
      id: 'dir-3',
      fullName: 'Nalinda Jayasinghe',
      practiceAreas: ['Criminal Defense', 'Advocacy', 'Bail Hearings'],
      district: 'Kandy',
      avgRating: 4.7,
      profileImageUrl: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=400&h=500&q=80',
      languages: ['Sinhala', 'English'],
      bio: 'Dedicated defense advocate representing clients in summary trials, bail applications, and penal representation.',
      yearsOfExperience: 10,
      baslNumber: 'BASL/7722/KAN',
      contactPhone: '+94 81 222 3344'
    },
    {
      id: 'dir-4',
      fullName: 'Priyantha Fernando',
      practiceAreas: ['Civil Litigation', 'Property Disputes', 'Wills & Trust'],
      district: 'Galle',
      avgRating: 4.9,
      profileImageUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&h=500&q=80',
      languages: ['English', 'Sinhala'],
      bio: 'Expert civil litigation chambers handling land partitioning, wills, trust administration, and family deeds.',
      yearsOfExperience: 15,
      baslNumber: 'BASL/6641/GAL',
      contactPhone: '+94 91 555 6677'
    }
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('All Areas');
  const [selectedDistrict, setSelectedDistrict] = useState('All Districts');
  const [lawyers, setLawyers] = useState<Lawyer[]>(allLawyers);
  const [isReindexing, setIsReindexing] = useState(false);
  const [key, setKey] = useState(0);
  const [selectedLawyerId, setSelectedLawyerId] = useState<string | null>(null);

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
    setSelectedLawyerId(null);

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

      // 5. Simulate clicking on the lawyer card to show their profile
      await new Promise(r => setTimeout(r, 1500));
      if (!active) return;
      setSelectedLawyerId('dir-1');
    };

    runSimulation();

    return () => {
      active = false;
    };
  }, [isInView, key]);

  const selectedLawyer = allLawyers.find(l => l.id === selectedLawyerId);

  return (
    <div 
      ref={containerRef}
      className="w-full bg-[#faf8f5] rounded-xl overflow-hidden border border-neutral-200 text-left font-sans text-neutral-800 flex flex-col shadow-lg select-none"
    >
      
      {/* Header */}
      <MockHeader activeTab="FIND LAWYER" />

      {/* Directory / Profile Page Content */}
      <div className="p-6 sm:p-8 space-y-6 max-h-[550px] overflow-y-auto">
        
        {selectedLawyer ? (
          /* Profile Detail View Layout matching LawyerProfileClient.tsx */
          <div className="space-y-6">
            
            {/* Breadcrumb Back Button */}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest pb-4 border-b border-neutral-200">
              <button 
                onClick={() => setSelectedLawyerId(null)}
                className="text-neutral-500 hover:text-[#bfa37a] transition-colors flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Directory
              </button>
            </div>

            {/* Main Split Layout Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              
              {/* LEFT COLUMN: Profile card metadata */}
              <div className="md:col-span-4 space-y-4">
                <div className="relative group overflow-hidden bg-white border border-neutral-200 p-2.5">
                  <div className="relative overflow-hidden bg-neutral-900 aspect-[4/5]">
                    <img 
                      src={selectedLawyer.profileImageUrl} 
                      alt={selectedLawyer.fullName} 
                      className="w-full h-full object-cover" 
                    />
                    
                    {/* Languages inside absolute badge */}
                    <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1">
                      {selectedLawyer.languages.map((lang) => (
                        <span key={lang} className="text-[7.5px] bg-black/45 backdrop-blur-md text-white font-bold uppercase tracking-widest px-2 py-0.5 border border-white/10">
                          {lang}
                        </span>
                      ))}
                    </div>

                    {/* BASL Verification Badge absolute bottom */}
                    <div className="absolute bottom-3 left-3 z-10">
                      <span className="flex items-center gap-1 text-white text-[8px] font-bold bg-[#bfa37a] px-2.5 py-1 uppercase tracking-widest">
                        <ShieldCheck className="h-3.5 w-3.5" /> BASL Verified
                      </span>
                    </div>
                  </div>
                </div>

                {/* Flat Action Buttons */}
                <div className="flex gap-2">
                  <button className="flex-grow flex items-center justify-center gap-1.5 bg-[#1a1a1a] text-white py-3 text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors">
                    <Calendar className="h-3.5 w-3.5" /> Book Now
                  </button>
                  <button className="flex-grow flex items-center justify-center gap-1.5 border border-[#efeae0] text-[#1a1a1a] py-3 text-[10px] font-bold uppercase tracking-wider hover:bg-[#efeae0]/20 transition-colors">
                    <MessageSquare className="h-3.5 w-3.5" /> Chat
                  </button>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-3 border border-[#efeae0] divide-x divide-[#efeae0] bg-[#faf8f6] py-3 text-center">
                  <div>
                    <p className="text-sm font-serif font-bold text-[#1a1a1a]">12</p>
                    <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Reviews</p>
                  </div>
                  <div>
                    <p className="text-sm font-serif font-bold text-[#1a1a1a]">{selectedLawyer.avgRating.toFixed(1)}</p>
                    <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Rating</p>
                  </div>
                  <div>
                    <p className="text-sm font-serif font-bold text-[#1a1a1a]">{selectedLawyer.yearsOfExperience}</p>
                    <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Years Exp</p>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Profile Content Details */}
              <div className="md:col-span-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-[#bfa37a] text-white text-[8px] font-bold px-2 py-0.5 uppercase tracking-widest">Verified</span>
                    <span className="bg-[#efeae0]/40 border border-[#efeae0] text-[#1a1a1a] text-[8px] font-bold px-2 py-0.5 uppercase tracking-widest">Litigation Chambers</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-905 tracking-tight leading-tight">{selectedLawyer.fullName}</h1>
                  <p className="text-xs text-[#bfa37a] font-serif italic mt-1">
                    {selectedLawyer.practiceAreas.join(' · ')}
                  </p>
                  
                  {/* Stars Rating */}
                  <div className="flex items-center gap-2.5 mt-3">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <Star key={v} className={`w-3.5 h-3.5 ${v <= Math.round(selectedLawyer.avgRating) ? 'text-[#bfa37a] fill-[#bfa37a]' : 'text-neutral-200'}`} />
                      ))}
                    </div>
                    <span className="text-xs font-serif font-bold text-neutral-900">{selectedLawyer.avgRating.toFixed(1)}</span>
                    <span className="text-[9px] font-bold uppercase text-neutral-450 tracking-wider">({selectedLawyer.avgRating > 4.8 ? '12 Reviews' : '5 Reviews'})</span>
                  </div>
                </div>

                {/* NOTE: Price/Fee ranges removed completely as per design comments */}

                {/* Bio Description */}
                <div className="border-t border-[#efeae0] pt-4.5">
                  <h3 className="text-[10px] font-bold text-[#bfa37a] uppercase tracking-widest mb-2">About Advocate</h3>
                  <p className="text-neutral-600 text-xs font-light leading-relaxed">
                    {selectedLawyer.bio} Licensed professional representing chambers in high courts and specialized tribunals.
                  </p>
                </div>

                {/* Details Grid */}
                <div className="border-t border-[#efeae0] pt-4.5">
                  <h3 className="text-[10px] font-bold text-[#bfa37a] uppercase tracking-widest mb-3">Chambers Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-light">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-neutral-100 text-[#bfa37a]">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-neutral-450 uppercase tracking-widest">District</p>
                        <p className="font-bold text-neutral-900 mt-0.5">{selectedLawyer.district}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-neutral-100 text-[#bfa37a]">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-neutral-450 uppercase tracking-widest">Contact Phone</p>
                        <p className="font-bold text-neutral-900 mt-0.5">{selectedLawyer.contactPhone}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-neutral-100 text-[#bfa37a]">
                        <Scale className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-neutral-455 uppercase tracking-widest">BASL Number</p>
                        <p className="font-bold text-neutral-900 mt-0.5">{selectedLawyer.baslNumber}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-neutral-100 text-[#bfa37a]">
                        <Gavel className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-neutral-455 uppercase tracking-widest">Court Practice</p>
                        <p className="font-bold text-neutral-900 mt-0.5">Supreme Court &amp; Local Districts</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Practice Areas tag lists */}
                <div className="border-t border-[#efeae0] pt-4.5">
                  <h3 className="text-[10px] font-bold text-[#bfa37a] uppercase tracking-widest mb-2.5">Specializations</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedLawyer.practiceAreas.map((area) => (
                      <span key={area} className="bg-neutral-950 text-white px-3 py-1.5 text-[8.5px] font-bold uppercase tracking-wider">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

              </div>

            </div>

          </div>
        ) : (
          /* Normal Directory Listing View */
          <>
            {/* Main Title section */}
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-light tracking-tight text-neutral-900">Lawyer Directory</h1>
                <p className="text-neutral-500 text-xs font-light leading-relaxed">
                  Browse verified Sri Lankan legal professionals. Click on a profile card to view detailed specifications.
                </p>
              </div>

              <button 
                onClick={() => setKey(prev => prev + 1)}
                className="p-2 rounded bg-white border border-neutral-200 hover:border-gold/30 text-neutral-455 hover:text-white hover:bg-[#030303] transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider shadow-sm"
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
                  className="w-full bg-transparent border border-neutral-200 rounded px-3.5 pl-8 py-2 text-xs text-neutral-805 placeholder-neutral-405 focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-3" />
              </div>

              {/* Area select */}
              <div className="bg-transparent border border-neutral-200 rounded px-3 py-2 text-xs text-neutral-505 flex justify-between items-center cursor-pointer">
                <span>{selectedArea}</span>
                <ChevronRight className="w-3 h-3 rotate-90 opacity-60" />
              </div>

              {/* District select */}
              <div className="bg-transparent border border-neutral-200 rounded px-3 py-2 text-xs text-neutral-505 flex justify-between items-center cursor-pointer">
                <span>{selectedDistrict}</span>
                <ChevronRight className="w-3 h-3 rotate-90 opacity-60" />
              </div>

              {/* Language select */}
              <div className="bg-transparent border border-neutral-200 rounded px-3 py-2 text-xs text-neutral-505 flex justify-between items-center cursor-pointer">
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
                    onClick={() => setSelectedLawyerId(lawyer.id)}
                    className="group flex flex-col items-start bg-white border border-neutral-100 p-4 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 relative cursor-pointer"
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
                        <div className="flex items-center gap-0.5 text-[9px] font-bold text-neutral-605 bg-neutral-100 px-2 py-1 rounded">
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
          </>
        )}

      </div>

    </div>
  );
}
