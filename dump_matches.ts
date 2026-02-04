
import puppeteer from 'puppeteer';

async function dumpMatches() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto('https://crex.com/live-matches', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('a[href^="/scoreboard/"]', { timeout: 10000 });

        const cards = await page.evaluate(() => {
            const matchCards = Array.from(document.querySelectorAll('a[href^="/scoreboard/"]'));
            return matchCards.map(card => ({
                html: card.innerHTML,
                href: card.getAttribute('href')
            }));
        });

        console.log(JSON.stringify(cards, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

dumpMatches();
