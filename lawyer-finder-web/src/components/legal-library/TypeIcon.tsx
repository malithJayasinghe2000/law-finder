import {
  BookOpen, ClipboardList, FileText, Gavel, Landmark, ListChecks, MapPin, Newspaper, Scale, Scroll, type LucideProps,
} from 'lucide-react';

/** One icon per kind of library document (src/lib/legalLibrary.ts). */
const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  CONSTITUTION: Landmark,
  ACT: BookOpen,
  ORDINANCE: Scroll,
  REGULATION: ListChecks,
  PROVINCIAL_STATUTE: MapPin,
  GAZETTE_NOTIFICATIONS: Newspaper,
  COURT_RULES: ClipboardList,
  SRI_LANKA_LAW_REPORTS: Scale,
  SUPREME_COURT_DECISIONS: Gavel,
  COURT_OF_APPEAL_DECISIONS: Gavel,
  HIGH_COURT_DECISIONS: Gavel,
};

export function TypeIcon({ type, ...props }: { type: string } & LucideProps) {
  const Icon = ICONS[type] ?? FileText;
  return <Icon aria-hidden="true" {...props} />;
}
