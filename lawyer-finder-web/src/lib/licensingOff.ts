import { NextResponse } from 'next/server';

/**
 * The answer every licence API gives while licensing is off (src/lib/licensing.ts).
 * Server-only: licensing.ts itself stays a plain module the sidebar can import.
 */
export function licensingOffResponse() {
  return NextResponse.json({ error: 'Licences are not sold yet.' }, { status: 410 });
}
