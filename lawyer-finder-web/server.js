require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
// FIX: Use 0.0.0.0 in production so Render can route external traffic to your app
const hostname = dev ? 'localhost' : '0.0.0.0'; 
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const { Pool } = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { PrismaClient } = require('@prisma/client');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  const DANGEROUS_HTML_PATTERN = /<\s*\/?\s*(script|iframe|object|embed|form|input|button|textarea|select|style|link|meta|base|applet)[^>]*>/gi;
  const HTML_TAG_PATTERN = /<[^>]*>/g;
  const EVENT_HANDLER_PATTERN = /\s*on\w+\s*=\s*["'][^"']*["']/gi;
  const JAVASCRIPT_URI_PATTERN = /javascript\s*:/gi;
  const DATA_URI_PATTERN = /data\s*:\s*text\/html/gi;
  const NULL_BYTE_PATTERN = /\0/g;

  function sanitizeString(input, maxLength = 10000) {
    if (!input || typeof input !== 'string') return '';
    return input
      .replace(NULL_BYTE_PATTERN, '')
      .replace(DANGEROUS_HTML_PATTERN, '')
      .replace(EVENT_HANDLER_PATTERN, '')
      .replace(JAVASCRIPT_URI_PATTERN, '')
      .replace(DATA_URI_PATTERN, '')
      .replace(HTML_TAG_PATTERN, '')
      .trim()
      .slice(0, maxLength);
  }

  function getCookie(cookieString, name) {
    if (!cookieString) return null;
    const match = cookieString.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return match[2];
    return null;
  }

  // Socket.IO Handshake Authentication Middleware
  io.use(async (socket, nextMiddleware) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const token = getCookie(cookieHeader, 'session');

      if (!token) {
        return nextMiddleware(new Error('Authentication error: No session cookie'));
      }

      const secret = process.env.JWT_SECRET || 'fallback-secret-key-please-change-me';
      const encodedKey = new TextEncoder().encode(secret);
      
      const { jwtVerify } = require('jose');
      const { payload } = await jwtVerify(token, encodedKey);
      
      if (!payload || !payload.userId) {
        return nextMiddleware(new Error('Authentication error: Invalid session'));
      }

      socket.user = {
        userId: payload.userId,
        role: payload.role
      };
      nextMiddleware();
    } catch (err) {
      console.error('Socket authentication failed:', err.message);
      return nextMiddleware(new Error('Authentication error: Invalid token'));
    }
  });

  /**
   * May this user be in this conversation's live room?
   *
   * ───────────────────────────────────────────────────────────────────────────
   * THIS MIRRORS `resolveConversationAccess` IN src/lib/firms/access.ts. That
   * file is the source of truth; this exists only because the socket server is
   * plain CommonJS and cannot import the TypeScript module. If the rule changes
   * there, it changes here in the same commit.
   *
   * It is expressed as ONE query whose `where` can only match when the rule
   * holds, rather than as branching logic, because a second copy of a privilege
   * rule written as `if` statements is a second copy that will drift.
   *
   * Before Phase 7 this was a bare `conversationParticipant.findFirst`, which
   * meant an attorney who had left a firm still joined the room and received
   * that firm's clients' messages live.
   * ───────────────────────────────────────────────────────────────────────────
   */
  const mayAccessConversation = async (conversationId, user) => {
    // Platform staff, first and unconditionally. Same reasoning as access.ts.
    if (user.role === 'ADMIN') return false;

    const match = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        // Must be in the thread at all.
        participants: { some: { userId: user.userId } },
        OR: [
          // The client always keeps their own thread.
          { clientId: user.userId },
          // A thread created before Phase 7, with no firm recorded.
          { firmId: null },
          // The firm side: participation must still be backed by an ACTIVE
          // membership of the firm the client was talking to.
          { firm: { members: { some: { userId: user.userId, status: 'ACTIVE' } } } },
        ],
      },
      select: { id: true },
    });

    return !!match;
  };

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id, 'User:', socket.user.userId);

    // User personal room (for global unread counts)
    socket.on('join_user', (userId) => {
      if (userId && userId === socket.user.userId) {
        socket.join(userId);
      }
    });

    // Conversation specific room
    socket.on('join_conversation', async (conversationId) => {
      if (!conversationId || typeof conversationId !== 'string') return;

      const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!UUID_V4_REGEX.test(conversationId)) return;

      try {
        if (await mayAccessConversation(conversationId, socket.user)) {
          socket.join(`conv_${conversationId}`);
        }
      } catch (err) {
        console.error('Socket join_conversation error:', err.message);
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) socket.leave(`conv_${conversationId}`);
    });

    socket.on('send_message', async (data) => {
      if (!data || typeof data !== 'object') return;
      if (data.senderId !== socket.user.userId) return;

      const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!UUID_V4_REGEX.test(data.conversationId)) return;

      try {
        if (!(await mayAccessConversation(data.conversationId, socket.user))) return;

        const sanitizedContent = sanitizeString(data.content || '', 5000);
        const cleanData = {
          id: data.id,
          conversationId: data.conversationId,
          senderId: socket.user.userId,
          receiverId: data.receiverId,
          content: sanitizedContent,
          createdAt: data.createdAt
        };

        io.to(`conv_${data.conversationId}`).emit('new_message', cleanData);
        
        if (data.receiverId && UUID_V4_REGEX.test(data.receiverId)) {
          io.to(data.receiverId).emit('unread_update', {
            conversationId: data.conversationId,
            message: cleanData
          });
        }
      } catch (err) {
        console.error('Socket send_message error:', err.message);
      }
    });

    // Notify user's personal room when they read a conversation
    socket.on('mark_read', (data) => {
      if (data && data.userId && data.userId === socket.user.userId) {
        io.to(socket.user.userId).emit('unread_update');
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  server.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
