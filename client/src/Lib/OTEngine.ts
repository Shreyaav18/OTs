import type { Operation, InsertOperation, DeleteOperation } from './operations';

class OTEngine {
  /**
   * Transform op1 against op2
   * Returns transformed version of op1
   */
  transform(op1: Operation, op2: Operation): Operation {
    // Case 1: Insert vs Insert
    if (op1.type === 'insert' && op2.type === 'insert') {
      return this.transformInsertInsert(op1, op2);
    }
    
    // Case 2: Insert vs Delete
    if (op1.type === 'insert' && op2.type === 'delete') {
      return this.transformInsertDelete(op1, op2);
    }
    
    // Case 3: Delete vs Insert
    if (op1.type === 'delete' && op2.type === 'insert') {
      return this.transformDeleteInsert(op1, op2);
    }
    
    // Case 4: Delete vs Delete
    if (op1.type === 'delete' && op2.type === 'delete') {
      return this.transformDeleteDelete(op1, op2);
    }
    
    return op1;
  }

  /**
   * Transform insert against insert
   */
  private transformInsertInsert(
    op1: InsertOperation, 
    op2: InsertOperation
  ): InsertOperation {
    if (op2.position < op1.position) {
      // op2 happened before op1, shift op1 right
      return {
        ...op1,
        position: op1.position + op2.text.length
      };
    }
    
    if (op2.position === op1.position) {
      // Same position - use userId as tie-breaker for deterministic ordering
      if (op2.userId < op1.userId) {
        return {
          ...op1,
          position: op1.position + op2.text.length
        };
      }
    }
    
    // op2 happened after op1, no change needed
    return op1;
  }

  /**
   * Transform insert against delete
   */
  private transformInsertDelete(
    op1: InsertOperation, 
    op2: DeleteOperation
  ): InsertOperation {
    if (op2.position + op2.length <= op1.position) {
      // Delete happened entirely before insert, shift insert left
      return {
        ...op1,
        position: op1.position - op2.length
      };
    }
    
    if (op2.position < op1.position) {
      // Delete overlaps with insert position
      // Move insert to where delete started
      return {
        ...op1,
        position: op2.position
      };
    }
    
    // Delete happened after insert, no change
    return op1;
  }

  /**
   * Transform delete against insert
   */
  private transformDeleteInsert(
    op1: DeleteOperation, 
    op2: InsertOperation
  ): DeleteOperation {
    if (op2.position <= op1.position) {
      // Insert happened before delete, shift delete right
      return {
        ...op1,
        position: op1.position + op2.text.length
      };
    }
    
    if (op2.position < op1.position + op1.length) {
      // Insert happened inside delete range, extend delete length
      return {
        ...op1,
        length: op1.length + op2.text.length
      };
    }
    
    // Insert happened after delete, no change
    return op1;
  }

  /**
   * Transform delete against delete
   */
  private transformDeleteDelete(
    op1: DeleteOperation, 
    op2: DeleteOperation
  ): DeleteOperation {
    if (op2.position + op2.length <= op1.position) {
      // op2 happened entirely before op1, shift op1 left
      return {
        ...op1,
        position: op1.position - op2.length
      };
    }
    
    if (op2.position >= op1.position + op1.length) {
      // op2 happened entirely after op1, no change
      return op1;
    }
    
    // Overlapping deletes - complex case
    if (op2.position <= op1.position) {
      const overlap = Math.min(op2.position + op2.length - op1.position, op1.length);
      return {
        ...op1,
        position: op2.position,
        length: op1.length - overlap
      };
    }
    
    // op2 starts inside op1
    const overlap = Math.min(op1.position + op1.length - op2.position, op2.length);
    return {
      ...op1,
      length: op1.length - overlap
    };
  }

  /**
   * Apply an operation to text
   */
  apply(text: string, operation: Operation): string {
    if (operation.type === 'insert') {
      return this.applyInsert(text, operation);
    } else {
      return this.applyDelete(text, operation);
    }
  }

  /**
   * Apply insert operation
   */
  private applyInsert(text: string, op: InsertOperation): string {
    const before = text.substring(0, op.position);
    const after = text.substring(op.position);
    return before + op.text + after;
  }

  /**
   * Apply delete operation
   */
  private applyDelete(text: string, op: DeleteOperation): string {
    const before = text.substring(0, op.position);
    const after = text.substring(op.position + op.length);
    return before + after;
  }

  /**
   * Transform an operation against multiple operations
   * Useful for transforming against pending operations
   */
  transformAgainst(op: Operation, operations: Operation[]): Operation {
    let transformed = op;
    for (const otherOp of operations) {
      transformed = this.transform(transformed, otherOp);
    }
    return transformed;
  }

  /**
   * Compose two operations into one (optimization)
   * Only works for certain cases
   */
  compose(op1: Operation, op2: Operation): Operation | null {
    // Two consecutive inserts at same position
    if (
      op1.type === 'insert' && 
      op2.type === 'insert' && 
      op1.position + op1.text.length === op2.position &&
      op1.userId === op2.userId
    ) {
      return {
        ...op1,
        text: op1.text + op2.text
      };
    }
    
    // Two consecutive deletes
    if (
      op1.type === 'delete' && 
      op2.type === 'delete' && 
      op1.position === op2.position &&
      op1.userId === op2.userId
    ) {
      return {
        ...op1,
        length: op1.length + op2.length
      };
    }
    
    return null;
  }
}

export default OTEngine;