/**
 * A `?redirect=` value we are willing to send someone to after sign-in.
 *
 * Only a path on this site. "//evil.example" and "/\evil.example" are read by
 * browsers as another host, so a redirect parameter that accepted them would turn
 * the login page into an open redirect — a phishing link that starts on our domain.
 */
export function safeRedirect(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}

/** The `?redirect=` of the current page, if it is safe. Client-side only. */
export function currentRedirect(): string | null {
  if (typeof window === 'undefined') return null;
  return safeRedirect(new URLSearchParams(window.location.search).get('redirect'));
}

/** Append a redirect to a sign-in or sign-up link, so it survives the hop between them. */
export function withRedirect(path: string, redirect: string | null): string {
  return redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
}
