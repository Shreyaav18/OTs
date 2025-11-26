// Single Operation interface with discriminated union
interface BaseOperation {
  id: string;
  userId: string;
  timestamp: number;
  position: number;
}

interface InsertOperation extends BaseOperation {
  type: 'insert';
  text: string;
}

interface DeleteOperation extends BaseOperation {
  type: 'delete';
  length: number;
}

type Operation = InsertOperation | DeleteOperation;

interface User {
  id: string;
  name: string;
  color: string;
  cursor: number;
}

interface Document {
  id: string;
  content: string;
  version: number;
  users: User[];
}

// Generate unique operation ID
function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create insert operation
function createInsertOperation(
  userId: string, 
  position: number, 
  text: string
): InsertOperation {
  return {
    id: generateOperationId(),
    type: 'insert',
    userId,
    position,
    text,
    timestamp: Date.now()
  };
}

// Create delete operation
function createDeleteOperation(
  userId: string, 
  position: number, 
  length: number
): DeleteOperation {
  return {
    id: generateOperationId(),
    type: 'delete',
    userId,
    position,
    length,
    timestamp: Date.now()
  };
}

// Detect what changed between old and new text
function detectChange(
  oldText: string,
  newText: string,
  cursorPosition: number,
  userId: string
): Operation | null {
  
  // No change
  if (oldText === newText) return null;

  const oldLen = oldText.length;
  const newLen = newText.length;

  // INSERT: text was added
  if (newLen > oldLen) {
    const insertedLength = newLen - oldLen;
    const position = cursorPosition - insertedLength;
    const insertedText = newText.substring(position, cursorPosition);
    
    return createInsertOperation(userId, position, insertedText);
  }

  // DELETE: text was removed
  if (newLen < oldLen) {
    const deletedLength = oldLen - newLen;
    const position = cursorPosition;
    
    return createDeleteOperation(userId, position, deletedLength);
  }

  // REPLACE: same length but different content
  // For now, we'll treat this as no operation
  // In a full implementation, you'd handle this as delete + insert
  return null;
}

export type {
  Operation,
  InsertOperation,
  DeleteOperation,
  User,
  Document,
  BaseOperation
};

export {
  generateOperationId,
  createInsertOperation,
  createDeleteOperation,
  detectChange
};
