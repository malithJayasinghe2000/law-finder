'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Download, FileText, ExternalLink, BookOpen, Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocumentDetail {
  id: string;
  title: string;
  category: string;
  categoryDisplay: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  outline?: OutlineItem[] | null;
}

interface OutlineItem {
  title: string;
  page: number;
  summary: string;
}

// Outlines generator based on document metadata
const getDocumentOutline = (title: string, fileName: string): OutlineItem[] => {
  const normTitle = (title || '').toLowerCase() + ' ' + (fileName || '').toLowerCase();
  
  if (normTitle.includes('criminal') || normTitle.includes('procedure')) {
    return [
      {
        title: 'Part I: Preliminary & Definitions',
        page: 1,
        summary: 'Defines fundamental legal terminology, court structures, jurisdiction, and general directives for criminal procedure in Sri Lanka.'
      },
      {
        title: 'Part II: Constitution and Powers of Criminal Courts',
        page: 12,
        summary: 'Details the classification of criminal courts, their geographical jurisdictions, and the sentencing limits of magistrates and high court judges.'
      },
      {
        title: 'Part III: Public Assistance and Information',
        page: 28,
        summary: 'Outlines the legal duties of the public to assist Magistrates and Police Officers, and the requirements for reporting crimes.'
      },
      {
        title: 'Part IV: Rules of Arrest, Escape, and Bail',
        page: 45,
        summary: 'Regulates circumstances of arrest without warrant, searches of private premises, custody rules, escape recovery, and bail conditions.'
      },
      {
        title: 'Part V: Processes to Compel Appearance',
        page: 68,
        summary: 'Covers summons, warrants of arrest, service protocols, proclamation of absconding persons, and attachment of property.'
      },
      {
        title: 'Part VI: Police Inquiries and Investigations',
        page: 92,
        summary: 'Defines the legal procedures for registering complaints (FIRS), conducting searches, recording statements, and filing charge sheets.'
      },
      {
        title: 'Part VII: Jurisdiction of Courts in Inquiries and Trials',
        page: 115,
        summary: 'Lays down rules regarding the proper place of inquiry or trial, and conditions required to initiate prosecution.'
      },
      {
        title: 'Part VIII: Charges and Joinder of Offences',
        page: 135,
        summary: 'Explains form requirements for criminal charges, joinder of charges against a single accused, or trials involving multiple accused.'
      },
      {
        title: 'Part IX: General Provisions as to Inquiries and Trials',
        page: 160,
        summary: 'Includes rights of accused persons to defense, tender of pardon to accomplices, and procedures in case of unsound mind.'
      }
    ];
  }

  if (normTitle.includes('companies') || normTitle.includes('company')) {
    return [
      {
        title: 'Part I: Incorporation and Name Registration',
        page: 1,
        summary: 'Procedures for incorporating a company in Sri Lanka, name approval, reservation, and articles of association guidelines.'
      },
      {
        title: 'Part II: Share Capital, Dividends, and Debentures',
        page: 18,
        summary: 'Rules governing shares issuance, transfer of shares, reduction of capital, dividend declarations, and debenture registries.'
      },
      {
        title: 'Part III: Company Management and Administration',
        page: 48,
        summary: 'Establishes guidelines for registered offices, keeping statutory books, annual returns filing, and general meetings.'
      },
      {
        title: 'Part IV: Directors: Appointment, Duties, and Liabilities',
        page: 85,
        summary: 'Defines qualification of directors, fiduciary duties, conflicts of interest disclosures, and rules on loans to directors.'
      },
      {
        title: 'Part V: Secretarial Administration and Registrars',
        page: 120,
        summary: 'Mandates qualifications of company secretaries, duties, registration filings, and the powers of the Registrar of Companies.'
      },
      {
        title: 'Part VI: Accounts, Audits, and Disclosures',
        page: 155,
        summary: 'Requirements for maintaining proper accounting records, financial statements presentation, audit reports, and inspectors.'
      },
      {
        title: 'Part VII: Charges, Mortgages, and Registrations',
        page: 190,
        summary: 'Regulates the creation and registration of charges, mortgages on company assets, and consequences of non-registration.'
      },
      {
        title: 'Part VIII: Amalgamations, Arrangements, and Mergers',
        page: 220,
        summary: 'Procedures for corporate restructures, mergers (amalgamation), compromises with creditors, and minority shareholder rights.'
      },
      {
        title: 'Part IX: Winding Up and Insolvency Proceedings',
        page: 260,
        summary: 'Covers voluntary winding up, court-ordered liquidation, liquidators appointment, priority of claims, and dissolution.'
      }
    ];
  }

  return [
    {
      title: 'Chapter 1: Preliminary & Introductions',
      page: 1,
      summary: 'Introduction to the document, basic definitions, scope of applicability, and foundational concepts.'
    },
    {
      title: 'Chapter 2: Main Directives and Regulations',
      page: 10,
      summary: 'Details the primary sections, core regulations, mandatory legal provisions, and legal obligations.'
    },
    {
      title: 'Chapter 3: Administrative and Execution Guidelines',
      page: 30,
      summary: 'Procedures for enforcement, administrative setups, dispute resolutions, and operational rules.'
    },
    {
      title: 'Chapter 4: Special Provisions and Exemptions',
      page: 60,
      summary: 'Outlines exclusions, exceptions, special privileges, and supplementary rules.'
    },
    {
      title: 'Chapter 5: Enforcement, Penalties and General Clauses',
      page: 90,
      summary: 'Details offenses, corresponding fines/penalties, transitional arrangements, and final clauses.'
    }
  ];
};

export default function DocumentDetailPage() {
  const params = useParams();
  const locale = params.locale as string;
  const docId = params.id as string;

  const [documentDetail, setDocumentDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [outline, setOutline] = useState<OutlineItem[]>([]);

  // Fetch document details
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await fetch(`/api/legal-documents/${docId}`);
        if (!res.ok) {
          setError('Document not found');
          return;
        }
        const data = await res.json();
        setDocumentDetail(data.document);
        
        // Set outline from database if present, otherwise fall back to hardcoded generator
        if (data.document) {
          if (data.document.outline && Array.isArray(data.document.outline) && data.document.outline.length > 0) {
            setOutline(data.document.outline);
          } else {
            const generatedOutline = getDocumentOutline(data.document.title, data.document.fileName);
            setOutline(generatedOutline);
          }
        }
      } catch {
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [docId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-32">
        <div className="max-w-6xl mx-auto px-6 space-y-6">
          <div className="h-6 w-32 bg-neutral-100 animate-pulse" />
          <div className="h-10 w-96 bg-neutral-100 animate-pulse" />
          <div className="h-[600px] bg-neutral-50 border border-neutral-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !documentDetail) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center pt-32">
        <div className="text-center space-y-4">
          <FileText className="w-12 h-12 text-[#bfa37a] stroke-[1] mx-auto" />
          <h2 className="font-serif text-xl text-neutral-800">{error || 'Document not found'}</h2>
          <Link
            href={`/${locale}/legal-library`}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#bfa37a] hover:text-[#a68d67] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const fileUrl = `/api/legal-documents/${docId}/file`;
  const fileSizeMb = (documentDetail.fileSize / (1024 * 1024)).toFixed(2);

  return (
    <div className="min-h-screen bg-[#faf9f6] selection:bg-[#bfa37a]/30 pt-12 pb-16">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Navigation & Actions Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-neutral-200/50 pb-6">
          <div className="space-y-2">
            <Link
              href={`/${locale}/legal-library`}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#bfa37a] hover:text-[#a68d67] transition mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </Link>
            <h1 className="text-2xl md:text-3xl font-serif text-neutral-900 leading-tight">
              {documentDetail.title}
            </h1>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">
              {documentDetail.categoryDisplay} • {fileSizeMb} MB
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a href={fileUrl} download={documentDetail.fileName} className="block">
              <Button className="bg-[#1a1a1a] text-white hover:bg-neutral-800 rounded-none px-6 py-6 text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            </a>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="outline" className="border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-none px-5 py-6 text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </Button>
            </a>
          </div>
        </div>

        {/* 2-Column Split View Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Outline, Chapter Start Pages & Summaries (1/3 Width) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-neutral-200/80 shadow-sm p-6 relative">
              <div className="absolute top-0 right-0 w-3 h-3 bg-[#bfa37a]" />
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-neutral-100">
                <Compass className="w-5 h-5 text-[#bfa37a]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                  Document Structure & Summary
                </h3>
              </div>

              <div className="space-y-4 max-h-[680px] overflow-y-auto pr-1 scrollbar-thin">
                {outline.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePage(item.page)}
                    className={`w-full text-left p-4 transition-all duration-300 border border-neutral-100 hover:border-[#bfa37a]/30 group block relative rounded-none ${
                      activePage === item.page
                        ? 'bg-[#faf6f0] border-l-4 border-l-[#bfa37a] border-neutral-200/80'
                        : 'bg-white hover:bg-neutral-50/50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h4 className="text-xs font-serif font-bold text-neutral-900 group-hover:text-[#bfa37a] transition-colors line-clamp-1">
                        {item.title}
                      </h4>
                      <span className="text-[10px] bg-neutral-100 group-hover:bg-[#bfa37a]/10 text-neutral-500 group-hover:text-[#bfa37a] font-bold px-2 py-0.5 rounded-none shrink-0 transition-colors">
                        Page {item.page}
                      </span>
                    </div>
                    <p className="text-neutral-550 text-[11px] font-light leading-relaxed line-clamp-2">
                      {item.summary}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Normal Native PDF Viewer (2/3 Width) */}
          <div className="lg:col-span-8">
            <div className="bg-white border border-neutral-200/80 shadow-md p-2 relative">
              <div className="absolute top-0 right-0 w-3 h-3 bg-[#bfa37a]" />
              
              <iframe
                key={activePage}
                src={`${fileUrl}#page=${activePage}`}
                className="w-full h-[750px] border-0"
                title={documentDetail.title}
              />
            </div>
          </div>

        </div>

        {documentDetail.description && (
          <div className="mt-8 bg-white border border-neutral-200/80 p-6 max-w-7xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">Description / Abstract</h3>
            <p className="text-neutral-600 text-sm font-light leading-relaxed">{documentDetail.description}</p>
          </div>
        )}

      </div>
    </div>
  );
}

