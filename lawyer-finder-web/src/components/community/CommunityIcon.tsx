import { communityIcon } from '@/lib/community/icons';

/** A community's line icon (src/lib/community/icons.ts). Decorative: the name is always beside it. */
export function CommunityIcon({ icon, className = 'h-3.5 w-3.5' }: { icon: string | null | undefined; className?: string }) {
  const Icon = communityIcon(icon);
  return <Icon className={className} aria-hidden="true" />;
}
