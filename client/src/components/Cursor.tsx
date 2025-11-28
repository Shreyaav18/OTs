import React, { useState, useEffect } from 'react';

interface CursorProps {
    userId: string;
    userName: string;
    userColor: string;
    cursorPosition: number;
    editorRef: React.RefObject<HTMLTextAreaElement | null>; // Changed to textarea
    content: string; // Need full content to calculate position
}

const Cursor: React.FC<CursorProps> = ({ 
    userName, 
    userColor, 
    cursorPosition, 
    editorRef,
    content
}) => {
    const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isVisible, setIsVisible] = useState<boolean>(true);

    useEffect(() => {
        if (!editorRef.current) {
            setIsVisible(false);
            return;
        }

        try {
            const textarea = editorRef.current;
            const style = window.getComputedStyle(textarea);
            
            // Get font metrics
            const fontSize = parseInt(style.fontSize);
            const lineHeight = parseInt(style.lineHeight) || fontSize * 1.6;
            
            // Calculate line and column from cursor position
            const textBeforeCursor = content.substring(0, cursorPosition);
            const lines = textBeforeCursor.split('\n');
            const lineNumber = lines.length - 1;
            const columnNumber = lines[lineNumber].length;
            
            // Calculate pixel position (approximate for monospace)
            const charWidth = fontSize * 0.6; // Average monospace character width
            const padding = parseInt(style.paddingLeft) || 24;
            const paddingTop = parseInt(style.paddingTop) || 24;
            
            const x = padding + (columnNumber * charWidth);
            const y = paddingTop + (lineNumber * lineHeight);

            setPosition({ x, y });
            setIsVisible(true);
        } catch (error) {
            console.error('Error calculating cursor position:', error);
            setIsVisible(false);
        }
    }, [cursorPosition, editorRef, content]);

    if (!isVisible) return null;

    return (
        <div
            style={{
                position: 'absolute',
                left: `${position.x}px`,
                top: `${position.y}px`,
                pointerEvents: 'none',
                zIndex: 50,
                transition: 'all 0.1s ease',
            }}
        >
            {/* Cursor line */}
            <div
                style={{
                    width: '2px',
                    height: '20px',
                    backgroundColor: userColor,
                    animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
            />
            
            {/* User label */}
            <div
                style={{
                    position: 'absolute',
                    top: '-24px',
                    left: '0',
                    whiteSpace: 'nowrap',
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    color: '#FFFFFF',
                    backgroundColor: userColor,
                    fontWeight: '500',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
            >
                {userName}
            </div>
        </div>
    );
};

export default Cursor;