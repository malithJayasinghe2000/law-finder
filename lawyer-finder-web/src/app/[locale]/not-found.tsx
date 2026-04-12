import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Home, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden flex flexlex-col">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-neutral-900 pointer-events-none" />
      
      {/* Animated background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20 animate-pulse delay-1000" />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl">
          
          {/* Main Card */}
          <Card className="rounded-none border-l-4 border-l-white bg-white/5 backdrop-blur-md border-white/10 shadow-2xl p-8 sm:p-12">
            
            {/* Icon */}
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                <ShieldCheck className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* Main Error Message */}
            <div className="text-center mb-8">
              <h1 className="text-6xl sm:text-7xl font-black text-white mb-4 tracking-tighter">
                404
              </h1>
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-4 uppercase tracking-tight">
                Page Not Found
              </h2>
              <p className="text-neutral-400 font-medium max-w-md mx-auto leading-relaxed">
                The page you are looking for doesn't exist or has been moved. Let's get you back on track.
              </p>
            </div>

            {/* Divider */}
            <div className="w-16 h-1 bg-white mx-auto mb-12" />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button className="w-full sm:w-auto bg-white text-black hover:bg-neutral-200 rounded-none h-12 px-8 font-black uppercase tracking-widest group">
                  <Home className="w-4 h-4 mr-2" />
                  Back to Home
                  <ArrowLeft className="w-4 h-4 ml-2 rotate-180 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/en/dashboard">
                <Button 
                  variant="outline" 
                  className="w-full sm:w-auto text-white border-white/20 hover:bg-white/10 hover:border-white rounded-none h-12 px-8 font-black uppercase tracking-widest"
                >
                  Go to Dashboard
                </Button>
              </Link>
            </div>

            {/* Footer Message */}
            <div className="mt-12 pt-8 border-t border-white/10 text-center">
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                Need help? <Link href="/contact" className="text-white hover:underline">Contact support</Link>
              </p>
            </div>

          </Card>

          {/* Support Info */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
            <div className="text-neutral-500">
              <p className="text-[10px] font-black uppercase tracking-widest mb-2 text-neutral-400">Status</p>
              <p className="font-mono text-sm">404 Not Found</p>
            </div>
            <div className="text-neutral-500">
              <p className="text-[10px] font-black uppercase tracking-widest mb-2 text-neutral-400">Solution</p>
              <p className="text-sm">Check your URL and try again</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
