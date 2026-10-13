'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { DISTRICTS, PRACTICE_AREAS } from '@/schemas/profile.schema';

interface LawyerFilterFormProps {
  locale: string;
  filters: {
    search?: string;
    district?: string;
    practiceArea?: string;
  };
}

export default function LawyerFilterForm({ locale, filters }: LawyerFilterFormProps) {
  const router = useRouter();

  const [search, setSearch] = useState(filters.search || '');
  const [district, setDistrict] = useState(filters.district || '');
  const [practiceArea, setPracticeArea] = useState(filters.practiceArea || '');

  // Sync state if URL filters change externally (e.g., clicking Clear)
  useEffect(() => {
    setSearch(filters.search || '');
    setDistrict(filters.district || '');
    setPracticeArea(filters.practiceArea || '');
  }, [filters.search, filters.district, filters.practiceArea]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const params = new URLSearchParams();
    const cleanSearch = search.trim();
    if (cleanSearch) params.set('search', cleanSearch);
    if (district) params.set('district', district);
    if (practiceArea) params.set('practiceArea', practiceArea);
    
    // Pushing the new URL triggers a soft-navigation (no hard refresh)
    router.push(`/${locale}/lawyers?${params.toString()}`);
  };

  return (
    <form className="mb-10" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="search"
            placeholder="Search by name or district..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        <select
          name="district"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none"
        >
          <option value="">All Districts</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          name="practiceArea"
          value={practiceArea}
          onChange={(e) => setPracticeArea(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none"
        >
          <option value="">All Practice Areas</option>
          {PRACTICE_AREAS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button type="submit" className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          Filter
        </button>
        <Link
          href={`/${locale}/lawyers`}
          className="h-9 px-5 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors inline-flex items-center justify-center"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}
