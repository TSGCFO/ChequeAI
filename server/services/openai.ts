import OpenAI from "openai";
import { storage } from "../storage";
import { InsertTransaction, TransactionWithDetails } from "@shared/schema";
import fs from "fs";
import path from "path";
import os from "os";

// Initialize OpenAI with the API key from environment variables
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || ""
});

// Help message for the assistant
const HELP_MESSAGE = `
I'm your AI assistant for Cheque Ledger Pro. I can help with commands and natural language requests:

You can use either slash commands or natural language:
- \`/new transaction\` or "create a new transaction" 
- \`/deposit\` or "make a new deposit"
- \`/find transaction\` or "find transaction details"
- \`/modify transaction\` or "modify cheque number 00010572" or "change the amount of cheque 12345"
- \`/summary\` or "show me a business summary" 
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
      response: "Let's create a new transaction. Please provide the customer ID (or type /cancel to cancel):",
      updatedState: {
        ...state,
        currentCommand: "/new transaction",
        pendingData: {},
        step: "askCustomerId"
      }
    };
  }
  
  // Check for cancel command
  if (userMessage.trim().toLowerCase() === "/cancel") {
    return {
      response: "Transaction creation cancelled. How can I help you?",
      updatedState: {
        currentCommand: undefined,
        pendingData: undefined,
        step: undefined
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
      // Properly handle formats like $73,687.30 or 73,687.30
      const amount = userMessage.trim().replace('$', '').replace(/,/g, '');
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
 * Handle the /modify transaction command
 * @param userMessage User's message
 * @param conversationId Conversation ID
 * @param state Current conversation state
 * @returns Response message and updated state
 */
async function handleModifyTransactionCommand(
  userMessage: string, 
  conversationId: string, 
  state: ConversationState[string]
): Promise<{ response: string; updatedState: ConversationState[string] }> {
  // Initialize state if not exists
  if (!state.step) {
    return {
      response: "Let's modify a transaction. Please provide the transaction ID (or type /cancel to cancel):",
      updatedState: {
        ...state,
        currentCommand: "/modify transaction",
        pendingData: {},
        step: "askTransactionId"
      }
    };
  }
  
  // Check for cancel command
  if (userMessage.trim().toLowerCase() === "/cancel") {
    return {
      response: "Transaction modification cancelled. How can I help you?",
      updatedState: {
        currentCommand: undefined,
        pendingData: undefined,
        step: undefined
      }
    };
  }

  // Process based on current step
  switch (state.step) {
    case "askTransactionId":
      const transactionId = parseInt(userMessage.trim());
      if (isNaN(transactionId)) {
        return {
          response: "Transaction ID must be a number. Please try again or type /cancel to cancel:",
          updatedState: state
        };
      }

      // Verify transaction exists
      try {
        const transaction = await storage.getTransactionWithDetails(transactionId);
        if (!transaction) {
          return {
            response: "Transaction not found. Please provide a valid transaction ID:",
            updatedState: state
          };
        }

        // Store transaction and display details
        return {
          response: `Found transaction #${transaction.transaction_id}:
          
Cheque Number: ${transaction.cheque_number}
Cheque Amount: $${transaction.cheque_amount}
Date: ${transaction.date ? new Date(transaction.date.toString()).toLocaleDateString() : 'Not set'}
Customer: ${transaction.customer?.customer_name || 'Unknown'}
Vendor: ${transaction.vendor?.vendor_name || 'Unknown'}

What would you like to modify? (Type the number):
1. Date
2. Cheque Number
3. Cheque Amount
4. Vendor ID

Remember, you can only modify the date, cheque number, amount, and vendor ID.`,
          updatedState: {
            ...state,
            pendingData: { 
              ...state.pendingData, 
              transactionId,
              originalTransaction: transaction 
            },
            step: "askFieldToModify"
          }
        };
      } catch (error) {
        console.error("Error getting transaction:", error);
        return {
          response: "Error retrieving transaction. Please try again:",
          updatedState: state
        };
      }

    case "askFieldToModify":
      const option = userMessage.trim();
      let selectedField: string;

      // Determine which field to modify based on user's selection
      if (option === "1" || option.toLowerCase() === "date") {
        selectedField = "date";
      } else if (option === "2" || option.toLowerCase() === "cheque number") {
        selectedField = "cheque_number";
      } else if (option === "3" || option.toLowerCase() === "cheque amount") {
        selectedField = "cheque_amount";
      } else if (option === "4" || option.toLowerCase() === "vendor id") {
        selectedField = "vendor_id";
      } else {
        return {
          response: "Invalid selection. Please enter a number from 1-4 or the field name:",
          updatedState: state
        };
      }

      // Ask for the new value based on selected field
      let promptMessage: string;
      switch (selectedField) {
        case "date":
          promptMessage = "Please enter the new date (YYYY-MM-DD):";
          break;
        case "cheque_number":
          promptMessage = "Please enter the new cheque number:";
          break;
        case "cheque_amount":
          promptMessage = "Please enter the new amount (e.g., 1000.50):";
          break;
        case "vendor_id":
          promptMessage = "Please enter the new vendor ID:";
          break;
        default:
          promptMessage = "Please enter the new value:";
      }

      return {
        response: promptMessage,
        updatedState: {
          ...state,
          pendingData: { ...state.pendingData, fieldToModify: selectedField },
          step: "askNewValue"
        }
      };

    case "askNewValue":
      const fieldToModify = state.pendingData?.fieldToModify as string;
      let newValue = userMessage.trim();
      const originalTransaction = state.pendingData?.originalTransaction as TransactionWithDetails;
      
      // Process the new value based on the field type
      if (fieldToModify === "cheque_amount") {
        // Remove $ and commas for amount values
        newValue = newValue.replace(/[$,]/g, '');
        const amountNumber = parseFloat(newValue);
        
        if (isNaN(amountNumber) || amountNumber <= 0) {
          return {
            response: "Please enter a valid positive number for the amount:",
            updatedState: state
          };
        }
        
        newValue = amountNumber.toString();
      } else if (fieldToModify === "vendor_id") {
        // Verify vendor exists
        try {
          const vendor = await storage.getVendor(newValue);
          if (!vendor) {
            return {
              response: "Vendor not found. Please provide a valid vendor ID:",
              updatedState: state
            };
          }
        } catch (error) {
          console.error("Error verifying vendor:", error);
          return {
            response: "Error verifying vendor. Please try again with a valid vendor ID:",
            updatedState: state
          };
        }
      }

      // Prepare update data (only include allowed fields)
      const updateData: Partial<InsertTransaction> = {};
      
      // Only assign to allowed fields to avoid type errors and ensure we follow constraints
      if (fieldToModify === "date") {
        updateData.date = newValue;
      } else if (fieldToModify === "cheque_number") {
        updateData.cheque_number = newValue;
      } else if (fieldToModify === "cheque_amount") {
        updateData.cheque_amount = newValue;
      } else if (fieldToModify === "vendor_id") {
        updateData.vendor_id = newValue;
      }

      // Show confirmation with clear before/after information
      let oldValueDisplay: string;
      let newValueDisplay: string;
      
      if (fieldToModify === "cheque_amount") {
        oldValueDisplay = `$${originalTransaction.cheque_amount}`;
        newValueDisplay = `$${newValue}`;
      } else if (fieldToModify === "date") {
        oldValueDisplay = originalTransaction.date ? new Date(originalTransaction.date.toString()).toLocaleDateString() : 'Not set';
        newValueDisplay = newValue;
      } else if (fieldToModify === "cheque_number") {
        oldValueDisplay = originalTransaction.cheque_number;
        newValueDisplay = newValue;
      } else if (fieldToModify === "vendor_id") {
        oldValueDisplay = originalTransaction.vendor_id;
        newValueDisplay = newValue;
      } else {
        oldValueDisplay = 'Unknown';
        newValueDisplay = newValue;
      }

      const fieldDisplayName = {
        date: "Date",
        cheque_number: "Cheque Number",
        cheque_amount: "Cheque Amount",
        vendor_id: "Vendor ID"
      }[fieldToModify];

      return {
        response: `Please confirm the following change to Transaction #${originalTransaction.transaction_id}:

Change ${fieldDisplayName} from: ${oldValueDisplay}
To: ${newValueDisplay}

Type "confirm" to proceed or "cancel" to abort.`,
        updatedState: {
          ...state,
          pendingData: { 
            ...state.pendingData, 
            updateData 
          },
          step: "confirmUpdate"
        }
      };

    case "confirmUpdate":
      const confirmation = userMessage.trim().toLowerCase();
      
      if (confirmation === "confirm" || confirmation === "yes") {
        const transactionId = state.pendingData?.transactionId as number;
        const updateData = state.pendingData?.updateData as Partial<InsertTransaction>;
        
        try {
          // Make the update (only using the allowed fields)
          const updatedTransaction = await storage.updateTransaction(transactionId, updateData);
          
          if (!updatedTransaction) {
            return {
              response: "Error updating the transaction. The transaction may no longer exist.",
              updatedState: {
                currentCommand: undefined,
                pendingData: undefined,
                step: undefined
              }
            };
          }
          
          // Format response with updated transaction details
          return {
            response: `Transaction #${updatedTransaction.transaction_id} has been successfully updated!

\`\`\`json
{
  "transaction_id": ${updatedTransaction.transaction_id},
  "chequeNumber": "${updatedTransaction.cheque_number}",
  "chequeAmount": "${updatedTransaction.cheque_amount}",
  "date": "${updatedTransaction.date ? new Date(updatedTransaction.date.toString()).toLocaleDateString() : 'N/A'}",
  "customer_id": ${updatedTransaction.customer_id},
  "vendor_id": "${updatedTransaction.vendor_id}"
}
\`\`\`

The changes have been saved to the database.`,
            updatedState: {
              currentCommand: undefined,
              pendingData: undefined,
              step: undefined
            }
          };
        } catch (error) {
          console.error("Error updating transaction:", error);
          return {
            response: "Error updating the transaction. Please try again later.",
            updatedState: {
              currentCommand: undefined,
              pendingData: undefined,
              step: undefined
            }
          };
        }
      } else if (confirmation === "cancel" || confirmation === "no") {
        return {
          response: "Transaction update cancelled. How can I help you?",
          updatedState: {
            currentCommand: undefined,
            pendingData: undefined,
            step: undefined
          }
        };
      } else {
        return {
          response: `Please type "confirm" to update the transaction or "cancel" to abort.`,
          updatedState: state
        };
      }

    default:
      return {
        response: "Something went wrong with the transaction modification process. Let's start over. Please provide the transaction ID:",
        updatedState: {
          ...state,
          step: "askTransactionId",
          pendingData: {}
        }
      };
  }
}

/**
 * Handle the /deposit command
 * @param userMessage User's message
 * @param conversationId Conversation ID
 * @param state Current conversation state
 * @returns Response message and updated state
 */
async function handleDepositCommand(
  userMessage: string, 
  conversationId: string, 
  state: ConversationState[string]
): Promise<{ response: string; updatedState: ConversationState[string] }> {
  // Initialize state if not exists
  if (!state.step) {
    return {
      response: "Let's create a new customer deposit. Please provide the customer ID (or type /cancel to cancel):",
      updatedState: {
        ...state,
        currentCommand: "/deposit",
        pendingData: {},
        step: "askCustomerId"
      }
    };
  }
  
  // Check for cancel command
  if (userMessage.trim().toLowerCase() === "/cancel") {
    return {
      response: "Deposit creation cancelled. How can I help you?",
      updatedState: {
        currentCommand: undefined,
        pendingData: undefined,
        step: undefined
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
          response: `Customer: ${customer.customer_name}. Now, please provide the deposit amount:`,
          updatedState: {
            ...state,
            pendingData: { ...state.pendingData, customerId },
            step: "askAmount"
          }
        };
      } catch (error) {
        console.error("Error verifying customer:", error);
        return {
          response: "Error verifying customer. Please try again:",
          updatedState: state
        };
      }

    case "askAmount":
      const amountInput = userMessage.trim().replace(/[$,]/g, '');
      const amount = parseFloat(amountInput);
      
      if (isNaN(amount) || amount <= 0) {
        return {
          response: "Please provide a valid positive amount:",
          updatedState: state
        };
      }

      // Create the deposit
      try {
        const deposit = await storage.createCustomerDeposit({
          customer_id: state.pendingData?.customerId as number,
          amount: amount.toFixed(2)
        });

        const customer = await storage.getCustomer(deposit.customer_id);
        
        return {
          response: `Deposit successfully created for ${customer?.customer_name || 'Customer'}.
          
Amount: $${deposit.amount}
Date: ${new Date().toLocaleDateString()}

The deposit has been added to the database.`,
          updatedState: {
            currentCommand: undefined,
            pendingData: undefined,
            step: undefined
          }
        };
      } catch (error) {
        console.error("Error creating deposit:", error);
        return {
          response: "Error creating the deposit. Please try again later.",
          updatedState: {
            currentCommand: undefined,
            pendingData: undefined,
            step: undefined
          }
        };
      }

    default:
      return {
        response: "Something went wrong with the deposit creation process. Let's start over. Please provide the customer ID:",
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
      
      case "/deposit":
        const depositResult = await handleDepositCommand(userMessage, conversationId, state);
        response = depositResult.response;
        updatedState = depositResult.updatedState;
        break;
        
      case "/modify transaction":
        const modifyResult = await handleModifyTransactionCommand(userMessage, conversationId, state);
        response = modifyResult.response;
        updatedState = modifyResult.updatedState;
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
    
    const response = "Let's create a new transaction. Please provide the customer ID (or type /cancel to cancel):";
    
    // Save assistant message to conversation history
    await storage.saveAIMessage({
      user_id: 0,
      content: response,
      role: "assistant",
      conversation_id: conversationId
    });
    
    return response;
  }
  
  if (trimmedMessage === "/deposit") {
    conversationStates[conversationId] = {
      currentCommand: "/deposit",
      pendingData: {},
      step: "askCustomerId"
    };
    
    const response = "Let's create a new customer deposit. Please provide the customer ID (or type /cancel to cancel):";
    
    // Save assistant message to conversation history
    await storage.saveAIMessage({
      user_id: 0,
      content: response,
      role: "assistant",
      conversation_id: conversationId
    });
    
    return response;
  }
  
  if (trimmedMessage === "/modify transaction") {
    conversationStates[conversationId] = {
      currentCommand: "/modify transaction",
      pendingData: {},
      step: "askTransactionId"
    };
    
    const response = "Let's modify a transaction. Please provide the transaction ID (or type /cancel to cancel):";
    
    // Save assistant message to conversation history
    await storage.saveAIMessage({
      user_id: 0,
      content: response,
      role: "assistant",
      conversation_id: conversationId
    });
    
    return response;
  }
  
  // Check for natural language commands
  
  // Check for "modify" or "change" commands
  const modifyRegex = /modify|change|update|edit|alter/i;
  const chequeNumberRegex = /(?:cheque|check)\s+(?:number|#)?\s*(\d+)/i;
  const amountRegex = /(?:amount|value|sum)/i;
  
  if (modifyRegex.test(trimmedMessage)) {
    // Check if it's trying to modify a transaction
    const chequeNumberMatch = chequeNumberRegex.exec(userMessage);
    
    if (chequeNumberMatch && chequeNumberMatch[1]) {
      const chequeNumber = chequeNumberMatch[1];
      
      // Try to find the transaction by cheque number
      try {
        const transactions = await storage.getTransactions();
        const transaction = transactions.find(t => t.cheque_number === chequeNumber);
        
        if (transaction) {
          conversationStates[conversationId] = {
            currentCommand: "/modify transaction",
            pendingData: { 
              transactionId: transaction.transaction_id,
              originalTransaction: transaction
            },
            step: "askFieldToModify"
          };
          
          // If "amount" is mentioned, directly offer to modify the amount
          if (amountRegex.test(trimmedMessage)) {
            const response = `I found cheque #${chequeNumber} (Transaction #${transaction.transaction_id}). 
            
Current amount: $${transaction.cheque_amount}

Please enter the new amount:`;
            
            // Save assistant message to conversation history
            await storage.saveAIMessage({
              user_id: 0,
              content: response,
              role: "assistant",
              conversation_id: conversationId
            });
            
            // Update state to skip directly to asking for the new amount
            if (conversationStates[conversationId] && conversationStates[conversationId].pendingData) {
              conversationStates[conversationId].pendingData.fieldToModify = "cheque_amount";
              conversationStates[conversationId].step = "askNewValue";
            }
            
            return response;
          }
          
          // Otherwise, provide options to modify
          const response = `I found cheque #${chequeNumber} (Transaction #${transaction.transaction_id}):
          
Cheque Number: ${transaction.cheque_number}
Cheque Amount: $${transaction.cheque_amount}
Date: ${transaction.date ? new Date(transaction.date.toString()).toLocaleDateString() : 'Not set'}
${transaction.customer_id ? `Customer ID: ${transaction.customer_id}` : ''}
${transaction.vendor_id ? `Vendor ID: ${transaction.vendor_id}` : ''}

What would you like to modify? (Type the number):
1. Date
2. Cheque Number
3. Cheque Amount
4. Vendor ID

Remember, you can only modify the date, cheque number, amount, and vendor ID.`;
          
          // Save assistant message to conversation history
          await storage.saveAIMessage({
            user_id: 0,
            content: response,
            role: "assistant",
            conversation_id: conversationId
          });
          
          return response;
        }
      } catch (error) {
        console.error("Error finding transaction by cheque number:", error);
      }
    }
  }
  
  // Check for natural language "new transaction" commands
  if (/new\s+(?:transaction|cheque|check)/i.test(trimmedMessage) || 
      /create\s+(?:a\s+)?(?:transaction|cheque|check)/i.test(trimmedMessage)) {
    
    conversationStates[conversationId] = {
      currentCommand: "/new transaction",
      pendingData: {},
      step: "askCustomerId"
    };
    
    const response = "Let's create a new transaction. Please provide the customer ID (or type /cancel to cancel):";
    
    // Save assistant message to conversation history
    await storage.saveAIMessage({
      user_id: 0,
      content: response,
      role: "assistant",
      conversation_id: conversationId
    });
    
    return response;
  }
  
  // Check for natural language "deposit" commands
  if (/new\s+deposit/i.test(trimmedMessage) || 
      /create\s+(?:a\s+)?deposit/i.test(trimmedMessage) ||
      /make\s+(?:a\s+)?deposit/i.test(trimmedMessage)) {
    
    conversationStates[conversationId] = {
      currentCommand: "/deposit",
      pendingData: {},
      step: "askCustomerId"
    };
    
    const response = "Let's create a new customer deposit. Please provide the customer ID (or type /cancel to cancel):";
    
    // Save assistant message to conversation history
    await storage.saveAIMessage({
      user_id: 0,
      content: response,
      role: "assistant",
      conversation_id: conversationId
    });
    
    return response;
  }
  
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
                  - /deposit - Start the process to create a new customer deposit
                  - /modify transaction - Modify an existing transaction (only date, cheque number, amount or vendor)
                  - /find transaction - Find transaction details
                  - /summary - Get business summary
                  
                  You can understand both slash commands like "/modify transaction" and natural language requests like "modify cheque number 00010572" or "change the amount of cheque 12345".
                  
                  If a user asks to modify or create something in natural language, try to understand and handle their request directly.
                  
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
 * Process a voice message and generate a response
 * @param audioBuffer Buffer containing the voice message audio data
 * @param conversationId The conversation ID for context
 * @returns AI-generated response to the voice message
 */
export async function processVoiceMessage(audioBuffer: Buffer, conversationId: string): Promise<string> {
  try {
    // Create a temporary file path
    const tempFilePath = path.join(os.tmpdir(), `voice-${Date.now()}.ogg`);
    
    // Write the buffer to a temporary file
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    try {
      // Create a readable stream from the file
      const audioReadStream = fs.createReadStream(tempFilePath);
      
      // Use the Whisper model to transcribe the audio
      const transcription = await openai.audio.transcriptions.create({
        file: audioReadStream,
        model: "whisper-1",
      });
      
      // Get the transcribed text
      const transcribedText = transcription.text;
      
      // Save the user's message to conversation history
      await storage.saveAIMessage({
        user_id: 0,
        content: transcribedText,
        role: "user",
        conversation_id: conversationId
      });
      
      // Now process the transcribed text using our normal AI response generation
      const response = await generateAIResponse(transcribedText, conversationId);
      
      return response;
    } finally {
      // Clean up the temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  } catch (error) {
    console.error("Error processing voice message:", error);
    throw error;
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
