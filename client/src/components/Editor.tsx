import React, { useState, useRef, useEffect } from 'react';
import type { Operation, User } from '../Lib/operations';
import { detectChange } from '../Lib/operations';
import OTEngine from '../Lib/OTEngine';
import socketManager from '../Lib/SocketManager';
import Cursor from './Cursor';


interface EditorProps {
  documentId?: string;
  userName?: string;
}

function Editor({ documentId = 'default-doc', userName }: EditorProps) {
  // States
  const [userId] = useState(() => 
    `user_${Math.random().toString(36).substr(2, 9)}`
  );
  const [content, setContent] = useState<string>('');
  const [prevContent, setPrevContent] = useState<string>('');
  const [remoteUsers, setRemoteUsers] = useState<User[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [, setCursorPosition] = useState<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [otEngine] = useState(() => new OTEngine());

  // Initialize socket connection
  useEffect(() => {
    console.log('🚀 Initializing socket connection...');

    // Connect to server
    socketManager.connect('http://localhost:3001');

    // Register callbacks
    socketManager.on({
      onConnect: () => {
        console.log('✅ Socket connected');
        setIsConnected(true);
        socketManager.joinDocument(documentId, userName);
      },

      onDisconnect: () => {
        console.log('❌ Socket disconnected');
        setIsConnected(false);
      },

      onDocumentState: (state) => {
        console.log('📄 Received document state:', state);
        setContent(state.content);
        setPrevContent(state.content);
        setRemoteUsers(state.users.filter(u => u.id !== socketManager.getSocketId()));
      },

      onOperation: (data) => {
        console.log('🔄 Received remote operation:', data.operation);
        
        // Apply operation using OT engine
        const newContent = otEngine.apply(content, data.operation);
        setContent(newContent);
        setPrevContent(newContent);
        
        // Add to operation log
        setOperations(prev => [...prev, data.operation]);
      },

      onUserJoined: (data) => {
        console.log('👋 User joined:', data.user.name);
        setRemoteUsers(data.users.filter(u => u.id !== socketManager.getSocketId()));
      },

      onUserLeft: (data) => {
        console.log('👋 User left:', data.userId);
        setRemoteUsers(data.users.filter(u => u.id !== socketManager.getSocketId()));
      },

      onCursorUpdate: (data) => {
        setRemoteUsers(prev => 
          prev.map(user => 
            user.id === data.userId 
              ? { ...user, cursor: data.position }
              : user
          )
        );
      },

      onError: (error) => {
        console.error('❌ Socket error:', error);
      }
    });

    // Cleanup on unmount
    return () => {
      socketManager.disconnect();
    };
  }, [documentId, userName, content, otEngine]);

  // Handle text changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursor = e.target.selectionStart;
    
    const operation = detectChange(prevContent, newText, cursor, userId);
    
    if (operation) {
      console.log('📝 Local operation:', operation);
      
      // Send to server
      socketManager.sendOperation(operation);
      
      // Add to operation log
      setOperations(prev => [...prev, operation]);
    }
    
    setContent(newText);
    setPrevContent(newText);
    setCursorPosition(cursor);
  };

  // Handle cursor movement
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const position = target.selectionStart;
    setCursorPosition(position);
    
    // Send cursor position to server
    socketManager.sendCursorPosition(position);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Collaborative Editor</h1>
          <div style={styles.connectionBadge(isConnected)}>
            <div style={styles.connectionDot(isConnected)} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div style={styles.info}>
          <span style={styles.badge}>Doc: {documentId}</span>
          <span style={styles.badge}>Users: {remoteUsers.length + 1}</span>
          <span style={styles.badge}>Ops: {operations.length}</span>
        </div>
      </div>

      {/* User List */}
      {remoteUsers.length > 0 && (
        <div style={styles.userList}>
          <span style={styles.userListTitle}>Active Users:</span>
          {remoteUsers.map(user => (
            <div key={user.id} style={styles.userBadge}>
              <div style={{
                ...styles.userColorDot,
                backgroundColor: user.color
              }} />
              {user.name}
            </div>
          ))}
        </div>
      )}

      {/* Main Editor with Remote Cursors */}
      <div style={styles.editorWrapper}>
        <div style={{ position: 'relative', flex: 1 }}>
          <textarea
            ref={textareaRef}
            style={styles.textarea}
            value={content}
            onChange={handleChange}
            onSelect={handleSelect}
            placeholder={isConnected ? "Start typing..." : "Connecting to server..."}
            disabled={!isConnected}
            spellCheck={false}
          />
          
          {/* Render remote cursors */}
          {remoteUsers.map(user => (
            <Cursor
              key={user.id}
              userId={user.id}
              userName={user.name}
              userColor={user.color}
              cursorPosition={user.cursor}
              editorRef={textareaRef}
              content={content}
            />
          ))}
        </div>
      </div>

      {/* Operation Log */}
      <div style={styles.logPanel}>
        <h3 style={styles.logTitle}>
          Operation History ({operations.length})
        </h3>
        <div style={styles.logContent}>
          {operations.length === 0 ? (
            <div style={styles.emptyLog}>No operations yet. Start typing!</div>
          ) : (
            operations.slice(-10).reverse().map((op, idx) => (
              <div key={op.id} style={styles.logItem}>
                <span style={styles.logIndex}>#{operations.length - idx}</span>
                <span style={{
                  ...styles.logType,
                  backgroundColor: op.type === 'insert' ? '#4CAF50' : '#F44336'
                }}>
                  {op.type}
                </span>
                <span style={styles.logDetails}>
                  pos: {op.position} | 
                  {op.type === 'insert' 
                    ? ` text: "${op.text}"` 
                    : ` len: ${'length' in op ? op.length : 0}`
                  }
                </span>
                <span style={styles.logUser}>
                  {op.userId === userId ? 'You' : op.userId.substring(0, 8)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Styles
const styles: Record<string, any> = {

  container: {
    width: '100%',
    height: '100vh',
    backgroundColor: '#E8D5C4',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    boxSizing: 'border-box',
    gap: '20px',
  },
  
  header: {
    backgroundColor: '#8B7B7A',
    padding: '20px',
    borderRadius: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  
  title: {
    margin: 0,
    color: '#EEEDE7',
    fontSize: '24px',
    fontWeight: '600',
  },
  
  connectionBadge: (connected: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderRadius: '20px',
    backgroundColor: connected ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
    color: connected ? '#4CAF50' : '#F44336',
    fontSize: '13px',
    fontWeight: '500',
  }),
  
  connectionDot: (connected: boolean) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: connected ? '#4CAF50' : '#F44336',
    animation: connected ? 'pulse 2s ease-in-out infinite' : 'none',
  }),
  
  info: {
    display: 'flex',
    gap: '12px',
  },
  
  badge: {
    backgroundColor: '#E8C4B8',
    color: '#4A3E3D',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  
  userList: {
    backgroundColor: '#8B7B7A',
    padding: '12px 20px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  
  userListTitle: {
    color: '#EEEDE7',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  userBadge: {
    backgroundColor: '#EEEDE7',
    color: '#4A3E3D',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  
  userColorDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  
  editorWrapper: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
  },
  
  textarea: {
    width: '100%',
    height: '100%',
    padding: '24px',
    fontSize: '16px',
    lineHeight: '1.6',
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
    backgroundColor: '#EEEDE7',
    color: '#4A3E3D',
    border: 'none',
    borderRadius: '12px',
    resize: 'none',
    outline: 'none',
    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.05)',
  },
  
  logPanel: {
    height: '200px',
    backgroundColor: '#8B7B7A',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  
  logTitle: {
    margin: '0 0 12px 0',
    color: '#EEEDE7',
    fontSize: '16px',
    fontWeight: '600',
  },
  
  logContent: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  
  emptyLog: {
    color: '#E8C4B8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: '20px',
  },
  
  logItem: {
    backgroundColor: '#EEEDE7',
    padding: '8px 12px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    fontFamily: 'monospace',
  },
  
  logIndex: {
    color: '#8B7B7A',
    fontWeight: 'bold',
    minWidth: '30px',
  },
  
  logType: {
    color: 'white',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  
  logDetails: {
    flex: 1,
    color: '#4A3E3D',
  },
  
  logUser: {
    color: '#8B7B7A',
    fontSize: '11px',
  },
};

export default Editor;