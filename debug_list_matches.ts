
import { ScraperService } from './src/services/scraperService';

async function verifyList() {
    console.log('Fetching live matches with new logic...');
    try {
        const matches = await ScraperService.scrapeLiveMatches();
        console.log('RESULTS:');
        matches.forEach(m => {
            console.log(`${m.team1} (${m.score1} ${m.overs1}) vs ${m.team2} (${m.score2} ${m.overs2})`);
            console.log(`   Status: ${m.status} | Toss: ${m.toss}`);
            console.log(`   Venue: ${m.venue}`);
            console.log(`   Batting: ${m.battingTeam}`);
            if (m.team1XI && m.team1XI.length > 0) {
                console.log(`   Team 1 XI (${m.team1XI.length}): ${m.team1XI.slice(0, 3).join(', ')}...`);
            }
            if (m.team2XI && m.team2XI.length > 0) {
                console.log(`   Team 2 XI (${m.team2XI.length}): ${m.team2XI.slice(0, 3).join(', ')}...`);
            }
            console.log(`   Logos: ${m.team1Logo} | ${m.team2Logo}`);
        });
        if (matches.length > 0) {
            const liveMatch = matches.find(m => m.status === 'Live');
            if (liveMatch && liveMatch.matchUrl) {
                console.log(`\nFetching details for: ${liveMatch.team1} vs ${liveMatch.team2}`);
                console.log(`URL: ${liveMatch.matchUrl}`);
                const details = await ScraperService.scrapeMatchDetail(liveMatch.matchUrl);
                if (details) {
                    console.log('Match Details Found:');
                    if (details.team1XI) console.log(`Team 1 XI (${details.team1XI.length}):`, details.team1XI);
                    if (details.team2XI) console.log(`Team 2 XI (${details.team2XI.length}):`, details.team2XI);
                } else {
                    console.log('No details returned.');
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

verifyList();
