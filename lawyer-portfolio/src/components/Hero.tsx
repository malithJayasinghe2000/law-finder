import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, Sparkles, Scale, Users, 
  Bot, MessageSquare, Search, Landmark 
} from 'lucide-react';

interface HeroProps {
  onExploreFeatures: () => void;
}

export default function Hero({ onExploreFeatures }: HeroProps) {
  const [searchPlaceholder, setSearchPlaceholder] = useState('');

  useEffect(() => {
    const phrases = [
      'Colombo Family Lawyer...',
      'Rent Act No. 7 eviction notice...',
      'Corporate NDA contract drafting...',
      'Land partition deeds Galle...'
    ];
    let phraseIdx = 0;
    let charIdx = 0;
    let isDeleting = false;
    let active = true;

    const tick = () => {
      if (!active) return;
      const currentPhrase = phrases[phraseIdx];
      if (isDeleting) {
        setSearchPlaceholder(currentPhrase.substring(0, charIdx - 1));
        charIdx--;
      } else {
        setSearchPlaceholder(currentPhrase.substring(0, charIdx + 1));
        charIdx++;
      }

      let delta = 80 - Math.random() * 30;
      if (isDeleting) delta /= 2;

      if (!isDeleting && charIdx === currentPhrase.length) {
        delta = 2000; // pause at full text
        isDeleting = true;
      } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        phraseIdx = (phraseIdx + 1) % phrases.length;
        delta = 500; // pause before next word
      }
      setTimeout(tick, delta);
    };

    const timer = setTimeout(tick, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <section className="relative pt-24 pb-12 px-6 sm:px-12 lg:px-24 overflow-hidden bg-glow-top border-b border-[#efeae0]">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-6xl mx-auto text-center space-y-5 relative z-10">

        

        {/* Headlines matching platform style */}
        <div className="space-y-3">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-serif text-neutral-900 leading-[1.1] tracking-tight max-w-4xl mx-auto"
          >
            Defending Your Rights <br />
            Delivering 
            <span className="inline-flex items-center mx-3 bg-neutral-100 border border-neutral-200 rounded-full h-9 w-20 sm:h-12 sm:w-26 overflow-hidden relative align-middle shadow-inner">
              <img 
                src="/justieswomen.png" 
                className="object-cover object-top w-full h-full scale-125 opacity-90 bg-white" 
                alt="Justice Decor" 
              />
            </span>
            Justice.
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-neutral-500 text-sm sm:text-base max-w-xl mx-auto font-light leading-relaxed"
          >
            Experience high-fidelity interactive playgrounds of Sri Lanka&apos;s leading legal SaaS platform. Find vetted lawyers and run automated client intakes.
          </motion.p>
        </div>

       

        {/* Floating Mockup Layout Section (Add Homepage to the middle, flanked by cards) */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative mt-6 mx-auto max-w-7xl w-full flex items-center justify-center pt-4 pb-6 px-6"
        >
          {/* Background grid design */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#efeae0_1px,transparent_1px),linear-gradient(to_bottom,#efeae0_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25 pointer-events-none -z-10" />

          {/* 1. Far Left Card: Counsel AI */}
          <motion.div 
            whileHover={{ y: -6, rotate: 0, scale: 1.03, zIndex: 30 }}
            className="hidden lg:flex flex-col absolute left-[-4%] xl:left-[1%] w-52 bg-white/75 backdrop-blur-md border border-[#efeae0] p-4 shadow-[0_10px_30px_rgba(191,163,122,0.08)] rotate-[-8deg] transition-all duration-300 origin-center text-left space-y-2.5 z-10 hover:shadow-[0_15px_35px_rgba(191,163,122,0.18)] cursor-pointer"
          >
            <div className="flex items-center gap-1.5 pb-2 border-b border-neutral-100">
              <div className="p-1 rounded bg-[#bfa37a]/10 text-[#bfa37a]">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span className="text-[8px] font-bold text-neutral-900 uppercase tracking-widest">Counsel AI</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-[11px] font-serif font-bold text-neutral-900 leading-tight">Pre-Consultation AI</h4>
              <p className="text-[9.5px] text-neutral-450 font-light leading-relaxed">
                Evaluates client inquiries against statutory codes using vector RAG indexing.
              </p>
            </div>
            <div className="p-1.5 bg-neutral-50 border border-neutral-100 rounded text-[7.5px] font-mono text-neutral-500">
              <span className="text-[#bfa37a]">&gt; MATCH:</span> Rent Act 1972
            </div>
          </motion.div>

          {/* 2. Inner Left Card: Advocate Finder */}
          <motion.div 
            whileHover={{ y: -6, rotate: 0, scale: 1.03, zIndex: 30 }}
            className="hidden lg:flex flex-col absolute left-[12%] xl:left-[16%] w-52 bg-white/80 backdrop-blur-md border border-[#efeae0] p-4 shadow-[0_10px_30px_rgba(191,163,122,0.1)] rotate-[-4deg] transition-all duration-300 origin-center text-left space-y-2.5 z-15 hover:shadow-[0_15px_35px_rgba(191,163,122,0.18)] cursor-pointer"
          >
            <div className="flex items-center gap-1.5 pb-2 border-b border-neutral-100">
              <div className="p-1 rounded bg-[#bfa37a]/10 text-[#bfa37a]">
                <Search className="w-3.5 h-3.5" />
              </div>
              <span className="text-[8px] font-bold text-neutral-900 uppercase tracking-widest">Matcher</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-[11px] font-serif font-bold text-neutral-900 leading-tight">Verified Directory</h4>
              <p className="text-[9.5px] text-neutral-450 font-light leading-relaxed">
                Filter specializations, practice codes, and ratings to match representation.
              </p>
            </div>
            <div className="flex items-center justify-between text-[8px] font-bold text-neutral-500 bg-neutral-50 px-2 py-1 rounded">
              <span>⭐ 4.9 Rating</span>
              <span className="text-[#bfa37a]">COLOMBO</span>
            </div>
          </motion.div>

          {/* Center mockup: The Platform Homepage Mockup */}
          <div className="w-full max-w-2xl xl:max-w-3xl z-20 shadow-[0_20px_50px_rgba(0,0,0,0.12)] transition-all duration-500 hover:shadow-[0_25px_60px_rgba(191,163,122,0.22)] hover:scale-[1.015]">
            <div className="w-full rounded-xl border border-neutral-250 bg-white overflow-hidden">
              {/* Browser address bar */}
              <div className="h-10 px-4 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between gap-4 select-none">
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 opacity-80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 opacity-80"></div>
                </div>
                <div className="flex-1 max-w-sm h-6.5 bg-white border border-neutral-200/80 rounded-md px-3 flex items-center justify-center gap-1.5 text-[10px] text-neutral-450 mx-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#bfa37a] shrink-0 animate-pulse" />
                  <span className="truncate">https://thelawyr.lk</span>
                </div>
                <div className="w-8"></div>
              </div>

              {/* Homepage Render */}
              <div className="bg-white p-6 sm:p-7 space-y-6 text-left select-none">
                {/* Navbar */}
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" className="h-5 w-auto object-contain" alt="TheLawyr Logo" />
                    <span className="font-serif font-bold text-neutral-900 text-sm tracking-wider">TheLawyr</span>
                  </div>
                  <div className="flex items-center gap-5 text-[9px] font-bold text-neutral-450 uppercase tracking-widest">
                    <span className="hover:text-neutral-950 transition-colors">Find Lawyers</span>
                    <span className="hover:text-neutral-950 transition-colors">AI Chat</span>
                    <span className="hover:text-neutral-950 transition-colors">Blog</span>
                  </div>
                  <button className="bg-[#bfa37a] text-white text-[9px] font-bold uppercase tracking-wider px-3.5 py-1.5 border border-[#bfa37a] hover:bg-[#a68d67] transition-all">
                    Portal
                  </button>
                </div>

                {/* Homepage Hero Body */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  {/* Mock content left */}
                  <div className="md:col-span-8 space-y-3.5">
                    <div className="inline-block text-[8px] font-bold text-[#bfa37a] bg-[#bfa37a]/10 border border-[#bfa37a]/25 px-2.5 py-0.5 uppercase tracking-wider rounded">
                      Sri Lanka&apos;s Legal SaaS
                    </div>
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-serif text-neutral-900 leading-tight tracking-tight">
                      Defending Your Rights <br />
                      Delivering 
                      <span className="inline-flex items-center mx-2 bg-neutral-100 border border-neutral-200 rounded-full h-5 w-11 sm:h-7 sm:w-16 overflow-hidden relative align-middle shadow-inner">
                        <img 
                          src="/justieswomen.png" 
                          className="object-cover object-top w-full h-full scale-125 opacity-90 bg-white" 
                          alt="Justice" 
                        />
                      </span>
                      Justice
                    </h3>
                    <p className="text-neutral-450 text-[10px] sm:text-xs leading-relaxed font-light max-w-md">
                      Welcome to LawHub, where our team of experienced attorneys is dedicated to providing you with the best. Sri Lanka&apos;s leading legal SaaS platform.
                    </p>
                    
                    {/* Action buttons & Reviews */}
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <div className="flex gap-2">
                        <button className="bg-[#bfa37a] text-white text-[9px] font-bold uppercase tracking-wider px-4 py-2 border border-[#bfa37a]">
                          Find Lawyers
                        </button>
                        <button className="border border-[#bfa37a] text-[#bfa37a] text-[9px] font-bold uppercase tracking-wider px-4 py-2">
                          Chat AI
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                          <div className="w-5.5 h-5.5 rounded-full border border-white bg-neutral-200 overflow-hidden">
                            <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=50&h=50&q=80" className="w-full h-full object-cover" alt="1" />
                          </div>
                          <div className="w-5.5 h-5.5 rounded-full border border-white bg-neutral-200 overflow-hidden">
                            <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=50&h=50&q=80" className="w-full h-full object-cover" alt="2" />
                          </div>
                          <div className="w-5.5 h-5.5 rounded-full border border-white bg-[#bfa37a] text-white flex items-center justify-center text-[7.5px] font-bold">
                            +12
                          </div>
                        </div>
                        <span className="text-[7.5px] font-bold text-neutral-400 uppercase tracking-widest">100+ Lawyers</span>
                      </div>
                    </div>

                    {/* Chat box mockup */}
                    <div className="pt-2 w-full max-w-sm">
                      <div className="flex border border-neutral-200 rounded overflow-hidden shadow-xs h-9 sm:h-10 bg-neutral-50 items-center px-3 gap-2">
                        <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <div className="flex-1 text-[10px] sm:text-xs text-neutral-450 truncate select-none flex items-center">
                          <span>{searchPlaceholder}</span>
                          <span className="typing-cursor h-3.5 bg-[#bfa37a] w-0.5 ml-0.5"></span>
                        </div>
                        <button className="bg-[#bfa37a] text-white h-7 px-3.5 flex items-center justify-center text-[9px] font-bold uppercase shrink-0">
                          Ask
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Vertical Marquees of Lawyer Images right side */}
                  <div className="md:col-span-4 h-44 overflow-hidden grid grid-cols-2 gap-2 relative border-l border-neutral-100 pl-2">
                    <div className="flex flex-col gap-2 animate-marquee-vertical-up py-0.5 select-none pointer-events-none">
                      <div className="rounded h-16 w-full overflow-hidden bg-neutral-100 border border-neutral-150">
                        <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&h=150&q=80" className="object-cover object-top w-full h-full" alt="Lawyer" />
                      </div>
                      <div className="rounded h-16 w-full overflow-hidden bg-neutral-100 border border-neutral-150">
                        <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&h=150&q=80" className="object-cover object-top w-full h-full" alt="Lawyer" />
                      </div>
                      {/* Duplicate loop */}
                      <div className="rounded h-16 w-full overflow-hidden bg-neutral-100 border border-neutral-150">
                        <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&h=150&q=80" className="object-cover object-top w-full h-full" alt="Lawyer" />
                      </div>
                      <div className="rounded h-16 w-full overflow-hidden bg-neutral-100 border border-neutral-150">
                        <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&h=150&q=80" className="object-cover object-top w-full h-full" alt="Lawyer" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 animate-marquee-vertical-down py-0.5 pt-4 select-none pointer-events-none">
                      <div className="rounded h-16 w-full overflow-hidden bg-neutral-100 border border-neutral-150">
                        <img src="https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=150&h=150&q=80" className="object-cover object-top w-full h-full" alt="Lawyer" />
                      </div>
                      <div className="rounded h-16 w-full overflow-hidden bg-neutral-100 border border-neutral-150">
                        <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&h=150&q=80" className="object-cover object-top w-full h-full" alt="Lawyer" />
                      </div>
                      {/* Duplicate loop */}
                      <div className="rounded h-16 w-full overflow-hidden bg-neutral-100 border border-neutral-150">
                        <img src="https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=150&h=150&q=80" className="object-cover object-top w-full h-full" alt="Lawyer" />
                      </div>
                      <div className="rounded h-16 w-full overflow-hidden bg-neutral-100 border border-neutral-150">
                        <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&h=150&q=80" className="object-cover object-top w-full h-full" alt="Lawyer" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Inner Right Card: Secure Chat */}
          <motion.div 
            whileHover={{ y: -6, rotate: 0, scale: 1.03, zIndex: 30 }}
            className="hidden lg:flex flex-col absolute right-[12%] xl:right-[16%] w-52 bg-white/80 backdrop-blur-md border border-[#efeae0] p-4 shadow-[0_10px_30px_rgba(191,163,122,0.1)] rotate-[4deg] transition-all duration-300 origin-center text-left space-y-2.5 z-15 hover:shadow-[0_15px_35px_rgba(191,163,122,0.18)] cursor-pointer"
          >
            <div className="flex items-center gap-1.5 pb-2 border-b border-neutral-100">
              <div className="p-1 rounded bg-[#bfa37a]/10 text-[#bfa37a]">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <span className="text-[8px] font-bold text-neutral-900 uppercase tracking-widest">Protected Chat</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-[11px] font-serif font-bold text-neutral-900 leading-tight">Escrow Room</h4>
              <p className="text-[9.5px] text-neutral-450 font-light leading-relaxed">
                Exchange legal files and sign lease agreements in secure channels.
              </p>
            </div>
            <div className="flex items-center justify-between p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[7.5px] font-bold uppercase tracking-wider">
              <span>Encrypted</span>
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
            </div>
          </motion.div>

          {/* 4. Far Right Card: Chambers Ledger */}
          <motion.div 
            whileHover={{ y: -6, rotate: 0, scale: 1.03, zIndex: 30 }}
            className="hidden lg:flex flex-col absolute right-[-4%] xl:right-[1%] w-52 bg-white/75 backdrop-blur-md border border-[#efeae0] p-4 shadow-[0_10px_30px_rgba(191,163,122,0.08)] rotate-[8deg] transition-all duration-300 origin-center text-left space-y-2.5 z-10 hover:shadow-[0_15px_35px_rgba(191,163,122,0.18)] cursor-pointer"
          >
            <div className="flex items-center gap-1.5 pb-2 border-b border-neutral-100">
              <div className="p-1 rounded bg-[#bfa37a]/10 text-[#bfa37a]">
                <Landmark className="w-3.5 h-3.5" />
              </div>
              <span className="text-[8px] font-bold text-neutral-900 uppercase tracking-widest">chambers</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-[11px] font-serif font-bold text-neutral-900 leading-tight">Payout Ledger</h4>
              <p className="text-[9.5px] text-neutral-450 font-light leading-relaxed">
                Track client intake bookings, escrow schedules, and payouts.
              </p>
            </div>
            <div className="p-1.5 bg-neutral-50 border border-neutral-100 rounded text-[7.5px] font-mono text-neutral-500 text-center font-bold">
              LKR 42,500 Available
            </div>
          </motion.div>
        </motion.div>

        
      </div>
    </section>
  );
}
