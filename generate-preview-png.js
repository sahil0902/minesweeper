const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generatePreview() {
  // Create the images directory if it doesn't exist
  const imagesDir = path.join(__dirname, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new'
  });

  try {
    console.log('Creating new page...');
    const page = await browser.newPage();
    
    // Set viewport to match OpenGraph image size
    await page.setViewport({
      width: 1200,
      height: 630,
      deviceScaleFactor: 1
    });

    // Load the preview HTML file
    console.log('Loading preview HTML...');
    const htmlPath = path.join(__dirname, 'images', 'preview-png.html');
    const htmlUrl = `file://${htmlPath}`;
    await page.goto(htmlUrl, {
      waitUntil: 'networkidle0'
    });

    // Wait for all content to load (including JavaScript execution)
    console.log('Waiting for content to load...');
    await page.evaluate(() => {
      return new Promise(resolve => {
        // Check if document is already complete
        if (document.readyState === 'complete') {
          return resolve();
        }
        
        // Wait for the load event
        window.addEventListener('load', resolve);
        
        // Also resolve after 1 second as a fallback
        setTimeout(resolve, 1000);
      });
    });

    // Take a screenshot
    console.log('Taking screenshot...');
    const screenshotPath = path.join(__dirname, 'images', 'preview.png');
    await page.screenshot({
      path: screenshotPath,
      type: 'png',
      fullPage: false
    });

    console.log(`Preview image saved to: ${screenshotPath}`);
  } catch (error) {
    console.error('Error generating preview:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

// Run the function
generatePreview().catch(err => {
  console.error('Failed to generate preview:', err);
  process.exit(1);
}); 