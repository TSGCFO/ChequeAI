import TelegramBot from "node-telegram-bot-api";
import { generateAIResponse } from "./openai";

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
      "Welcome to Cheque Ledger Pro! I'm your AI assistant. You can ask me about your transactions, customers, vendors, and more.\n\nType /help to see available commands."
    );
  });
  
  // Help command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      "Available commands:\n" +
      "/start - Start the bot\n" +
      "/help - Show this help message\n" +
      "/summary - Get a business summary\n" +
      "/transactions - Get recent transactions\n\n" +
      "You can also ask questions in natural language like:\n" +
      "- \"Show me transactions for Atlas Construction\"\n" +
      "- \"What's my profit this month?\"\n" +
      "- \"Calculate fee for a $5000 cheque with Atlas Construction\""
    );
  });
  
  // Handle all text messages (excluding commands)
  bot.on("message", async (msg) => {
    // Skip command messages
    if (msg.text && msg.text.startsWith("/")) return;
    
    // Skip non-text messages
    if (!msg.text) return;
    
    const chatId = msg.chat.id;
    
    try {
      // Show typing indicator
      bot.sendChatAction(chatId, "typing");
      
      // Generate response using OpenAI
      const conversationId = `telegram-${chatId}`;
      const response = await generateAIResponse(msg.text, conversationId);
      
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
