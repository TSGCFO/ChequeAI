import OpenAI from "openai";
import { storage } from "../storage";

// Initialize OpenAI with the API key from environment variables
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || ""
});

/**
 * Generates an AI response based on user input and context
 * @param userMessage The message from the user
 * @param conversationId The ID of the conversation for context
 * @returns Promise with the AI-generated response
 */
export async function generateAIResponse(userMessage: string, conversationId: string): Promise<string> {
  try {
    // Get conversation history for context
    const conversationHistory = await storage.getAIConversationHistory(conversationId);
    
    // Build messages array for OpenAI with conversation history
    const messages = [
      {
        role: "system",
        content: `You are an AI assistant for a cheque cashing business ledger management system called 'Cheque Ledger Pro'. 
                  You can help users with:
                  1. Creating, finding, and analyzing transactions
                  2. Generating reports on customer and vendor activity
                  3. Calculating fees and profits
                  4. Explaining business processes
                  
                  You have access to transaction data, customers, and vendors. Be helpful, concise, and professional.
                  If the user asks to perform an action like creating a transaction or processing a document, 
                  guide them on how to use the appropriate interface feature.
                  
                  For numerical values, always format currency with a dollar sign and two decimal places.`
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
    
    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
    
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
