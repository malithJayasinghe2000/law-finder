'use client';

import { Badge } from '@/components/ui/badge';
import { Globe, Eye } from 'lucide-react';

interface TranslationBadgeProps {
  sourceLanguage: string;
  isAuto: boolean;
  isShowingTranslation: boolean;
  onToggle: () => void;
}

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  si: 'සිංහල (Sinhala)',
  ta: 'தமிழ் (Tamil)',
};

export default function TranslationBadge({
  sourceLanguage,
  isAuto,
  isShowingTranslation,
  onToggle,
}: TranslationBadgeProps) {
  if (!isShowingTranslation && sourceLanguage === 'en') return null;

  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
      <Globe className="h-4 w-4 text-blue-500 flex-shrink-0" />
      <span className="text-blue-700 dark:text-blue-300">
        {isShowingTranslation ? (
          <>
            Auto-translated from <strong>{LANG_NAMES[sourceLanguage] || sourceLanguage}</strong>
            {isAuto && <span className="text-blue-500 ml-1">(machine translation)</span>}
          </>
        ) : (
          <>
            Original language: <strong>{LANG_NAMES[sourceLanguage] || sourceLanguage}</strong>
          </>
        )}
      </span>
      <button
        onClick={onToggle}
        className="ml-auto flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors px-2 py-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30"
      >
        <Eye className="h-3.5 w-3.5" />
        {isShowingTranslation ? 'View Original' : 'Translate'}
      </button>
    </div>
  );
}
