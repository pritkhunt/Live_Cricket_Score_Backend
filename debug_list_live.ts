import mongoose from 'mongoose';
import Match from './src/models/Match';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cricket_live_score');

    const liveMatches = await Match.find({ status: 'Live' });
    console.log(`Found ${liveMatches.length} live matches in DB:`);
    liveMatches.forEach(m => console.log(`- ${m.matchId} (${m.status}) URL: ${m.matchUrl?.substring(0, 50)}...`));

    process.exit(0);
};

run();
