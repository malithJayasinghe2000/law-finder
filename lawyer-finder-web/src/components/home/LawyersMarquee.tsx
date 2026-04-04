"use client";

import { Star } from "lucide-react";

export default function LawyersMarquee() {
  const professionals = [
    { name: "Suresh Perera", area: "Corporate Law" },
    { name: "Amaya Fernando", area: "Family Law" },
    { name: "Nimal Peiris", area: "Criminal Defense" },
    { name: "Dilani Silva", area: "Property Law" },
    { name: "Tariq Mahmud", area: "Civil Litigation" },
    { name: "Chamari Senanayake", area: "Intellectual Property" },
  ];

  return (
    <div className="w-full overflow-hidden border-y border-border/10 bg-background py-8 overflow-x-auto">
      <div className="flex space-x-12 whitespace-nowrap px-4 lg:justify-center">
        {professionals.map((prof, i) => (
          <div key={i} className="flex items-center space-x-4 min-w-max">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground tracking-tight">{prof.name}</p>
              <p className="text-sm text-muted-foreground">{prof.area}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
