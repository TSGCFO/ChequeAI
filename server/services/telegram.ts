import TelegramBot from "node-telegram-bot-api";
import { generateAIResponse, processVoiceMessage, processChequeDocument } from "./openai";
import { storage } from "../storage";

// Telegram bot token from environment variables
const telegramToken = process.env.TELEGRAM_BOT_TOKEN || "";

// Initialize the bot
let bot: TelegramBot | null = null;

// Max number of reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 10;
// Current reconnection attempt counter
let reconnectAttempts = 0;
// Reconnection delay in ms (starts at 5 seconds, doubles each time)
let reconnectDelay = 5000;
// Flag to track if we're in the middle of a reconnection
let isReconnecting = false;

// Check if we're in a deployed environment
// This checks both Replit's deployment flag and if we're running on a production server
const isDeployedEnvironment = process.env.REPLIT_DEPLOYMENT === 'true' || 
                             process.env.NODE_ENV === 'production';

// Check if we should run the Telegram bot
// Always enable the Telegram bot if a token is available
const shouldRunTelegramBot = telegramToken && 
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
          bot = new TelegramBot(telegramToken, {
            polling: true,
            // Add error handling for polling
            onlyFirstMatch: true
          });
          
          // Register error handler for polling errors
          bot.on('polling_error', (error) => {
            console.error('Telegram polling error:', error);
            
            // Attempt to reconnect
            if (!isReconnecting) {
              reconnectBot();
            }
          });
        });
      } else {
        // No webhook URL, use simple polling
        console.log('Using simple polling in production');
        bot = new TelegramBot(telegramToken, {
          polling: true,
          // Add error handling for polling
          onlyFirstMatch: true
        });
        
        // Register error handler for polling errors
        bot.on('polling_error', (error) => {
          console.error('Telegram polling error:', error);
          
          // Attempt to reconnect
          if (!isReconnecting) {
            reconnectBot();
          }
        });
      }
    } else {
      // In development, use simple polling
      console.log('Starting Telegram bot in development mode');
      bot = new TelegramBot(telegramToken, {
        polling: true,
        // Add error handling for polling
        onlyFirstMatch: true
      });
      
      // Register error handler for polling errors
      bot.on('polling_error', (error) => {
        console.error('Telegram polling error:', error);
        
        // Attempt to reconnect
        if (!isReconnecting) {
          reconnectBot();
        }
      });
    }
    setupBot();
    
    // Add process exit handlers to gracefully close the bot
    process.on('SIGINT', () => {
      console.log('SIGINT received, closing Telegram bot');
      if (bot) {
        bot.close();
      }
    });
    
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, closing Telegram bot');
      if (bot) {
        bot.close();
      }
    });
    
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
// Track login state per chat
const loginStates: Map<string, {
  state: 'need_username' | 'need_password' | 'authenticated';
  username?: string;
  userId?: number;
}> = new Map();

// Check if a user is authenticated with the Telegram bot
async function isAuthenticated(chatId: string): Promise<boolean> {
  try {
    // Check for authentication state in memory first
    const loginState = loginStates.get(chatId);
    if (loginState && loginState.state === 'authenticated') {
      return true;
    }
    
    // Check if we already have a telegram user with this chat ID
    const telegramUser = await storage.getTelegramUserByChatId(chatId);
    if (telegramUser) {
      // User exists in database, update last active timestamp
      await storage.updateTelegramUserLastActive(chatId);
      
      // Set login state in memory for faster future checks
      loginStates.set(chatId, { 
        state: 'authenticated',
        username: telegramUser.username || '',
        userId: telegramUser.user_id  // Use the linked web user ID
      });
      
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error checking Telegram user authentication:", error);
    return false;
  }
}

// Process authentication for Telegram users
async function processAuthentication(chatId: string, text: string): Promise<string> {
  // Check if we're in the middle of authentication
  let state = loginStates.get(chatId);
  
  if (!state) {
    // If no state exists, start authentication process
    loginStates.set(chatId, { state: 'need_username' });
    return "Please enter your username to login:";
  }
  
  if (state.state === 'need_username') {
    // Process username
    const username = text.trim();
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      return "Username not found. Please enter a valid username:";
    }
    
    // Update state
    loginStates.set(chatId, { 
      state: 'need_password', 
      username: username
    });
    
    return "Please enter your password:";
  }
  
  if (state.state === 'need_password' && state.username) {
    // Process password
    const password = text.trim();
    
    // Import auth functions for password verification
    const { comparePasswords } = await import('../auth');
    
    // Get user
    const user = await storage.getUserByUsername(state.username);
    if (!user) {
      loginStates.delete(chatId);
      return "Authentication failed. Please try again. Type /login to start the process.";
    }
    
    // Check password
    const passwordMatch = await comparePasswords(password, user.password);
    if (!passwordMatch) {
      return "Incorrect password. Please try again:";
    }
    
    // Password match, create telegram user record
    try {
      await storage.createTelegramUser({
        telegram_id: parseInt(chatId),
        user_id: user.user_id,  // Link to web user
        username: user.username,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      });
      
      // Update state to authenticated
      loginStates.set(chatId, { 
        state: 'authenticated',
        username: state.username,
        userId: user.user_id
      });
      
      return `Authentication successful! Welcome ${user.first_name || user.username}. You can now use all bot commands.`;
    } catch (error) {
      console.error("Error creating telegram user:", error);
      return "Failed to complete authentication. Please try again later.";
    }
  }
  
  return "Authentication error. Please try again. Type /login to start the process.";
}

function setupBot() {
  if (!bot) return;
  
  // Welcome message for new users
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id.toString();
    if (bot) {
      const authenticated = await isAuthenticated(chatId);
      
      let welcomeMessage = "Welcome to Cheque Ledger Pro! I'm your AI assistant.";
      
      if (!authenticated) {
        welcomeMessage += " You need to login first to use this bot. Type /login to authenticate.";
      } else {
        welcomeMessage += " You're already authenticated and can use all features!\n\nYou can use both slash commands like \"/modify transaction\" or natural language like \"modify the amount of cheque 12345\".\n\nType /help to see all available commands and examples.";
      }
      
      bot.sendMessage(chatId, welcomeMessage);
    }
  });
  
  // Login command
  bot.onText(/\/login/, async (msg) => {
    const chatId = msg.chat.id.toString();
    if (bot) {
      const authenticated = await isAuthenticated(chatId);
      
      if (authenticated) {
        bot.sendMessage(chatId, "You're already logged in!");
      } else {
        // Start login process
        loginStates.set(chatId, { state: 'need_username' });
        bot.sendMessage(chatId, "Please enter your username:");
      }
    }
  });
  
  // Help command
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id.toString();
    if (bot) {
      const authenticated = await isAuthenticated(chatId);
      
      if (!authenticated) {
        bot.sendMessage(
          chatId,
          "You need to login first to use all features. Type /login to authenticate."
        );
        return;
      }
      
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
  bot.onText(/^\/(start|help|login)$/, (msg) => {
    // Don't do anything here, as these commands are handled by specific handlers above
  });

  // Handle all other text messages, including other commands
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id.toString();
    
    // Skip start, help, and login commands (they have specific handlers)
    if (msg.text === "/start" || msg.text === "/help" || msg.text === "/login") return;
    
    try {
      if (!bot) return;
      
      // Show typing indicator
      bot.sendChatAction(chatId, "typing");
      
      // Check authentication
      const authenticated = await isAuthenticated(chatId);
      
      // Check if user is in the login process
      const loginState = loginStates.get(chatId);
      if (loginState && loginState.state !== 'authenticated') {
        if (msg.text) {
          const response = await processAuthentication(chatId, msg.text);
          bot.sendMessage(chatId, response);
        }
        return;
      }
      
      // Require authentication for all other commands
      if (!authenticated) {
        bot.sendMessage(
          chatId,
          "You need to login first to use this feature. Type /login to authenticate."
        );
        return;
      }
      
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
 * Handle webhook updates from Telegram
 * @param update The update object from Telegram webhook
 */
export function handleWebhookUpdate(update: any) {
  if (!bot) {
    console.error("Cannot handle webhook update: Telegram bot not initialized");
    return;
  }
  
  try {
    // Process the update manually
    bot.processUpdate(update);
  } catch (error) {
    console.error("Error processing webhook update:", error);
  }
}

/**
 * Attempts to reconnect the telegram bot
 */
function reconnectBot() {
  if (isReconnecting || !shouldRunTelegramBot || !telegramToken) {
    return;
  }

  isReconnecting = true;
  console.log(`Attempting to reconnect Telegram bot (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`);

  setTimeout(() => {
    try {
      if (bot) {
        // Clean up existing bot
        bot.close();
      }

      // Create a new bot instance with polling
      bot = new TelegramBot(telegramToken, { 
        polling: true,
        onlyFirstMatch: true 
      });
      
      // Set up the handlers again
      setupBot();
      
      console.log("Telegram bot reconnected successfully");
      
      // Reset reconnect counter on success
      reconnectAttempts = 0;
      reconnectDelay = 5000; // Reset to initial delay
      isReconnecting = false;
    } catch (error) {
      console.error("Failed to reconnect Telegram bot:", error);
      
      reconnectAttempts++;
      
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        // Exponential backoff
        reconnectDelay *= 2;
        isReconnecting = false;
        reconnectBot();
      } else {
        console.error(`Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
        isReconnecting = false;
      }
    }
  }, reconnectDelay);
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
    
    // Check if this is a connection error and try to reconnect
    if (error instanceof Error && 
        (error.message.includes('ETELEGRAM') || 
         error.message.includes('ENOTFOUND') || 
         error.message.includes('ETIMEDOUT'))) {
      reconnectBot();
    }
    
    return { success: false, error: "Failed to send message" };
  }
}