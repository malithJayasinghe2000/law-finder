import { motion } from 'framer-motion';
import { 
  Bot, Search, MessageSquare, BookOpen, 
  Calendar, Landmark, Megaphone, 
  ArrowDown, Database, Lock
} from 'lucide-react';
import Hero from './components/Hero';
import BrowserWindow from './components/BrowserWindow';
import AIChatShowcase from './components/showcases/AIChatShowcase';
import LawyerFinderShowcase from './components/showcases/LawyerFinderShowcase';
import ChatLawyerShowcase from './components/showcases/ChatLawyerShowcase';
import BlogShowcase from './components/showcases/BlogShowcase';
import BookingShowcase from './components/showcases/BookingShowcase';
import WithdrawalShowcase from './components/showcases/WithdrawalShowcase';
import AdPlacementShowcase from './components/showcases/AdPlacementShowcase';

export default function App() {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-neutral-800 selection:bg-gold/30 flex flex-col justify-between font-sans overflow-x-hidden">
      
      {/* 1. Sticky Navigation Bar */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-[#efeae0] py-4 px-6 sm:px-12 lg:px-24 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {/* Dark logo because theme is white */}
            <img 
              src="/logo.png" 
              alt="TheLawyr Logo" 
              className="h-8 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }} 
            />
            <span className="font-serif font-bold text-neutral-900 text-base tracking-wide flex items-center gap-1.5">
              TheLawyr
              <span className="text-xs font-sans font-normal text-neutral-400 uppercase tracking-widest pl-1 border-l border-neutral-300">
                Showcase
              </span>
            </span>
          </div>
        </div>

        {/* Scroll Jumps */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-neutral-500">
          <button onClick={() => scrollToSection('counsel-ai')} className="hover:text-neutral-900 transition-colors">Counsel AI</button>
          <button onClick={() => scrollToSection('advocate-finder')} className="hover:text-neutral-900 transition-colors">Finder</button>
          <button onClick={() => scrollToSection('consultation')} className="hover:text-neutral-900 transition-colors">Secure Chat</button>
          <button onClick={() => scrollToSection('blogs')} className="hover:text-neutral-900 transition-colors">Blog</button>
          <button onClick={() => scrollToSection('booking-desk')} className="hover:text-neutral-900 transition-colors">Bookings</button>
          <button onClick={() => scrollToSection('withdrawals')} className="hover:text-neutral-900 transition-colors">Payouts</button>
        </nav>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => scrollToSection('counsel-ai')}
            className="bg-[#0a0a0a] hover:bg-neutral-800 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 transition-all shadow-sm"
          >
            Explore Platform
          </button>
        </div>
      </header>

      {/* 2. Hero Section */}
      <Hero onExploreFeatures={() => scrollToSection('counsel-ai')} />

     

      {/* 3. Interactive Scrolling Playgrounds */}
      <main className="max-w-7xl mx-auto w-full px-6 sm:px-12 lg:px-12 py-12 space-y-36">
        
        {/* Section 1: Counsel AI Assistant */}
        <motion.section 
          id="counsel-ai" 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.65 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center"
        >
          {/* Explanation (Left) */}
          <div className="col-span-1 lg:col-span-4 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#bfa37a]/10 border border-[#bfa37a]/25 text-[#bfa37a] text-[9px] font-bold uppercase tracking-wider">
              <Bot className="w-3.5 h-3.5" />
              <span>Intelligent Counsel</span>
            </div>
            <h2 className="text-3xl font-serif text-neutral-900 tracking-tight leading-tight">
              Instant Counsel AI Research Assistant
            </h2>
            <p className="text-neutral-500 text-xs font-light leading-relaxed">
              Experience the power of our legal counsel assistant. Clients describe their legal queries and instantly receive structured statutory guidance conforming strictly to Sri Lankan codes.
            </p>
            <div className="pt-4 border-t border-neutral-200">
              <span className="font-bold text-[#bfa37a] uppercase tracking-wider block text-[9px]">Platform Advantage</span>
              <p className="text-[11px] text-neutral-500 font-light mt-1">Accelerates pre-consultation inquiries, filtering queries before involving advocate resources.</p>
            </div>
          </div>

          {/* Mockup (Right) */}
          <div className="col-span-1 lg:col-span-8 w-full">
            <BrowserWindow url="https://thelawyr.lk/chat">
              <AIChatShowcase />
            </BrowserWindow>
          </div>
        </motion.section>

        {/* Section 2: Advocate Finder */}
        <motion.section 
          id="advocate-finder" 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.65 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center"
        >
          {/* Explanation (Right on Desktop, Top on Mobile) */}
          <div className="col-span-1 lg:col-span-4 lg:order-last space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#bfa37a]/10 border border-[#bfa37a]/25 text-[#bfa37a] text-[9px] font-bold uppercase tracking-wider">
              <Search className="w-3.5 h-3.5" />
              <span>Advocate Matching</span>
            </div>
            <h2 className="text-3xl font-serif text-neutral-900 tracking-tight leading-tight">
              Specialized Advocate Directory &amp; Matcher
            </h2>
            <p className="text-neutral-500 text-xs font-light leading-relaxed">
              Explore how clients identify corresponding legal representation. Clients input query specializations, filter practice guidelines, and immediately focus matches on top-tier verified profiles.
            </p>
            <div className="pt-4 border-t border-neutral-200">
              <span className="font-bold text-[#bfa37a] uppercase tracking-wider block text-[9px]">Platform Advantage</span>
              <p className="text-[11px] text-neutral-500 font-light mt-1">Includes complete verification loops, verified badge listings, and rating indexing.</p>
            </div>
          </div>

          {/* Mockup (Left on Desktop, Bottom on Mobile) */}
          <div className="col-span-1 lg:col-span-8 lg:order-first w-full">
            <BrowserWindow url="https://thelawyr.lk/lawyers">
              <LawyerFinderShowcase />
            </BrowserWindow>
          </div>
        </motion.section>

        {/* Section 3: Secure Client-Lawyer Chat */}
        <motion.section 
          id="consultation" 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.65 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center"
        >
          {/* Explanation (Left) */}
          <div className="col-span-1 lg:col-span-4 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#bfa37a]/10 border border-[#bfa37a]/25 text-[#bfa37a] text-[9px] font-bold uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Protected Channels</span>
            </div>
            <h2 className="text-3xl font-serif text-neutral-900 tracking-tight leading-tight">
              Secure Communications &amp; Asset Exchange
            </h2>
            <p className="text-neutral-500 text-xs font-light leading-relaxed">
              See how clients and advocates interact in encrypted rooms. Upload lease drafts, NDAs, or pleadings with animated progress monitors, and review real-time double check confirmation stamps.
            </p>
            <div className="pt-4 border-t border-neutral-200">
              <span className="font-bold text-[#bfa37a] uppercase tracking-wider block text-[9px]">Platform Advantage</span>
              <p className="text-[11px] text-neutral-500 font-light mt-1">Secures legal files directly in centralized document lockers, maintaining professional privacy standards.</p>
            </div>
          </div>

          {/* Mockup (Right) */}
          <div className="col-span-1 lg:col-span-8 w-full">
            <BrowserWindow url="https://thelawyr.lk/consultation/room-882">
              <ChatLawyerShowcase />
            </BrowserWindow>
          </div>
        </motion.section>

        {/* Section 4: Dynamic Blogs */}
        <motion.section 
          id="blogs" 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.65 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center"
        >
          {/* Explanation (Right on Desktop) */}
          <div className="col-span-1 lg:col-span-4 lg:order-last space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#bfa37a]/10 border border-[#bfa37a]/25 text-[#bfa37a] text-[9px] font-bold uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Legal Resources</span>
            </div>
            <h2 className="text-3xl font-serif text-neutral-900 tracking-tight leading-tight">
              Dual Persona Knowledge Base
            </h2>
            <p className="text-neutral-500 text-xs font-light leading-relaxed">
              Maintains content channels for both general consumers seeking lease templates, and professional chambers seeking virtual office operations insights.
            </p>
            <div className="pt-4 border-t border-neutral-200">
              <span className="font-bold text-[#bfa37a] uppercase tracking-wider block text-[9px]">Platform Advantage</span>
              <p className="text-[11px] text-neutral-500 font-light mt-1">Generates SEO visibility and organic traffic, positioning advocates directly in search query pipelines.</p>
            </div>
          </div>

          {/* Mockup (Left on Desktop) */}
          <div className="col-span-1 lg:col-span-8 lg:order-first w-full">
            <BrowserWindow url="https://thelawyr.lk/blog">
              <BlogShowcase />
            </BrowserWindow>
          </div>
        </motion.section>

        {/* Section 5: Lawyer Booking Desk */}
        <motion.section 
          id="booking-desk" 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.65 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center"
        >
          {/* Explanation (Left) */}
          <div className="col-span-1 lg:col-span-4 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#bfa37a]/10 border border-[#bfa37a]/25 text-[#bfa37a] text-[9px] font-bold uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" />
              <span>Chambers Administration</span>
            </div>
            <h2 className="text-3xl font-serif text-neutral-900 tracking-tight leading-tight">
              Intake Booking &amp; Schedule Confirmation
            </h2>
            <p className="text-neutral-500 text-xs font-light leading-relaxed">
              Observe client appointment cards arriving on the advocate dashboard calendar. Confirmed entries prompt layout shifts, block timing slots, and lock in bookings.
            </p>
            <div className="pt-4 border-t border-neutral-200">
              <span className="font-bold text-[#bfa37a] uppercase tracking-wider block text-[9px]">Platform Advantage</span>
              <p className="text-[11px] text-neutral-500 font-light mt-1">Stops scheduling conflicts and automates client intakes via video slots.</p>
            </div>
          </div>

          {/* Mockup (Right) */}
          <div className="col-span-1 lg:col-span-8 w-full">
            <BrowserWindow url="https://thelawyr.lk/advocate/dashboard/bookings">
              <BookingShowcase />
            </BrowserWindow>
          </div>
        </motion.section>

        {/* Section 6: Ledger Balance & Payouts */}
        <motion.section 
          id="withdrawals" 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.65 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center"
        >
          {/* Explanation (Right on Desktop) */}
          <div className="col-span-1 lg:col-span-4 lg:order-last space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#bfa37a]/10 border border-[#bfa37a]/25 text-[#bfa37a] text-[9px] font-bold uppercase tracking-wider">
              <Landmark className="w-3.5 h-3.5" />
              <span>Chambers Ledger</span>
            </div>
            <h2 className="text-3xl font-serif text-neutral-900 tracking-tight leading-tight">
              Ledger Payouts &amp; Secure Bank Withdrawals
            </h2>
            <p className="text-neutral-500 text-xs font-light leading-relaxed">
              Simulate escrow fund releases. Advocates view active consult revenues, authorize bank payouts via secure confirmation modals, and trace live counting wallet ledger updates.
            </p>
            <div className="pt-4 border-t border-neutral-200">
              <span className="font-bold text-[#bfa37a] uppercase tracking-wider block text-[9px]">Platform Advantage</span>
              <p className="text-[11px] text-neutral-500 font-light mt-1">Guarantees advocate retainers through held escrow release guidelines.</p>
            </div>
          </div>

          {/* Mockup (Left on Desktop) */}
          <div className="col-span-1 lg:col-span-8 lg:order-first w-full">
            <BrowserWindow url="https://thelawyr.lk/advocate/dashboard/wallet">
              <WithdrawalShowcase />
            </BrowserWindow>
          </div>
        </motion.section>

        {/* Section 7: Visibility Placements */}
        <motion.section 
          id="campaigns" 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.65 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center"
        >
          {/* Explanation (Left) */}
          <div className="col-span-1 lg:col-span-4 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#bfa37a]/10 border border-[#bfa37a]/25 text-[#bfa37a] text-[9px] font-bold uppercase tracking-wider">
              <Megaphone className="w-3.5 h-3.5" />
              <span>Targeted Marketing</span>
            </div>
            <h2 className="text-3xl font-serif text-neutral-900 tracking-tight leading-tight">
              Visibility Campaigns &amp; Sponsor Placements
            </h2>
            <p className="text-neutral-500 text-xs font-light leading-relaxed">
              Explore how legal practitioners generate traffic. Advocates select target showcase zones, configure campaigns, upload banner assets, and preview sponsored placements in the directory index.
            </p>
            <div className="pt-4 border-t border-neutral-200">
              <span className="font-bold text-[#bfa37a] uppercase tracking-wider block text-[9px]">Platform Advantage</span>
              <p className="text-[11px] text-neutral-500 font-light mt-1">Allows advocates to expand local reach and secure targeted client inquiries.</p>
            </div>
          </div>

          {/* Mockup (Right) */}
          <div className="col-span-1 lg:col-span-8 w-full">
            <BrowserWindow url="https://thelawyr.lk/advocate/dashboard/campaigns">
              <AdPlacementShowcase />
            </BrowserWindow>
          </div>
        </motion.section>

      </main>

      {/* 4. Value Proposition and Core Features Section */}
      <section id="platform-specs" className="py-24 border-t border-neutral-200 bg-white shadow-inner">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 lg:px-24 space-y-12">
          
          <div className="text-center space-y-3">
            <h3 className="text-2xl sm:text-3xl font-serif text-neutral-900 tracking-tight">
              Value Proposition &amp; Core Value
            </h3>
            <p className="text-xs text-neutral-500 font-light max-w-xl mx-auto">
              Designed to modernise legal operations, establish digital trust, and streamline case workflow handovers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-150 hover:border-[#bfa37a]/30 transition-all duration-300 space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-[#bfa37a] shadow-xs">
                <Search className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-neutral-900">Verified Representation Match</h4>
              <p className="text-xs text-neutral-500 font-light leading-relaxed">
                Direct matching pipelines that connect clients with qualified, vetted advocates, reducing retention delays and consultation intake friction.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#faf8f5] border border-neutral-150 hover:border-[#bfa37a]/30 transition-all duration-300 space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-[#bfa37a] shadow-xs">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-neutral-900">Secure Retainer Escrows</h4>
              <p className="text-xs text-neutral-500 font-light leading-relaxed">
                Protects upfront retainer fees using a held escrow model, ensuring payment security for clients and guaranteed payment settlements for advocates.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-150 hover:border-[#bfa37a]/30 transition-all duration-300 space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-[#bfa37a] shadow-xs">
                <Calendar className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-neutral-900">Chambers Automation</h4>
              <p className="text-xs text-neutral-500 font-light leading-relaxed">
                Simplifies client appointment bookings, scheduling reminders, and virtual intake calendar blocks to save hours of administrative overhead.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Footer */}
      <footer className="py-12 border-t border-neutral-200 bg-white text-center space-y-4 px-6">
        <div className="flex flex-col items-center justify-center gap-3">
          <img src="/logo.png" alt="TheLawyr Logo" className="h-10 object-contain mx-auto" />
          <p className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider">
            &copy; 2026 TheLawyr Platform. Developed for Showcase and Design demonstration.
          </p>
          <div className="pt-2 border-t border-neutral-100 w-44 mx-auto">
            <span className="text-[9px] text-[#bfa37a] uppercase tracking-[0.25em] font-bold block">
              Product by FiveNeurals
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
