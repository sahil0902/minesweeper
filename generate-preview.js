const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generatePreview() {
  console.log('Generating preview image...');
  
  try {
    // Launch a headless browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Create a new page
    const page = await browser.newPage();
    
    // Set viewport to match OpenGraph image size
    await page.setViewport({
      width: 1200,
      height: 630,
      deviceScaleFactor: 1
    });
    
    // Load the preview template file
    const templatePath = path.join(__dirname, 'preview-template.html');
    console.log(`Loading template from: ${templatePath}`);
    
    await page.goto(`file://${templatePath}`);
    
    // Wait for the content to load
    await page.waitForSelector('.preview-container', { timeout: 5000 });
    
    // Wait a bit more for animations and dynamic content
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take a screenshot
    const outputPath = path.join(__dirname, 'images', 'preview.png');
    console.log(`Saving screenshot to: ${outputPath}`);
    
    await page.screenshot({
      path: outputPath,
      fullPage: false,
      omitBackground: false
    });
    
    // Close the browser
    await browser.close();
    
    console.log('Preview image generated successfully!');
  } catch (error) {
    console.error('Error generating preview image:', error);
  }
}

// Execute the function
generatePreview(); 