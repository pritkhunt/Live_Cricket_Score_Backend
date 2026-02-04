import mongoose, { Schema, Document } from 'mongoose';

export interface IBattingStats {
  batsman: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  sr: number;
  dismissal: string;
}

export interface IBowlingStats {
  bowler: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  er: number;
}

export interface ICommentary {
  over: number;
  ball: number;
  event: string;
  description: string;
  runs: number;
  isWicket: boolean;
}

export interface IMatch extends Document {
  matchId: string;
  team1: string;
  team2: string;
  team1Logo: string;
  team2Logo: string;
  score1: string;
  score2: string;
  overs1: string;
  overs2: string;
  battingTeam: string;
  status: string;
  toss: string;
  venue: string;
  partnership: string;
  matchUrl: string;
  playingXI: { team1: string[], team2: string[] };
  scorecard: {
    batting: {
      batsman: string;
      runs: string;
      balls: string;
      fours: string;
      sixes: string;
      sr: string;
      dismissal: string;
    }[];
    bowling: {
      bowler: string;
      overs: string;
      maidens: string;
      runs: string;
      wickets: string;
      er: string;
    }[];
  };
  recentOvers: string[];
  commentary: ICommentary[];
  matchStatus: string;
  updatedAt: Date;
}

const MatchSchema: Schema = new Schema({
  matchId: { type: String, required: true, unique: true },
  team1: { type: String, required: true },
  team2: { type: String, required: true },
  team1Logo: { type: String },
  team2Logo: { type: String },
  score1: { type: String, default: '0/0' },
  score2: { type: String, default: '0/0' },
  overs1: { type: String, default: '0.0' },
  overs2: { type: String, default: '0.0' },
  battingTeam: { type: String },
  status: { type: String, default: 'Upcoming' },
  toss: { type: String },
  venue: { type: String },
  partnership: { type: String },
  matchStatus: { type: String },
  matchUrl: { type: String },
  playingXI: {
    team1: [String],
    team2: [String]
  },
  scorecard: {
    batting: [{
      batsman: String,
      runs: String,
      balls: String,
      fours: String,
      sixes: String,
      sr: String,
      dismissal: String
    }],
    bowling: [{
      bowler: String,
      overs: String,
      maidens: String,
      runs: String,
      wickets: String,
      er: String
    }]
  },
  recentOvers: [String],
  commentary: [{
    over: String,
    ball: String,
    event: String,
    description: String,
    score: String,
    isWicket: Boolean
  }]
}, { timestamps: true });

export default mongoose.model<IMatch>('Match', MatchSchema);
