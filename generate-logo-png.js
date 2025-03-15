const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generateLogo() {
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
    
    // Set viewport for the logo
    await page.setViewport({
      width: 200,
      height: 200,
      deviceScaleFactor: 2 // Higher resolution
    });

    // Load the preview HTML file
    console.log('Loading logo HTML...');
    const htmlPath = path.join(__dirname, 'images', 'logo-generator.html');
    const htmlUrl = `file://${htmlPath}`;
    await page.goto(htmlUrl, {
      waitUntil: 'networkidle0'
    });

    // Wait for all content to load
    console.log('Waiting for content to load...');
    await page.evaluate(() => {
      return new Promise(resolve => {
        if (document.readyState === 'complete') {
          return resolve();
        }
        window.addEventListener('load', resolve);
        setTimeout(resolve, 1000);
      });
    });

    // Take a screenshot of just the logo element
    console.log('Taking screenshot of logo...');
    const logoElement = await page.$('.logo');
    
    if (logoElement) {
      const screenshotPath = path.join(__dirname, 'images', 'logo.png');
      await logoElement.screenshot({
        path: screenshotPath,
        type: 'png',
        omitBackground: true // Transparent background
      });
      console.log(`Logo image saved to: ${screenshotPath}`);
    } else {
      console.error('Could not find logo element');
    }

    // Also create a larger favicon version
    console.log('Creating favicon...');
    const faviconPath = path.join(__dirname, 'images', 'favicon.png');
    await page.screenshot({
      path: faviconPath,
      type: 'png',
      clip: {
        x: page.viewport().width / 2 - 50,
        y: page.viewport().height / 2 - 50,
        width: 100,
        height: 100
      }
    });
    console.log(`Favicon saved to: ${faviconPath}`);
    
  } catch (error) {
    console.error('Error generating logo:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

// Run the function
generateLogo().catch(err => {
  console.error('Failed to generate logo:', err);
  process.exit(1);
}); 