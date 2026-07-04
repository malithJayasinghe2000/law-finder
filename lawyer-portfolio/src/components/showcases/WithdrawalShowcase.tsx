import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { 
  Landmark, ArrowUpRight, TrendingUp, CheckCircle2, 
  Loader2, RefreshCw, DollarSign
} from 'lucide-react';
import MockDashboardSidebar from '../MockDashboardSidebar';
import MockDashboardHeader from '../MockDashboardHeader';

interface Transaction {
  id: string;
  date: string;
  bank: string;
  amount: number;
  status: 'Completed' | 'Pending' | 'Processing';
}

export default function WithdrawalShowcase() {
  const [balance, setBalance] = useState(1420.00);
  const [escrow, setEscrow] = useState(850.00);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 'tx-1', date: 'June 28, 2026', bank: 'Sampath Bank (*4920)', amount: 950.00, status: 'Completed' },
    { id: 'tx-2', date: 'June 10, 2026', bank: 'Commercial Bank (*1184)', amount: 1200.00, status: 'Completed' }
  ]);
  const [showModal, setShowModal] = useState(false);
  const [key, setKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.2 });

  useEffect(() => {
    if (!isInView) return;

    let active = true;
    setBalance(1420.00);
    setEscrow(850.00);
    setIsProcessing(false);
    setIsComplete(false);
    setShowModal(false);
    setTransactions([
      { id: 'tx-1', date: 'June 28, 2026', bank: 'Sampath Bank (*4920)', amount: 950.00, status: 'Completed' },
      { id: 'tx-2', date: 'June 10, 2026', bank: 'Commercial Bank (*1184)', amount: 1200.00, status: 'Completed' }
    ]);

    const runSimulation = async () => {
      // Wait 1.5s
      await new Promise(r => setTimeout(r, 1500));
      if (!active) return;

      // Open Modal
      setShowModal(true);

      // Wait 2.0s (lawyer reviewing bank details in simulation)
      await new Promise(r => setTimeout(r, 2000));
      if (!active) return;

      // Click Confirm -> processing
      setIsProcessing(true);

      // Wait 2.5s (bank handshake)
      await new Promise(r => setTimeout(r, 2500));
      if (!active) return;

      // Success!
      setIsProcessing(false);
      setIsComplete(true);

      // Counter countdown
      const startBalance = 1420.00;
      const duration = 1000; // 1s
      const steps = 30;
      const stepTime = duration / steps;
      
      for (let i = 1; i <= steps; i++) {
        if (!active) return;
        const current = startBalance - (startBalance * (i / steps));
        setBalance(Number(current.toFixed(2)));
        await new Promise(r => setTimeout(r, stepTime));
      }

      if (!active) return;
      // Close modal shortly after count down
      await new Promise(r => setTimeout(r, 600));
      if (!active) return;
      setShowModal(false);

      // Append ledger item
      setTransactions(prev => [
        { id: 'tx-new', date: 'July 10, 2026', bank: 'Sampath Bank (*4920)', amount: 1420.00, status: 'Processing' },
        ...prev
      ]);
    };

    runSimulation();

    return () => {
      active = false;
    };
  }, [isInView, key]);

  return (
    <div 
      ref={containerRef}
      className="w-full bg-[#fbf9f6] rounded-xl overflow-hidden border border-neutral-200 text-left font-sans text-neutral-800 flex flex-col shadow-lg select-none relative"
    >
      
      {/* Dashboard Top bar */}
      <MockDashboardHeader title="Lawyer Portal" />

      {/* Main dashboard body */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 flex-grow min-h-[500px]">
        
        {/* LEFT COLUMN: Sidebar */}
        <div className="md:col-span-3">
          <MockDashboardSidebar activeTab="Earnings & Payouts" />
        </div>

        {/* RIGHT COLUMN: Ledger Accounts & payouts list */}
        <div className="md:col-span-9 p-6 bg-neutral-50 space-y-6 max-h-[520px] overflow-y-auto">
          
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Earnings &amp; Payouts Ledger</span>
            
            <button 
              onClick={() => setKey(prev => prev + 1)}
              className="p-1.5 rounded bg-white border border-neutral-200 hover:border-gold/30 text-neutral-455 hover:bg-[#030303] hover:text-white transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Ledger balance cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white border border-neutral-100 rounded-xl flex flex-col justify-between h-28 shadow-sm">
              <div className="flex items-center justify-between text-[9px] font-bold uppercase text-neutral-455 tracking-wider">
                <span>Withdrawable Balance</span>
                <DollarSign className="w-3.5 h-3.5 text-[#bfa37a]" />
              </div>
              <div>
                <p className="text-xl font-bold text-neutral-900 tracking-tight">
                  LKR {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[9px] text-emerald-500 font-bold flex items-center gap-0.5 mt-0.5">
                  <TrendingUp className="w-2.5 h-2.5" /> +14.2% client bookings
                </p>
              </div>
            </div>

            <div className="p-4 bg-white border border-neutral-100 rounded-xl flex flex-col justify-between h-28 shadow-sm">
              <div className="flex items-center justify-between text-[9px] font-bold uppercase text-neutral-455 tracking-wider">
                <span>Secured Escrow Balance</span>
              </div>
              <div>
                <p className="text-xl font-bold text-neutral-400 tracking-tight">
                  LKR {escrow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[9px] text-neutral-500 font-light mt-0.5 leading-none">
                  Released automatically upon client intake validation
                </p>
              </div>
            </div>
          </div>

          {/* Transaction payouts records ledger list */}
          <div className="space-y-3">
            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block">Ledger Records</span>
            <div className="divide-y divide-neutral-150 border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-sm max-h-[160px] overflow-y-auto pr-1">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-3 flex items-center justify-between text-[11px] hover:bg-neutral-50">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded bg-neutral-100 border border-neutral-150 flex items-center justify-center text-neutral-450">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-neutral-900 leading-none">Payout to {tx.bank}</p>
                      <p className="text-[9px] text-neutral-455 font-light mt-0.5">{tx.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-800">LKR {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      tx.status === 'Completed'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-[#bfa37a]/10 text-[#bfa37a] border-[#bfa37a]/20 animate-pulse'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Modal Simulation Overlay */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-neutral-950/60 backdrop-blur-xs z-30 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-white rounded-2xl p-5 border border-neutral-250 shadow-2xl text-center space-y-4"
            >
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-9 h-9 rounded-full bg-[#bfa37a]/15 text-[#bfa37a] flex items-center justify-center border border-[#bfa37a]/20 shadow-md">
                  <Landmark className="w-4.5 h-4.5" />
                </div>
                <h4 className="text-xs font-bold text-neutral-900 leading-none">Verify Payout Request</h4>
                <p className="text-[9px] text-neutral-500 font-light">Transfer available client revenue to checking account</p>
              </div>

              {/* Bank destination card */}
              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-150 text-left space-y-1">
                <span className="text-[8px] uppercase tracking-widest font-bold text-neutral-400">Destination Account</span>
                <p className="text-[10px] font-bold text-neutral-950 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#bfa37a]"></span>
                  Sampath Bank PLC
                </p>
                <p className="text-[9px] text-neutral-550 font-light">Checking Account: ******4920</p>
              </div>

              {/* Amount details */}
              <div className="flex justify-between items-baseline py-1.5 border-y border-neutral-150 text-left text-xs">
                <span className="text-neutral-500 font-light">Withdrawal Amount:</span>
                <span className="text-sm font-bold text-[#bfa37a]">LKR 1,420.00</span>
              </div>

              {/* Actions trigger */}
              <div className="w-full">
                {isProcessing ? (
                  <div className="w-full py-2 bg-neutral-900 text-[#bfa37a] flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-wider">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#bfa37a]" />
                    <span>Processing bank release...</span>
                  </div>
                ) : isComplete ? (
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="w-full py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-wider"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Withdrawal Dispatched</span>
                  </motion.div>
                ) : (
                  <button className="w-full py-2 bg-[#bfa37a] text-white rounded hover:bg-[#a68d67] font-bold text-[9px] uppercase tracking-wider transition-colors shadow-md">
                    Confirm &amp; Transfer Funds
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
