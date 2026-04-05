"use client";

import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.width = 'calc(100% - 400px)';
      document.body.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      document.body.style.overflowX = 'hidden';
    } else {
      document.body.style.width = '100%';
      // Optional: Add a small timeout before removing overflowX if needed
    }
  }, [isOpen]);

  return (
    <>
      <div className={`fixed bottom-8 z-50 transition-all duration-500 ease-in-out ${isOpen ? 'right-[430px]' : 'right-8'}`}>
        {!isOpen && (
          <Button 
            onClick={() => setIsOpen(true)}
            size="icon" 
            className="h-16 w-16 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-110 transition-transform duration-300 bg-white text-black hover:bg-neutral-200"
          >
            <div className="relative flex items-center justify-center w-full h-full">
              <MessageCircle className="h-7 w-7 absolute" />
              <div className="absolute inset-0 rounded-full border-2 border-white animate-ping opacity-20"></div>
            </div>
          </Button>
        )}
      </div>

      <div 
        className={`fixed top-0 right-0 h-full w-[400px] bg-background border-l border-border/50 shadow-2xl z-[100] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
               <MessageCircle className="h-4 w-4 text-primary-foreground" />
            </div>
            <h3 className="font-semibold text-lg">Legal Assistant</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-6 flex flex-col h-[calc(100vh-85px)] bg-muted/20">
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="flex flex-col gap-1 items-start">
              <div className="bg-muted p-4 rounded-2xl rounded-tl-sm max-w-[85%] shadow-sm">
                <p className="text-sm leading-relaxed text-foreground">
                  Hello! How can we assist you with your legal needs today?
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground ml-1">Just now</span>
            </div>
          </div>
          
          <div className="pt-4 mt-auto">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Type your message..." 
                className="w-full p-4 pr-12 rounded-full border border-border/50 bg-background shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all"
              />
              <Button size="icon" className="absolute right-1.5 top-1.5 h-10 w-10 rounded-full bg-primary hover:bg-primary/90">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-send-fill text-primary-foreground" viewBox="0 0 16 16">
                  <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471-.47 1.178Z"/>
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
