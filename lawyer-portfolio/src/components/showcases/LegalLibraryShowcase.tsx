import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  BookOpen, Search, Scale, Gavel, Scroll,
  ChevronRight, Calendar, Filter, ArrowRight, ArrowLeft, Download, ExternalLink, Compass, RefreshCw
} from 'lucide-react';
import MockHeader from '../MockHeader';

interface LegalDocument {
  id: string;
  title: string;
  category: string;
  categoryDisplay: string;
  description: string;
  actNumber?: string;
  year?: number;
  caseNumber?: string;
  pageCount?: number;
  outline: { title: string; page: number; summary: string; textContent: string }[];
}

export default function LegalLibraryShowcase() {
  const documents: LegalDocument[] = [
    {
      id: 'doc-1',
      title: 'Penal Code of Sri Lanka (No. 2 of 1883)',
      category: 'ACTS_AND_ORDINANCES',
      categoryDisplay: 'Acts & Ordinances',
      description: 'The primary statute governing criminal offenses, penal liabilities, and punishments in the jurisdiction of Sri Lanka.',
      actNumber: 'No. 2 of 1883',
      year: 1883,
      pageCount: 220,
      outline: [
        {
          title: 'Part I: Preliminary & Definitions',
          page: 1,
          summary: 'Defines fundamental legal terminology, court structures, jurisdiction, and general directives for criminal procedure in Sri Lanka.',
          textContent: 'CHAPTER I - PRELIMINARY\n\n1. This Act may be cited as the Penal Code of Sri Lanka. It governs the definitions of criminal acts, offenses, and outlines territorial jurisdiction.\n\n2. Every person shall be liable to punishment under this Code and not otherwise for every act or omission contrary to the provisions thereof of which he shall be guilty within Sri Lanka.'
        },
        {
          title: 'Part II: General Exceptions & Defences',
          page: 18,
          summary: 'Details acts committed by accident, infancy, insanity, intoxication, or in the exercise of private defense.',
          textContent: 'CHAPTER IV - GENERAL EXCEPTIONS\n\n75. Nothing is an offence which is done by a child under eight years of age.\n\n76. Nothing is an offence which is done by a child above eight years of age and under twelve, who has not attained sufficient maturity of understanding to judge of the nature and consequences of his conduct.'
        },
        {
          title: 'Part III: Of Abetment & Conspiracy',
          page: 45,
          summary: 'Outlines the legal liability of abettors, instigation, and criminal conspiracy principles.',
          textContent: 'CHAPTER V - OF ABETMENT\n\n100. A person abets the doing of a thing who instigates any person to do that thing, or engages with one or more other persons in any conspiracy for the doing of that thing.'
        }
      ]
    },
    {
      id: 'doc-2',
      title: 'Companies Act No. 7 of 2007',
      category: 'ACTS_AND_ORDINANCES',
      categoryDisplay: 'Acts & Ordinances',
      description: 'The statutory framework regulating incorporation, capital structures, administration, and dissolution of corporate entities in Sri Lanka.',
      actNumber: 'No. 7 of 2007',
      year: 2007,
      pageCount: 310,
      outline: [
        {
          title: 'Part I: Incorporation and Name Registration',
          page: 1,
          summary: 'Procedures for incorporating a company in Sri Lanka, name approval, reservation, and articles of association guidelines.',
          textContent: 'PART I - INCORPORATION OF COMPANIES\n\n2. The method of incorporating a company shall involve making an application to the Registrar of Companies in the prescribed form, accompanied by the Articles of Association.'
        },
        {
          title: 'Part II: Shares & Share Capital',
          page: 35,
          summary: 'Rules governing shares issuance, transfer of shares, capital reductions, and dividend distributions.',
          textContent: 'PART II - SHARES AND DEBENTURES\n\n49. A share in a company is personal property and is transferable in accordance with the articles of association, subject to restrictions stated herein.'
        }
      ]
    },
    {
      id: 'doc-3',
      title: 'Supreme Court Case: Wijesinghe v. Attorney General',
      category: 'SUPREME_COURT_DECISIONS',
      categoryDisplay: 'Supreme Court Decisions',
      description: 'Landmark decision concerning fundamental rights petitions, administrative excesses, and constitutional protections.',
      caseNumber: 'SC/FR/421/2020',
      year: 2021,
      pageCount: 45,
      outline: [
        {
          title: 'Section 1: Facts & Background',
          page: 1,
          summary: 'Introduces the petition, the administrative action challenged, and the constitutional articles cited.',
          textContent: 'IN THE SUPREME COURT OF THE DEMOCRATIC SOCIALIST REPUBLIC OF SRI LANKA\n\nIn the matter of an Application under Article 126 of the Constitution.\n\nWijesinghe, Petitioner v. Attorney General, Respondent.'
        },
        {
          title: 'Section 2: Judicial Determination',
          page: 15,
          summary: 'Summarizes court findings on equality protections, due process, and the final judicial orders.',
          textContent: 'HELD:\nThe administrative actions of the respondent amounted to an arbitrary exercise of statutory authority, violating Article 12(1) of the Constitution guaranteeing equal protection under the law.'
        }
      ]
    }
  ];

  const categories = [
    { value: 'ACTS_AND_ORDINANCES', label: 'Acts & Ordinances', count: 2 },
    { value: 'SUPREME_COURT_DECISIONS', label: 'Supreme Court Decisions', count: 1 }
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [activeOutlineIdx, setActiveOutlineIdx] = useState(0);
  const [key, setKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.2 });

  const selectedDoc = documents.find(d => d.id === selectedDocId);

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? doc.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  // Automated Demo Simulation
  useEffect(() => {
    if (!isInView) return;

    let active = true;
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedDocId(null);
    setActiveOutlineIdx(0);

    const runSimulation = async () => {
      // 1. Wait a moment
      await new Promise(r => setTimeout(r, 800));
      if (!active) return;

      // 2. Typing Search Query
      let currentQuery = '';
      const targetQuery = "Penal Code";
      for (let i = 0; i < targetQuery.length; i++) {
        if (!active) return;
        currentQuery += targetQuery[i];
        setSearchQuery(currentQuery);
        await new Promise(r => setTimeout(r, 35));
      }

      // 3. Filter category
      await new Promise(r => setTimeout(r, 500));
      if (!active) return;
      setSelectedCategory('ACTS_AND_ORDINANCES');

      // 4. Click the Penal Code document card
      await new Promise(r => setTimeout(r, 1000));
      if (!active) return;
      setSelectedDocId('doc-1');

      // 5. Switch outline chapter
      await new Promise(r => setTimeout(r, 1500));
      if (!active) return;
      setActiveOutlineIdx(1);
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
      <MockHeader activeTab="LEGAL LIBRARY" />

      {/* Library View Content */}
      <div className="p-6 sm:p-8 space-y-6 max-h-[550px] overflow-y-auto">

        {selectedDoc ? (
          /* INSIDE DOCUMENT DETAILS VIEW */
          <div className="space-y-6">

            {/* Back Button & Actions */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 pb-4 border-b border-neutral-200">
              <button
                onClick={() => {
                  setSelectedDocId(null);
                  setActiveOutlineIdx(0);
                }}
                className="text-neutral-505 hover:text-[#bfa37a] transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Library
              </button>

              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 bg-[#1a1a1a] text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <button className="flex items-center gap-1.5 border border-neutral-205 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-50 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Open Tab
                </button>
              </div>
            </div>

            {/* Title Header */}
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#faf6f0] text-[#bfa37a] text-[8px] font-bold uppercase tracking-widest border border-[#bfa37a]/15">
                {selectedDoc.categoryDisplay}
              </span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 tracking-tight leading-tight mt-2">
                {selectedDoc.title}
              </h2>
              <p className="text-[10px] text-neutral-450 uppercase font-medium mt-1">
                {selectedDoc.actNumber || selectedDoc.caseNumber} · {selectedDoc.year} · {selectedDoc.pageCount || 20} pages
              </p>
            </div>

            {/* Split Screen Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

              {/* Left Column: Outline / Summary (1/3 Width) */}
              <div className="md:col-span-4 bg-white border border-neutral-200 p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                  <Compass className="w-4 h-4 text-[#bfa37a]" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-700">Document Outline</span>
                </div>

                <div className="space-y-2">
                  {selectedDoc.outline.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveOutlineIdx(idx)}
                      className={`w-full text-left p-3 border transition-all text-xs flex flex-col justify-between cursor-pointer ${activeOutlineIdx === idx
                          ? 'bg-[#faf6f0] border-l-4 border-l-[#bfa37a] border-neutral-205'
                          : 'bg-white border-neutral-100 hover:bg-neutral-50/50'
                        }`}
                    >
                      <div className="flex justify-between items-start gap-2 w-full font-bold">
                        <span className="truncate">{item.title}</span>
                        <span className="text-[7.5px] bg-neutral-150 text-neutral-500 px-1 py-0.2">P. {item.page}</span>
                      </div>
                      <p className="text-[9.5px] text-neutral-450 mt-1 font-light leading-relaxed">{item.summary}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Simulated Premium Document Page Viewer (2/3 Width) */}
              <div className="md:col-span-8 bg-white border border-neutral-200 p-6 shadow-inner min-h-[300px] flex flex-col justify-between relative overflow-hidden">
                {/* Background watermark seal */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
                  <Scale className="w-72 h-72 text-neutral-900" />
                </div>

                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-100 text-[8px] text-neutral-400 font-bold uppercase tracking-wider">
                    <span>Democratic Socialist Republic of Sri Lanka</span>
                    <span>Page {selectedDoc.outline[activeOutlineIdx].page}</span>
                  </div>

                  {/* Actual text body */}
                  <div className="font-serif text-neutral-800 text-xs leading-relaxed whitespace-pre-line p-2">
                    {selectedDoc.outline[activeOutlineIdx].textContent}
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-neutral-100 flex justify-between items-center text-[8px] text-neutral-400 font-mono">
                  <span>SYSTEM HASH: SHA-256/LAW_DOC_{selectedDoc.id.toUpperCase()}</span>
                  <span>CONFIDENTIAL REFERENCE</span>
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* NORMAL CATALOG SEARCH VIEW */
          <div className="space-y-6">

            {/* Title & Replay */}
            <div className="flex justify-between items-start gap-4">
              <div>
                <h1 className="text-2xl font-light tracking-tight text-neutral-900">Legal Document Library</h1>
                <p className="text-neutral-505 text-xs font-light mt-1">
                  Explore Sri Lankan Acts, Ordinances, Case Law, and Gazette Notifications cataloged for semantic search.
                </p>
              </div>
              <button
                onClick={() => setKey(prev => prev + 1)}
                className="p-2 rounded bg-white border border-neutral-200 hover:border-gold/30 text-neutral-450 hover:text-white hover:bg-[#030303] transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Replay</span>
              </button>
            </div>

            {/* Embedded Search Form */}
            <div className="p-4 bg-white border border-neutral-100 shadow-sm flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  value={searchQuery}
                  placeholder="Search acts, ordinances, court decisions..."
                  className="w-full bg-transparent border border-neutral-200 rounded px-3.5 pl-8 py-2 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-[#bfa37a]"
                />
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-3" />
              </div>

              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory('')}
                  className="flex items-center gap-1 px-3 py-2 bg-neutral-100 text-neutral-600 text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  <Filter className="w-3 h-3" />
                  <span>Clear Filter</span>
                </button>
              )}
            </div>

            {/* Classification Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(prev => prev === cat.value ? '' : cat.value)}
                    className={`text-left p-4 bg-white border hover:shadow transition-all duration-300 flex justify-between items-center cursor-pointer ${isActive ? 'border-[#bfa37a] bg-[#faf6f0]/20' : 'border-neutral-200/60'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#faf6f0] text-[#bfa37a]">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">{cat.label}</h4>
                        <p className="text-[10px] text-neutral-450 font-light mt-0.5">{cat.count} documents available</p>
                      </div>
                    </div>
                    <span className="text-lg font-serif text-neutral-300">{cat.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Results Header */}
            <div className="text-xs text-neutral-500 font-bold uppercase tracking-wider pb-2 border-b border-neutral-100">
              {filteredDocs.length} legal documents found
            </div>

            {/* Document Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredDocs.map((doc) => (
                  <motion.div
                    key={doc.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => setSelectedDocId(doc.id)}
                    className="bg-white border border-neutral-200/60 p-5 hover:shadow-xl hover:border-neutral-300 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between h-48 cursor-pointer text-left"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-bold uppercase tracking-widest text-[#bfa37a] bg-[#faf6f0] px-2 py-0.5 border border-[#bfa37a]/15">
                          {doc.categoryDisplay}
                        </span>
                        {doc.year && <span className="text-[9px] text-neutral-400 font-bold">{doc.year}</span>}
                      </div>

                      <h3 className="font-serif text-sm font-bold text-neutral-900 group-hover:text-[#bfa37a] line-clamp-2 leading-snug">
                        {doc.title}
                      </h3>

                      <p className="text-neutral-500 text-[10px] font-light line-clamp-2 leading-relaxed">{doc.description}</p>
                    </div>

                    <div className="border-t border-neutral-100 pt-3 flex justify-between items-center text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                      <span>{doc.actNumber || doc.caseNumber}</span>
                      <span className="text-[#bfa37a] flex items-center gap-0.5">
                        View Details <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
