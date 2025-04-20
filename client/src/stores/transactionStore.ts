import { create } from "zustand";
import type { TransactionWithDetails } from "@shared/schema";

interface TransactionState {
  selectedTransaction: TransactionWithDetails | null;
  isTransactionDetailsOpen: boolean;
  setSelectedTransaction: (transaction: TransactionWithDetails | null) => void;
  openTransactionDetails: () => void;
  closeTransactionDetails: () => void;
  filterOptions: {
    status: string | null;
    customerId: number | null;
    vendorId: string | null;
    dateFrom: Date | null;
    dateTo: Date | null;
    searchQuery: string;
  };
  setFilterOptions: (options: Partial<TransactionState['filterOptions']>) => void;
  resetFilterOptions: () => void;
}

const defaultFilterOptions = {
  status: null,
  customerId: null,
  vendorId: null,
  dateFrom: null,
  dateTo: null,
  searchQuery: "",
};

export const useTransactionStore = create<TransactionState>((set) => ({
  selectedTransaction: null,
  isTransactionDetailsOpen: false,
  filterOptions: { ...defaultFilterOptions },
  
  setSelectedTransaction: (transaction) => set({ selectedTransaction: transaction }),
  
  openTransactionDetails: () => set({ isTransactionDetailsOpen: true }),
  
  closeTransactionDetails: () => set({ isTransactionDetailsOpen: false }),
  
  setFilterOptions: (options) => set((state) => ({
    filterOptions: {
      ...state.filterOptions,
      ...options,
    }
  })),
  
  resetFilterOptions: () => set({ filterOptions: { ...defaultFilterOptions } }),
}));
