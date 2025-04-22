const fs = require('fs');
const path = require('path');
const { convertPdfToImage } = require('./pdf-converter');

// Test function
async function testPdfConversion() {
  try {
    // Check for PDF files in attached_assets
    const pdfFiles = fs.readdirSync('./attached_assets')
      .filter(file => file.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('No PDF files found in attached_assets directory.');
      return;
    }
    
    const testFile = pdfFiles[0];
    console.log(`Testing with PDF file: ${testFile}`);
    
    // Read the PDF file
    const pdfBuffer = fs.readFileSync(path.join('./attached_assets', testFile));
    
    // Convert to image
    console.log('Converting PDF to image...');
    const imageBuffer = await convertPdfToImage(pdfBuffer);
    
    // Save the output image
    const outputPath = path.join('./attached_assets', 'converted-pdf.png');
    fs.writeFileSync(outputPath, imageBuffer);
    
    console.log(`Conversion successful! Image saved to: ${outputPath}`);
    console.log(`Image size: ${imageBuffer.length} bytes`);
  } catch (error) {
    console.error('Error during PDF conversion test:', error);
  }
}

// Run the test
testPdfConversion();
