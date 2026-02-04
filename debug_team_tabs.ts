
import { ScraperService } from './src/services/scraperService';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function debugTeamTabs() {
  try {
    console.log('Testing Team Matches Scraping...');
    const matches = await ScraperService.scrapeTeamMatches('mumbai-indians-F');
    console.log(`Found ${matches.length} matches.`);
    if (matches.length > 0) console.log('Sample Match:', matches[0]);

    console.log('\nTesting Team News Scraping...');
    const news = await ScraperService.scrapeTeamNews('mumbai-indians-F');
    console.log(`Found ${news.length} news items.`);
    if (news.length > 0) console.log('Sample News:', news[0]);

  } catch (error) {
    console.error('Error during debugging:', error);
  }
}

debugTeamTabs();
