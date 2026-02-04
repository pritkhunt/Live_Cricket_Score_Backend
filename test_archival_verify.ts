import mongoose from 'mongoose';
import PastMatch from './src/models/PastMatch';
import Match from './src/models/Match';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cricket_live_score');

    const matchId = 'TEST_ARCHIVE_MATCH';
    
    // Check if it's gone from Match
    const match = await Match.findOne({ matchId });
    if (match) {
        console.log('Match still in active collection. Archival failed or not yet run.');
    } else {
        console.log('Match removed from active collection.');
    }

    // Check if it's in PastMatch
    const pastMatch = await PastMatch.findOne({ matchId });
    if (pastMatch) {
        console.log('Match found in PastMatch collection. Archival SUCCESS.');
        console.log('Status:', pastMatch.status);
    } else {
        console.log('Match NOT found in PastMatch collection.');
    }

    process.exit(0);
};

run();
