/**
 * ── Client-Safe Sanitization Utilities ──────────────────────────────────────
 * Regex-based pure functions to strip dangerous HTML, scripts, event handlers,
 * and null bytes. Safe to import in both client-side and server-side code.
 */

const DANGEROUS_HTML_PATTERN = /<\s*\/?\s*(script|iframe|object|embed|form|input|button|textarea|select|style|link|meta|base|applet)[^>]*>/gi;
const HTML_TAG_PATTERN = /<[^>]*>/g;
const EVENT_HANDLER_PATTERN = /\s*on\w+\s*=\s*["'][^"']*["']/gi;
const JAVASCRIPT_URI_PATTERN = /javascript\s*:/gi;
const DATA_URI_PATTERN = /data\s*:\s*text\/html/gi;
const NULL_BYTE_PATTERN = /\0/g;

/**
 * Sanitize a plain-text string by stripping ALL HTML tags, script injections,
 * null bytes, and trimming whitespace. Use for names, titles, messages, etc.
 */
export function sanitizeString(input: string, maxLength = 10000): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(NULL_BYTE_PATTERN, '')           // Remove null bytes
    .replace(DANGEROUS_HTML_PATTERN, '')       // Remove dangerous tags
    .replace(EVENT_HANDLER_PATTERN, '')        // Remove event handlers
    .replace(JAVASCRIPT_URI_PATTERN, '')       // Remove javascript: URIs
    .replace(DATA_URI_PATTERN, '')             // Remove data:text/html URIs
    .replace(HTML_TAG_PATTERN, '')             // Remove all remaining HTML tags
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize rich-text content (e.g. Markdown or TipTap HTML) by removing
 * dangerous tags and attributes while preserving safe formatting tags.
 * Safe tags: p, br, strong, em, ul, ol, li, h1-h6, blockquote, code, pre, a, img
 */
export function sanitizeHtml(input: string, maxLength = 50000): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(NULL_BYTE_PATTERN, '')
    .replace(DANGEROUS_HTML_PATTERN, '')
    .replace(EVENT_HANDLER_PATTERN, '')
    .replace(JAVASCRIPT_URI_PATTERN, '')
    .replace(DATA_URI_PATTERN, '')
    .trim()
    .slice(0, maxLength);
}
