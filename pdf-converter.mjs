import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converts a PDF file to an image using Ghostscript
 * @param {Buffer} pdfBuffer The PDF file buffer
 * @returns {Promise<Buffer>} The image buffer
 */
export async function convertPdfToImage(pdfBuffer) {
  try {
    // Create temporary files
    const tempPdfPath = path.join(os.tmpdir(), `temp-${Date.now()}.pdf`);
    const tempImagePath = path.join(os.tmpdir(), `temp-${Date.now()}.png`);
    
    // Write PDF buffer to temp file
    fs.writeFileSync(tempPdfPath, pdfBuffer);
    
    // Validate PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    if (pageCount === 0) {
      throw new Error('PDF contains no pages');
    }
    
    console.log(`PDF contains ${pageCount} pages, converting first page to image`);
    
    try {
      // Use Ghostscript to convert PDF to PNG with high resolution
      const gsCommand = `gs -q -dQUIET -dSAFER -dBATCH -dNOPAUSE -dNOPROMPT -dMaxBitmap=500000000 -dAlignToPixels=0 -dGridFitTT=2 -sDEVICE=png16m -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -r300 -dFirstPage=1 -dLastPage=1 -sOutputFile=${tempImagePath} ${tempPdfPath}`;
      console.log(`Executing: ${gsCommand}`);
      
      execSync(gsCommand);
      
      // Check if the output file exists and has content
      if (!fs.existsSync(tempImagePath) || fs.statSync(tempImagePath).size === 0) {
        throw new Error('Ghostscript failed to generate the image or generated an empty image');
      }
      
      // Read the image file
      const imageBuffer = fs.readFileSync(tempImagePath);
      console.log(`Image generated successfully, size: ${imageBuffer.length} bytes`);
      
      // Clean up temp files
      try {
        fs.unlinkSync(tempPdfPath);
        fs.unlinkSync(tempImagePath);
      } catch (e) {
        console.error('Error cleaning up temp files:', e);
      }
      
      return imageBuffer;
    } catch (gsError) {
      console.error('Ghostscript error:', gsError);
      throw new Error(`Ghostscript error: ${gsError.message}`);
    }
  } catch (error) {
    console.error('Error converting PDF to image:', error);
    throw error;
  }
}
