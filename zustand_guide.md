# Zustand State Management Guide

Zustand is a tiny, incredibly fast state management tool. Instead of wrapping your entire app in complex Context Providers (like Redux), Zustand lets you create standalone "hooks" that can be used directly in any component.

We have already initialized your store at [src/store/useUIStore.ts](file:///d:/find%20law/lawyer-finder-web/src/store/useUIStore.ts).

## How to use it in this project

### 1. Reading State (Values)
If a component needs to know if the sidebar is open, you import the store and "select" that specific value.
```tsx
'use client';
import { useUIStore } from '@/store/useUIStore';

export default function Sidebar() {
  // Only grabs `isSidebarOpen`. This component will NOT re-render if `isDarkMode` changes!
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);
  
  return (
    <div className={isSidebarOpen ? 'block' : 'hidden'}>
      Sidebar Content
    </div>
  );
}
```

### 2. Updating State (Actions)
To change the state, you grab the action function (e.g., [toggleSidebar](file:///d:/find%20law/lawyer-finder-web/src/store/useUIStore.ts#13-14)) from the store and attach it to an event like a button click.
```tsx
'use client';
import { useUIStore } from '@/store/useUIStore';

export default function MenuButton() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  
  return (
    <button onClick={toggleSidebar}>
      Toggle Menu
    </button>
  );
}
```

### Golden Rule for Next.js App Router:
Because Zustand relies on React Hooks, any file that imports it **must** have `"use client";` at the very top of the file. You cannot use Zustand inside Server Components.
