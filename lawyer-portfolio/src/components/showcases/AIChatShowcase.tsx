import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { 
  Sparkles, ChevronDown, ChevronUp, 
  Database, CheckCircle, Search, Paperclip, Mic
} from 'lucide-react';
import MockHeader from '../MockHeader';

export default function AIChatShowcase() {
  const [isTyping, setIsTyping] = useState(false);
  const [clientInput, setClientInput] = useState('');
  const [showThoughts, setShowThoughts] = useState(true);
  const [thoughtState, setThoughtState] = useState<'idle' | 'searching' | 'done'>('idle');
  const [showResponse, setShowResponse] = useState(false);
  const [streamedText, setStreamedText] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.2 });
  const scrollRef = useRef<HTMLDivElement>(null);

  const clientMsg = "Can my landlord evict me without notice in Colombo if I refuse a 50% rent increase?";
  
  const fullAIResponse = `**Sri Lankan Rent Act No. 7 of 1972 Guidelines:**

1. **Rent Increases:** Landlords cannot arbitrarily increase rent by 50%. Any rent increase must conform to the "authorized rent" guidelines or be approved by the local Rent Board.
2. **Forced Eviction is Illegal:** A landlord *cannot* lock you out, disconnect utilities, or forcibly evict you without a formal ejectment order from a competent District Court.
3. **Notice Requirement:** The landlord must issue a formal, written quit notice (typically 3 to 12 months depending on the grounds of eviction).
4. **Recommended Action:** 
   - Keep a written record of the 50% demand.
   - Do not vacate under threats.
   - File a complaint at the nearest police station for unlawful harassment/coercion.
   - Seek dispute resolution through the local Rent Board.`;

  useEffect(() => {
    if (!isInView) return;
    
    let active = true;
    setIsTyping(false);
    setClientInput('');
    setThoughtState('idle');
    setShowResponse(false);
    setStreamedText('');

    const runSimulation = async () => {
      // 1. Wait a moment
      await new Promise(r => setTimeout(r, 800));
      if (!active) return;

      // 2. Client types
      setIsTyping(true);
      let currentInput = "";
      for (let i = 0; i < clientMsg.length; i++) {
        if (!active) return;
        currentInput += clientMsg[i];
        setClientInput(currentInput);
        await new Promise(r => setTimeout(r, 20));
      }
      setIsTyping(false);

      // 3. Send message -> Start Thinking
      await new Promise(r => setTimeout(r, 800));
      if (!active) return;
      setThoughtState('searching');

      // 4. Wait for searching steps
      await new Promise(r => setTimeout(r, 2000));
      if (!active) return;
      setThoughtState('done');

      // 5. Stream AI Response
      await new Promise(r => setTimeout(r, 500));
      if (!active) return;
      setShowResponse(true);

      const words = fullAIResponse.split(' ');
      let currentText = '';
      for (let i = 0; i < words.length; i++) {
        if (!active) return;
        currentText += (i === 0 ? '' : ' ') + words[i];
        setStreamedText(currentText);
        
        // Auto scroll to bottom
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        
        await new Promise(r => setTimeout(r, 30));
      }
    };

    runSimulation();

    return () => {
      active = false;
    };
  }, [isInView]);

  // Handle manual scroll update on details open
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [showThoughts, thoughtState, showResponse]);

  return (
    <div 
      ref={containerRef}
      className="w-full bg-[#faf8f5] rounded-xl overflow-hidden border border-neutral-200 text-left font-sans text-neutral-800 flex flex-col shadow-lg select-none"
    >
      
      {/* Navigation Header */}
      <MockHeader activeTab="AI CHAT" />

      {/* Main split page content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 flex-grow h-[520px]">
        
        {/* LEFT COLUMN: Chat sidebar */}
        <div className="md:col-span-3 bg-white border-r border-neutral-150 p-4 flex flex-col justify-between hidden md:flex h-full">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-800 tracking-wider">CHAT</span>
              <div className="relative w-32">
                <input 
                  type="text" 
                  readOnly 
                  placeholder="Search..." 
                  className="w-full bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1 text-[10px] pr-6 focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-2" />
              </div>
            </div>

            {/* New Chat Button */}
            <button className="w-full bg-[#0d0d0f] hover:bg-neutral-850 text-white rounded-none py-2.5 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-gold" />
              <span>NEW CHAT</span>
            </button>

            {/* Conversation list status */}
            <div className="pt-10 text-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                No Conversations Yet
              </span>
            </div>
          </div>

          <div className="text-[9px] text-neutral-450 font-bold uppercase tracking-widest text-center pt-4 border-t border-neutral-100">
            AI Legal Assistant
          </div>
        </div>

        {/* CENTER/MAIN PANEL: Chat Interface Container */}
        <div className="md:col-span-9 bg-[#fdfcfb] flex flex-col justify-between relative h-full">
          
          {/* Scrollable messages thread */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 pb-28 scroll-smooth"
          >
            {/* Greeting Hero Banner */}
            {streamedText.length === 0 && (
              <div className="text-center py-6 space-y-2">
                <span className="text-[9px] text-[#bfa37a] uppercase tracking-[0.25em] font-bold">
                  Consultation Portal
                </span>
                <h1 className="text-3xl sm:text-4xl font-serif text-neutral-900 leading-tight">
                  Hi, I&apos;m Your Personal Lawyer
                </h1>
                <p className="text-neutral-500 text-xs max-w-md mx-auto font-light leading-relaxed">
                  Ask me any question regarding Sri Lankan law, contracts, or procedures to begin a case review.
                </p>
              </div>
            )}

            {/* Greeting bubble */}
            <div className="bg-[#fdfbf7] border border-[#efeae0] rounded-xl rounded-tl-none p-4 max-w-[85%] text-xs font-light leading-relaxed">
              Hello! I am <span className="font-semibold text-[#bfa37a]">TheLawyrAI</span>, your personal legal assistant powered by Sri Lankan legislation and web search. I can help you understand legal provisions from the Civil, Penal, and Tenancy statutes.
            </div>

            {/* Client Message */}
            {clientInput && (
              <div className="flex justify-end">
                <div className="bg-[#161616] text-white border border-[#161616] rounded-xl rounded-tr-none p-4 max-w-[85%] text-xs font-light leading-relaxed">
                  {clientInput}
                  {isTyping && <span className="typing-cursor"></span>}
                </div>
              </div>
            )}

            {/* Thoughts collapsible */}
            {thoughtState !== 'idle' && (
              <div className="space-y-2 max-w-[85%]">
                <div className="flex items-center justify-between w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-lg text-[9px] text-neutral-500 font-bold">
                  <span className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-[#bfa37a] animate-pulse" />
                    {thoughtState === 'searching' ? 'Counsel AI is thinking...' : 'Thought process complete (4.4s)'}
                  </span>
                  <button 
                    onClick={() => setShowThoughts(!showThoughts)}
                    className="text-neutral-450 hover:text-neutral-950 focus:outline-none"
                  >
                    {showThoughts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <AnimatePresence>
                  {showThoughts && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-[#faf8f5] border border-neutral-200 rounded-lg p-3 space-y-1.5 text-[9px] text-neutral-455 font-light"
                    >
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${thoughtState === 'searching' ? 'text-neutral-300' : 'text-emerald-500'}`} />
                        <span>Audited Sri Lankan Rent Act No. 7 of 1972 Section 22</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${thoughtState === 'searching' ? 'text-neutral-300' : 'text-emerald-500'}`} />
                        <span>Checked District Court eviction notice precedents</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${thoughtState === 'searching' ? 'text-neutral-300' : 'text-emerald-500'}`} />
                        <span>Parsed legal remedies &amp; Rent Board actions</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* AI response */}
            {showResponse && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="max-w-[85%] bg-[#fdfbf7] text-neutral-800 border border-[#efeae0] rounded-xl rounded-tl-none p-5 shadow-[0_4px_12px_rgba(0,0,0,0.02)] text-xs font-light leading-relaxed whitespace-pre-line">
                  {streamedText}
                  {streamedText.length < fullAIResponse.length && <span className="typing-cursor"></span>}
                </div>
              </motion.div>
            )}
          </div>

          {/* Sticky Floating input box at bottom */}
          <div className="absolute bottom-4 left-6 right-6 space-y-1.5 bg-transparent z-20">
            <div className="bg-white border border-neutral-200 rounded-2xl p-3 shadow-md flex flex-col gap-2">
              <input 
                type="text" 
                readOnly
                placeholder="Ask about Sri Lankan law..."
                value={clientInput}
                className="w-full bg-transparent text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none"
              />
              
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-neutral-500 border border-neutral-200 rounded bg-neutral-55 px-2 py-0.5 flex items-center gap-1 cursor-pointer">
                    All DB <ChevronDown className="w-2.5 h-2.5" />
                  </span>
                  
                  <span className="text-[9px] font-bold text-neutral-500 border border-neutral-200 rounded bg-neutral-55 px-2 py-0.5 flex items-center gap-1 cursor-pointer">
                    <Paperclip className="w-3 h-3 text-neutral-400" /> Attach
                  </span>
                  
                  <span className="text-[9px] font-bold text-neutral-500 border border-neutral-200 rounded bg-neutral-55 px-2 py-0.5 flex items-center gap-1 cursor-pointer">
                    <Mic className="w-3 h-3 text-neutral-400" /> Voice
                  </span>
                </div>

                <button 
                  disabled
                  className="bg-[#bfa37a] text-white text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1"
                >
                  <span>SEND</span>
                </button>
              </div>
            </div>

            <div className="text-[8px] text-neutral-455 font-bold uppercase tracking-widest text-center">
              POWERED BY SRI LANKAN LEGAL DATABASE &amp; WEB SEARCH
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
