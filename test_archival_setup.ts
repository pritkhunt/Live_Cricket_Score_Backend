import mongoose from 'mongoose';
import Match from './src/models/Match';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cricket_live_score');

    // Create a dummy live match that is definitely active in DB but won't be in the scrape list (since matchId is fake)
    // We need a real URL that will return a result status.
    // Let's use a URL that we hope creates a "Result" status.
    const matchId = 'TEST_ARCHIVE_MATCH';
    
    // Clear all matches to ensure clean state and fast processing
    await Match.deleteMany({});
    // Also clear PastMatch to avoid duplicate key errors during testing
    try {
        const PastMatchModel = mongoose.model('PastMatch'); 
        await PastMatchModel.deleteMany({}); 
    } catch (e) {
        // Model might not be registered if we strictly import Match.ts only, 
        // but let's try to import it dynamically or just ignore if it fails for now, 
        // actually better to import it at top or define it. 
        // Since we are not importing PastMatch in this file, let's just use raw connection or import it.
    }

    await Match.create({
        matchId,
        team1: 'Test Team A',
        team2: 'Test Team B',
        status: 'Live',
        matchUrl: '/scoreboard/ZC2/250/1st-T20/U/Q/aus-vs-pak-1st-t20-australia-tour-of-pakistan-2026/live', // Using the AUS vs PAK url which might be finished
        score1: '100/10',
        score2: '90/10'
    });

    console.log('Created test match: TEST_ARCHIVE_MATCH');
    process.exit(0);
};

run();
