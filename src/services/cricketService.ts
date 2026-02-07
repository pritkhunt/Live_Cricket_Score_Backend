import Match from '../models/Match';
import PastMatch from '../models/PastMatch';
import { Server } from 'socket.io';
import { ScraperService } from './scraperService';

export const fetchAndStoreMatches = async (io: Server) => {
  try {
    console.log('Starting Crex.com scrape...');
    const scrapedMatches = await ScraperService.scrapeLiveMatches();
    console.log(`Scraped ${scrapedMatches.length} matches`);

    // Deduplicate matches by matchId
    const uniqueMatches = Array.from(new Map(scrapedMatches.map(m => [m.matchId, m])).values());
    console.log(`Processing ${uniqueMatches.length} unique matches`);

    // Prepare all match update promises
    const processedMatches: any[] = [];
    const matchUpdatePromises = uniqueMatches.map(async (matchData) => {
      try {
        let updateData: any = { ...matchData };

        // Always try to get details for live matches to ensure commentary updates
        if (matchData.status === 'Live' && matchData.matchUrl) {
          const details = await ScraperService.scrapeMatchDetail(matchData.matchUrl);
          if (details) {
            // Defensive Merge: Only merge non-empty objects/arrays
            if (details.scorecard && (details.scorecard.batting.length > 0 || details.scorecard.bowling.length > 0)) {
              updateData.scorecard = details.scorecard;
            }
            if (details.commentary && details.commentary.length > 0) {
              updateData.commentary = details.commentary;
            }
            if (details.partnership) updateData.partnership = details.partnership;
            if (details.recentOvers && details.recentOvers.length > 0) updateData.recentOvers = details.recentOvers;
            if (details.crr) updateData.crr = details.crr;
            if (details.rrr) updateData.rrr = details.rrr;
            if (details.matchStatus) updateData.matchStatus = details.matchStatus;

            if (details.team1XI && details.team1XI.length > 0 && details.team2XI && details.team2XI.length > 0) {
              updateData.playingXI = {
                team1: details.team1XI,
                team2: details.team2XI
              };
            }
          }
        }

        const match = await Match.findOneAndUpdate(
          { matchId: matchData.matchId },
          { $set: updateData },
          { upsert: true, new: true, runValidators: true }
        );

        if (match) {
          processedMatches.push(match.toObject());
        }
      } catch (err) {
        console.error(`Error updating match ${matchData.matchId}:`, err);
      }
    });

    // Run all updates in parallel
    await Promise.all(matchUpdatePromises);

    // Broadcast all updates synchronously
    processedMatches.forEach(m => io.emit('score_update', m));

    // Archive completed matches
    const activeMatchIds = scrapedMatches.map(m => m.matchId);
    const liveMatchesInDb = await Match.find({ status: 'Live' });

    for (const dbMatch of liveMatchesInDb) {
      if (!activeMatchIds.includes(dbMatch.matchId)) {
        console.log(`Checking status for potentially finished match: ${dbMatch.matchId}`);
        // Match is in DB as Live but not in current scrape list. Check if it's finished.
        if (dbMatch.matchUrl) {
          const details = await ScraperService.scrapeMatchDetail(dbMatch.matchUrl);

          if (details && details.matchStatus) {
            const statusText = details.matchStatus.toLowerCase();
            if (statusText.includes('won by') || statusText.includes('match ended') || statusText.includes('result') || statusText.includes('draw') || statusText.includes('tie')) {
              console.log(`Archiving match ${dbMatch.matchId} - Status: ${details.matchStatus}`);

              // Create PastMatch
              const pastMatchData = dbMatch.toObject();
              pastMatchData.status = details.matchStatus; // Update status to specific result
              pastMatchData.scorecard = details.scorecard || pastMatchData.scorecard;
              pastMatchData.partnership = details.partnership || pastMatchData.partnership;
              pastMatchData.recentOvers = details.recentOvers || pastMatchData.recentOvers;


              // Remove _id to allow Mongo to generate a new one or use matchId as unique
              delete (pastMatchData as any)._id;
              delete (pastMatchData as any).__v;

              // Use findOneAndUpdate with upsert to prevent duplicate key errors
              await PastMatch.findOneAndUpdate(
                { matchId: dbMatch.matchId },
                pastMatchData,
                { upsert: true, new: true }
              );

              await Match.deleteOne({ _id: dbMatch._id });

              io.emit('match_archived', { matchId: dbMatch.matchId });
            }
          }
        }
      }
    }

    console.log('Matches updated from Crex.com and broadcasted');
  } catch (error) {
    console.error('Error in fetchAndStoreMatches:', error);
  }
};
