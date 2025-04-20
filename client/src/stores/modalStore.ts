import { create } from "zustand";

interface ModalState {
  // New Transaction Modal
  isNewTransactionModalOpen: boolean;
  openNewTransactionModal: () => void;
  closeNewTransactionModal: () => void;
  
  // Document Processing Modal
  isDocumentProcessingModalOpen: boolean;
  openDocumentProcessingModal: () => void;
  closeDocumentProcessingModal: () => void;
  
  // Transaction Details Modal
  isTransactionDetailsModalOpen: boolean;
  transactionId: number | null;
  openTransactionDetailsModal: (id: number) => void;
  closeTransactionDetailsModal: () => void;
  
  // Chat Modal (for mobile view)
  isChatModalOpen: boolean;
  openChatModal: () => void;
  closeChatModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  // New Transaction Modal
  isNewTransactionModalOpen: false,
  openNewTransactionModal: () => set({ isNewTransactionModalOpen: true }),
  closeNewTransactionModal: () => set({ isNewTransactionModalOpen: false }),
  
  // Document Processing Modal
  isDocumentProcessingModalOpen: false,
  openDocumentProcessingModal: () => set({ isDocumentProcessingModalOpen: true }),
  closeDocumentProcessingModal: () => set({ isDocumentProcessingModalOpen: false }),
  
  // Transaction Details Modal
  isTransactionDetailsModalOpen: false,
  transactionId: null,
  openTransactionDetailsModal: (id) => set({
    isTransactionDetailsModalOpen: true,
    transactionId: id
  }),
  closeTransactionDetailsModal: () => set({
    isTransactionDetailsModalOpen: false,
    transactionId: null
  }),
  
  // Chat Modal (for mobile view)
  isChatModalOpen: false,
  openChatModal: () => set({ isChatModalOpen: true }),
  closeChatModal: () => set({ isChatModalOpen: false }),
}));
