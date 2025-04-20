import React, { useState, useEffect, useRef } from "react";
import { Paperclip, Send, Info, X, Settings, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import useAIAssistant from "@/hooks/useAIAssistant";
import { apiRequest } from "@/lib/queryClient";

interface ChatInterfaceProps {
  onClose?: () => void;
}

interface Message {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface Transaction {
  chequeNumber: string;
  date: string;
  amount: string;
  status: string;
}

export default function ChatInterface({ onClose }: ChatInterfaceProps) {
  const [activeTab, setActiveTab] = useState("assistant");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content: "Hello! I'm your AI assistant for Cheque Ledger Pro. You can ask me to help with:\n\n- Creating new transactions\n- Finding transaction details\n- Generating reports\n- Processing document images\n\nHow can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [conversationId] = useState(`session-${Date.now()}`);
  const { sendMessage } = useAIAssistant(conversationId);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setMessage("");
    setIsLoading(true);

    try {
      const response = await sendMessage(message);
      
      if (response) {
        const assistantMessage: Message = {
          id: messages.length + 2,
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };
        
        setMessages((prevMessages) => [...prevMessages, assistantMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to get a response from the AI assistant.",
        variant: "destructive",
      });
      
      // Add error message
      const errorMessage: Message = {
        id: messages.length + 2,
        role: "system",
        content: "Sorry, I encountered an error processing your request. Please try again later.",
        timestamp: new Date(),
      };
      
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper function to render message content with proper formatting
  const renderMessageContent = (content: string) => {
    // Process line breaks for better formatting
    let formattedContent = content;
    
    // Format numbered or bulleted lists
    if (content.includes("\n-") || content.match(/\n\d+\./)) {
      return (
        <>
          {content.split('\n').map((line, index) => {
            // Check if line is a bullet point or numbered item
            if (line.startsWith('- ') || line.match(/^\d+\./)) {
              return (
                <div key={index} className="flex items-start my-1">
                  <span className="mr-2">{line.startsWith('- ') ? '•' : line.split('.')[0] + '.'}</span>
                  <span>{line.replace(/^- /, '').replace(/^\d+\.\s*/, '')}</span>
                </div>
              );
            }
            // Handle section headers (often used in AI responses)
            else if (line.endsWith(':') && line.length < 50) {
              return <p key={index} className="font-semibold mt-2 mb-1">{line}</p>;
            }
            // Regular text
            else if (line.trim()) {
              return <p key={index} className="my-1">{line}</p>;
            }
            // Empty line as spacing
            else {
              return <div key={index} className="h-2"></div>;
            }
          })}
        </>
      );
    }
    
    // Try to detect and format transaction data
    if (content.includes("transaction") && 
        (content.includes("cheque") || content.includes("Cheque"))) {
      try {
        // First try to find and parse structured transaction data
        const transactionMatch = content.match(/```json\n([\s\S]*?)\n```/);
        
        if (transactionMatch && transactionMatch[1]) {
          const transactionData = JSON.parse(transactionMatch[1]);
          
          // Replace the JSON code block with a nicely formatted transaction card
          formattedContent = content.replace(/```json\n[\s\S]*?\n```/, 
            '<div class="transaction-placeholder"></div>');
          
          return (
            <>
              {formattedContent.split('<div class="transaction-placeholder"></div>').map((part, idx, arr) => (
                <React.Fragment key={`part-${idx}`}>
                  {part}
                  {idx < arr.length - 1 && (
                    <div className="mt-3 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
                      <div className="flex items-center justify-between p-3 text-sm">
                        <div>
                          <p className="font-medium">
                            Cheque #{transactionData.chequeNumber || transactionData.transaction_id || "N/A"}
                          </p>
                          <p className="text-gray-500">
                            {transactionData.date || new Date().toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            ${parseFloat(transactionData.amount || "0").toFixed(2)}
                          </p>
                          <p className={
                            transactionData.status === "Completed" ? "text-green-600" : 
                            transactionData.status === "Pending" ? "text-yellow-600" : "text-gray-600"
                          }>
                            {transactionData.status || "Pending"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </>
          );
        }
      } catch (e) {
        console.error("Error formatting transaction data:", e);
      }
    }
    
    // Default: return with line breaks preserved
    return (
      <>
        {formattedContent.split('\n').map((line, index) => (
          line.trim() ? 
            <p key={index} className="my-1">{line}</p> : 
            <div key={index} className="h-2"></div>
        ))}
      </>
    );
  };

  return (
    <>
      {/* Tabs for AI Assistant */}
      <div className="border-b border-gray-200 px-4 py-2">
        <div className="flex justify-between items-center">
          <Tabs defaultValue="assistant" value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="assistant">AI Assistant</TabsTrigger>
              <TabsTrigger value="document">Document Processing</TabsTrigger>
            </TabsList>
          </Tabs>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {/* System message for timestamp */}
          <div className="flex justify-center">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
              Today, {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Messages */}
          {messages.map((msg) => {
            if (msg.role === "user") {
              return (
                <div key={msg.id} className="flex items-start justify-end">
                  <div className="max-w-md rounded-lg rounded-tr-none bg-primary p-3 text-sm text-white">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <div className="ml-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <User className="h-4 w-4" />
                  </div>
                </div>
              );
            } else if (msg.role === "assistant") {
              return (
                <div key={msg.id} className="flex items-start">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="ml-3 max-w-md rounded-lg rounded-tl-none bg-gray-100 p-3 text-sm">
                    <div className="whitespace-pre-wrap">
                      {renderMessageContent(msg.content)}
                    </div>
                  </div>
                </div>
              );
            } else {
              // System message
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="rounded-md bg-yellow-50 px-4 py-2 text-xs text-yellow-800">
                    {msg.content}
                  </div>
                </div>
              );
            }
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-start">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="ml-3 max-w-md rounded-lg rounded-tl-none bg-gray-100 p-3 text-sm">
                <p>Thinking...</p>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className="h-1 w-3/4 animate-pulse rounded-full bg-primary"></div>
                </div>
              </div>
            </div>
          )}

          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" className="flex-shrink-0">
            <Paperclip className="h-4 w-4" />
          </Button>
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Ask your AI assistant..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
            />
            <Button
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1"
              onClick={handleSendMessage}
              disabled={isLoading || !message.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center">
            <Info className="mr-1 h-3 w-3" />
            <span>Connected to GPT-4</span>
          </div>
          <div>
            <Button variant="link" size="sm" className="h-auto p-0 text-primary">
              <Settings className="mr-1 h-3 w-3" />
              Settings
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function User(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
