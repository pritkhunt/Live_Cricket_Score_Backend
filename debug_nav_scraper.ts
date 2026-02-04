
import { ScraperService } from './src/services/scraperService';

(async () => {
  console.log('Testing Scraper Service for Nav Items...');
  
  try {
      console.log('\n--- Scraping Series ---');
      const series = await ScraperService.scrapeSeriesList();
      console.log(`Found ${series.length} series.`);
      if (series.length > 0) console.log('Sample:', series[0]);

      console.log('\n--- Scraping Teams ---');
      const teams = await ScraperService.scrapeTeamList();
      console.log(`Found ${teams.length} teams.`);
      if (teams.length > 0) console.log('Sample:', teams[0]);

      console.log('\n--- Scraping News ---');
      const news = await ScraperService.scrapeNewsList();
      console.log(`Found ${news.length} news items.`);
      if (news.length > 0) console.log('Sample:', news[0]);

  } catch (e) {
      console.error('Error in debug script:', e);
  }
  
  process.exit();
})();
