import express from 'express';
import Match from '../models/Match';

const router = express.Router();

// Get all live matches
router.get('/live', async (req, res) => {
  try {
    const matches = await Match.find({ status: 'Live' });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// Get match details
router.get('/:id', async (req, res) => {
  try {
    const match = await Match.findOne({ matchId: req.params.id });
    if (!match) return res.status(404).json({ message: 'Match not found' });
    res.json(match);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
