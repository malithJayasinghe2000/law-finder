import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Search, MessageSquare, BookOpen,
  Calendar, Landmark, Megaphone,
  CreditCard, FileText, ShieldCheck, ChevronRight, Scroll
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
import LawyerDashboardOverviewShowcase from './components/showcases/LawyerDashboardOverviewShowcase';
import ClientConsultationsShowcase from './components/showcases/ClientConsultationsShowcase';
import LegalLibraryShowcase from './components/showcases/LegalLibraryShowcase';

type Role = 'citizen' | 'advocate';

export default function App() {
  const [currentRole, setCurrentRole] = useState<Role>('citizen');
  const [activeCitizenFeature, setActiveCitizenFeature] = useState<string>('counsel-ai');
  const [activeAdvocateFeature, setActiveAdvocateFeature] = useState<string>('overview');

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const citizenFeatures = [
    {
      id: 'counsel-ai',
      name: 'Counsel AI Assistant',
      description: 'Trilingual Legal Triage Chatbot',
      icon: Bot,
      url: 'https://thelawyr.lk/chat',
      tagline: 'How it works: Type your legal question in plain language. The AI reads it, searches Sri Lanka\'s laws to identify the matching act and draft rules, and suggests verified lawyers specialized in that field to take over your case.'
    },
    {
      id: 'finder',
      name: 'Advocate Finder',
      description: 'Smart Advocate Matching Index',
      icon: Search,
      url: 'https://thelawyr.lk/lawyers',
      tagline: 'How it works: Find the right lawyer by choosing their location, languages, or legal specialties. Click on any profile card to read their full qualifications, office address, and verified ratings left by past clients.'
    },
    {
      id: 'consultations',
      name: 'My Consultations',
      description: 'Consult Booking & Payments Manager',
      icon: CreditCard,
      url: 'https://thelawyr.lk/dashboard/client/consultations',
      tagline: 'How it works: Manage all your consultations in one list. You can join online video meetings directly, submit bank transfer receipts to secure your booking, cancel appointments if needed, or leave ratings and feedback after a consultation is complete.'
    },
    {
      id: 'forum',
      name: 'Community Forum',
      description: 'Citizen Legal Q&A Forum',
      icon: BookOpen,
      url: 'https://thelawyr.lk/blog',
      tagline: 'How it works: Share your legal experiences or read posts written by other citizens. You can search legal topics, create new posts for review, and interact with the community to learn about common legal scenarios.'
    },
    {
      id: 'library',
      name: 'Legal Document Library',
      description: 'Acts, Ordinances & Case Law',
      icon: Scroll,
      url: 'https://thelawyr.lk/legal-library',
      tagline: 'How it works: Explore Sri Lankan Acts, Ordinances, Case Law, and Gazette Notifications. Click on any document to read its outline structure, summary, and view the actual document content.'
    }
  ];

  const advocateFeatures = [
    {
      id: 'overview',
      name: 'Overview Dashboard',
      description: 'Chambers Overview & Stats',
      icon: ShieldCheck,
      url: 'https://thelawyr.lk/dashboard/lawyer',
      tagline: 'How it works: Your practice home screen. View statistics of your profile activity, check your verification status, renew your plan, read incoming Bookings from new clients, and review your profile summary.'
    },
    {
      id: 'bookings',
      name: 'Appointments Calendar',
      description: 'Consult intake schedule desk',
      icon: Calendar,
      url: 'https://thelawyr.lk/dashboard/lawyer/consultations/availability',
      tagline: 'How it works: A calendar showing all your upcoming consults. As clients book slots, appointments appear automatically. You can review time slots, confirm bookings, or cancel sessions if you have schedule conflicts.'
    },
    {
      id: 'ledger',
      name: 'Escrow Ledger & Wallet',
      description: 'Retainer balance & bank withdrawals',
      icon: Landmark,
      url: 'https://thelawyr.lk/dashboard/lawyer/payments',
      tagline: 'How it works: Manage your chambers\' finances. See funds safely held in escrow, review active balances ready for withdrawal, check payout history records, and simulate transfering funds to your bank account.'
    },
    {
      id: 'chat',
      name: 'Secure consultations',
      description: 'Client chatrooms & case vaults',
      icon: MessageSquare,
      url: 'https://thelawyr.lk/dashboard/lawyer/chat',
      tagline: 'How it works: A private chatroom for you and your client. Upload and download important lease drafts or agreements, trace document upload progress, and talk securely in real-time.'
    },
    {
      id: 'campaigns',
      name: 'Visibility placements',
      description: 'Sponsored ads campaign dashboard',
      icon: Megaphone,
      url: 'https://thelawyr.lk/dashboard/lawyer/ads',
      tagline: 'How it works: Promote your practice to get more clients. Design a sponsored campaign banner, pick where it appears on the search list, and preview how your ad will look to users browsing the directory.'
    },
    {
      id: 'articles',
      name: 'Article Publisher',
      description: 'Legal blog content manager',
      icon: FileText,
      url: 'https://thelawyr.lk/dashboard/blog/my-posts',
      tagline: 'How it works: Write and publish articles about common legal issues. Demonstrating your expertise with guides and checklists builds trust and helps prospective clients discover your profile online.'
    }
  ];

  const activeFeatureId = currentRole === 'citizen' ? activeCitizenFeature : activeAdvocateFeature;
  const currentFeaturesList = currentRole === 'citizen' ? citizenFeatures : advocateFeatures;
  const activeFeatureData = currentFeaturesList.find(f => f.id === activeFeatureId) || currentFeaturesList[0];

  const getFeatureUrl = () => {
    return activeFeatureData.url;
  };

  const renderFeatureShowcase = () => {
    switch (activeFeatureId) {
      case 'counsel-ai':
        return <AIChatShowcase />;
      case 'finder':
        return <LawyerFinderShowcase />;
      case 'consultations':
        return <ClientConsultationsShowcase />;
      case 'forum':
      case 'articles':
        return <BlogShowcase />;
      case 'library':
        return <LegalLibraryShowcase />;
      case 'overview':
        return <LawyerDashboardOverviewShowcase />;
      case 'bookings':
        return <BookingShowcase />;
      case 'ledger':
        return <WithdrawalShowcase />;
      case 'chat':
        return <ChatLawyerShowcase />;
      case 'campaigns':
        return <AdPlacementShowcase />;
      default:
        return <AIChatShowcase />;
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-neutral-800 selection:bg-gold/30 flex flex-col justify-between font-sans overflow-x-hidden">

      {/* 1. Sticky Navigation Bar */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-[#efeae0] py-3 px-4 sm:px-12 lg:px-24 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
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

        {/* Workspace Swapping Buttons */}
        <div className="flex gap-1.5 bg-neutral-100 p-1 border border-[#efeae0]">
          <button
            onClick={() => {
              setCurrentRole('citizen');
              setActiveCitizenFeature('counsel-ai');
            }}
            className={`px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all ${currentRole === 'citizen'
              ? 'bg-white text-neutral-950 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-805'
              }`}
          >
            <span className="hidden sm:inline">Citizen Workspace</span>
            <span className="sm:hidden">Citizen</span>
          </button>
          <button
            onClick={() => {
              setCurrentRole('advocate');
              setActiveAdvocateFeature('overview');
            }}
            className={`px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all ${currentRole === 'advocate'
              ? 'bg-white text-neutral-950 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-805'
              }`}
          >
            <span className="hidden sm:inline">Advocate Workspace</span>
            <span className="sm:hidden">Advocate</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => scrollToSection('interactive-sandbox')}
            className="bg-[#0a0a0a] hover:bg-neutral-800 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 transition-all shadow-sm"
          >
            Explore Platform
          </button>
        </div>
      </header>

      {/* 2. Hero Section */}
      <Hero onExploreFeatures={() => scrollToSection('interactive-sandbox')} />

      {/* 3. Interactive Sandbox Section */}
      <main id="interactive-sandbox" className="max-w-7xl mx-auto w-full px-6 sm:px-12 lg:px-12 py-16 space-y-16">

        {/* Sandbox Title & Selector */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#bfa37a]/10 border border-[#bfa37a]/25 text-[#bfa37a] text-[9px] font-bold uppercase tracking-wider">
            <span>Product Sandbox</span>
          </div>
          <h2 className="text-3xl font-serif text-neutral-900 tracking-tight leading-tight">
            Role-Wise Interface Demonstrations
          </h2>
          <p className="text-neutral-500 text-xs font-light leading-relaxed">
            Toggle between the portals to view how the application behaves for citizens seeking legal representation and advocates managing their digital chambers.
          </p>

          {/* Large Portal Toggles */}
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto pt-4">
            <button
              onClick={() => {
                setCurrentRole('citizen');
                setActiveCitizenFeature('counsel-ai');
              }}
              className={`p-4 border transition-all text-left flex flex-col justify-between ${currentRole === 'citizen'
                ? 'bg-white border-[#bfa37a] shadow-md'
                : 'bg-neutral-50 border-neutral-200 hover:bg-white hover:border-neutral-300'
                }`}
            >
              <span className={`text-[9px] font-bold uppercase tracking-wider ${currentRole === 'citizen' ? 'text-[#bfa37a]' : 'text-neutral-400'}`}>Citizen / Client</span>
              <span className="font-serif font-bold text-neutral-900 text-sm mt-1">Consultation &amp; Search</span>
            </button>

            <button
              onClick={() => {
                setCurrentRole('advocate');
                setActiveAdvocateFeature('overview');
              }}
              className={`p-4 border transition-all text-left flex flex-col justify-between ${currentRole === 'advocate'
                ? 'bg-white border-[#bfa37a] shadow-md'
                : 'bg-neutral-50 border-neutral-200 hover:bg-white hover:border-neutral-300'
                }`}
            >
              <span className={`text-[9px] font-bold uppercase tracking-wider ${currentRole === 'advocate' ? 'text-[#bfa37a]' : 'text-neutral-400'}`}>Advocate / Lawyer</span>
              <span className="font-serif font-bold text-neutral-900 text-sm mt-1">Practice Management</span>
            </button>
          </div>
        </div>

        {/* Sandbox Board Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Side Feature Selector Options (Left) */}
          <div className="col-span-1 lg:col-span-4 space-y-3">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] block mb-2 px-1 text-left">
              Select {currentRole === 'citizen' ? 'Client' : 'Lawyer'} Feature
            </span>
            <div className="space-y-2 text-left">
              {currentFeaturesList.map((feature) => {
                const IconComponent = feature.icon;
                const isActive = feature.id === activeFeatureId;
                return (
                  <div
                    key={feature.id}
                    className={`border transition-all duration-300 rounded-lg overflow-hidden ${isActive
                      ? 'bg-white border-[#bfa37a] shadow-md'
                      : 'bg-white/50 border-neutral-200 hover:bg-white hover:border-neutral-300'
                      }`}
                  >
                    <button
                      onClick={() => {
                        if (currentRole === 'citizen') {
                          setActiveCitizenFeature(feature.id);
                        } else {
                          setActiveAdvocateFeature(feature.id);
                        }
                      }}
                      className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer focus:outline-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 shrink-0 flex items-center justify-center border rounded ${isActive ? 'bg-[#bfa37a]/10 border-[#bfa37a]/20 text-[#bfa37a]' : 'bg-neutral-50 border-neutral-200 text-neutral-400'
                          }`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-neutral-900 leading-tight">{feature.name}</h3>
                          <p className="text-[10px] text-neutral-450 mt-0.5 font-light">{feature.description}</p>
                        </div>
                      </div>
                      <span className={`text-[#bfa37a] transition-transform duration-305 shrink-0 ${isActive ? 'rotate-90' : ''}`}>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1.5 text-[11px] text-neutral-500 font-light leading-relaxed border-t border-neutral-100">
                            <span className="text-[9px] font-bold text-[#bfa37a] uppercase tracking-wider block mb-1">How it works</span>
                            {feature.tagline.replace('How it works: ', '')}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Browser Mock Viewport Wrapper (Right) */}
          <div className="col-span-1 lg:col-span-8 w-full">
            <BrowserWindow url={getFeatureUrl()}>
              <div className="w-full">
                {renderFeatureShowcase()}
              </div>
            </BrowserWindow>
          </div>

        </div>

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
              <p className="text-xs text-neutral-505 font-light leading-relaxed">
                Direct matching pipelines that connect clients with qualified, vetted advocates, reducing retention delays and consultation intake friction.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#faf8f5] border border-neutral-150 hover:border-[#bfa37a]/30 transition-all duration-300 space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-[#bfa37a] shadow-xs">
                <LockIcon className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-neutral-900">Secure Retainer Escrows</h4>
              <p className="text-xs text-neutral-505 font-light leading-relaxed">
                Protects upfront retainer fees using a held escrow model, ensuring payment security for clients and guaranteed payment settlements for advocates.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-150 hover:border-[#bfa37a]/30 transition-all duration-300 space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-[#bfa37a] shadow-xs">
                <Calendar className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-neutral-900">Chambers Automation</h4>
              <p className="text-xs text-neutral-505 font-light leading-relaxed">
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

// Simple fallback icon wrapper
function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
