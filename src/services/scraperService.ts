import puppeteer from 'puppeteer';

export interface ScrapedMatch {
  matchId: string;
  team1: string;
  team2: string;
  team1Logo: string;
  team2Logo: string;
  score1: string;
  score2: string;
  overs1: string;
  overs2: string;
  battingTeam: string;
  status: string;
  venue: string;
  toss: string;
  matchUrl: string;
  partnership?: string;
  commentary?: CommentaryItem[];
  team1XI?: string[];
  team2XI?: string[];
  scorecard?: any;
}

export interface CommentaryItem {
  over: string;
  ball: string;
  score: string;
  description: string;
  event: string;
  isWicket: boolean;
}

export class ScraperService {
  private static browser: any = null; // Browser | null
  private static CREX_URL = 'https://crex.com/live-matches';

  private static async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=en-US,en'],
        env: { ...process.env, TZ: 'Asia/Kolkata' }
      });
    }
    return this.browser;
  }

  static async scrapeLiveMatches(): Promise<ScrapedMatch[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('console', (msg: any) => {
      const text = msg.text();
      if (text.includes('Failed to load resource')) return;
      console.log('BROWSER:', text);
    });
    page.on('request', (req: any) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    try {
      await page.goto(this.CREX_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('a[href^="/scoreboard/"]', { timeout: 10000 });

      const matches = await page.evaluate(() => {
        const matchCards = Array.from(document.querySelectorAll('.live-matches a[href^="/scoreboard/"]'));
        const results = [];
        const seenIds = new Set();

        for (const card of matchCards) {
          const href = card.getAttribute('href') || '';
          const matchId = href.split('/').filter(Boolean).slice(-2).join('_');

          if (seenIds.has(matchId)) continue;
          seenIds.add(matchId);

          const cleanupScore = (name: string, score: string, overs: string) => {
            const normalize = (str: string) => str ? str.replace(/\s+/g, ' ').trim() : '';
            name = normalize(name);
            score = normalize(score);
            overs = normalize(overs);

            if (name && score) {
              const nLower = name.toLowerCase();
              const sLower = score.toLowerCase();
              if (sLower.startsWith(nLower)) {
                score = score.substring(name.length).trim();
              }
            }

            if (overs && score) {
              const oLower = overs.toLowerCase();
              const sLower = score.toLowerCase();
              if (sLower.endsWith(oLower)) {
                score = score.substring(0, score.length - overs.length).trim();
              } else if (sLower.includes(oLower)) {
                const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                score = score.replace(new RegExp(escapeRegExp(overs), 'ig'), '').trim();
              }
            }

            if (score.toLowerCase().includes('yet to bat')) {
              score = score.replace(/yet to bat/gi, '').trim();
            }
            return { name, score, overs };
          };

          const finalizeStatus = (s: string, o: string) => {
            if (o.toLowerCase().includes('yet to bat')) return { s: '', o: 'Yet to bat' };
            if (!s && !o) return { s: '', o: 'Yet to bat' };
            if (!s) return { s: '', o: o || 'Yet to bat' };
            return { s, o };
          };

          const teamContainers = Array.from(card.querySelectorAll('.team'));
          const teams = teamContainers.map(container => {
            const rawName = container.querySelector('.team-name')?.textContent || '';
            const rawScore = container.querySelector('.team-score')?.textContent || '';
            const rawOvers = container.querySelector('.total-overs')?.textContent ||
              container.querySelector('.match-over')?.textContent || '';

            const img = container.querySelector('img') as HTMLImageElement;
            const logo = img ? (img.src || img.getAttribute('data-src') || '') : '';

            const cleaned = cleanupScore(rawName, rawScore, rawOvers);
            const finalized = finalizeStatus(cleaned.score, cleaned.overs);
            return { name: cleaned.name, score: finalized.s, overs: finalized.o, logo };
          });

          // Fallback if teamContainers weren't found or different structure
          if (teams.length < 2) {
            const names = Array.from(card.querySelectorAll('.team-name')).map(el => el.textContent?.trim() || '');
            const scores = Array.from(card.querySelectorAll('.team-score')).map(el => el.textContent?.trim() || '');
            const overs = Array.from(card.querySelectorAll('.total-overs, .match-over')).map(el => el.textContent?.trim() || '');

            const team1Raw = { name: names[0] || '', score: scores[0] || '', overs: overs[0] || '' };
            const team2Raw = { name: names[1] || '', score: scores[1] || '', overs: overs[1] || '' };

            // Extract logos in fallback
            const imgs = Array.from(card.querySelectorAll('img')).map(el => {
              const img = el as HTMLImageElement;
              return img.src || img.getAttribute('data-src') || '';
            });

            const c1 = cleanupScore(team1Raw.name, team1Raw.score, team1Raw.overs);
            const f1 = finalizeStatus(c1.score, c1.overs);

            const c2 = cleanupScore(team2Raw.name, team2Raw.score, team2Raw.overs);
            const f2 = finalizeStatus(c2.score, c2.overs);

            // Check for active inning in fallback
            const activeIdx = Array.from(card.querySelectorAll('.team-score')).findIndex(el => el.querySelector('.inning-active') || el.querySelector('svg'));
            const battingTeam = activeIdx !== -1 ? (activeIdx === 0 ? c1.name : c2.name) : '';

            const venueEl = card.querySelector('h3.match-number') || card.querySelector('h3');
            const venue = venueEl ? venueEl.textContent?.replace(/\s+/g, ' ').trim() : 'Unknown Venue';

            const statusText = card.querySelector('.comment')?.textContent?.trim() ||
              card.querySelector('.match-status')?.textContent?.trim() ||
              'Live';

            results.push({
              matchId,
              team1: c1.name || 'Team 1', team2: c2.name || 'Team 2',
              team1Logo: imgs[0] || '', team2Logo: imgs[1] || '',
              score1: f1.s, score2: f2.s,
              overs1: f1.o, overs2: f2.o,
              battingTeam, status: 'Live', venue: venue || 'Unknown Venue', toss: statusText, matchUrl: href
            });
            continue;
          }

          const battingTeamIndex = teamContainers.findIndex(el =>
            el.querySelector('.inning-active') ||
            el.querySelector('svg') ||
            el.classList.contains('active')
          );
          const battingTeam = battingTeamIndex !== -1 ? (teams[battingTeamIndex]?.name || '') : '';

          const statusText = card.querySelector('.comment')?.textContent?.trim() ||
            card.querySelector('.match-status')?.textContent?.trim() ||
            'Live';

          const venueEl = card.querySelector('h3.match-number') || card.querySelector('h3');
          const venue = venueEl ? venueEl.textContent?.replace(/\s+/g, ' ').trim() : 'Unknown Venue';

          results.push({
            matchId,
            team1: teams[0].name,
            team2: teams[1].name,
            team1Logo: teams[0].logo,
            team2Logo: teams[1].logo,
            score1: teams[0].score,
            score2: teams[1].score,
            overs1: teams[0].overs,
            overs2: teams[1].overs,
            battingTeam,
            status: 'Live',
            venue,
            toss: statusText,
            matchUrl: href
          });
        }
        return results;
      });

      return matches;
    } catch (error) {
      console.error('Scraping error:', error);
      return [];
    } finally {
      if (page) await page.close();
    }
  }

  static async scrapeMatchDetail(matchUrl: string): Promise<any> {
    const browser = await this.getBrowser();
    const [pageLive, pageScorecard] = await Promise.all([
      browser.newPage(),
      browser.newPage()
    ]);

    const setupPage = async (p: any) => {
      await p.setRequestInterception(true);
      p.on('request', (req: any) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
          req.abort().catch(() => { });
        } else {
          req.continue().catch(() => { });
        }
      });
    };

    await Promise.all([setupPage(pageLive), setupPage(pageScorecard)]);

    try {
      let baseUrl = matchUrl.replace(/\/scorecard$/, '').replace(/\/live$/, '').replace(/\/commentary$/, '');
      if (baseUrl.startsWith('https://crex.com')) baseUrl = baseUrl.replace('https://crex.com', '');

      const liveUrl = `https://crex.com${baseUrl}/live`;
      const scorecardUrl = `https://crex.com${baseUrl}/scorecard`;

      console.log(`Parallel Scrape: Fetching Live(${liveUrl}) and Scorecard(${scorecardUrl})`);

      let xiData: { team1XI: string[], team2XI: string[] } = { team1XI: [], team2XI: [] };
      let liveResults: any = { liveData: {}, commentary: [] };
      let scorecardData: any = { batting: [], bowling: [] };

      // 1. Scrape Live and Scorecard pages parallel
      await Promise.all([
        (async () => {
          try {
            await pageLive.goto(liveUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

            liveResults = await pageLive.evaluate(async () => {
              // ... (existing live data extraction logic) ...
              let status = '';
              let recent: string[] = [];
              let partnership = '';
              let commentary: any[] = [];

              try {
                const stateScript = document.getElementById('app-root-state');
                if (stateScript) {
                  let jsonText = stateScript.textContent || '';
                  jsonText = jsonText.replace(/&q;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&l;/g, '<').replace(/&g;/g, '>').replace(/&a;nbsp;/g, ' ');
                  const data = JSON.parse(jsonText);
                  const keys = Object.keys(data);
                  const feedKey = keys.find(k => k.includes('getBallFeeds'));

                  // Extract Live Status/Partnership/Recent
                  const rawItems = feedKey ? data[feedKey] : null;
                  if (Array.isArray(rawItems)) {
                    // ... (same status logic as before) ...
                    const liveIndicator = rawItems.find((raw: any) => raw.c && (raw.c.toLowerCase().trim() === 'ball' || raw.c.toLowerCase().trim() === 'live'));
                    const inningsBreakItem = rawItems.find((raw: any) => raw.c && raw.c.toLowerCase().includes('innings break'));
                    if (liveIndicator) status = "Ball";
                    else if (inningsBreakItem) status = "Innings Break";
                    else {
                      const latestEvent = rawItems.find((raw: any) => ['b', 'o'].includes(raw.type));
                      if (latestEvent && latestEvent.type === 'o') status = "OVER";
                      else {
                        const latestBall = rawItems.find((raw: any) => raw.type === 'b' && raw.o);
                        if (latestBall) status = latestBall.b || '0';
                        else {
                          const statusItem = rawItems.find((raw: any) => ['ic1', 'ic2', 'ic3'].includes(raw.type) && raw.c);
                          if (statusItem) status = statusItem.c.replace(/<[^>]*>?/gm, '').trim();
                        }
                      }
                    }
                    const overItem = rawItems.find((raw: any) => raw.type === 'o' && raw.rb);
                    if (overItem) recent = overItem.rb.split('.').filter(Boolean);
                  }

                  // Extract Commentary
                  let commItems = feedKey ? data[feedKey] : null;
                  if (!commItems && data.firebaseData) commItems = data.firebaseData.map((f: any) => f.commentary).filter(Boolean);
                  if (Array.isArray(commItems)) {
                    commItems.forEach((raw: any) => {
                      if (raw.type === 'b') {
                        const overStr = String(raw.o || '');
                        const overParts = overStr.split('.');
                        const score = String(raw.b || '');
                        let desc = (raw.c1 || '') + (raw.c2 ? ' ' + raw.c2 : '');
                        desc = desc.replace(/&l;/g, '<').replace(/&g;/g, '>').replace(/&a;nbsp;/g, ' ');
                        if (overStr && desc) {
                          commentary.push({
                            over: overParts[0] || '', ball: overParts[1] || '', score: score, description: desc.trim(),
                            event: score === 'W' ? 'wicket' : (['4', '6'].includes(score) ? 'boundary' : 'run'),
                            isWicket: score === 'W' || desc.toLowerCase().includes('out!') || desc.toLowerCase().includes('wicket!')
                          });
                        }
                      }
                    });
                  }
                }
              } catch (e) { }

              // Commentary Fallback (DOM)
              if (commentary.length === 0) {
                const cards = document.querySelectorAll('.comm-card, .commentary-card, .comm-item');
                cards.forEach(card => {
                  const text = card.textContent?.trim() || '';
                  // Attempt to parse "19.5 4 ..."
                  const match = text.match(/^(\d+\.\d+)\s+([^\s]+)\s+(.*)/);
                  if (match) {
                    const overStr = match[1];
                    const score = match[2];
                    const desc = match[3];
                    const overParts = overStr.split('.');
                    commentary.push({
                      over: overParts[0] || '', ball: overParts[1] || '', score: score, description: desc.trim(),
                      event: score === 'W' ? 'wicket' : (['4', '6'].includes(score) ? 'boundary' : 'run'),
                      isWicket: score === 'W' || desc.toLowerCase().includes('out!')
                    });
                  }
                });
              }

              // Fallbacks
              if (!status) status = document.querySelector('.result-box, .match-result')?.textContent?.trim() || '';
              if (!partnership) partnership = document.querySelector('.p-ship')?.textContent?.trim().replace("P'ship :", '').trim() || '';
              if (recent.length === 0) recent = Array.from(document.querySelectorAll('.recent-overs .over-circle, .recent-overs .ball-circle')).map(el => el.textContent?.trim() || '');

              // Fallback for Recent Overs using text search
              if (recent.length === 0) {
                const bodyText = document.body.innerText || '';
                const recentMatch = bodyText.match(/Recent\s*[:\-\s]?\s*([\d\s\.Ww\+]+)/i);
                if (recentMatch) {
                  // extracting valid balls (digits, dots, W w, etc.)
                  recent = recentMatch[1].trim().split(/\s+/).filter(b => /[\d\.Ww]/.test(b));
                }
              }

              let crr = '';
              let rrr = '';

              const bodyText = document.body.innerText || '';

              // CRR Regex: Look for "CRR" followed by optional colon/space and digits
              const crrMatch = bodyText.match(/CRR\s*[:\-\s]?\s*([\d\.]+)/i);
              if (crrMatch) crr = crrMatch[1];

              // RRR Regex
              const rrrMatch = bodyText.match(/RRR\s*[:\-\s]?\s*([\d\.]+)/i);
              if (rrrMatch) rrr = rrrMatch[1];

              // Fallback: Check specific containers if body text is cluttered or missing
              if (!crr || !rrr) {
                const allText = Array.from(document.querySelectorAll('.match-info, .live-header, .team-score-box, .score-card'))
                  .map(el => el.textContent).join(' ');
                if (!crr) {
                  const m = allText.match(/CRR\s*[:\-\s]?\s*([\d\.]+)/i);
                  if (m) crr = m[1];
                }
                if (!rrr) {
                  const m = allText.match(/RRR\s*[:\-\s]?\s*([\d\.]+)/i);
                  if (m) rrr = m[1];
                }
              }

              return { liveData: { status, recent, partnership, crr, rrr }, commentary: commentary.slice(0, 50) };
            });
          } catch (e) { console.error('Live scrape error:', e); }
        })(),

        (async () => {
          try {
            await pageScorecard.goto(scorecardUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await pageScorecard.waitForSelector('table', { timeout: 5000 }).catch(() => { });

            // Try extracting Playing XI from JSON state FIRST
            xiData = await pageScorecard.evaluate(() => {
              let t1: string[] = [];
              let t2: string[] = [];
              try {
                const stateScript = document.getElementById('app-root-state');
                if (stateScript) {
                  let jsonText = stateScript.textContent || '';
                  jsonText = jsonText.replace(/&q;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&l;/g, '<').replace(/&g;/g, '>').replace(/&a;nbsp;/g, ' ');
                  const data = JSON.parse(jsonText);
                  const keys = Object.keys(data);

                  const mapKeys = keys.filter(k => k.includes('getHomeMapData'));
                  const scKey = keys.find(k => k.includes('sC4.php'));

                  if (mapKeys.length > 0 && scKey && data[scKey]) {
                    const playerMap = new Map();
                    mapKeys.forEach(k => {
                      if (data[k] && data[k].p) {
                        data[k].p.forEach((p: any) => playerMap.set(p.f_key, p.n));
                      }
                    });

                    const scData = data[scKey];

                    if (scData[0] && scData[0].a) {
                      t1 = scData[0].a.map((id: string) => playerMap.get(id.split('.')[0]) || id);
                    }
                    if (scData[1] && scData[1].a) {
                      t2 = scData[1].a.map((id: string) => playerMap.get(id.split('.')[0]) || id);
                    }
                  }
                }
              } catch (e) { }
              return { team1XI: t1, team2XI: t2 };
            });

            // Scrape conventional scorecard
            scorecardData = await pageScorecard.evaluate(async () => {
              const sc = { batting: [] as any[], bowling: [] as any[] };
              const tables = Array.from(document.querySelectorAll('table'));
              tables.forEach((table) => {
                const text = table.textContent?.toLowerCase() || '';
                const rows = Array.from(table.querySelectorAll('tr'));
                if (text.includes('batter') || text.includes('batsman')) {
                  rows.forEach(row => {
                    const cols = Array.from(row.querySelectorAll('td'));
                    if (cols.length >= 6) {
                      // ... existing batting scrape ...
                      const batsmanNameEl = cols[0].querySelector('.player-name') || cols[0].querySelector('.batsman-name') || cols[0];
                      let batsmanName = batsmanNameEl.textContent?.trim() || '';
                      if (batsmanName.toLowerCase().includes('batter') || batsmanName.toLowerCase().includes('batsman') || batsmanName.toLowerCase().includes('runs')) return;
                      const dismissal = cols[0].querySelector('.decision')?.textContent?.trim() || cols[0].querySelector('.p-status')?.textContent?.trim() || '';
                      if (!batsmanName.includes('*') && (cols[0].textContent?.includes('*') || cols[0].querySelector('.bits-star') || cols[0].querySelector('.active-striker'))) batsmanName += ' *';
                      sc.batting.push({
                        batsman: batsmanName, dismissal: dismissal, runs: cols[1]?.textContent?.trim() || '0',
                        balls: cols[2]?.textContent?.trim() || '0', fours: cols[3]?.textContent?.trim() || '0',
                        sixes: cols[4]?.textContent?.trim() || '0', sr: cols[5]?.textContent?.trim() || '0.00'
                      });
                    }
                  });
                } else if (text.includes('bowler') || text.includes('bowling')) {
                  rows.forEach(row => {
                    const cols = Array.from(row.querySelectorAll('td'));
                    if (cols.length >= 6) {
                      // ... existing bowling scrape ...
                      const bowlerName = cols[0]?.textContent?.trim() || '';
                      if (bowlerName.toLowerCase().includes('bowler') || bowlerName.toLowerCase().includes('overs') || bowlerName.toLowerCase().includes('omrw')) return;
                      sc.bowling.push({
                        bowler: bowlerName,
                        overs: cols[1]?.textContent?.trim() || '0',
                        maidens: cols[2]?.textContent?.trim() || '0',
                        runs: cols[3]?.textContent?.trim() || '0',
                        wickets: cols[4]?.textContent?.trim() || '0',
                        er: cols[5]?.textContent?.trim() || '0.00'
                      });
                    }
                  });
                }
              });
              return sc;
            });

          } catch (e) { console.error('Scorecard scrape error:', e); }
        })()
      ]);

      // 2. FALLBACK for Playing XI if JSON failed or is incomplete (less than 11 players)
      if (!xiData.team1XI.length || !xiData.team2XI.length || xiData.team1XI.length < 11 || xiData.team2XI.length < 11) {
        console.log('JSON Playing XI extraction from Scorecard incomplete (likely active players only). Fetching full squad from Info Page JSON...');
        let baseUrl = matchUrl.replace(/\/scorecard$/, '').replace(/\/live$/, '').replace(/\/commentary$/, '').replace(/\/info$/, '');
        if (baseUrl.startsWith('https://crex.com')) baseUrl = baseUrl.replace('https://crex.com', '');
        const infoUrl = `https://crex.com${baseUrl}/info`;

        const pageInfo = await browser.newPage();
        try {
          await pageInfo.setRequestInterception(true);
          pageInfo.on('request', (req: any) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort().catch(() => { });
            else req.continue().catch(() => { });
          });
          await pageInfo.goto(infoUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

          // Extract directly from Info page JSON state (iV4 key)
          const infoXI = await pageInfo.evaluate(() => {
            try {
              // 1. Get Visual Team Names (Source of Truth for Order)
              const visualNames = Array.from(document.querySelectorAll('.team-name, .t-name'))
                .map(el => el.textContent?.trim())
                .filter(Boolean);

              // 2. Parse State
              const stateScript = document.getElementById('app-root-state');
              if (!stateScript) return null;

              let jsonText = stateScript.textContent || '';
              jsonText = jsonText.replace(/&q;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&l;/g, '<').replace(/&g;/g, '>').replace(/&a;nbsp;/g, ' ');
              const data = JSON.parse(jsonText);
              const keys = Object.keys(data);

              // 3. Build Player Map
              const mapKeys = keys.filter(k => k.includes('getHomeMapData'));
              const playerMap = new Map();
              mapKeys.forEach(k => {
                if (data[k] && data[k].p) {
                  data[k].p.forEach((p: any) => playerMap.set(p.f_key, p.n));
                }
              });

              // 4. Get Metadata for Team ID <-> Name mapping
              const metaKey = keys.find(k => k.includes('getMatchMetaData'));
              const teamIdToName: any = {};
              const teamNameToId: any = {};

              if (metaKey && data[metaKey] && data[metaKey]['0']) {
                const m = data[metaKey]['0'];
                if (m.team1_fkey && m.team1) {
                  teamIdToName[m.team1_fkey] = m.team1;
                  teamNameToId[m.team1.toLowerCase()] = m.team1_fkey;
                }
                if (m.team2_fkey && m.team2) {
                  teamIdToName[m.team2_fkey] = m.team2;
                  teamNameToId[m.team2.toLowerCase()] = m.team2_fkey;
                }
              }

              // 5. Find iV4 key for Playing XI data
              const ivKey = keys.find(k => k.includes('iV4.php'));
              if (ivKey && data[ivKey] && data[ivKey].tp) {
                const tp = data[ivKey].tp;
                const teamOrder = data[ivKey].t || ''; // "ID_A-ID_B"

                const parts = tp.split('/');
                const orderParts = teamOrder.split('-');

                if (parts.length >= 2 && orderParts.length >= 2) {
                  const processTeam = (str: string) => {
                    return str.split('-').map(pStr => {
                      const id = pStr.split('.')[0];
                      return playerMap.get(id) || id;
                    });
                  };

                  const listA = processTeam(parts[0]);
                  const listB = processTeam(parts[1]);

                  const idA = orderParts[0];
                  const idB = orderParts[1];

                  const teamLists: any = {};
                  teamLists[idA] = listA;
                  teamLists[idB] = listB;

                  // 6. RESOLVE ORDER based on Visual Names
                  let vT1_ID = '';
                  let vT2_ID = '';

                  if (visualNames.length >= 2) {
                    const vN1 = visualNames[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
                    const vN2 = visualNames[1]?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';

                    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

                    // Robust Fuzzy Match
                    const findId = (name: string) => {
                      if (!name) return null;
                      // 1. Exact ID lookup (if name was actually an ID)
                      if (teamLists[name]) return name;

                      // 2. Direct Name lookup
                      const cleanName = normalize(name);
                      for (const [id, teamName] of Object.entries(teamIdToName)) {
                        const cleanTName = normalize(teamName as string);
                        // Exact match
                        if (cleanTName === cleanName) return id;
                        // Contains
                        if (cleanTName.includes(cleanName) || cleanName.includes(cleanTName)) return id;
                        // Acronym check (e.g. 'CSK' match 'Chennai Super Kings')
                        const acronym = (teamName as string).split(' ').map(w => w[0]).join('').toLowerCase();
                        if (acronym === cleanName || cleanName.includes(acronym)) return id;
                        // First 3 chars match
                        if (cleanTName.length >= 3 && cleanName.length >= 3 && cleanTName.substring(0, 3) === cleanName.substring(0, 3)) return id;
                      }
                      return null;
                    };

                    vT1_ID = findId(vN1) || '';
                    vT2_ID = findId(vN2) || '';
                  }

                  // If visual resolution failed, fallback to metadata T1/T2 order
                  // IMPORTANT: If we found ONE but not the other, imply the other.
                  if (vT1_ID && !vT2_ID) {
                    vT2_ID = (vT1_ID === idA) ? idB : idA;
                  } else if (!vT1_ID && vT2_ID) {
                    vT1_ID = (vT2_ID === idA) ? idB : idA;
                  } else if (!vT1_ID && !vT2_ID) {
                    // Double fallback: Use metadata IDs first
                    if (metaKey && data[metaKey] && data[metaKey]['0']) {
                      vT1_ID = data[metaKey]['0'].team1_fkey;
                      vT2_ID = data[metaKey]['0'].team2_fkey;
                    } else {
                      // Triple fallback: default to iV4 order
                      vT1_ID = idA;
                      vT2_ID = idB;
                    }
                  }

                  // Final Assignment
                  if (vT1_ID && vT2_ID && teamLists[vT1_ID] && teamLists[vT2_ID]) {
                    return {
                      team1XI: teamLists[vT1_ID],
                      team2XI: teamLists[vT2_ID]
                    };
                  } else {
                    return {
                      team1XI: listA,
                      team2XI: listB
                    };
                  }
                }
              }
              return null;
            } catch (e) { return null; }
          });

          if (infoXI && infoXI.team1XI.length > 0) {
            xiData = infoXI;
            console.log(`Successfully extracted full Playing XI from Info JSON! (T1: ${xiData.team1XI.length}, T2: ${xiData.team2XI.length})`);
          } else {
            console.log('Info JSON extraction failed, trying legacy UI scrape as last resort...');
            // Legacy UI scrape logic could go here if needed, but JSON is much more reliable matches.
            // We will skip legacy UI scrape to assume if JSON fails, data isn't there, avoiding timeouts.
          }

        } catch (e) {
          console.error('Info fallback scrape failed:', e);
        } finally {
          await pageInfo.close().catch(() => { });
        }
      } else {
        console.log('Successfully extracted Playing XI from Scorecard JSON state!');
      }

      return {
        scorecard: scorecardData,
        partnership: liveResults.liveData?.partnership || '',
        recentOvers: liveResults.liveData?.recent || [],
        matchStatus: liveResults.liveData?.status || '',
        commentary: liveResults.commentary || [],
        crr: liveResults.liveData?.crr || '',
        rrr: liveResults.liveData?.rrr || '',
        team1XI: xiData.team1XI || [],
        team2XI: xiData.team2XI || []
      };
    } catch (error) {
      console.error('Error scraping match detail:', error);
      return null;
    } finally {
      await Promise.all([
        pageLive ? pageLive.close().catch(() => { }) : Promise.resolve(),
        pageScorecard ? pageScorecard.close().catch(() => { }) : Promise.resolve()
      ]);
    }
  }

  static async scrapeInfoPageFallback(matchUrl: string): Promise<{ team1XI: string[], team2XI: string[] }> {
    // ... existing fallback code ...
    return { team1XI: [], team2XI: [] }; // Placeholder for types, actual implementation in previous steps
    // Note: This method was implemented inline in scrapeMatchDetail in previous steps.
    // Ideally should be a proper separate method but for now I'll stick to the existing structure.
    // I will add the new methods below scrapeMatchDetail or at the end of the class.
    return { team1XI: [], team2XI: [] };
  }

  // --- NEW METHODS FOR SERIES, TEAMS, NEWS ---

  static async scrapeSeriesList(): Promise<any[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.goto('https://crex.com/series', { waitUntil: 'domcontentloaded', timeout: 30000 });

      let allSeries: any[] = [];
      let pageCount = 0;
      const MAX_PAGES = 15; // scrape up to 15 pages

      while (pageCount < MAX_PAGES) {
        pageCount++;

        // Scrape current view
        const currentViewSeries: any[] = await page.evaluate(() => {
          const list: any[] = [];
          let currentMonth = '';

          const seriesWiseContainers = document.querySelectorAll('.serieswise');
          if (seriesWiseContainers.length > 0) {
            seriesWiseContainers.forEach(container => {
              Array.from(container.children).forEach(child => {
                if (child.classList.contains('s_date')) {
                  currentMonth = child.textContent?.trim() || '';
                } else {
                  if (child.tagName === 'A' && child.classList.contains('series-card')) {
                    const nameEl = child.querySelector('.series-name');
                    const dateEl = child.querySelector('.series-desc span');
                    list.push({
                      id: child.getAttribute('href')?.split('/').pop() || '',
                      name: nameEl?.textContent?.trim(),
                      date: dateEl?.textContent?.trim(),
                      url: child.getAttribute('href'),
                      month: currentMonth
                    });
                  } else {
                    const cards = child.querySelectorAll('a.series-card');
                    cards.forEach(card => {
                      const nameEl = card.querySelector('.series-name');
                      const dateEl = card.querySelector('.series-desc span');
                      list.push({
                        id: card.getAttribute('href')?.split('/').pop() || '',
                        name: nameEl?.textContent?.trim(),
                        date: dateEl?.textContent?.trim(),
                        url: card.getAttribute('href'),
                        month: currentMonth
                      });
                    });
                  }
                }
              });
            });
          } else {
            return Array.from(document.querySelectorAll('a.series-card')).map(el => ({
              id: el.getAttribute('href')?.split('/').pop() || '',
              name: el.querySelector('.series-name')?.textContent?.trim(),
              date: el.querySelector('.series-desc span')?.textContent?.trim(),
              url: el.getAttribute('href'),
              month: ''
            }));
          }
          return list;
        });

        if (currentViewSeries.length > 0) {
          allSeries = [...allSeries, ...currentViewSeries];
        } else {
          break;
        }

        const firstSeriesName = currentViewSeries[0]?.name;

        // Check for Next button
        const nextBtn = await page.$('.next-button');
        if (!nextBtn) {
          break;
        }

        // Click and wait for content change
        try {
          await page.evaluate(() => {
            const btn = document.querySelector('.next-button') as HTMLElement;
            if (btn) btn.click();
          });

          // Wait for the first series name to change (content loaded)
          await page.waitForFunction((prevName: any) => {
            const firstCard = document.querySelector('.series-card .series-name');
            const newName = firstCard?.textContent?.trim();
            return newName && newName !== prevName;
          }, { timeout: 10000 }, firstSeriesName);

        } catch (err) {
          break;
        }
      }

      // Deduplicate by ID just in case
      const seen = new Set();
      return allSeries.filter(s => {
        const duplicate = seen.has(s.id);
        seen.add(s.id);
        return !duplicate;
      });

    } catch (e) {
      console.error('Error scraping series:', e);
      return [];
    } finally {
      await page.close();
    }
  }

  static async scrapeTeamList(): Promise<any[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.goto('https://crex.com/team', { waitUntil: 'domcontentloaded', timeout: 30000 });
      return await page.evaluate(() => {
        const teams: any[] = [];
        const seenNames = new Set();

        const teamElements = document.querySelectorAll('a.team-box, li.team-card, a[href^="/team/"]');

        teamElements.forEach(el => {
          const name = el.querySelector('div:last-child, .team-name, .t-name, h2, h3')?.textContent?.trim() || el.textContent?.trim();

          if (name && name.length > 2 && !seenNames.has(name)) {
            const img = el.querySelector('img')?.getAttribute('src');
            const validImg = img && img.startsWith('http') ? img : null;

            const href = el.getAttribute('href');
            const id = href ? href.split('/').pop() : name.replace(/\s+/g, '-').toLowerCase();

            seenNames.add(name);
            teams.push({
              id: id,
              name: name,
              image: validImg,
              url: href
            });
          }
        });
        return teams;
      });
    } catch (e) {
      console.error('Error scraping teams:', e);
      return [];
    } finally {
      await page.close();
    }
  }

  static async scrapeNewsList(): Promise<any[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.goto('https://crex.com/news', { waitUntil: 'domcontentloaded', timeout: 30000 });
      return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a.card')).map(el => {
          const titleEl = el.querySelector('h2');
          const descEl = el.querySelector('p');
          const imgEl = el.querySelector('img');
          return {
            id: el.getAttribute('href')?.split('/').pop() || '',
            title: titleEl?.textContent?.trim(),
            description: descEl?.textContent?.trim(),
            image: imgEl?.getAttribute('src'),
            url: el.getAttribute('href')
          };
        });
      });
    } catch (e) {
      console.error('Error scraping news:', e);
      return [];
    } finally {
      await page.close();
    }
  }

  static async scrapeNewsDetail(slug: string): Promise<any> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const url = `https://crex.com/cricket-news/${slug}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return await page.evaluate(() => {
        const title = document.querySelector('h1')?.textContent?.trim();
        const image = document.querySelector('.section-inner-first img')?.getAttribute('src') || document.querySelector('.resizer img')?.getAttribute('src');
        const paragraphs = Array.from(document.querySelectorAll('.section-inner-first p')).map(p => p.textContent?.trim()).filter(t => t && t.length > 0);
        const author = document.querySelector('.author-name')?.textContent?.trim();
        const date = document.querySelector('.role')?.textContent?.trim();

        return {
          title,
          image,
          content: paragraphs,
          author,
          date
        };
      });
    } catch (e) {
      console.error('Error scraping news details:', e);
      return null;
    } finally {
      await page.close();
    }
  }

  static async scrapeTeamDetail(slug: string): Promise<any> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const url = `https://crex.com/team/${slug}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return await page.evaluate(() => {
        const name = document.querySelector('h1')?.textContent?.trim() || document.querySelector('.team-name')?.textContent?.trim();
        const logo = document.querySelector('.team-logo img')?.getAttribute('src') || document.querySelector('.team-info img')?.getAttribute('src');
        const about = document.querySelector('.about-section')?.textContent?.trim() || document.querySelector('.about-info')?.textContent?.trim();

        const matches = Array.from(document.querySelectorAll('.match-card-wrapper')).map(el => {
          const seriesName = el.querySelector('.series-name')?.textContent?.trim();
          const teams = Array.from(el.querySelectorAll('.team-name')).map(t => t.textContent?.trim());
          const score = el.querySelector('.result')?.textContent?.trim();
          const status = el.querySelector('.match-status')?.textContent?.trim();
          const date = el.querySelector('.start-time')?.textContent?.trim();

          return {
            series: seriesName,
            t1: teams[0],
            t2: teams[1],
            score,
            status,
            date
          };
        });

        return {
          name,
          logo,
          about,
          matches
        };
      });
    } catch (e) {
      console.error('Error scraping team details:', e);
      return null;
    } finally {
      await page.close();
    }
  }

  static async scrapeTeamMatches(slug: string): Promise<any[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const url = `https://crex.com/team/${slug}/matches`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.match-card-wrapper')).map(el => {
          const seriesName = el.querySelector('h3.series-name')?.textContent?.trim() || el.querySelector('.series-name')?.textContent?.trim();
          const teams = Array.from(el.querySelectorAll('.team-name')).map(t => t.textContent?.trim());
          const score = el.querySelector('.result')?.textContent?.trim();
          const status = el.querySelector('.match-status')?.textContent?.trim();
          const date = el.querySelector('.start-time')?.textContent?.trim();

          return {
            series: seriesName,
            t1: teams[0],
            t2: teams[1],
            score,
            status,
            date
          };
        });
      });
    } catch (e) {
      console.error('Error scraping team matches:', e);
      return [];
    } finally {
      await page.close();
    }
  }

  static async scrapeTeamNews(slug: string): Promise<any[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const url = `https://crex.com/team/${slug}/news`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a.card')).map(el => {
          const titleEl = el.querySelector('h3');
          const descEl = el.querySelector('p');
          const imgEl = el.querySelector('img');
          return {
            id: el.getAttribute('href')?.split('/').pop() || '',
            title: titleEl?.textContent?.trim(),
            description: descEl?.textContent?.trim(),
            image: imgEl?.getAttribute('src'),
            url: el.getAttribute('href')
          };
        });
      });
    } catch (e) {
      console.error('Error scraping team news:', e);
      return [];
    } finally {
      await page.close();
    }
  }

  static async scrapeSeriesDetail(slug: string): Promise<any> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const url = `https://crex.com/series/${slug}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return await page.evaluate(() => {
        const titleEl = document.querySelector('.series-info h1') || document.querySelector('h1.series-name');
        const dateEl = document.querySelector('.series-info .series-date') || document.querySelector('.series-info .date') || document.querySelector('.series-info span');

        // Logo Extraction - Robust Selectors
        const seriesLogo = document.querySelector('.current-series .series-image img')?.getAttribute('src') ||
          document.querySelector('.series-header-left img')?.getAttribute('src') ||
          document.querySelector('.series-img-wrapper img')?.getAttribute('src') ||
          document.querySelector('img.series-logo')?.getAttribute('src') ||
          document.querySelector('.series-info-left img')?.getAttribute('src');

        // Sponsor is often in the right header or distinct wrapper
        const sponsorLogo = document.querySelector('.series-header-right img')?.getAttribute('src') ||
          document.querySelector('.sponsor-img-wrapper img')?.getAttribute('src') ||
          document.querySelector('.sponsor-logo img')?.getAttribute('src') ||
          document.querySelector('img[alt*="sponsor"]')?.getAttribute('src');

        return {
          title: titleEl?.textContent?.trim(),
          name: titleEl?.textContent?.trim(),
          info: titleEl?.textContent?.trim(),
          dates: dateEl?.textContent?.trim(),
          seriesLogo: seriesLogo,
          sponsorLogo: sponsorLogo
        };
      });
    } catch (e) {
      console.error('Error scraping series detail:', e);
      return null;
    } finally {
      await page.close();
    }
  }

  static async scrapeSeriesMatches(slug: string): Promise<any[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    await page.emulateTimezone('Asia/Kolkata');
    const url = `https://crex.com/series/${slug}/matches`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.match-card-wrapper')).map(el => {
          const matchInfo = el.querySelector('.upper-txt')?.textContent?.trim() || el.querySelector('.match-info')?.textContent?.trim() || el.querySelector('h3.series-name')?.textContent?.trim() || el.querySelector('.series-name')?.textContent?.trim();
          const teams = Array.from(el.querySelectorAll('.team-name')).map(t => t.textContent?.trim());
          const score = el.querySelector('.result')?.textContent?.trim();
          const teamLogos = Array.from(el.querySelectorAll('crex-team-card img')).map(img => img.getAttribute('src') || img.getAttribute('data-src'));
          const teamScores = Array.from(el.querySelectorAll('crex-team-card .team-score')).map(s => s.textContent?.trim());
          const teamOvers = Array.from(el.querySelectorAll('crex-team-card .team-overs')).map(s => s.textContent?.trim());

          // Time is often in the center div or .start-time
          const dateEl = el.querySelector('.start-time') || el.querySelector('.match-time') || el.querySelector('.match-date') || el.querySelector('.lower-txt');
          let date = dateEl?.textContent?.trim();

          if (!date) {
            // Fallback: Try 2nd div in 2nd column, but validate it's a time
            const centerDiv = el.querySelector('div > div:nth-child(2) > div:nth-child(2)');
            const text = centerDiv?.textContent?.trim();
            // Check if it looks like time (e.g. 1:00 PM, 13:00) or Date
            if (text && (text.includes('AM') || text.includes('PM') || text.includes(','))) {
              date = text;
            }
          }

          // Manual GMT to IST Conversion
          if (date && date.includes(',')) {
            try {
              const d = new Date(date + ', 2026 UTC');
              if (!isNaN(d.getTime())) {
                date = d.toLocaleString('en-US', {
                  timeZone: 'Asia/Kolkata',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
              }
            } catch (e) { }
          }

          // If date still looks like a score (contains /), start scraping for "Result" instead if needed, 
          // but for date field we want Time. If finished, date might be hidden or just header.
          if (date && date.includes('/')) {
            date = ''; // It's a score, not a date
          }

          return {
            info: matchInfo,
            t1: teams[0],
            t2: teams[1],
            t1Logo: teamLogos[0] || '',
            t2Logo: teamLogos[1] || '',
            t1Score: teamScores[0] || '',
            t2Score: teamScores[1] || '',
            t1Overs: teamOvers[0] || '',
            t2Overs: teamOvers[1] || '',
            score, // Result text e.g. "AFG Won by..."
            status,
            date
          };
        });
      });
    } catch (e) {
      console.error('Error scraping series matches:', e);
      return [];
    } finally {
      await page.close();
    }
  }

  static async scrapeSeriesPointsTable(slug: string): Promise<any[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const url = `https://crex.com/series/${slug}/points-table`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Wait for table to ensure it loads
      try { await page.waitForSelector('table', { timeout: 5000 }); } catch (e) { }

      return await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tr'));
        // Skip header row
        return rows.slice(1).map(row => {
          const teamEl = row.querySelector('.team-name') || row.querySelector('.team-wrapper');
          const teamName = teamEl?.textContent?.trim();
          const tds = Array.from(row.querySelectorAll('td'));
          // Indices depend on table structure. Usually: Team, P, W, L, NR, Pts, NRR
          // But sometimes simple tables. Let's try to map by class or generic index.
          // Assumption: Last is NRR, second last is Pts.
          if (tds.length < 5) return null; // Not enough data

          return {
            team: teamName,
            matches: tds[1]?.textContent?.trim(),
            won: tds[2]?.textContent?.trim(),
            lost: tds[3]?.textContent?.trim(),
            nr: tds[4]?.textContent?.trim(),
            pts: tds[tds.length - 2]?.textContent?.trim(),
            nrr: tds[tds.length - 1]?.textContent?.trim()
          };
        }).filter(t => t && t.team);
      });
    } catch (e) {
      console.error('Error scraping series points:', e);
      return [];
    } finally {
      await page.close();
    }
  }
  static async scrapeSeriesSquads(slug: string): Promise<any[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const url = `https://crex.com/series/${slug}/team-squad`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return await page.evaluate(() => {
        const uniqueTeams = new Map();

        // Use specific selector and deduplicate
        const teamElements = document.querySelectorAll('app-team-squad-details');

        teamElements.forEach(el => {
          const name = el.querySelector('h3')?.textContent?.trim();
          if (name && !uniqueTeams.has(name)) {
            const count = el.querySelector('p')?.textContent?.trim();
            const img = el.querySelector('img')?.getAttribute('src');
            uniqueTeams.set(name, {
              name: name,
              count: count,
              img: img,
              id: name,
              url: ''
            });
          }
        });

        if (uniqueTeams.size === 0) {
          // Fallback to legacy class if component not found, but still dedup
          const cardElements = document.querySelectorAll('.series-left-card');
          cardElements.forEach(el => {
            const name = el.querySelector('h3')?.textContent?.trim();
            if (name && !uniqueTeams.has(name)) {
              const count = el.querySelector('p')?.textContent?.trim();
              const img = el.querySelector('img')?.getAttribute('src');
              uniqueTeams.set(name, { name, count, img, id: name, url: '' });
            }
          });
        }

        return Array.from(uniqueTeams.values());
      });
    } catch (e) {
      console.error('Error scraping series squads:', e);
      return [];
    } finally {
      await page.close();
    }
  }


  static async scrapeSeriesSquadPlayers(slug: string, teamName: string): Promise<any[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const url = `https://crex.com/series/${slug}/team-squad`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // 1. Find and Click the team in the sidebar (Retry logic)
      let clickSuccess = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        console.log(`[Scraper] Attempt ${attempt} to click team: ${teamName}`);
        const teamFound = await page.evaluate(async (tName: string) => {
          const teamElements = Array.from(document.querySelectorAll('app-team-squad-details'));
          const target = teamElements.find(el => {
            const text = el.querySelector('h3')?.textContent?.trim() || '';
            return text.toLowerCase().includes(tName.toLowerCase());
          });

          if (target) {
            // If already selected, return true immediately
            if (target.parentElement?.classList.contains('selected')) {
              return true;
            }
            target.scrollIntoView({ behavior: 'instant', block: 'center' });
            (target as HTMLElement).click();
            return true;
          }
          return false;
        }, teamName);

        if (!teamFound) {
          console.warn(`[Scraper] Team ${teamName} not found in sidebar.`);
          return [];
        }

        // 2. Wait for players to load. Match the header or selected state.
        try {
          await page.waitForFunction((tName: string) => {
            const selected = document.querySelector('.series-left-card.selected h3');
            return selected && selected.textContent?.toLowerCase().includes(tName.toLowerCase());
          }, { timeout: 4000 }, teamName);

          clickSuccess = true;
          console.log(`[Scraper] Successfully selected team: ${teamName}`);
          break; // Success
        } catch (e) {
          console.warn(`[Scraper] Timeout waiting for selection of ${teamName}. Retrying...`);
        }
      }

      if (!clickSuccess) {
        console.error(`[Scraper] Failed to select team ${teamName} after retries.`);
        // Crucial: Return empty to avoid showing wrong (India) players
        return [];
      }

      // Extra small buffer for list render
      await new Promise(r => setTimeout(r, 1000));

      // 3. Scrape Players
      return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href^="/player/"]')).map(el => {
          // Correct selectors based on inspection
          const nameEl = el.querySelector('.player-data .name');
          const roleEl = el.querySelector('.player-data .player-type');
          const imgEl = el.querySelector('img.lazyloaded') || el.querySelector('img');

          // Get name from text or try to parse from href for full name
          let name = nameEl?.childNodes[0]?.textContent?.trim(); // Get text node, ignore <span>(c)</span>
          const href = el.getAttribute('href');

          // specific logic for "akha name" (full name)
          // href is like /player/suryakumar-yadav-2Y
          if (href) {
            const slugMatch = href.match(/\/player\/(.*)-[a-zA-Z0-9]+$/);
            if (slugMatch && slugMatch[1]) {
              name = slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            }
          }

          return {
            name: name,
            role: roleEl?.textContent?.trim(),
            image: imgEl?.getAttribute('src')
          };
        });
      });

    } catch (e) {
      console.error('Error scraping squad players:', e);
      return [];
    } finally {
      await page.close();
    }
  }

  static async scrapeSeriesNews(slug: string): Promise<any[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const url = `https://crex.com/series/${slug}/news`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for news to load
      try {
        await page.waitForSelector('a.news-link', { timeout: 5000 });
      } catch (e) {
        // console.log('News selector not found or timed out');
      }

      return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a.news-link')).map(el => {
          const titleEl = el.querySelector('h3.title');
          const imgEl = el.querySelector('img');
          // Description is often missing in this view, use title or empty.
          // Using empty string as description is not visible in card here.
          const desc = '';
          const href = el.getAttribute('href');
          // href like /cricket-news/slug
          // extraction: last part
          const id = href?.split('/').pop() || '';

          return {
            id: id,
            title: titleEl?.textContent?.trim(),
            description: desc,
            image: imgEl?.getAttribute('src'),
            url: href
          };
        });
      });
    } catch (e) {
      console.error('Error scraping series news:', e);
      return [];
    } finally {
      await page.close();
    }
  }
}



