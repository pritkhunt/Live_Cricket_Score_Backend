import { ScraperService } from './src/services/scraperService';

async function verify() {
  const matchUrl = '/scoreboard/ZC2/250/1st-T20/U/Q/aus-vs-pak-1st-t20-australia-tour-of-pakistan-2026/live';
  console.log('Scraping match details for:', matchUrl);
  
  const data = await ScraperService.scrapeMatchDetail(matchUrl);
  
  if (data && data.scorecard) {
    console.log('Batting:');
    data.scorecard.batting.forEach((b: any) => {
      console.log(`${b.batsman} - ${b.runs}(${b.balls})`);
    });
    
    console.log('\nBowling:');
    data.scorecard.bowling.forEach((b: any) => {
      console.log(`${b.bowler} - ${b.wickets}/${b.runs} (${b.overs})`);
    });

    console.log('\nPartnership:', data.partnership);
    console.log('Recent Overs:', data.recentOvers);
  } else {
    console.log('No scorecard data found');
  }
}

verify();
