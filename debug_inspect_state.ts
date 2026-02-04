import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    console.log('Navigating to Live Matches...');
    await page.goto('https://crex.com/live-matches', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('a[href^="/scoreboard/"]', { timeout: 10000 });
    
    // Get first match URL
    const matchUrl = await page.evaluate(() => {
        const el = document.querySelector('a[href^="/scoreboard/"]');
        return el ? el.getAttribute('href') : null;
    });

    if (!matchUrl) {
        console.error('No live match found!');
        await browser.close();
        return;
    }

    const fullUrl = `https://crex.com${matchUrl}`; // href is usually relative/absolute but crex hrefs are usually relative like /scoreboard/...
    // Scorecard URL
    let baseUrl = fullUrl.replace(/\/live$/, '').replace(/\/commentary$/, '').replace(/\/info$/, '');
    if (baseUrl.endsWith('/scoreboard')) baseUrl = baseUrl;
    else baseUrl += '/scorecard';
    
    // Fix double slash if any or missing domain if relative
    // Actually the href is usually `/scoreboard/...`.
    const targetUrl = matchUrl.startsWith('http') ? matchUrl : `https://crex.com${matchUrl}`;
    
    // Switch to Info URL
    const infoUrl = targetUrl.replace(/\/scorecard$/, '/info').replace(/\/live$/, '/info');
    console.log(`Inspecting Info Page: ${infoUrl}`);
    await page.goto(infoUrl, { waitUntil: 'domcontentloaded' });
    
    // ... same inspect logic ...
    const data = await page.evaluate(() => {
        try {
            const stateScript = document.getElementById('app-root-state');
            if (!stateScript) return { error: 'No state script' };
            
            let jsonText = stateScript.textContent || '';
            jsonText = jsonText.replace(/&q;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&l;/g, '<').replace(/&g;/g, '>').replace(/&a;nbsp;/g, ' ');
            const state = JSON.parse(jsonText);
            
            
            
            const keys = Object.keys(state);
            const scKey = keys.find(k => k.includes('sC4.php'));
            const metaKey = keys.find(k => k.includes('getMatchMetaData'));
            
            let scNames: any = null;
            if (scKey && state[scKey]) {
                const sc = state[scKey];
                // Check if sC4 has team names or abbreviations
                // Usually sc[0].a is players, maybe there's a property for name
                scNames = {
                    t1_p: sc[0] ? sc[0].p : '?', // P often holds team name/info
                    t2_p: sc[1] ? sc[1].p : '?',
                    t1_st: sc[0] ? sc[0].st : '?', // Short title?
                    t2_st: sc[1] ? sc[1].st : '?'
                };
            }

            let metaNames: any = null;
            if (metaKey && state[metaKey] && state[metaKey]['0']) {
                const m = state[metaKey]['0'];
                metaNames = {
                    team1: m.team1,
                    team2: m.team2,
                    team1_s: m.team1_s, // Short name?
                    team2_s: m.team2_s
                };
            }

            return {
                scNames,
                metaNames
            };
        } catch (e: any) {
            return { error: e.toString() };
        }
    });

    console.log('Debug Results:', JSON.stringify(data, null, 2));
    await browser.close();
})();
