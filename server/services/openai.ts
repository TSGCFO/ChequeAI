import OpenAI from "openai";
import { storage } from "../storage";
import { InsertTransaction } from "@shared/schema";

// Initialize OpenAI with the API key from environment variables
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || ""
});

// Help message for the assistant
const HELP_MESSAGE = `
I'm your AI assistant for Cheque Ledger Pro. I can help with the following commands:

Commands:
- \`/new transaction\` - Create a new transaction (I'll ask for details)
- \`/find transaction\` - Find transaction details (I'll ask for the ID)
- \`/summary\` - Get a summary of business metrics
- \`/help\` - Show this help message

For general questions, just ask me directly about:
- Transaction details
- Customer information
- Vendor information
- Business reports and analytics

How can I assist you today?
`;

// State tracking for command-based conversations
type ConversationState = {
  [conversationId: string]: {
    currentCommand?: string;
    pendingData?: {
      customerId?: number;
      chequeNumber?: string;
      amount?: string;
      vendorId?: string;
      [key: string]: any;
    };
    step?: string;
  };
};

const conversationStates: ConversationState = {};

/**
 * Handle the /new transaction command
 * @param userMessage User's message
 * @param conversationId Conversation ID
 * @param state Current conversation state
 * @returns Response message and updated state
 */
async function handleNewTransactionCommand(
  userMessage: string, 
  conversationId: string, 
  state: ConversationState[string]
): Promise<{ response: string; updatedState: ConversationState[string] }> {
  // Initialize state if not exists
  if (!state.step) {
    return {
      response: "Let's create a new transaction. Please provide the customer ID:",
      updatedState: {
        ...state,
        currentCommand: "/new transaction",
        pendingData: {},
        step: "askCustomerId"
      }
    };
  }

  // Process based on current step
  switch (state.step) {
    case "askCustomerId":
      const customerId = parseInt(userMessage.trim());
      if (isNaN(customerId)) {
        return {
          response: "Customer ID must be a number. Please try again:",
          updatedState: state
        };
      }

      // Verify customer exists
      try {
        const customer = await storage.getCustomer(customerId);
        if (!customer) {
          return {
            response: "Customer not found. Please provide a valid customer ID:",
            updatedState: state
          };
        }

        return {
          response: `Customer: ${customer.customer_name}. Now, please provide the cheque number:`,
          updatedState: {
            ...state,
            pendingData: { ...state.pendingData, customerId },
            step: "askChequeNumber"
          }
        };
      } catch (error) {
        console.error("Error verifying customer:", error);
        return {
          response: "Error verifying customer. Please try again with a valid customer ID:",
          updatedState: state
        };
      }

    case "askChequeNumber":
      const chequeNumber = userMessage.trim();
      if (!chequeNumber) {
        return {
          response: "Cheque number is required. Please provide a valid cheque number:",
          updatedState: state
        };
      }

      return {
        response: "Please enter the cheque amount (e.g., 1000.50):",
        updatedState: {
          ...state,
          pendingData: { ...state.pendingData, chequeNumber },
          step: "askAmount"
        }
      };

    case "askAmount":
      const amount = userMessage.trim().replace('$', '');
      const amountNumber = parseFloat(amount);
      
      if (isNaN(amountNumber) || amountNumber <= 0) {
        return {
          response: "Please enter a valid positive number for the amount:",
          updatedState: state
        };
      }

      return {
        response: "Finally, please provide the vendor ID:",
        updatedState: {
          ...state,
          pendingData: { ...state.pendingData, amount: amountNumber.toString() },
          step: "askVendorId"
        }
      };

    case "askVendorId":
      const vendorId = userMessage.trim();
      if (!vendorId) {
        return {
          response: "Vendor ID is required. Please provide a valid vendor ID:",
          updatedState: state
        };
      }

      // Verify vendor exists
      try {
        const vendor = await storage.getVendor(vendorId);
        if (!vendor) {
          return {
            response: "Vendor not found. Please provide a valid vendor ID:",
            updatedState: state
          };
        }

        // Create the transaction
        try {
          // Only include the specified fields as requested
          const newTransaction: InsertTransaction = {
            customer_id: state.pendingData!.customerId!,
            cheque_number: state.pendingData!.chequeNumber!,
            cheque_amount: state.pendingData!.amount!,
            vendor_id: vendorId
          };

          const transaction = await storage.createTransaction(newTransaction);

          // Format response with transaction details
          return {
            response: `Transaction created successfully!

\`\`\`json
{
  "transaction_id": ${transaction.transaction_id},
  "chequeNumber": "${transaction.cheque_number}",
  "chequeAmount": "${transaction.cheque_amount}",
  "customer_id": ${transaction.customer_id},
  "vendor_id": "${transaction.vendor_id}",
  "date": "${transaction.date ? new Date(transaction.date.toString()).toLocaleDateString() : 'N/A'}"
}
\`\`\`

The transaction has been added to the database. You can view it in the transactions list.`,
            updatedState: {
              currentCommand: undefined,
              pendingData: undefined,
              step: undefined
            }
          };
        } catch (error) {
          console.error("Error creating transaction:", error);
          return {
            response: "Error creating the transaction. Please try again later.",
            updatedState: {
              currentCommand: undefined,
              pendingData: undefined,
              step: undefined
            }
          };
        }
      } catch (error) {
        console.error("Error verifying vendor:", error);
        return {
          response: "Error verifying vendor. Please try again with a valid vendor ID:",
          updatedState: state
        };
      }

    default:
      return {
        response: "Something went wrong with the transaction creation process. Let's start over. Please provide the customer ID:",
        updatedState: {
          ...state,
          step: "askCustomerId",
          pendingData: {}
        }
      };
  }
}

/**
 * Handle command-based interactions
 * @param userMessage User's message
 * @param conversationId Conversation ID
 * @returns Response message or null if not a command
 */
async function handleCommands(userMessage: string, conversationId: string): Promise<string | null> {
  // Get or initialize conversation state
  const state = conversationStates[conversationId] || {};
  
  // Check if we're in the middle of a command flow
  if (state.currentCommand) {
    let response: string;
    let updatedState;

    // Process based on current command
    switch (state.currentCommand) {
      case "/new transaction":
        const result = await handleNewTransactionCommand(userMessage, conversationId, state);
        response = result.response;
        updatedState = result.updatedState;
        break;
        
      // Add other command handlers here
      
      default:
        response = "I'm not sure what we were doing. How can I help you?";
        updatedState = {
          currentCommand: undefined,
          pendingData: undefined,
          step: undefined
        };
    }

    // Update conversation state
    conversationStates[conversationId] = updatedState;
    
    // Save assistant message to conversation history
    await storage.saveAIMessage({
      user_id: 0,
      content: response,
      role: "assistant",
      conversation_id: conversationId
    });
    
    return response;
  }

  // Check for new commands
  const trimmedMessage = userMessage.trim().toLowerCase();
  
  if (trimmedMessage === "/help") {
    // Save assistant message to conversation history
    await storage.saveAIMessage({
      user_id: 0,
      content: HELP_MESSAGE,
      role: "assistant",
      conversation_id: conversationId
    });
    
    return HELP_MESSAGE;
  }
  
  if (trimmedMessage === "/new transaction") {
    conversationStates[conversationId] = {
      currentCommand: "/new transaction",
      pendingData: {},
      step: "askCustomerId"
    };
    
    const response = "Let's create a new transaction. Please provide the customer ID:";
    
    // Save assistant message to conversation history
    await storage.saveAIMessage({
      user_id: 0,
      content: response,
      role: "assistant",
      conversation_id: conversationId
    });
    
    return response;
  }
  
  // Add more command handlers here
  
  // Not a command, return null to continue with normal AI response
  return null;
}

/**
 * Generates an AI response based on user input and context
 * @param userMessage The message from the user
 * @param conversationId The ID of the conversation for context
 * @returns Promise with the AI-generated response
 */
export async function generateAIResponse(userMessage: string, conversationId: string): Promise<string> {
  try {
    // First check if this is a command
    const commandResponse = await handleCommands(userMessage, conversationId);
    if (commandResponse !== null) {
      return commandResponse;
    }
    
    // Get conversation history for context
    const conversationHistory = await storage.getAIConversationHistory(conversationId);
    
    // Build messages array for OpenAI with conversation history
    const messages = [
      {
        role: "system",
        content: `You are an AI assistant for a cheque cashing business ledger management system called 'Cheque Ledger Pro'. 
                  
                  You understand the following COMMANDS:
                  - /help - Display help information about available commands
                  - /new transaction - Start the process to create a new transaction
                  - /find transaction - Find transaction details
                  - /summary - Get business summary
                  
                  When the user asks about creating transactions or other system actions, remind them to use these slash commands.
                  
                  If a user asks a question that you don't have enough information for, direct them to use one of the available commands.
                  
                  For numerical values, always format currency with a dollar sign and two decimal places.
                  
                  Never make up information and be explicit when you don't know something.
                  
                  When showing transactions or other data, use code blocks with proper formatting for readability.`
      }
    ];
    
    // Add conversation history (limit to last 10 messages for context)
    const recentMessages = conversationHistory.slice(-10);
    recentMessages.forEach(msg => {
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content
      });
    });
    
    // Add the current user message
    messages.push({
      role: "user",
      content: userMessage
    });
    
    // Check if the message appears to be a query for transaction data
    const isDataQuery = /transactions|customer|vendor|summary|report|total|profit|balance/i.test(userMessage);
    
    if (isDataQuery) {
      // Fetch relevant data to enhance the response
      try {
        const businessSummary = await storage.getBusinessSummary();
        const recentTransactions = await storage.getTransactions({ limit: 5 });
        
        // Add data context to system message
        messages.unshift({
          role: "system",
          content: `Here is some recent data to help with your response:
                    Business Summary: ${JSON.stringify(businessSummary)}
                    Recent Transactions: ${JSON.stringify(recentTransactions)}
                    
                    When showing transactions in your response, format them in a clear, readable way.
                    If the user is asking about specific transactions that aren't in this data,
                    let them know you only have access to recent transactions.`
        });
      } catch (error) {
        console.error("Error fetching data for AI context:", error);
      }
    }
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 1000,
    });
    
    const assistantResponse = response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
    
    // Save assistant message to conversation history
    await storage.saveAIMessage({
      user_id: 0,
      content: assistantResponse,
      role: "assistant",
      conversation_id: conversationId
    });
    
    return assistantResponse;
    
  } catch (error) {
    console.error("Error generating AI response:", error);
    throw new Error("Failed to generate AI response");
  }
}

/**
 * Processes an image and extracts relevant information
 * @param imageBase64 The base64-encoded image data
 * @returns Extracted information from the image
 */
export async function processImage(imageBase64: string) {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant designed to extract information from cheque images. 
                    Extract the following information in JSON format:
                    - chequeNumber: the cheque number
                    - amount: the dollar amount
                    - date: the date on the cheque
                    - payeeName: the name of the payee (recipient)
                    - bankName: the bank name if visible
                    
                    Return the response as a valid JSON object.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract information from this cheque image."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const result = response.choices[0].message.content;
    
    // Parse the JSON response
    if (result) {
      return JSON.parse(result);
    }
    
    throw new Error("Failed to extract information from the image");
    
  } catch (error) {
    console.error("Error processing image with OpenAI:", error);
    throw error;
  }
}
