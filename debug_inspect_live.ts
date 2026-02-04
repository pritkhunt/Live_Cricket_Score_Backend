
import puppeteer from 'puppeteer';

async function main() {
  console.log('Starting inspection...');
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Forward console logs from browser to node
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  try {
    const mainUrl = 'https://crex.com/live-matches';
    console.log(`Navigating to ${mainUrl}`);
    await page.goto(mainUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const matchHref = await page.evaluate(() => {
        const card = document.querySelector('a[href^="/scoreboard/"]');
        return card ? card.getAttribute('href') : null;
    });

    if (!matchHref) {
        console.log('No live match found.');
        return;
    }

    const fullUrl = `https://crex.com${matchHref}`;
    console.log(`Loading match: ${fullUrl}`);
    await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Page loaded. Dumping structure...');
    
    const structure = await page.evaluate(() => {
        // Find all tables and list their headers
        const tables = Array.from(document.querySelectorAll('table'));
        console.log(`Found ${tables.length} tables`);
        
        tables.forEach((t, i) => {
            const table = t as HTMLElement;
            console.log(`Table ${i}: ${table.innerText.substring(0, 100)}...`);
            // Check headers
            const headers = Array.from(t.querySelectorAll('th')).map(h => (h as HTMLElement).innerText);
            console.log(`Headers: ${headers.join(', ')}`);
            
            // First row
            const firstRow = t.querySelector('tbody tr');
            if (firstRow) {
                console.log(`First row: ${(firstRow as HTMLElement).innerText}`);
            }
        });

        // Look for specific "Live" classes or text
        const liveCard = document.querySelector('.live-card');
        if (liveCard) console.log('Found .live-card');
        
        // Find "Batter" text
        // Use XPath to find text nodes containing "Batter"
        // ... omitted for simplicity, just dump body text around keywords
        const bodyText = document.body.innerText;
        const keywords = ['Batter', 'Bowler', 'Partnership', 'CRR'];
        keywords.forEach(k => {
             const idx = bodyText.indexOf(k);
             if (idx !== -1) {
                 console.log(`Keyword "${k}" context: ${bodyText.substring(idx, idx + 100)}`);
             }
        });
        
        return { title: document.title };
    });

    console.log('Analysis complete:', structure);

  } catch (error) {
      console.error('Error:', error);
  } finally {
      await browser.close();
  }
}

main();
