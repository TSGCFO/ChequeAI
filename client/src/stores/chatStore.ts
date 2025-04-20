import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Message {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  addMessage: (message: Message) => void;
  createConversation: (title?: string) => string;
  setActiveConversation: (id: string | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      messages: [
        {
          id: 1,
          role: "assistant",
          content: "Hello! I'm your AI assistant for Cheque Ledger Pro. You can ask me to help with:\n\n- Creating new transactions\n- Finding transaction details\n- Generating reports\n- Processing document images\n\nHow can I help you today?",
          timestamp: new Date(),
        },
      ],
      
      addMessage: (message) => set((state) => {
        const updatedMessages = [...state.messages, message];
        
        // If there's an active conversation, update it
        if (state.activeConversationId) {
          const updatedConversations = state.conversations.map((conv) => {
            if (conv.id === state.activeConversationId) {
              return {
                ...conv,
                messages: updatedMessages,
                updatedAt: new Date(),
              };
            }
            return conv;
          });
          
          return {
            messages: updatedMessages,
            conversations: updatedConversations,
          };
        }
        
        return { messages: updatedMessages };
      }),
      
      createConversation: (title = "New Conversation") => {
        const id = `conv-${Date.now()}`;
        const newConversation: Conversation = {
          id,
          title,
          messages: get().messages,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set((state) => ({
          conversations: [...state.conversations, newConversation],
          activeConversationId: id,
        }));
        
        return id;
      },
      
      setActiveConversation: (id) => {
        if (!id) {
          set({ activeConversationId: null });
          return;
        }
        
        const conversation = get().conversations.find((c) => c.id === id);
        
        if (conversation) {
          set({
            activeConversationId: id,
            messages: conversation.messages,
          });
        } else {
          set({ activeConversationId: null });
        }
      },
      
      clearMessages: () => set({
        messages: [
          {
            id: 1,
            role: "assistant",
            content: "Hello! I'm your AI assistant for Cheque Ledger Pro. How can I help you today?",
            timestamp: new Date(),
          },
        ],
      }),
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
      }),
    }
  )
);
