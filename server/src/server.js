import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.io setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory document store (use database in production)
const documents = new Map();

// User colors for cursor display
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
];

let colorIndex = 0;

/**
 * Get or create document
 */
function getDocument(documentId) {
  if (!documents.has(documentId)) {
    documents.set(documentId, {
      id: documentId,
      content: '',
      version: 0,
      operations: [],
      users: new Map()
    });
  }
  return documents.get(documentId);
}

/**
 * Add user to document
 */
function addUser(documentId, socket) {
  const doc = getDocument(documentId);
  const user = {
    id: socket.id,
    name: socket.handshake.query.userName || `User ${doc.users.size + 1}`,
    color: COLORS[colorIndex % COLORS.length],
    cursor: 0
  };
  
  colorIndex++;
  doc.users.set(socket.id, user);
  
  return user;
}

/**
 * Remove user from document
 */
function removeUser(documentId, socketId) {
  const doc = documents.get(documentId);
  if (doc) {
    doc.users.delete(socketId);
    
    // Clean up empty documents (optional)
    if (doc.users.size === 0) {
      // documents.delete(documentId); // Uncomment to delete empty docs
    }
  }
}

/**
 * Broadcast to all users in a document except sender
 */
function broadcastToDocument(documentId, event, data, excludeSocketId = null) {
  const doc = documents.get(documentId);
  if (!doc) return;
  
  doc.users.forEach((user, socketId) => {
    if (socketId !== excludeSocketId) {
      io.to(socketId).emit(event, data);
    }
  });
}

// REST API endpoints (optional)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    documents: documents.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/documents/:id', (req, res) => {
  const doc = documents.get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  
  res.json({
    id: doc.id,
    content: doc.content,
    version: doc.version,
    activeUsers: doc.users.size
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  
  let currentDocumentId = null;
  let currentUser = null;

  /**
   * Join a document
   */
  socket.on('join-document', (data) => {
    const { documentId, userName } = data;
    
    console.log(`📄 ${socket.id} joining document: ${documentId}`);
    
    // Leave previous document if any
    if (currentDocumentId) {
      socket.leave(currentDocumentId);
      removeUser(currentDocumentId, socket.id);
    }
    
    // Join new document
    currentDocumentId = documentId;
    socket.join(documentId);
    
    const doc = getDocument(documentId);
    currentUser = addUser(documentId, socket);
    
    // Send current document state to new user
    socket.emit('document-state', {
      content: doc.content,
      version: doc.version,
      users: Array.from(doc.users.values())
    });
    
    // Notify others about new user
    broadcastToDocument(documentId, 'user-joined', {
      user: currentUser,
      users: Array.from(doc.users.values())
    }, socket.id);
    
    console.log(`👥 Document ${documentId} now has ${doc.users.size} users`);
  });

  /**
   * Handle operation from client
   */
  socket.on('operation', (data) => {
    if (!currentDocumentId) {
      console.error('❌ Operation received without joining document');
      return;
    }
    
    const { operation } = data;
    const doc = getDocument(currentDocumentId);
    
    console.log(`🔄 Operation from ${socket.id}:`, operation.type, 'at', operation.position);
    
    // Apply operation to server's document state
    if (operation.type === 'insert') {
      const before = doc.content.substring(0, operation.position);
      const after = doc.content.substring(operation.position);
      doc.content = before + operation.text + after;
    } else if (operation.type === 'delete') {
      const before = doc.content.substring(0, operation.position);
      const after = doc.content.substring(operation.position + operation.length);
      doc.content = before + after;
    }
    
    // Increment version
    doc.version++;
    
    // Store operation in history
    doc.operations.push({
      ...operation,
      serverVersion: doc.version,
      serverTimestamp: Date.now()
    });
    
    // Broadcast operation to all other clients
    broadcastToDocument(currentDocumentId, 'operation', {
      operation,
      version: doc.version
    }, socket.id);
  });

  /**
   * Handle cursor position updates
   */
  socket.on('cursor-position', (data) => {
    if (!currentDocumentId || !currentUser) return;
    
    const { position } = data;
    const doc = getDocument(currentDocumentId);
    const user = doc.users.get(socket.id);
    
    if (user) {
      user.cursor = position;
      
      // Broadcast cursor update to others
      broadcastToDocument(currentDocumentId, 'cursor-update', {
        userId: socket.id,
        position
      }, socket.id);
    }
  });

  /**
   * Handle disconnect
   */
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    
    if (currentDocumentId) {
      removeUser(currentDocumentId, socket.id);
      
      // Notify others about user leaving
      broadcastToDocument(currentDocumentId, 'user-left', {
        userId: socket.id,
        users: Array.from(getDocument(currentDocumentId).users.values())
      });
    }
  });

  /**
   * Handle errors
   */
  socket.on('error', (error) => {
    console.error(`❌ Socket error from ${socket.id}:`, error);
  });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║  🚀 OT Server Running                 ║
║  📍 Port: ${PORT}                        ║
║  🌐 Environment: ${process.env.NODE_ENV || 'development'}       ║
║  📄 CORS: ${process.env.CLIENT_URL}    ║
╚═══════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, closing server...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
```

---

## 📊 **Server Events Flow:**

CLIENT → SERVER → OTHER CLIENTS

join-document
    → document-state (to sender)
    → user-joined (to others)

operation
    → Apply to server state
    → operation (broadcast to others)

cursor-position
    → cursor-update (broadcast to others)

disconnect
    → user-left (broadcast to all)
    ```
