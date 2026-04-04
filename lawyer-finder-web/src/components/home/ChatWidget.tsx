"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChatWidget() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button size="icon" className="h-14 w-14 rounded-full shadow-2xl hover:scale-105 transition-transform duration-300 bg-primary text-primary-foreground">
        <MessageCircle className="h-6 w-6" />
      </Button>
    </div>
  );
}
