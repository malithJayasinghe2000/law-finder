import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Same, for a date that may not exist yet.
 *
 * Since firm-first intake, a matter can be created with no appointment at all —
 * the firm proposes a time when it quotes. Call sites that render a schedule
 * must cope with that rather than crashing on a null.
 */
export function formatSriLankaDateIsoOrNull(date: Date | null | undefined): string | null {
  return date ? formatSriLankaDateIso(date) : null;
}

export function formatSriLankaDateIso(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function parseDateOnlyToUtc(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateOnlyString(
  date: string,
  locale = 'en-US',
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
) {
  const [year, month, day] = date.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(utcDate);
}
