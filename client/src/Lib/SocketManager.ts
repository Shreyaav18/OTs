import { io, Socket } from 'socket.io-client';
import type { Operation, User } from './operations';

interface DocumentState {
  content: string;
  version: number;
  users: User[];
}

interface SocketManagerCallbacks {
  onDocumentState?: (state: DocumentState) => void;
  onOperation?: (data: { operation: Operation; version: number }) => void;
  onUserJoined?: (data: { user: User; users: User[] }) => void;
  onUserLeft?: (data: { userId: string; users: User[] }) => void;
  onCursorUpdate?: (data: { userId: string; position: number }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

class SocketManager {
  private socket: Socket | null = null;
  private callbacks: SocketManagerCallbacks = {};
  private currentDocumentId: string | null = null;
  private connected: boolean = false;

  constructor() {
    // Initialize but don't connect yet
  }

  /**
   * Connect to server
   */
  connect(serverUrl: string = 'http://localhost:3001'): void {
    if (this.socket?.connected) {
      console.log('Already connected');
      return;
    }

    console.log('🔌 Connecting to server:', serverUrl);

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.setupEventListeners();
  }

  /**
   * Setup all socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to server:', this.socket?.id);
      this.connected = true;
      this.callbacks.onConnect?.();

      // Rejoin document if we were in one (reconnection scenario)
      if (this.currentDocumentId) {
        this.joinDocument(this.currentDocumentId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
      this.connected = false;
      this.callbacks.onDisconnect?.();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      this.callbacks.onError?.(error);
    });

    // Document events
    this.socket.on('document-state', (data: DocumentState) => {
      console.log('📄 Received document state:', data.version);
      this.callbacks.onDocumentState?.(data);
    });

    this.socket.on('operation', (data: { operation: Operation; version: number }) => {
      console.log('🔄 Received operation:', data.operation.type);
      this.callbacks.onOperation?.(data);
    });

    // User events
    this.socket.on('user-joined', (data: { user: User; users: User[] }) => {
      console.log('👋 User joined:', data.user.name);
      this.callbacks.onUserJoined?.(data);
    });

    this.socket.on('user-left', (data: { userId: string; users: User[] }) => {
      console.log('👋 User left:', data.userId);
      this.callbacks.onUserLeft?.(data);
    });

    this.socket.on('cursor-update', (data: { userId: string; position: number }) => {
      this.callbacks.onCursorUpdate?.(data);
    });
  }

  /**
   * Join a document
   */
  joinDocument(documentId: string, userName?: string): void {
    if (!this.socket?.connected) {
      console.error('Cannot join document: not connected');
      return;
    }

    console.log('📄 Joining document:', documentId);
    this.currentDocumentId = documentId;

    this.socket.emit('join-document', {
      documentId,
      userName: userName || `User ${Math.random().toString(36).substr(2, 5)}`
    });
  }

  /**
   * Send operation to server
   */
  sendOperation(operation: Operation): void {
    if (!this.socket?.connected) {
      console.error('Cannot send operation: not connected');
      return;
    }

    if (!this.currentDocumentId) {
      console.error('Cannot send operation: not in a document');
      return;
    }

    console.log('📤 Sending operation:', operation.type, 'at', operation.position);

    this.socket.emit('operation', {
      operation
    });
  }

  /**
   * Send cursor position update
   */
  sendCursorPosition(position: number): void {
    if (!this.socket?.connected || !this.currentDocumentId) {
      return;
    }

    this.socket.emit('cursor-position', { position });
  }

  /**
   * Register callbacks
   */
  on(callbacks: SocketManagerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.socket) {
      console.log('👋 Disconnecting from server');
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.currentDocumentId = null;
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected && this.socket?.connected === true;
  }

  /**
   * Get current document ID
   */
  getCurrentDocumentId(): string | null {
    return this.currentDocumentId;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// Singleton instance
const socketManager = new SocketManager();

export default socketManager;
export { SocketManager };
export type { SocketManagerCallbacks, DocumentState };