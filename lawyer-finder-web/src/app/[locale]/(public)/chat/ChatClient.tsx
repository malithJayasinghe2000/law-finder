'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Paperclip, MoreVertical, Search, MessageSquare, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatClient({ locale, initialQuery }: { locale: string; initialQuery: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialQuery) {
      handleSend(initialQuery);
    } else {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: 'Hello! I am LawyerAI, your personal legal assistant. How can I help you today?',
        }
      ]);
    }
  }, [initialQuery]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    const newMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `This is a simulated response to: "${text}". The AI integration is currently in demo mode.`,
        }
      ]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-[#fcfcfc] font-sans">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6">
        <div className="flex items-center gap-4">
          <Link href={`/${locale}`} className="text-neutral-400 hover:text-black transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center bg-black text-white rounded-none">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-black">LawyerAI Personal Assistant</h1>
              <p className="text-[11px] text-green-600 font-semibold uppercase tracking-widest">Online</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/lawyers`} className="flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-black uppercase tracking-widest transition-colors">
            <Search className="w-4 h-4" /> Find Lawyer
          </Link>
          <button className="text-neutral-400 hover:text-black transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[80%] gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-none shadow-sm ${
                    message.role === 'user' ? 'bg-neutral-200 text-neutral-600' : 'bg-black text-white'
                  }`}
                >
                  {message.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </div>

                {/* Bubble */}
                <div
                  className={`relative flex flex-col p-4 shadow-sm rounded-none border ${
                    message.role === 'user'
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-neutral-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-left font-light">
                    {message.content}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex w-full justify-start">
              <div className="flex max-w-[80%] gap-4 flex-row">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-black text-white rounded-none shadow-sm">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="flex items-center justify-center p-4 bg-white border border-neutral-200 rounded-none shadow-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 bg-white border-t border-neutral-200 p-4">
        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-end gap-2 bg-neutral-50 border border-neutral-200 p-2 shadow-sm rounded-none focus-within:border-black focus-within:ring-1 focus-within:ring-black transition-all"
          >
            <button
              type="button"
              className="p-3 text-neutral-400 hover:text-black transition-colors shrink-0"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder="Type your message here..."
              className="max-h-32 min-h-[44px] w-full resize-none bg-transparent py-3 text-sm outline-none placeholder:text-neutral-400 font-light"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-3 bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 rounded-none"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </form>
          <div className="mt-2 text-center text-[10px] text-neutral-400 font-medium uppercase tracking-widest">
            AI can make mistakes. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
}
