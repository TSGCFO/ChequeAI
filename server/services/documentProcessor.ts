import Tesseract from 'tesseract.js';
import { processImage } from './openai';

interface ExtractOptions {
  extractChequeNumber: boolean;
  extractAmount: boolean;
  extractDate: boolean;
  autoAssignCustomer: boolean;
}

interface ProcessResult {
  success: boolean;
  data?: {
    chequeNumber?: string;
    amount?: string;
    date?: string;
    payeeName?: string;
    bankName?: string;
  };
  rawText?: string;
  error?: string;
}

/**
 * Process a document to extract cheque information
 * @param fileBuffer The document file buffer
 * @param options Extraction options
 * @returns Extracted information from the document
 */
export async function processDocument(
  fileBuffer: Buffer,
  options: ExtractOptions
): Promise<ProcessResult> {
  try {
    // Convert buffer to base64
    const base64Image = fileBuffer.toString('base64');
    
    // First try OpenAI vision model for more accurate extraction
    try {
      const aiResult = await processImage(base64Image);
      
      // Filter results based on options
      const filteredResult: Record<string, any> = {};
      
      if (options.extractChequeNumber && aiResult.chequeNumber) {
        filteredResult.chequeNumber = aiResult.chequeNumber;
      }
      
      if (options.extractAmount && aiResult.amount) {
        filteredResult.amount = aiResult.amount;
      }
      
      if (options.extractDate && aiResult.date) {
        filteredResult.date = aiResult.date;
      }
      
      // Always include these if available
      if (aiResult.payeeName) {
        filteredResult.payeeName = aiResult.payeeName;
      }
      
      if (aiResult.bankName) {
        filteredResult.bankName = aiResult.bankName;
      }
      
      return {
        success: true,
        data: filteredResult
      };
    } catch (aiError) {
      console.error("OpenAI processing failed, falling back to OCR:", aiError);
      
      // Fall back to Tesseract OCR if OpenAI fails
      const { data } = await Tesseract.recognize(
        fileBuffer,
        'eng',
        { logger: m => console.log(m) }
      );
      
      const extractedText = data.text;
      
      // Basic extraction with regex patterns
      const result: Record<string, any> = {};
      
      if (options.extractChequeNumber) {
        // Look for cheque number patterns
        const chequeNumberMatch = extractedText.match(/check\s*#?:?\s*(\d+)/i) || 
                                  extractedText.match(/cheque\s*#?:?\s*(\d+)/i) ||
                                  extractedText.match(/no[.:]?\s*(\d+)/i);
        
        if (chequeNumberMatch) {
          result.chequeNumber = chequeNumberMatch[1];
        }
      }
      
      if (options.extractAmount) {
        // Look for dollar amount patterns
        const amountMatch = extractedText.match(/\$\s*([\d,]+\.\d{2})/) ||
                            extractedText.match(/amount:?\s*\$?\s*([\d,]+\.\d{2})/i) ||
                            extractedText.match(/(\d+,\d{3}|\d+)\.\d{2}/);
        
        if (amountMatch) {
          result.amount = amountMatch[1].replace(/,/g, '');
        }
      }
      
      if (options.extractDate) {
        // Look for date patterns (various formats)
        const dateMatch = extractedText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/) ||
                          extractedText.match(/(\d{1,2}-\d{1,2}-\d{2,4})/) ||
                          extractedText.match(/(\w{3,9}\s+\d{1,2},?\s+\d{4})/i);
        
        if (dateMatch) {
          result.date = dateMatch[1];
        }
      }
      
      return {
        success: true,
        data: result,
        rawText: extractedText
      };
    }
  } catch (error) {
    console.error("Document processing error:", error);
    return {
      success: false,
      error: "Failed to process document"
    };
  }
}
