import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { 
  FileText, Send, CheckCheck, RefreshCw, 
  Paperclip, ShieldCheck, Download
} from 'lucide-react';
import MockHeader from '../MockHeader';

interface ChatRoom {
  id: string;
  lawyerName: string;
  specialty: string;
  avatar: string;
  status: 'active' | 'offline';
  lastMessage: string;
}

interface ChatMessage {
  id: string;
  sender: 'client' | 'lawyer';
  text: string;
  isStreaming?: boolean;
  file?: {
    name: string;
    size: string;
    isUploaded?: boolean;
  };
}

export default function ChatLawyerShowcase() {
  const rooms: ChatRoom[] = [
    { id: 'rm-1', lawyerName: 'Dr. Lakmal Perera', specialty: 'Family & Tenancy Law', avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=100&h=100&q=80', status: 'active', lastMessage: 'Document received. I will inspect...' },
    { id: 'rm-2', lawyerName: 'Anjali Senanayake', specialty: 'Corporate Law', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&h=100&q=80', status: 'offline', lastMessage: 'Please review the signing draft...' },
    { id: 'rm-3', lawyerName: 'Priyantha Fernando', specialty: 'Civil Property', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&h=100&q=80', status: 'offline', lastMessage: 'Appointment booked for July 12.' }
  ];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLawyerTyping, setIsLawyerTyping] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [key, setKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.2 });
  const scrollRef = useRef<HTMLDivElement>(null);

  const clientMsgText = "Uploading the lease contract copy. Let me know if Clause 12 is legal.";
  const lawyerMsgText = "I received the PDF. Yes, Clause 12 attempts to bypass the Rent Board ejectment procedures, which is completely invalid under Section 22. Do not sign this draft in its current form.";

  useEffect(() => {
    if (!isInView) return;

    let active = true;
    
    // Initial greeting pre-loaded
    setMessages([
      { 
        id: 'm-1', 
        sender: 'lawyer', 
        text: "Good afternoon. Thank you for booking this session. Please send over the lease contract so we can look at the terms." 
      }
    ]);
    setIsLawyerTyping(false);
    setUploadProgress(0);
    setShowUploadProgress(false);

    const runSimulation = async () => {
      // 1. Wait 1.5s
      await new Promise(r => setTimeout(r, 1500));
      if (!active) return;

      // 2. Stream client message (types inside message bubble)
      const clientMessageObj: ChatMessage = {
        id: 'm-2',
        sender: 'client',
        text: '',
        isStreaming: true
      };
      setMessages(prev => [...prev, clientMessageObj]);

      let typedClient = '';
      for (let i = 0; i < clientMsgText.length; i++) {
        if (!active) return;
        typedClient += clientMsgText[i];
        
        setMessages(prev => 
          prev.map(m => m.id === 'm-2' ? { ...m, text: typedClient } : m)
        );
        
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        await new Promise(r => setTimeout(r, 25));
      }
      
      // Stop client streaming state
      setMessages(prev => 
        prev.map(m => m.id === 'm-2' ? { ...m, isStreaming: false } : m)
      );

      // 3. Wait 800ms, then start simulated file upload
      await new Promise(r => setTimeout(r, 800));
      if (!active) return;

      setShowUploadProgress(true);
      setUploadProgress(0);

      // Animate progress bar
      for (let p = 0; p <= 100; p += 10) {
        if (!active) return;
        setUploadProgress(p);
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        await new Promise(r => setTimeout(r, 100));
      }

      if (!active) return;
      setShowUploadProgress(false);

      // Append uploaded file message bubble
      setMessages(prev => [...prev, { 
        id: 'm-3', 
        sender: 'client', 
        text: '',
        file: { name: 'Lease_Agreement_Draft.pdf', size: '2.4 MB', isUploaded: true } 
      }]);

      // 4. Wait 1.5s, then show lawyer typing indicator (bouncing dots)
      await new Promise(r => setTimeout(r, 1500));
      if (!active) return;
      setIsLawyerTyping(true);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }

      // Wait 2.0s (simulates lawyer reviewing the PDF)
      await new Promise(r => setTimeout(r, 2000));
      if (!active) return;
      setIsLawyerTyping(false);

      // 5. Stream lawyer response message bubble
      const lawyerMessageObj: ChatMessage = {
        id: 'm-4',
        sender: 'lawyer',
        text: '',
        isStreaming: true
      };
      setMessages(prev => [...prev, lawyerMessageObj]);

      let typedLawyer = '';
      for (let i = 0; i < lawyerMsgText.length; i++) {
        if (!active) return;
        typedLawyer += lawyerMsgText[i];
        
        setMessages(prev => 
          prev.map(m => m.id === 'm-4' ? { ...m, text: typedLawyer } : m)
        );
        
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        await new Promise(r => setTimeout(r, 25));
      }

      // Stop lawyer streaming state
      setMessages(prev => 
        prev.map(m => m.id === 'm-4' ? { ...m, isStreaming: false } : m)
      );
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
      <MockHeader activeTab="MESSAGES" />

      {/* Main Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 flex-grow h-[520px]">
        
        {/* LEFT COLUMN: Rooms List */}
        <div className="md:col-span-3 bg-white border-r border-neutral-150 p-4 space-y-4 hidden md:block h-full">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-2 block">Consultation Rooms</span>
          
          <div className="space-y-2">
            {rooms.map((room) => {
              const isActive = room.status === 'active';
              return (
                <div 
                  key={room.id}
                  className={`p-3 rounded-lg border text-xs flex gap-2.5 transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-neutral-50 border-[#efeae0] text-[#bfa37a]' 
                      : 'bg-white border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img src={room.avatar} className="w-8 h-8 rounded-full object-cover border border-neutral-200" alt={room.lawyerName} />
                    <span className={`w-2 h-2 rounded-full border border-white absolute bottom-0 right-0 ${
                      isActive ? 'bg-emerald-500' : 'bg-neutral-400'
                    }`}></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-neutral-900 truncate leading-none">{room.lawyerName}</p>
                    <p className="text-[9px] text-neutral-450 font-light truncate mt-0.5">{room.specialty}</p>
                    <p className="text-[10px] text-neutral-500 font-light truncate mt-1.5">{room.lastMessage}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MIDDLE COLUMN: Message feed */}
        <div className="md:col-span-6 bg-[#fdfcfb] flex flex-col justify-between h-full relative border-r border-neutral-150">
          {/* Top Panel bar */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 shrink-0 bg-white">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-neutral-950">Dr. Lakmal Perera</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <button 
              onClick={() => setKey(prev => prev + 1)}
              className="p-1 rounded bg-neutral-50 border border-neutral-200 hover:border-gold/30 text-neutral-455 hover:bg-[#030303] hover:text-white transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Messages list */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 space-y-4 text-xs pb-20 scroll-smooth"
          >
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${msg.sender === 'client' ? 'self-end ml-auto flex-row-reverse' : 'self-start'}`}
              >
                <div className={`rounded-xl p-3.5 leading-relaxed font-light ${
                  msg.sender === 'client'
                    ? 'bg-[#161616] text-white border border-[#161616] rounded-tr-none'
                    : 'bg-white text-neutral-800 border border-[#efeae0] rounded-tl-none shadow-sm'
                }`}>
                  {msg.text && (
                    <p>
                      {msg.text}
                      {msg.isStreaming && <span className="typing-cursor"></span>}
                    </p>
                  )}
                  
                  {msg.file && (
                    <div className="flex items-center gap-2.5 p-2 bg-[#fdfbf7] border border-[#efeae0] rounded-lg text-neutral-800 w-48 mt-1">
                      <FileText className="w-5 h-5 text-[#bfa37a] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[10px] truncate">{msg.file.name}</p>
                        <p className="text-[8px] text-neutral-400 font-light">{msg.file.size}</p>
                      </div>
                      <CheckCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Upload progress */}
            {showUploadProgress && (
              <div className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse">
                <div className="bg-white border border-[#efeae0] rounded-xl rounded-tr-none p-3.5 w-48 space-y-2 shadow-sm">
                  <div className="flex items-center gap-1.5 text-neutral-700">
                    <FileText className="w-4 h-4 text-[#bfa37a] animate-pulse" />
                    <span className="font-medium text-[9px]">Uploading...</span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-1 overflow-hidden">
                    <motion.div className="bg-[#bfa37a] h-full" animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.1 }} />
                  </div>
                  <div className="flex justify-between text-[8px] text-neutral-455 font-light">
                    <span>{uploadProgress}% done</span>
                    <span>2.4 MB</span>
                  </div>
                </div>
              </div>
            )}

            {/* Lawyer typing indicator */}
            {isLawyerTyping && (
              <div className="flex gap-3 self-start">
                <div className="bg-white border border-[#efeae0] rounded-xl rounded-tl-none p-3.5 flex gap-1 items-center shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
          </div>

          {/* Input block (Static placeholder at bottom) */}
          <div className="absolute bottom-4 left-4 right-4 bg-transparent z-20">
            <div className="bg-white border border-neutral-200 rounded-xl p-2 shadow-md flex items-center gap-2">
              <button className="p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-400 shrink-0">
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              
              <input 
                type="text" 
                readOnly 
                placeholder="Type message..." 
                className="flex-1 bg-transparent text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none px-2 min-w-0"
              />

              <button className="p-2 bg-[#bfa37a] text-white rounded-lg shrink-0">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Case Files / Escrow specs */}
        <div className="md:col-span-3 bg-white p-4 space-y-4 hidden md:block h-full">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-1 block">Case Vault Status</span>
          
          <div className="p-3 bg-[#fdfbf7] border border-[#efeae0] rounded-lg space-y-3.5">
            <div className="space-y-1">
              <span className="text-[8px] bg-gold/15 text-gold px-1.5 py-0.5 rounded font-bold uppercase border border-gold/20">Active Consult</span>
              <h5 className="text-[11px] font-bold text-neutral-900 leading-none pt-1">Tenancy Eviction Dispute</h5>
              <p className="text-[9px] text-neutral-450 font-light">Client: Sandamal Silva</p>
            </div>

            <div className="pt-2 border-t border-neutral-100 space-y-1.5 text-[10px]">
              <div className="flex justify-between items-center text-neutral-550">
                <span>Booking Status:</span>
                <span className="font-bold text-neutral-850">Confirmed Slot</span>
              </div>
              <div className="flex justify-between items-center text-neutral-550">
                <span>Escrow Trust:</span>
                <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-500 fill-emerald-500/20" /> Secured
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[9px] font-bold text-neutral-450 uppercase tracking-widest px-1 block">Uploaded Files</span>
            <div className="space-y-1.5">
              {messages.filter(m => m.file).map((m, idx) => (
                <div key={idx} className="p-2 border border-neutral-100 bg-[#fdfcfb] rounded flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-[#bfa37a]" />
                    <span className="font-bold text-neutral-800 truncate">{m.file?.name}</span>
                  </div>
                  <Download className="w-3.5 h-3.5 text-neutral-450 cursor-pointer hover:text-[#bfa37a]" />
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
