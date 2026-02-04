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
    const matchUrl = '/scoreboard/ZC2/250/1st-T20/U/Q/aus-vs-pak-1st-t20-australia-tour-of-pakistan-2026/live';
    const fullUrl = `https://crex.com${matchUrl}`;
    console.log(`Navigating to match: ${fullUrl}`);
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for initial load
    await page.waitForSelector('.batsmen-partnership', { timeout: 10000 }).catch(() => console.log('Partnership not found'));
    
    // Dump HTML of Live tab
    const liveHtml = await page.content();
    fs.writeFileSync('match_detail_live.html', liveHtml);
    console.log('Dumped Live tab HTML to match_detail_live.html');

    // Click on Scorecard tab
    const clicked = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('a'));
      const scorecardTab = tabs.find(el => el.textContent?.includes('Scorecard'));
      if (scorecardTab) {
        scorecardTab.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('Clicked Scorecard tab...');
      await new Promise(r => setTimeout(r, 5000)); // Wait for tab content to load
    } else {
      console.log('Scorecard tab not found');
    }

    const textContent = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync('match_detail_text.txt', textContent);
    console.log('Dumped text to match_detail_text.txt');

    const htmlContent = await page.content();
    fs.writeFileSync('match_detail_dump.html', htmlContent);
    console.log('Dumped HTML to match_detail_dump.html');
    
    await page.screenshot({ path: 'match_detail_screenshot.png', fullPage: true });
    console.log('Saved screenshot to match_detail_screenshot.png');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

inspect();
