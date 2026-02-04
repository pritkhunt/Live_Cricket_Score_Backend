import puppeteer from 'puppeteer';
import fs from 'fs';

async function inspect() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Optimize: Disable images and CSS to speed up scraping
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    console.log('Navigating to live matches...');
    await page.goto('https://crex.com/live-matches', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    await page.waitForSelector('a[href^="/scoreboard/"]', { timeout: 20000 });
    
      // Wait a bit for dynamic content
      await new Promise(r => setTimeout(r, 5000));

      const textContent = await page.evaluate(() => document.body.innerText);
      fs.writeFileSync('crex_list_text.txt', textContent);
      console.log('Dumped list text to crex_list_text.txt');

      const htmlContent = await page.content();
      fs.writeFileSync('crex_list_dump.html', htmlContent);
      console.log('Dumped list HTML to crex_list_dump.html');
      
      await page.screenshot({ path: 'crex_list_screenshot.png', fullPage: true });
      console.log('Saved list screenshot to crex_list_screenshot.png');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

inspect();
