import { Request, Response } from 'express';
import { ScraperService } from '../services/scraperService';

export const getSeries = async (req: Request, res: Response) => {
  try {
    const series = await ScraperService.scrapeSeriesList();
    res.json(series);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching series', error });
  }
};

export const getTeams = async (req: Request, res: Response) => {
  try {
    const teams = await ScraperService.scrapeTeamList();
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching teams', error });
  }
};

export const getNews = async (req: Request, res: Response) => {
  try {
    const news = await ScraperService.scrapeNewsList();
    res.json(news);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching news', error });
  }
};

export const getNewsDetail = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const detail = await ScraperService.scrapeNewsDetail(slug);
    if (!detail) {
        res.status(404).json({ message: 'News not found' });
        return;
    }
    res.json(detail);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching news details', error });
  }
};

export const getTeamDetail = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const detail = await ScraperService.scrapeTeamDetail(slug);
    if (!detail) {
        res.status(404).json({ message: 'Team not found' });
        return;
    }
    res.json(detail);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching team details', error });
  }
};

export const getTeamMatches = async (req: Request, res: Response) => {
    try {
        const slug = req.params.slug as string;
        const matches = await ScraperService.scrapeTeamMatches(slug);
        res.json(matches);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching team matches', error });
    }
};

export const getTeamNews = async (req: Request, res: Response) => {
    try {
        const slug = req.params.slug as string;
        const news = await ScraperService.scrapeTeamNews(slug);
        res.json(news);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching team news', error });
    }
};

export const getSeriesDetail = async (req: Request, res: Response) => {
    try {
        const slug = req.params.slug as string;
        const detail = await ScraperService.scrapeSeriesDetail(slug);
        res.json(detail);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching series detail', error });
    }
};

export const getSeriesMatches = async (req: Request, res: Response) => {
    try {
        const slug = req.params.slug as string;
        const matches = await ScraperService.scrapeSeriesMatches(slug);
        res.json(matches);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching series matches', error });
    }
};

export const getSeriesPointsTable = async (req: Request, res: Response) => {
    try {
        const slug = req.params.slug as string;
        const table = await ScraperService.scrapeSeriesPointsTable(slug);
        res.json(table);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching series points table', error });
    }
};

export const getSeriesSquads = async (req: Request, res: Response) => {
     try {
        const slug = req.params.slug as string;
        const squads = await ScraperService.scrapeSeriesSquads(slug);
        res.json(squads);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching series squads', error });
    }
};

export const getSeriesSquadPlayers = async (req: Request, res: Response) => {
    try {
        const slug = req.params.slug as string;
        const teamName = req.query.team as string;
        if (!teamName) {
            res.status(400).json({ message: 'Team name is required' });
            return;
        }
        const players = await ScraperService.scrapeSeriesSquadPlayers(slug, teamName);
        res.json(players);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching squad players', error });
    }
};
