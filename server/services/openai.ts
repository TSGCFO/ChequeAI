import OpenAI from "openai";
import { storage } from "../storage";
import { InsertTransaction, TransactionWithDetails, Customer, Vendor } from "@shared/schema";
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
  * You can enter customer/vendor names or IDs during the creation process
- \`/deposit\` or "make a new deposit"
  * You can enter customer names or IDs during the deposit process
- \`/find transaction\` or "find transaction details"
- \`/modify transaction\` or "modify cheque number 00010572" or "change the amount of cheque 12345"
- \`/summary\` or "show me a business summary" 
- \`/help\` - Show this help message
- \`/test\` - Enter test mode (commands will be processed but no changes will be saved to the database)
- \`/exit-test\` - Exit test mode

For general questions, just ask me directly about:
- Transaction details
- Customer information
- Vendor information
- Business reports and analytics

How can I assist you today?
`;

// State tracking for command-based conversations
type CommandResult = {
  response: string;
  updatedState: ConversationState[string];
};

type ConversationState = {
  [conversationId: string]: {
    currentCommand?: string;
    pendingData?: {
      customerId?: number;
      chequeNumber?: string;
      amount?: string;
      vendorId?: string;
      extractedCheques?: any[];
      currentChequeIndex?: number;
      newTransaction?: InsertTransaction;
      [key: string]: any;
    };
    step?: string;
    testMode?: boolean;
  };
};

const conversationStates: ConversationState = {};

/**
 * Helper function to find a customer by name or ID
 * @param customerInput The customer name or ID entered by the user
 * @returns The customer object if found, undefined otherwise
 */
async function findCustomerByNameOrId(customerInput: string): Promise<Customer | undefined> {
  const customerId = parseInt(customerInput.trim());
  
  // First try to find by ID if input is a number
  if (!isNaN(customerId)) {
    return await storage.getCustomer(customerId);
  }
  
  // If not a number, try to find by name
  const allCustomers = await storage.getCustomers();
  
  // Case-insensitive search
  return allCustomers.find(customer => 
    customer.customer_name.toLowerCase().includes(customerInput.toLowerCase()));
}

/**
 * Helper function to find a vendor by name or ID
 * @param vendorInput The vendor name or ID entered by the user
 * @returns The vendor object if found, undefined otherwise
 */
async function findVendorByNameOrId(vendorInput: string): Promise<Vendor | undefined> {
  // First try to find by ID directly
  const vendorById = await storage.getVendor(vendorInput.trim());
  if (vendorById) {
    return vendorById;
  }
  
  // If not found by ID, try to find by name
  const allVendors = await storage.getVendors();
  
  // Case-insensitive search
  return allVendors.find(vendor => 
    vendor.vendor_name.toLowerCase().includes(vendorInput.toLowerCase()));
}

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
      response: "Let's create a new transaction. Please provide the customer name or ID (or type /cancel to cancel):",
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
      // Try to find customer by name or ID
      try {
        const customerInput = userMessage.trim();
        if (!customerInput) {
          return {
            response: "Please provide a customer name or ID:",
            updatedState: state
          };
        }
        
        const customer = await findCustomerByNameOrId(customerInput);
        if (!customer) {
          return {
            response: "Customer not found. Please provide a valid customer name or ID:",
            updatedState: state
          };
        }

        return {
          response: `Customer: ${customer.customer_name}. Now, please provide the cheque number:`,
          updatedState: {
            ...state,
            pendingData: { ...state.pendingData, customerId: customer.customer_id },
            step: "askChequeNumber"
          }
        };
      } catch (error) {
        console.error("Error finding customer:", error);
        return {
          response: "Error finding customer. Please try again with a valid customer name or ID:",
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
        response: "Finally, please provide the vendor name or ID:",
        updatedState: {
          ...state,
          pendingData: { ...state.pendingData, amount: amountNumber.toString() },
          step: "askVendorId"
        }
      };

    case "askVendorId":
      const vendorInput = userMessage.trim();
      if (!vendorInput) {
        return {
          response: "Vendor name or ID is required. Please provide a valid vendor name or ID:",
          updatedState: state
        };
      }

      // Verify vendor exists
      try {
        const vendor = await findVendorByNameOrId(vendorInput);
        if (!vendor) {
          return {
            response: "Vendor not found. Please provide a valid vendor name or ID:",
            updatedState: state
          };
        }
        
        // Store the vendor ID for transaction creation
        const vendorId = vendor.vendor_id;

        // Create the transaction
        try {
          // Only include the specified fields as requested
          const newTransaction: InsertTransaction = {
            customer_id: state.pendingData!.customerId!,
            cheque_number: state.pendingData!.chequeNumber!,
            cheque_amount: state.pendingData!.amount!,
            vendor_id: vendorId
          };

          let transaction;
          if (state.testMode) {
            // In test mode, create a mock transaction but don't save to database
            transaction = {
              ...newTransaction,
              transaction_id: Math.floor(1000 + Math.random() * 9000), // Random 4-digit ID
              date: new Date().toISOString().split('T')[0],
              status: "pending",
              profit_amount: "0.00"
            };
            console.log("TEST MODE: Transaction simulated but not saved to database:", transaction);
          } else {
            // Normal mode - save to database
            transaction = await storage.createTransaction(newTransaction);
          }

          // Format response with transaction details
          const responsePrefix = state.testMode ? "🧪 TEST MODE: " : "";
          const responseSuffix = state.testMode ? 
            "This is a simulated transaction and has NOT been saved to the database." : 
            "The transaction has been added to the database. You can view it in the transactions list.";

          return {
            response: `${responsePrefix}Transaction created successfully!

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

${responseSuffix}`,
            updatedState: {
              currentCommand: undefined,
              pendingData: undefined,
              step: undefined,
              testMode: state.testMode // Preserve test mode flag
            }
          };
        } catch (error) {
          console.error("Error creating transaction:", error);
          return {
            response: "Error creating the transaction. Please try again later.",
            updatedState: {
              currentCommand: undefined,
              pendingData: undefined,
              step: undefined,
              testMode: state.testMode // Preserve test mode flag
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
        response: "Something went wrong with the transaction creation process. Let's start over. Please provide the customer name or ID:",
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
      response: "Let's modify a transaction. Please provide the transaction ID or cheque number (or type /cancel to cancel):",
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
      const userInput = userMessage.trim();
      let transaction = null;
      let transactionId = null;
      
      // First, check if input might be a cheque number
      if (userInput.match(/^[a-zA-Z0-9]+$/)) {
        try {
          // Try to find by cheque number
          const transactions = await storage.getTransactions();
          const matchedTransaction = transactions.find(t => t.cheque_number === userInput);
          
          if (matchedTransaction) {
            transactionId = matchedTransaction.transaction_id;
            transaction = await storage.getTransactionWithDetails(transactionId);
          }
        } catch (error) {
          console.error("Error searching for transaction by cheque number:", error);
        }
      }
      
      // If not found by cheque number, try as transaction ID
      if (!transaction && !isNaN(parseInt(userInput))) {
        transactionId = parseInt(userInput);
        try {
          transaction = await storage.getTransactionWithDetails(transactionId);
        } catch (error) {
          console.error("Error getting transaction by ID:", error);
        }
      }
      
      // If still not found, return error
      if (!transaction) {
        return {
          response: "Transaction not found. Please provide a valid transaction ID or cheque number:",
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
          promptMessage = "Please enter the new vendor name or ID:";
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
          const vendor = await findVendorByNameOrId(newValue);
          if (!vendor) {
            return {
              response: "Vendor not found. Please provide a valid vendor name or ID:",
              updatedState: state
            };
          }
          // Store the actual ID
          newValue = vendor.vendor_id;
        } catch (error) {
          console.error("Error verifying vendor:", error);
          return {
            response: "Error verifying vendor. Please try again with a valid vendor name or ID:",
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
        // Try to get the vendor name for better display
        const oldVendorName = originalTransaction.vendor?.vendor_name || originalTransaction.vendor_id;
        // For new value, find the vendor name if possible
        let newVendorName = newValue;
        try {
          const newVendor = await storage.getVendor(newValue);
          if (newVendor) {
            newVendorName = newVendor.vendor_name;
          }
        } catch (error) {
          console.error("Error getting vendor name for display:", error);
        }
        oldValueDisplay = oldVendorName;
        newValueDisplay = newVendorName;
      } else {
        oldValueDisplay = 'Unknown';
        newValueDisplay = newValue;
      }

      const fieldDisplayName = {
        date: "Date",
        cheque_number: "Cheque Number",
        cheque_amount: "Cheque Amount",
        vendor_id: "Vendor"
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
          let updatedTransaction;
          
          // Check if in test mode
          if (state.testMode) {
            // In test mode, create a mock updated transaction but don't save to database
            const originalTransaction = state.pendingData?.originalTransaction;
            updatedTransaction = {
              ...originalTransaction,
              ...updateData
            };
            console.log("TEST MODE: Transaction update simulated but not saved to database:", updatedTransaction);
          } else {
            // Normal mode - save to database
            updatedTransaction = await storage.updateTransaction(transactionId, updateData);
          }
          
          if (!updatedTransaction) {
            return {
              response: "Error updating the transaction. The transaction may no longer exist.",
              updatedState: {
                currentCommand: undefined,
                pendingData: undefined,
                step: undefined,
                testMode: state.testMode // Preserve test mode flag
              }
            };
          }
          
          // Format response with updated transaction details
          const responsePrefix = state.testMode ? "🧪 TEST MODE: " : "";
          const responseSuffix = state.testMode ? 
            "This is a simulated update and has NOT been saved to the database." : 
            "The changes have been saved to the database.";
            
          return {
            response: `${responsePrefix}Transaction #${updatedTransaction.transaction_id} has been successfully updated!

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

${responseSuffix}`,
            updatedState: {
              currentCommand: undefined,
              pendingData: undefined,
              step: undefined,
              testMode: state.testMode // Preserve test mode flag
            }
          };
        } catch (error) {
          console.error("Error updating transaction:", error);
          return {
            response: "Error updating the transaction. Please try again later.",
            updatedState: {
              currentCommand: undefined,
              pendingData: undefined,
              step: undefined,
              testMode: state.testMode // Preserve test mode flag
            }
          };
        }
      } else if (confirmation === "cancel" || confirmation === "no") {
        return {
          response: "Transaction update cancelled. How can I help you?",
          updatedState: {
            currentCommand: undefined,
            pendingData: undefined,
            step: undefined,
            testMode: state.testMode // Preserve test mode flag
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
        response: "Something went wrong with the transaction modification process. Let's start over. Please provide the transaction ID or cheque number:",
        updatedState: {
          ...state,
          step: "askTransactionId",
          pendingData: {}
        }
      };
  }
}

/**
 * Handle the cheque processing workflow after image analysis
 * @param userMessage User's message
 * @param conversationId Conversation ID
 * @param state Current conversation state
 * @returns Response message and updated state
 */
async function handleChequeProcessingCommand(
  userMessage: string,
  conversationId: string,
  state: ConversationState[string]
): Promise<{ response: string; updatedState: ConversationState[string] }> {
  // Check for cancel command
  if (userMessage.trim().toLowerCase() === "/cancel" || userMessage.trim().toLowerCase() === "cancel") {
    return {
      response: "Cheque processing cancelled. How can I help you?",
      updatedState: {
        currentCommand: undefined,
        pendingData: undefined,
        step: undefined
      }
    };
  }

  // Extract state information
  const pendingData = state.pendingData || {};
  const extractedCheques = state.pendingData?.extractedCheques || [];
  const currentChequeIndex = state.pendingData?.currentChequeIndex || 0;
  const currentCheque = extractedCheques[currentChequeIndex];

  // Process based on current step
  switch (state.step) {
    case "confirm_extraction":
      // Check if user wants to proceed with creating a transaction
      const confirmResponse = userMessage.trim().toLowerCase();
      if (confirmResponse === "yes" || confirmResponse === "y" || confirmResponse.includes("yes") || confirmResponse.includes("correct")) {
        // Move to next step to get customer ID
        return {
          response: "Great! Let's create a new transaction with this cheque. Please provide the customer name or ID:",
          updatedState: {
            ...state,
            currentCommand: "process_cheque",
            step: "askCustomerId"
          }
        };
      } else if (confirmResponse === "no" || confirmResponse === "n" || confirmResponse.includes("no") || confirmResponse.includes("wrong")) {
        // User indicates the extraction is incorrect
        return {
          response: "I'm sorry the extraction wasn't accurate. Please provide the correct cheque number and amount manually, or upload a clearer image.",
          updatedState: {
            currentCommand: undefined,
            pendingData: undefined,
            step: undefined
          }
        };
      } else {
        // Check if user is providing corrections
        const chequeNumberMatch = userMessage.match(/cheque\s+number\s*(?:is|:)?\s*(\d+)/i);
        const amountMatch = userMessage.match(/amount\s*(?:is|:)?\s*\$?(\d+(?:\.\d+)?)/i);
        
        if (chequeNumberMatch || amountMatch) {
          // Update the data based on corrections
          if (chequeNumberMatch && chequeNumberMatch[1]) {
            pendingData.chequeNumber = chequeNumberMatch[1];
          }
          
          if (amountMatch && amountMatch[1]) {
            pendingData.amount = amountMatch[1];
          }
          
          return {
            response: `I've updated the information. Cheque #${pendingData.chequeNumber} for $${pendingData.amount}. Is this correct now? Would you like to create a new transaction with this cheque?`,
            updatedState: {
              ...state,
              pendingData,
              step: "confirm_extraction"
            }
          };
        }
        
        // Unclear response, ask again
        return {
          response: "I'm not sure if you want to proceed. Please say 'yes' if you want to create a transaction with this cheque, or 'no' if you don't. If you need to correct some information, please specify which details need to be fixed.",
          updatedState: state
        };
      }
      
    case "askCustomerId":
      // Try to find customer by name or ID
      try {
        const customerInput = userMessage.trim();
        if (!customerInput) {
          return {
            response: "Please provide a customer name or ID:",
            updatedState: state
          };
        }
        
        const customer = await findCustomerByNameOrId(customerInput);
        if (!customer) {
          return {
            response: "Customer not found. Please provide a valid customer name or ID:",
            updatedState: state
          };
        }

        return {
          response: `Customer: ${customer.customer_name}. Now, please provide the vendor name or ID:`,
          updatedState: {
            ...state,
            pendingData: { ...pendingData, customerId: customer.customer_id },
            step: "askVendorId"
          }
        };
      } catch (error) {
        console.error("Error finding customer:", error);
        return {
          response: "Error finding customer. Please try again with a valid customer name or ID:",
          updatedState: state
        };
      }
      
    case "askVendorId":
      const vendorInput = userMessage.trim();
      if (!vendorInput) {
        return {
          response: "Vendor name or ID is required. Please provide a valid vendor name or ID:",
          updatedState: state
        };
      }
      
      // Verify vendor exists
      try {
        const vendor = await findVendorByNameOrId(vendorInput);
        if (!vendor) {
          return {
            response: "Vendor not found. Please provide a valid vendor name or ID:",
            updatedState: state
          };
        }
        
        // Store the vendor ID for transaction creation
        const vendorId = vendor.vendor_id;

        // Prepare transaction data
        const customerId = pendingData.customerId;
        const chequeNumber = pendingData.chequeNumber;
        const amount = pendingData.amount;
        
        // Check for required fields
        if (!customerId || !chequeNumber || !amount) {
          return {
            response: "Missing required information (customer ID, cheque number, or amount). Please try again.",
            updatedState: {
              currentCommand: undefined,
              pendingData: undefined,
              step: undefined
            }
          };
        }
        
        const newTransaction: InsertTransaction = {
          customer_id: customerId,
          cheque_number: chequeNumber,
          cheque_amount: amount.toString(),
          vendor_id: vendorId,
          date: new Date().toISOString().split('T')[0]
        };

        // Show transaction summary and ask for confirmation
        return {
          response: `Please confirm the following transaction:
          
Customer ID: ${newTransaction.customer_id}
Cheque Number: ${newTransaction.cheque_number}
Amount: $${newTransaction.cheque_amount}
Vendor ID: ${newTransaction.vendor_id}
Date: ${newTransaction.date}
Status: pending

Type "confirm" to create this transaction or "cancel" to abort.`,
          updatedState: {
            ...state,
            pendingData: { ...pendingData, vendorId, newTransaction },
            step: "confirmTransaction"
          }
        };
      } catch (error) {
        console.error("Error verifying vendor:", error);
        return {
          response: "Error verifying vendor. Please try again with a valid vendor name or ID:",
          updatedState: state
        };
      }
      
    case "confirmTransaction":
      const confirm = userMessage.trim().toLowerCase();
      
      if (confirm === "confirm") {
        try {
          // Create the transaction
          if (!pendingData.newTransaction) {
            throw new Error("Missing transaction data");
          }
          const transaction = await storage.createTransaction(pendingData.newTransaction);
          
          // Check if there are more cheques to process
          if (extractedCheques.length > currentChequeIndex + 1) {
            // Move to next cheque
            const nextChequeIndex = currentChequeIndex + 1;
            const nextCheque = extractedCheques[nextChequeIndex];
            
            return {
              response: `Transaction created successfully! Transaction ID: ${transaction.transaction_id}

Let's process the next cheque:

Cheque Number: ${nextCheque.chequeNumber || 'Not detected'}
Amount: ${nextCheque.amount || 'Not detected'}
Date: ${nextCheque.date || 'Not detected'}
Payee: ${nextCheque.payeeName || 'Not detected'}
Bank: ${nextCheque.bankName || 'Not detected'}

Is this information correct? Would you like to create a new transaction with this cheque?`,
              updatedState: {
                currentCommand: "process_cheque",
                step: "confirm_extraction",
                pendingData: {
                  extractedCheques,
                  currentChequeIndex: nextChequeIndex,
                  chequeNumber: nextCheque.chequeNumber,
                  amount: nextCheque.amount
                }
              }
            };
          }
          
          // No more cheques to process
          return {
            response: `Transaction created successfully! Transaction ID: ${transaction.transaction_id}

All cheques have been processed. Is there anything else you'd like to do?`,
            updatedState: {
              currentCommand: undefined,
              pendingData: undefined,
              step: undefined
            }
          };
        } catch (error) {
          console.error("Error creating transaction:", error);
          return {
            response: "There was an error creating the transaction. Please try again.",
            updatedState: state
          };
        }
      } else if (confirm === "cancel") {
        return {
          response: "Transaction cancelled. How can I help you?",
          updatedState: {
            currentCommand: undefined,
            pendingData: undefined,
            step: undefined
          }
        };
      } else {
        return {
          response: `Please type "confirm" to create the transaction or "cancel" to abort.`,
          updatedState: state
        };
      }
      
    default:
      return {
        response: "I'm not sure what we were doing. How can I help you?",
        updatedState: {
          currentCommand: undefined,
          pendingData: undefined,
          step: undefined
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
      response: "Let's create a new customer deposit. Please provide the customer name or ID (or type /cancel to cancel):",
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
      // Try to find customer by name or ID
      try {
        const customerInput = userMessage.trim();
        if (!customerInput) {
          return {
            response: "Please provide a customer name or ID:",
            updatedState: state
          };
        }
        
        const customer = await findCustomerByNameOrId(customerInput);
        if (!customer) {
          return {
            response: "Customer not found. Please provide a valid customer name or ID:",
            updatedState: state
          };
        }

        return {
          response: `Customer: ${customer.customer_name}. Now, please provide the deposit amount:`,
          updatedState: {
            ...state,
            pendingData: { ...state.pendingData, customerId: customer.customer_id },
            step: "askAmount"
          }
        };
      } catch (error) {
        console.error("Error finding customer:", error);
        return {
          response: "Error finding customer. Please try again with a valid customer name or ID:",
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
        let deposit;
        let customer;
        
        // Check if in test mode
        if (state.testMode) {
          // In test mode, create a mock deposit but don't save to database
          const customerId = state.pendingData?.customerId as number;
          customer = await storage.getCustomer(customerId);
          
          deposit = {
            deposit_id: Math.floor(1000 + Math.random() * 9000), // Random 4-digit ID
            customer_id: customerId,
            amount: amount.toFixed(2),
            date: new Date().toISOString().split('T')[0]
          };
          console.log("TEST MODE: Deposit simulated but not saved to database:", deposit);
        } else {
          // Normal mode - save to database
          deposit = await storage.createCustomerDeposit({
            customer_id: state.pendingData?.customerId as number,
            amount: amount.toFixed(2)
          });
          customer = await storage.getCustomer(deposit.customer_id);
        }
        
        // Format response with deposit details
        const responsePrefix = state.testMode ? "🧪 TEST MODE: " : "";
        const responseSuffix = state.testMode ? 
          "This is a simulated deposit and has NOT been saved to the database." : 
          "The deposit has been added to the database.";
        
        return {
          response: `${responsePrefix}Deposit successfully created for ${customer?.customer_name || 'Customer'}.
          
Amount: $${deposit.amount}
Date: ${new Date().toLocaleDateString()}

${responseSuffix}`,
          updatedState: {
            currentCommand: undefined,
            pendingData: undefined,
            step: undefined,
            testMode: state.testMode // Preserve test mode flag
          }
        };
      } catch (error) {
        console.error("Error creating deposit:", error);
        return {
          response: "Error creating the deposit. Please try again later.",
          updatedState: {
            currentCommand: undefined,
            pendingData: undefined,
            step: undefined,
            testMode: state.testMode // Preserve test mode flag
          }
        };
      }

    default:
      return {
        response: "Something went wrong with the deposit creation process. Let's start over. Please provide the customer name or ID:",
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
    // Check for cancel command first
    if (userMessage.trim().toLowerCase() === "/cancel" || userMessage.trim().toLowerCase() === "cancel") {
      // Preserve test mode flag if it exists
      const testMode = state.testMode;
      
      conversationStates[conversationId] = {
        currentCommand: undefined,
        pendingData: undefined,
        step: undefined,
        testMode // Preserve test mode flag
      };
      
      const cancelResponse = testMode ? 
        "🧪 TEST MODE: Command cancelled. How can I help you?" : 
        "Command cancelled. How can I help you?";
      
      // Save assistant message to conversation history
      await storage.saveAIMessage({
        user_id: 0,
        content: cancelResponse,
        role: "assistant",
        conversation_id: conversationId
      });
      
      return cancelResponse;
    }
    
    // Special handling for check_for_cheque command
    if (state.currentCommand === "check_for_cheque") {
      if (userMessage.trim().toLowerCase() === "yes") {
        // Extract the original image from the state
        const originalImage = state.pendingData?.originalImage;
        
        if (!originalImage) {
          // If no image data, reset state and ask for a new image
          // Preserve test mode flag if it exists
          const testMode = state.testMode;
          
          conversationStates[conversationId] = {
            currentCommand: undefined,
            pendingData: undefined,
            step: undefined,
            testMode // Preserve test mode flag
          };
          
          const errorResponse = "I couldn't find the original image data. Please upload a clear image of a bank cheque and try again.";
          
          // Save to conversation history
          await storage.saveAIMessage({
            user_id: 0,
            content: errorResponse,
            role: "assistant",
            conversation_id: conversationId
          });
          
          return errorResponse;
        }
        
        try {
          // Try again with a more lenient detection approach
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are an AI assistant focused on bank cheque detection.
                          The user has confirmed they're trying to upload a bank cheque image.
                          Look very carefully at the image for anything that resembles a bank cheque or check.
                          Even if the image is low quality, try to detect if there's a rectangular document with 
                          fields for amounts, dates, signature lines, bank information, etc.
                          
                          Return the response as a valid JSON object in the following format:
                          {
                            "isCheque": true/false,
                            "numberOfCheques": n,
                            "cheques": [
                              {
                                "chequeNumber": "string",
                                "amount": "string", 
                                "bankName": "string"
                              }
                            ],
                            "confidence": 0.0 to 1.0
                          }`
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "The user has confirmed this is a bank cheque image. Please look carefully and try to identify and extract information from any cheques in this image."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${originalImage}`
                    }
                  }
                ],
              },
            ],
            response_format: { type: "json_object" },
            max_tokens: 1000,
          });
      
          const result = response.choices[0].message.content;
          
          if (!result) {
            throw new Error("No response from image analysis");
          }
          
          const extractionResult = JSON.parse(result);
          
          // Check if cheque was detected on second attempt
          if (!extractionResult.isCheque || extractionResult.confidence < 0.3) {
            // Reset state and ask for a better image
            // Preserve test mode flag if it exists
            const testMode = state.testMode;
            
            conversationStates[conversationId] = {
              currentCommand: undefined,
              pendingData: undefined,
              step: undefined,
              testMode // Preserve test mode flag
            };
            
            const failureResponse = "I've tried my best but still can't detect a valid bank cheque in this image. Please upload a clearer image that shows the entire cheque, including the cheque number and amount fields.";
            
            // Save to conversation history
            await storage.saveAIMessage({
              user_id: 0,
              content: failureResponse,
              role: "assistant",
              conversation_id: conversationId
            });
            
            return failureResponse;
          }
          
          // Process the cheque as normal
          // Store the extracted cheque information in the conversation state
          const updatedState = { 
            pendingData: { 
              extractedCheques: extractionResult.cheques,
              currentChequeIndex: 0
            },
            currentCommand: "process_cheque",
            step: "confirm_extraction"
          };
          
          conversationStates[conversationId] = updatedState;
          
          // Format response for the first cheque
          const cheque = extractionResult.cheques[0];
          const successResponse = `On second look, I've found a cheque! Here's what I was able to extract:
          
Cheque Number: ${cheque.chequeNumber || 'Not detected'}
Amount: ${cheque.amount || 'Not detected'} 
Bank: ${cheque.bankName || 'Not detected'}

Please confirm if this information is correct:
1. Is the cheque number "${cheque.chequeNumber || 'Not detected'}" correct?
2. Is the amount "${cheque.amount || 'Not detected'}" correct?
3. Is the bank "${cheque.bankName || 'Not detected'}" correct?

After confirming, I can help you create a new transaction with this cheque.`;
          
          // Save the assistant's response to conversation history
          await storage.saveAIMessage({
            user_id: 0,
            content: successResponse,
            role: "assistant", 
            conversation_id: conversationId
          });
          
          return successResponse;
          
        } catch (error) {
          console.error("Error in second-attempt cheque analysis:", error);
          
          // Reset state and ask for a better image
          // Preserve test mode flag if it exists
          const testMode = state.testMode;
          
          conversationStates[conversationId] = {
            currentCommand: undefined,
            pendingData: undefined,
            step: undefined,
            testMode // Preserve test mode flag
          };
          
          const errorResponse = "I'm having trouble analyzing this image. Please upload a clearer image of a bank cheque, making sure the cheque number and amount are clearly visible.";
          
          // Save to conversation history
          await storage.saveAIMessage({
            user_id: 0,
            content: errorResponse,
            role: "assistant",
            conversation_id: conversationId
          });
          
          return errorResponse;
        }
      } else {
        // User said it's not a cheque, reset state
        // Preserve test mode flag if it exists
        const testMode = state.testMode;
          
        conversationStates[conversationId] = {
          currentCommand: undefined,
          pendingData: undefined,
          step: undefined,
          testMode // Preserve test mode flag
        };
        
        const notChequeResponse = "I understand. Please upload a clear image of a bank cheque to process it.";
        
        // Save to conversation history
        await storage.saveAIMessage({
          user_id: 0,
          content: notChequeResponse,
          role: "assistant",
          conversation_id: conversationId
        });
        
        return notChequeResponse;
      }
    }
    
    // For other commands, use switch statement
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

      case "process_cheque":
        const chequeResult = await handleChequeProcessingCommand(userMessage, conversationId, state);
        response = chequeResult.response;
        updatedState = chequeResult.updatedState;
        break;
        
      // Add other command handlers here
      
      default:
        response = "I'm not sure what we were doing. How can I help you?";
        updatedState = {
          currentCommand: undefined,
          pendingData: undefined,
          step: undefined,
          testMode: state.testMode // Preserve test mode flag
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
  
  // Test mode command
  if (trimmedMessage === "/test") {
    // Set test mode flag for this conversation
    if (!conversationStates[conversationId]) {
      conversationStates[conversationId] = {};
    }
    conversationStates[conversationId].testMode = true;
    
    const testModeMessage = `
🧪 Test mode activated 🧪

You are now in test mode. All commands and interactions will function normally, but:
- No transactions will be saved to the database
- No records will be modified
- No deposits will be processed

This mode is designed for testing features without affecting real data.
Use /exit-test to return to normal mode.
`;
    
    // Save assistant message to conversation history
    await storage.saveAIMessage({
      user_id: 0,
      content: testModeMessage,
      role: "assistant",
      conversation_id: conversationId
    });
    
    return testModeMessage;
  }
  
  // Exit test mode command
  if (trimmedMessage === "/exit-test") {
    // Turn off test mode flag for this conversation
    if (conversationStates[conversationId] && conversationStates[conversationId].testMode) {
      conversationStates[conversationId].testMode = false;
      
      const exitTestModeMessage = `
✅ Test mode deactivated

You have exited test mode. All commands will now perform real actions on the database.
`;
      
      // Save assistant message to conversation history
      await storage.saveAIMessage({
        user_id: 0,
        content: exitTestModeMessage,
        role: "assistant",
        conversation_id: conversationId
      });
      
      return exitTestModeMessage;
    }
    
    return "You are not currently in test mode.";
  }
  
  if (trimmedMessage === "/new transaction") {
    // Preserve test mode flag if it exists
    const testMode = conversationStates[conversationId]?.testMode;
    
    conversationStates[conversationId] = {
      currentCommand: "/new transaction",
      pendingData: {},
      step: "askCustomerId",
      testMode // Preserve test mode flag
    };
    
    let response = "Let's create a new transaction. Please provide the customer name or ID (or type /cancel to cancel):";
    
    // Add note if in test mode
    if (testMode) {
      response = "🧪 TEST MODE: " + response + "\n(No actual database changes will be made)";
    }
    
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
    // Preserve test mode flag if it exists
    const testMode = conversationStates[conversationId]?.testMode;
    
    conversationStates[conversationId] = {
      currentCommand: "/deposit",
      pendingData: {},
      step: "askCustomerId",
      testMode // Preserve test mode flag
    };
    
    let response = "Let's create a new customer deposit. Please provide the customer name or ID (or type /cancel to cancel):";
    
    // Add note if in test mode
    if (testMode) {
      response = "🧪 TEST MODE: " + response + "\n(No actual database changes will be made)";
    }
    
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
    // Preserve test mode flag if it exists
    const testMode = conversationStates[conversationId]?.testMode;
    
    conversationStates[conversationId] = {
      currentCommand: "/modify transaction",
      pendingData: {},
      step: "askTransactionId",
      testMode // Preserve test mode flag
    };
    
    let response = "Let's modify a transaction. Please provide the transaction ID or cheque number (or type /cancel to cancel):";
    
    // Add note if in test mode
    if (testMode) {
      response = "🧪 TEST MODE: " + response + "\n(No actual database changes will be made)";
    }
    
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
    
    // Preserve test mode flag if it exists
    const testMode = conversationStates[conversationId]?.testMode;
    
    conversationStates[conversationId] = {
      currentCommand: "/new transaction",
      pendingData: {},
      step: "askCustomerId",
      testMode // Preserve test mode flag
    };
    
    let response = "Let's create a new transaction. Please provide the customer name or ID (or type /cancel to cancel):";
    
    // Add note if in test mode
    if (testMode) {
      response = "🧪 TEST MODE: " + response + "\n(No actual database changes will be made)";
    }
    
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
    
    // Preserve test mode flag if it exists
    const testMode = conversationStates[conversationId]?.testMode;
    
    conversationStates[conversationId] = {
      currentCommand: "/deposit",
      pendingData: {},
      step: "askCustomerId",
      testMode // Preserve test mode flag
    };
    
    let response = "Let's create a new customer deposit. Please provide the customer name or ID (or type /cancel to cancel):";
    
    // Add note if in test mode
    if (testMode) {
      response = "🧪 TEST MODE: " + response + "\n(No actual database changes will be made)";
    }
    
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
    
    // Check if this is specifically asking for all transactions
    const isAllTransactionsQuery = /all\s+transactions|show\s+(\w+\s+)?transactions|list\s+(\w+\s+)?transactions|recent\s+transactions/i.test(userMessage);
    
    if (isDataQuery) {
      // Fetch relevant data to enhance the response
      try {
        const businessSummary = await storage.getBusinessSummary();
        
        // Get transactions based on the specific type of query
        let limit = 5; // Default limit
        let customData = null;
        
        if (isAllTransactionsQuery) {
          // If asking for all transactions, fetch a larger number
          limit = 50; // Increased to ensure we get more complete transaction data
        }
        
        // Get the appropriate data for the query
        if (/balance/i.test(userMessage)) {
          // For balance queries, include customer balance report
          try {
            customData = await storage.getReportData("customer_balances");
          } catch (error) {
            console.error("Error getting customer balances:", error);
          }
        } else if (/profit/i.test(userMessage)) {
          // For profit queries, include profit by customer report
          try {
            customData = await storage.getReportData("profit_by_customer");
          } catch (error) {
            console.error("Error getting profit by customer:", error);
          }
        }
        
        // Get transactions
        const recentTransactions = await storage.getTransactions({ limit });
        
        // Build the system message with all relevant data
        let systemContent = `Here is some recent data to help with your response:
                    Business Summary: ${JSON.stringify(businessSummary)}
                    ${isAllTransactionsQuery ? 'All' : 'Recent'} Transactions: ${JSON.stringify(recentTransactions)}`;
                    
        // Add any custom report data if available
        if (customData && customData.length > 0) {
          systemContent += `\n\nAdditional Report Data: ${JSON.stringify(customData)}`;
        }
        
        // Add instructions for formatting
        systemContent += `\n\nWhen showing transactions in your response, format them in a clear, readable way.
                    The database has a total of ${businessSummary.totalTransactions} transactions.
                    If the user asks about specific data that's not provided, let them know what you can find 
                    from the information available.`;
        
        // Add data context to system message
        messages.unshift({
          role: "system",
          content: systemContent
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
 * Process a cheque image or PDF and handle the transaction flow
 * @param fileBuffer The file buffer of the image or PDF
 * @param fileType The MIME type of the file ('image/jpeg', 'image/png', 'application/pdf', etc.)
 * @param conversationId The conversation ID for context
 * @returns AI-generated response about the cheque(s) found
 */
export async function processChequeDocument(
  fileBuffer: Buffer, 
  fileType: string, 
  conversationId: string
): Promise<string> {
  try {
    // Save a copy of the file for processing
    const fileExtension = fileType.split('/')[1] || 'bin';
    const tempFilePath = path.join(os.tmpdir(), `cheque-${Date.now()}.${fileExtension}`);
    fs.writeFileSync(tempFilePath, fileBuffer);
    
    try {
      // Convert buffer to base64
      const base64Data = fileBuffer.toString('base64');
      
      // Process the image to extract cheque information
      const extractionResult = await processImage(base64Data);
      
      // Save the image message to conversation history
      await storage.saveAIMessage({
        user_id: 0,
        content: "[User uploaded an image of cheque(s)]",
        role: "user",
        conversation_id: conversationId
      });
      
      // Check if the image contains cheques
      if (!extractionResult.isCheque) {
        const response = "I don't see any bank cheques in the image. Were you trying to upload a cheque image? If yes, please reply 'yes' and I'll try again with a different detection method. Otherwise, please upload a clear image of a bank cheque.";
        
        // Save the assistant's response to conversation history
        await storage.saveAIMessage({
          user_id: 0,
          content: response,
          role: "assistant",
          conversation_id: conversationId
        });
        
        // Set the state to wait for user confirmation
        const state = conversationStates[conversationId] || {};
        state.currentCommand = "check_for_cheque";
        state.pendingData = { originalImage: base64Data };
        conversationStates[conversationId] = state;
        
        return response;
      }
      
      // Check confidence level
      if (extractionResult.confidence < 0.5) {
        const response = "I can see what appears to be a cheque, but the image quality is too low for me to accurately extract the details. Please upload a clearer, well-lit image of the cheque. Make sure the cheque number and amount are clearly visible in the image.";
        
        // Save the assistant's response to conversation history
        await storage.saveAIMessage({
          user_id: 0,
          content: response,
          role: "assistant",
          conversation_id: conversationId
        });
        
        return response;
      }
      
      // Store the extracted cheque information in the conversation state
      const state = conversationStates[conversationId] || { pendingData: {} };
      if (!state.pendingData) state.pendingData = {};
      
      state.pendingData.extractedCheques = extractionResult.cheques;
      state.pendingData.currentChequeIndex = 0;
      state.currentCommand = "process_cheque";
      state.step = "confirm_extraction";
      conversationStates[conversationId] = state;
      
      let response = '';
      
      // Format the response for a single cheque
      if (extractionResult.numberOfCheques === 1) {
        const cheque = extractionResult.cheques[0];
        
        // Save initial information to state
        state.pendingData = {
          ...state.pendingData,
          chequeNumber: cheque.chequeNumber,
          amount: cheque.amount
        };
        
        response = `I've found a cheque in your image! Here's what I extracted:
        
Cheque Number: ${cheque.chequeNumber || 'Not detected'}
Amount: ${cheque.amount || 'Not detected'}
Bank: ${cheque.bankName || 'Not detected'}

Please confirm if this information is correct:
1. Is the cheque number "${cheque.chequeNumber || 'Not detected'}" correct?
2. Is the amount "${cheque.amount || 'Not detected'}" correct?
3. Is the bank "${cheque.bankName || 'Not detected'}" correct?

After confirming, I can help you create a new transaction with this cheque.`;
      } 
      // Format the response for multiple cheques
      else {
        const firstCheque = extractionResult.cheques[0];
        
        // Save initial information to state for the first cheque
        state.pendingData = {
          ...state.pendingData,
          chequeNumber: firstCheque.chequeNumber,
          amount: firstCheque.amount
        };
        
        response = `I've found ${extractionResult.numberOfCheques} cheques in your image! Let's process them one by one.\n\nHere's the first cheque:\n\n`;
        response += `Cheque Number: ${firstCheque.chequeNumber || 'Not detected'}\n`;
        response += `Amount: ${firstCheque.amount || 'Not detected'}\n`;
        response += `Bank: ${firstCheque.bankName || 'Not detected'}\n\n`;
        response += `Please confirm if this information is correct:\n`;
        response += `1. Is the cheque number "${firstCheque.chequeNumber || 'Not detected'}" correct?\n`;
        response += `2. Is the amount "${firstCheque.amount || 'Not detected'}" correct?\n`;
        response += `3. Is the bank "${firstCheque.bankName || 'Not detected'}" correct?\n\n`;
        response += `After confirming, I can help you create a new transaction with this cheque.`;
      }
      
      // Save the assistant's response to conversation history
      await storage.saveAIMessage({
        user_id: 0,
        content: response,
        role: "assistant",
        conversation_id: conversationId
      });
      
      return response;
    } finally {
      // Clean up the temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  } catch (error) {
    console.error("Error processing cheque document:", error);
    
    const errorResponse = "I had trouble processing your document. Please make sure it's a clear image of a bank cheque and try again.";
    
    // Save the error response to conversation history
    await storage.saveAIMessage({
      user_id: 0,
      content: errorResponse,
      role: "assistant",
      conversation_id: conversationId
    });
    
    return errorResponse;
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
                    First, determine if the image contains one or more bank cheques. If the image clearly doesn't contain bank cheques, respond with {"isCheque": false}.

                    If the image contains cheques, identify each distinct cheque in the image.
                    For each cheque identified, extract the following information:
                    - chequeNumber: the cheque number
                    - amount: the dollar amount
                    - date: the date on the cheque
                    - payeeName: the name of the payee (recipient)
                    - bankName: the bank name if visible
                    
                    Return the response as a valid JSON object in the following format:
                    {
                      "isCheque": true,
                      "numberOfCheques": n,
                      "cheques": [
                        {
                          "chequeNumber": "string",
                          "amount": "string",
                          "date": "string",
                          "payeeName": "string",
                          "bankName": "string"
                        },
                        ...
                      ],
                      "confidence": 0.0 to 1.0
                    }
                    
                    Set the confidence score based on the clarity of the image and your certainty of the extracted information.
                    If the image is too blurry or unclear to extract reliable information, set confidence to below 0.5.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and determine if it contains bank cheques. If so, extract the detailed information from each cheque."
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
      max_tokens: 1000,
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
