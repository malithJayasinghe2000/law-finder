import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!socketInstance) {
      // Use the injected NEXT_PUBLIC_SITE_URL or fallback to the current origin
      socketInstance = io(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin, {
        path: '/socket.io',
      });
    }

    setSocket(socketInstance);

    return () => {
      // We don't disconnect immediately so connections remain across page navigations in Next.js
      // But component cleanup can just drop local references.
    };
  }, []);

  return socket;
};
