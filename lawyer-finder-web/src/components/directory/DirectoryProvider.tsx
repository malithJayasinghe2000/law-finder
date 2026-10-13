'use client';

import { createContext, useContext } from 'react';

/**
 * Carries the public directory switch to client components (footer, hero
 * search, profile breadcrumbs) so they can hide links to `/lawyers` and
 * `/firms`. Server components call `isPublicDirectoryEnabled()` directly.
 * See src/lib/directory.ts.
 */
const DirectoryContext = createContext(false);

export function DirectoryProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return <DirectoryContext.Provider value={enabled}>{children}</DirectoryContext.Provider>;
}

export function useDirectoryEnabled(): boolean {
  return useContext(DirectoryContext);
}
