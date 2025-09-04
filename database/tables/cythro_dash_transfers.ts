/**
 * CythroDash - Transfers Database Schema
 * 
 * Handles coin transfers between users
 */

export interface CythroDashTransfer {
  _id?: string;
  id: number;
  from_user_id: number;
  to_user_id: number;
  from_username: string;
  to_username: string;
  amount: number;
  note?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  transaction_hash?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  
  // Metadata
  ip_address?: string;
  user_agent?: string;
  
  // Validation
  from_balance_before: number;
  from_balance_after: number;
  to_balance_before: number;
  to_balance_after: number;
}

export const transfersCollectionName = 'cythro_dash_transfers';

// Default transfer values
export const defaultTransferValues: Partial<CythroDashTransfer> = {
  status: 'pending',
  created_at: new Date(),
  updated_at: new Date(),
  note: '',
  ip_address: '',
  user_agent: '',
};

// Transfer validation rules
export const transferValidation = {
  minAmount: 1,
  maxAmount: 10000,
  maxNoteLength: 200,
  dailyTransferLimit: 50000,
  maxTransfersPerDay: 100,
};

// Transfer status enum
export enum TransferStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Helper functions
export const transferHelpers = {
  // Generate unique transfer ID
  generateTransferId: (): number => {
    return Date.now() + Math.floor(Math.random() * 1000);
  },

  // Validate transfer amount
  isValidAmount: (amount: number): boolean => {
    return amount >= transferValidation.minAmount && 
           amount <= transferValidation.maxAmount && 
           Number.isInteger(amount);
  },

  // Validate note
  isValidNote: (note: string): boolean => {
    return note.length <= transferValidation.maxNoteLength;
  },

  // Calculate transfer fee (if any)
  calculateFee: (amount: number): number => {
    // No fees for now, but can be implemented later
    return 0;
  },

  // Get transfer display status
  getDisplayStatus: (status: string): { text: string; color: string } => {
    switch (status) {
      case TransferStatus.COMPLETED:
        return { text: 'Completed', color: 'text-emerald-400' };
      case TransferStatus.PENDING:
        return { text: 'Pending', color: 'text-amber-400' };
      case TransferStatus.FAILED:
        return { text: 'Failed', color: 'text-red-400' };
      case TransferStatus.CANCELLED:
        return { text: 'Cancelled', color: 'text-gray-400' };
      default:
        return { text: 'Unknown', color: 'text-gray-400' };
    }
  },

  // Format transfer for display
  formatTransferAmount: (amount: number): string => {
    return amount.toLocaleString();
  },

  // Get relative time
  getRelativeTime: (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }
};

export default CythroDashTransfer;
