import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useChatStore } from "@/stores/chatStore";
import type { AIMessage } from "@shared/schema";

export default function useAIAssistant(conversationId: string) {
  const [error, setError] = useState<string | null>(null);
  const { addMessage } = useChatStore();

  // Fetch conversation history
  const { data: conversationHistory, isLoading, isError } = useQuery<AIMessage[]>({
    queryKey: [`/api/ai-assistant/history/${conversationId}`],
    enabled: Boolean(conversationId),
  });

  // Send message to AI assistant
  const sendMessage = async (message: string): Promise<string> => {
    try {
      setError(null);
      const response = await apiRequest("POST", "/api/ai-assistant", {
        message,
        conversationId,
        userId: 1, // In a real app, this would be the authenticated user ID
      });
      
      const responseData = await response.json();
      
      // Add message to local state via store
      addMessage({
        id: Date.now(),
        role: "assistant",
        content: responseData.response,
        timestamp: new Date(),
      });
      
      return responseData.response;
    } catch (err) {
      console.error("Error sending message to AI assistant:", err);
      setError("Failed to get a response from the AI assistant");
      throw err;
    }
  };

  // Send message to Telegram
  const sendTelegramMessage = async (chatId: string, message: string) => {
    try {
      const response = await apiRequest("POST", "/api/telegram/send", {
        chatId,
        message,
      });
      
      return await response.json();
    } catch (err) {
      console.error("Error sending message to Telegram:", err);
      setError("Failed to send message to Telegram");
      throw err;
    }
  };

  return {
    conversationHistory,
    isLoading,
    isError,
    error,
    sendMessage,
    sendTelegramMessage,
  };
}
