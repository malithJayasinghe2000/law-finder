/**
 * Sinhala (/si) and Tamil (/ta) pages.
 *
 * Off: every /si/... and /ta/... address is sent to the same page in English
 * (proxy.ts). Only the menu and a few titles are translated, so a visitor saw a
 * page half in Sinhala, half in English, which reads as broken.
 *
 * Before switching on: move the public pages' text into messages/si.json (and
 * ta.json), have a native speaker check it, and add a language switcher. The
 * dashboards stay English. AI answers stay English until the AI policy's
 * checks work in Sinhala and Tamil (src/lib/ai/policy.ts refuses them today).
 */
export const TRANSLATED_LOCALES_ENABLED = false;
