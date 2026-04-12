const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
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

  const io = new Server(server, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // User personal room (for global unread counts)
    socket.on('join_user', (userId) => {
      if (userId) socket.join(userId);
    });

    // Conversation specific room
    socket.on('join_conversation', (conversationId) => {
      if (conversationId) socket.join(`conv_${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) socket.leave(`conv_${conversationId}`);
    });

    socket.on('send_message', (data) => {
      // data: { id, conversationId, senderId, receiverId, content, createdAt }
      // Broadcast specifically to the conversation room
      io.to(`conv_${data.conversationId}`).emit('new_message', data);
      
      
      // Also notify receiver's personal room for badge updates
      if (data.receiverId) {
        io.to(data.receiverId).emit('unread_update', {
          conversationId: data.conversationId,
          message: data
        });
      }
    });

    // Notify user's personal room when they read a conversation
    socket.on('mark_read', (data) => {
      if (data.userId) {
        io.to(data.userId).emit('unread_update');
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
