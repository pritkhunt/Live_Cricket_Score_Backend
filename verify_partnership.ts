import mongoose from 'mongoose';
import Match from './src/models/Match';
import dotenv from 'dotenv';

dotenv.config();

const verify = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cricket_live_score');
    console.log('Connected to MongoDB');

    const matches = await Match.find({ status: 'Live' });
    console.log(`Found ${matches.length} live matches`);

    for (const match of matches) {
      console.log(`Match: ${match.team1} vs ${match.team2}`);
      console.log(`Score1: "${match.score1}" Overs1: "${match.overs1}"`);
      console.log(`Score2: "${match.score2}" Overs2: "${match.overs2}"`);
      console.log(`Partnership: ${match.partnership}`);
      console.log('---');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

verify();
