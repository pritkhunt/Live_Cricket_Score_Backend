
import { ScraperService } from './src/services/scraperService';

async function debug() {
  // Use a known live match URL or scrape live matches to find one
  const matchUrl = '/scoreboard/W5C/1X9/24th-Match/NY/NV/tas-w-vs-wa-w-24th-match-womens-national-cricket-league-2025-26/live';
  console.log('Scraping match details for:', matchUrl);
  
  const data = await ScraperService.scrapeMatchDetail(matchUrl);
  
  if (data && data.scorecard && data.scorecard.batting) {
    console.log('Batting Dismissals:');
    data.scorecard.batting.forEach((b: any) => {
      console.log(`[${b.batsman}] Dismissal: "${b.dismissal}"`);
      
      // Simulating parseDismissal logic
      const dismissal = b.dismissal.trim();
      if (dismissal === 'Batting' || dismissal === 'not out') {
          console.log('  -> MATCH: Batting/not out');
      } else {
          const regex = /\b(c |b |lbw|run out)\b/g;
          if (regex.test(dismissal)) {
               console.log('  -> MATCH: Regex found keywords');
          } else {
               console.log('  -> NO MATCH');
          }
      }
    });
  } else {
    console.log('No scorecard data found');
  }
}

debug();
