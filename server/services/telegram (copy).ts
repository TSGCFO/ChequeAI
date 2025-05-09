import TelegramBot from "node-telegram-bot-api";
import { generateAIResponse, processVoiceMessage, processChequeDocument } from "./openai";

// Telegram bot token from environment variables
const telegramToken = process.env.TELEGRAM_BOT_TOKEN || "";

// Initialize the bot
let bot: TelegramBot | null = null;

// Check if we're in a deployed environment
// This checks both Replit's deployment flag and if we're running on a production server
const isDeployedEnvironment = process.env.REPLIT_DEPLOYMENT === 'true' || 
                             process.env.NODE_ENV === 'production';

// Check if we should run the Telegram bot
// IMPORTANT: In development, we keep it disabled by default to prevent polling conflicts
// In production, we enable it by default unless explicitly disabled
const shouldRunTelegramBot = telegramToken && 
  (isDeployedEnvironment || process.env.ENABLE_TELEGRAM_BOT === 'true') && 
  process.env.DISABLE_TELEGRAM_BOT !== 'true';

// Try to initialize the bot if token is available and we should run it
if (shouldRunTelegramBot) {
  try {
    console.log("Initializing Telegram bot");
    
    if (isDeployedEnvironment) {
      console.log("Starting Telegram bot in deployed environment");
      // In production, use webhook mode if a webhook URL is provided
      const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
      
      if (webhookUrl) {
        console.log(`Setting up Telegram bot with webhook: ${webhookUrl}`);
        bot = new TelegramBot(telegramToken, { polling: false });
        // Set webhook
        bot.setWebHook(webhookUrl).then(() => {
          console.log('Webhook set successfully');
        }).catch(err => {
          console.error('Failed to set webhook:', err);
          // Fall back to simple polling if webhook fails
          console.log('Webhook setup failed, falling back to simple polling');
          bot = new TelegramBot(telegramToken, { polling: true });
        });
      } else {
        // No webhook URL, use simple polling
        console.log('Using simple polling in production');
        bot = new TelegramBot(telegramToken, { polling: true });
      }
    } else {
      // In development, use simple polling
      console.log('Starting Telegram bot in development mode');
      bot = new TelegramBot(telegramToken, { polling: true });
    }
    setupBot();
  } catch (error) {
    console.error("Error initializing Telegram bot:", error);
  }
} else {
  if (!telegramToken) {
    console.log("Telegram bot token not found. Bot functionality disabled.");
  } else if (!isDeployedEnvironment && process.env.ENABLE_TELEGRAM_BOT !== 'true') {
    console.log("Telegram bot disabled in development mode to prevent polling conflicts. Set ENABLE_TELEGRAM_BOT=true to enable it for testing.");
  } else {
    console.log("Telegram bot disabled by DISABLE_TELEGRAM_BOT environment variable.");
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
    if (bot) {
      bot.sendMessage(
        chatId,
        "Welcome to Cheque Ledger Pro! I'm your AI assistant. You can ask me about your transactions, customers, vendors, and more.\n\nYou can use both slash commands like \"/modify transaction\" or natural language like \"modify the amount of cheque 12345\".\n\nType /help to see all available commands and examples."
      );
    }
  });
  
  // Help command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    if (bot) {
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
    }
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
      if (!bot) return;
      
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
      }
      // Handle photo messages (cheque images)
      else if (msg.photo && msg.photo.length > 0) {
        // Notify user that we're processing their image
        await bot.sendMessage(chatId, "Processing your cheque image...");
        
        try {
          // Get the largest photo (last in the array)
          const photo = msg.photo[msg.photo.length - 1];
          const fileInfo = await bot.getFile(photo.file_id);
          
          // Get the file path from Telegram servers
          const fileUrl = `https://api.telegram.org/file/bot${telegramToken}/${fileInfo.file_path}`;
          
          // Download the image
          const imageResponse = await fetch(fileUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.statusText}`);
          }
          
          // Convert to buffer
          const imageBuffer = await imageResponse.arrayBuffer();
          
          // Process the image (detect and extract cheque information)
          response = await processChequeDocument(
            Buffer.from(imageBuffer), 
            'image/jpeg', // Telegram usually provides JPEGs for photos
            conversationId
          );
        } catch (imageError) {
          console.error("Error processing image:", imageError);
          response = "Sorry, I had trouble processing your image. Please ensure it contains a clear picture of a cheque and try again.";
        }
      }
      // Handle document messages (could be PDF scans of cheques)
      else if (msg.document) {
        // Only process documents with appropriate mime types
        const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
        const mimeType = msg.document.mime_type || '';
        
        if (!allowedMimeTypes.includes(mimeType)) {
          response = "I can only process PDF, JPEG, PNG, or TIFF documents containing cheque images. Please upload a supported file format.";
        } else {
          // Notify user that we're processing their document
          await bot.sendMessage(chatId, "Processing your document...");
          
          try {
            // Get the file info
            const fileInfo = await bot.getFile(msg.document.file_id);
            
            // Get the file path from Telegram servers
            const fileUrl = `https://api.telegram.org/file/bot${telegramToken}/${fileInfo.file_path}`;
            
            // Download the document
            const docResponse = await fetch(fileUrl);
            if (!docResponse.ok) {
              throw new Error(`Failed to download document: ${docResponse.statusText}`);
            }
            
            // Convert to buffer
            const docBuffer = await docResponse.arrayBuffer();
            
            // Process the document (detect and extract cheque information)
            response = await processChequeDocument(
              Buffer.from(docBuffer),
              mimeType,
              conversationId
            );
          } catch (docError) {
            console.error("Error processing document:", docError);
            response = "Sorry, I had trouble processing your document. Please ensure it contains a clear scan of a cheque and try again.";
          }
        }
      } else {
        // For other types of messages
        response = "I can only understand text, voice messages, and cheque images/scans. Please send your query in one of these formats.";
      }
      
      // Send response
      bot.sendMessage(chatId, response);
    } catch (error) {
      console.error("Error generating response for Telegram:", error);
      if (bot) {
        bot.sendMessage(
          chatId,
          "Sorry, I encountered an error processing your request. Please try again later."
        );
      }
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