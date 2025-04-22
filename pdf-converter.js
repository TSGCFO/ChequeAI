const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');

/**
 * Converts a PDF file to an image
 * @param {Buffer} pdfBuffer The PDF file buffer
 * @returns {Promise<Buffer>} The image buffer
 */
async function convertPdfToImage(pdfBuffer) {
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
    
    // Use sharp to convert PDF to image
    await sharp(tempPdfPath, { page: 0 })
      .png()
      .toFile(tempImagePath);
    
    // Read the image file back
    const imageBuffer = fs.readFileSync(tempImagePath);
    
    // Clean up temp files
    try {
      fs.unlinkSync(tempPdfPath);
      fs.unlinkSync(tempImagePath);
    } catch (e) {
      console.error('Error cleaning up temp files:', e);
    }
    
    return imageBuffer;
  } catch (error) {
    console.error('Error converting PDF to image:', error);
    throw error;
  }
}

module.exports = {
  convertPdfToImage
};
