import express from 'express';
import { getSeries, getTeams, getNews, getNewsDetail, getTeamDetail, getTeamMatches, getTeamNews, getSeriesDetail, getSeriesMatches, getSeriesPointsTable, getSeriesSquads, getSeriesSquadPlayers } from '../controllers/navController';

const router = express.Router();

router.get('/series', getSeries);
router.get('/series/:slug', getSeriesDetail);
router.get('/series/:slug/matches', getSeriesMatches);
router.get('/series/:slug/points', getSeriesPointsTable);
router.get('/series/:slug/squads', getSeriesSquads);
router.get('/series/:slug/squads/players', getSeriesSquadPlayers);
router.get('/teams', getTeams);
router.get('/teams/:slug', getTeamDetail);
router.get('/teams/:slug/matches', getTeamMatches);
router.get('/teams/:slug/news', getTeamNews);
router.get('/news', getNews);
router.get('/news/:slug', getNewsDetail);

export default router;
