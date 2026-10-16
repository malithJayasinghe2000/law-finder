import {
  Scale, House, Landmark, Briefcase, ScrollText, Plane, Signpost, FileText, HardHat, BookOpen, MessagesSquare,
  type LucideIcon,
} from 'lucide-react';

/**
 * The icons a community may have: line icons from the set the rest of the site
 * uses, chosen from this list by an admin, stored by key in `Community.icon`.
 *
 * They used to be emoji typed into a free-text box. Emoji draw differently on
 * every phone, in colour, and some showed people — a smiling family of four on
 * Family Law, where people come about divorce and custody; a car on Motor
 * Traffic, where they come about accidents (2026-10-16). No icon here shows a
 * person.
 */
export const COMMUNITY_ICONS = {
  scale: { label: 'Scales', Icon: Scale },
  house: { label: 'House', Icon: House },
  landmark: { label: 'Bank building', Icon: Landmark },
  briefcase: { label: 'Briefcase', Icon: Briefcase },
  scroll: { label: 'Scroll', Icon: ScrollText },
  plane: { label: 'Plane', Icon: Plane },
  signpost: { label: 'Signpost', Icon: Signpost },
  document: { label: 'Document', Icon: FileText },
  'hard-hat': { label: 'Hard hat', Icon: HardHat },
  book: { label: 'Book', Icon: BookOpen },
  discussion: { label: 'Discussion', Icon: MessagesSquare },
} as const satisfies Record<string, { label: string; Icon: LucideIcon }>;

export type CommunityIconKey = keyof typeof COMMUNITY_ICONS;

export const COMMUNITY_ICON_KEYS = Object.keys(COMMUNITY_ICONS) as [CommunityIconKey, ...CommunityIconKey[]];

export const DEFAULT_COMMUNITY_ICON: CommunityIconKey = 'discussion';

/** The icon for a stored value; anything unknown (an old emoji) gets the default. */
export function communityIcon(key: string | null | undefined): LucideIcon {
  return (key && key in COMMUNITY_ICONS ? COMMUNITY_ICONS[key as CommunityIconKey] : COMMUNITY_ICONS[DEFAULT_COMMUNITY_ICON]).Icon;
}
