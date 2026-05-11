/**
 * Return true when the provided URL is a valid Google Meet link.
 * Used for lawyer profile validation and meeting URL storage.
 */
export function isGoogleMeetLink(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    const isGoogleHost = parsed.hostname === 'meet.google.com';
    const isHttps = parsed.protocol === 'https:';
    const validPath = /^\/([a-z]{3}-[a-z]{4}-[a-z]{3})(\/.+)?$/.test(parsed.pathname);
    return isHttps && isGoogleHost && validPath;
  } catch {
    return false;
  }
}
