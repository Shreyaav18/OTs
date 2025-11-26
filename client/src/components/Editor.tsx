import React, { useState, useRef } from 'react';
import type { Operation } from '../Lib/operations';
import { detectChange } from '../Lib/operations';

interface EditorProps {
  initialContent?: string;
  onOperation?: (operation: Operation) => void;
}

function Editor({ initialContent = '', onOperation }: EditorProps) {
  // States
  const [userId] = useState(() => 
    `user_${Math.random().toString(36).substr(2, 9)}`
  );
  const [content, setContent] = useState<string>(initialContent);
  const [prevContent, setPrevContent] = useState<string>(initialContent);
  const [cursorPosition, setCursorPosition] = useState<number>(0);  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle text changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursor = e.target.selectionStart;
    
    const operation = detectChange(prevContent, newText, cursor, userId);
    
    if (operation) {
      console.log('Operation generated:', operation);
      onOperation?.(operation);
    }
    
    setContent(newText);
    setPrevContent(newText);
    setCursorPosition(cursor);
  };

  // Handle cursor movement
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    setCursorPosition(target.selectionStart);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Collaborative Editor</h1>
        <div style={styles.info}>
          <span style={styles.badge}>User: {userId}</span>
          <span style={styles.badge}>Cursor: {cursorPosition}</span>
          <span style={styles.badge}>Length: {content.length}</span>
        </div>
      </div>
      
      <textarea
        ref={textareaRef}
        style={styles.textarea}
        value={content}
        onChange={handleChange}
        onSelect={handleSelect}
        placeholder="Start typing to see operations in console..."
        spellCheck={false}
      />
    </div>
  );
}

// Styles using your color palette
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    width: '100%',
    height: '100vh',
    backgroundColor: '#E8D5C4', // Light peach background
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    boxSizing: 'border-box',
  },
  
  header: {
    backgroundColor: '#8B7B7A', // Dark mauve
    padding: '20px',
    borderRadius: '12px 12px 0 0',
    marginBottom: '0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  
  title: {
    margin: 0,
    color: '#EEEDE7', // Light cream
    fontSize: '24px',
    fontWeight: '600',
    letterSpacing: '0.3px',
  },
  
  info: {
    display: 'flex',
    gap: '12px',
  },
  
  badge: {
    backgroundColor: '#E8C4B8', // Medium peach
    color: '#4A3E3D',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  
  textarea: {
    flex: 1,
    width: '92%',
    padding: '24px',
    fontSize: '16px',
    lineHeight: '1.6',
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
    backgroundColor: '#EEEDE7', // Light cream
    color: '#4A3E3D', // Dark text
    border: 'none',
    borderRadius: '0 0 12px 12px',
    resize: 'none',
    outline: 'none',
    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.05)',
    transition: 'box-shadow 0.2s ease',
  },
};

// Add focus effect via style object (limitation: can't use :focus)
// To add focus effect, we'll need to track focus state
export default Editor;