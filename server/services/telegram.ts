import TelegramBot from "node-telegram-bot-api";
import { generateAIResponse, processVoiceMessage } from "./openai";

// Telegram bot token from environment variables
const telegramToken = process.env.TELEGRAM_BOT_TOKEN || "";

// Initialize the bot
let bot: TelegramBot | null = null;

// Try to initialize the bot if token is available
if (telegramToken) {
  try {
    bot = new TelegramBot(telegramToken, { polling: true });
    setupBot();
  } catch (error) {
    console.error("Error initializing Telegram bot:", error);
  }
}

/**
 * Set up message handlers for the Telegram bot
 */
function setupBot() {
  if (!bot) return;
  
  // Welcome message for new users
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      "Welcome to Cheque Ledger Pro! I'm your AI assistant. You can ask me about your transactions, customers, vendors, and more.\n\nYou can use both slash commands like \"/modify transaction\" or natural language like \"modify the amount of cheque 12345\".\n\nType /help to see all available commands and examples."
    );
  });
  
  // Help command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      "I'm your AI assistant for Cheque Ledger Pro. You can use both slash commands and natural language.\n\n" +
      "Available commands:\n" +
      "/start - Start the bot\n" +
      "/help - Show this help message\n" +
      "/new transaction - Create a new transaction\n" +
      "/deposit - Create a new customer deposit\n" +
      "/modify transaction - Modify an existing transaction\n" +
      "/find transaction - Find transaction details\n" +
      "/summary - Get a business summary\n\n" +
      "You can also use natural language like:\n" +
      "- \"create a new transaction\"\n" +
      "- \"make a new deposit\"\n" +
      "- \"modify cheque number 00010572\"\n" +
      "- \"change the amount of cheque 12345\"\n" +
      "- \"what's my business summary?\"\n\n" +
      "For general questions, just ask about transactions, customers, vendors, or business metrics."
    );
  });
  
  // Special handlers for specific commands
  bot.onText(/^\/(start|help)$/, (msg) => {
    // Don't do anything here, as these commands are handled by specific handlers above
  });

  // Handle all other text messages, including other commands
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    
    // Skip start and help commands (they have specific handlers)
    if (msg.text === "/start" || msg.text === "/help") return;
    
    try {
      // Show typing indicator
      bot.sendChatAction(chatId, "typing");
      
      const conversationId = `telegram-${chatId}`;
      let response: string;
      
      // Handle text messages
      if (msg.text) {
        // Generate response using OpenAI
        response = await generateAIResponse(msg.text, conversationId);
      }
      // Handle voice messages
      else if (msg.voice) {
        // Notify user that we're processing their voice message
        await bot.sendMessage(chatId, "Processing your voice message...");
        
        try {
          // Get the file info
          const fileInfo = await bot.getFile(msg.voice.file_id);
          
          // Get the file path from Telegram servers
          const fileUrl = `https://api.telegram.org/file/bot${telegramToken}/${fileInfo.file_path}`;
          
          // Download the voice message
          const audioResponse = await fetch(fileUrl);
          if (!audioResponse.ok) {
            throw new Error(`Failed to download voice file: ${audioResponse.statusText}`);
          }
          
          // Convert to buffer
          const audioBuffer = await audioResponse.arrayBuffer();
          
          // Process the voice message
          response = await processVoiceMessage(Buffer.from(audioBuffer), conversationId);
        } catch (voiceError) {
          console.error("Error processing voice message:", voiceError);
          response = "Sorry, I had trouble processing your voice message. Could you please try sending it as text instead?";
        }
      } else {
        // For other types of messages (photos, documents, etc.)
        response = "I can only understand text and voice messages. Please send your query as text or voice.";
      }
      
      // Send response
      bot.sendMessage(chatId, response);
    } catch (error) {
      console.error("Error generating response for Telegram:", error);
      bot.sendMessage(
        chatId,
        "Sorry, I encountered an error processing your request. Please try again later."
      );
    }
  });
  
  console.log("Telegram bot initialized successfully");
}

/**
 * Send a message to a specific Telegram chat
 * @param chatId The ID of the chat to send the message to
 * @param message The message to send
 * @returns Object indicating success or failure
 */
export async function sendTelegramMessage(chatId: string, message: string) {
  if (!bot) {
    return { success: false, error: "Telegram bot not initialized" };
  }
  
  try {
    await bot.sendMessage(chatId, message);
    return { success: true };
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return { success: false, error: "Failed to send message" };
  }
}
