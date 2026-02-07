import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cron from 'node-cron';
import matchRoutes from './routes/match';
import navRoutes from './routes/nav';
import { fetchAndStoreMatches } from './services/cricketService';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Database Connection
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI is not defined in environment variables');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/matches', matchRoutes);
app.use('/api', navRoutes);

// Socket.IO
io.on('connection', (socket: any) => {
  console.log('New client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Scheduled Job (Every 15 seconds)
// Scheduled Job (Every 15 seconds)
let isFetching = false;
cron.schedule('*/5 * * * * *', async () => {
  if (isFetching) {
    console.log('Previous fetch still in progress. Skipping...');
    return;
  }
  isFetching = true;
  console.log('Fetching live cricket scores...');
  try {
    await fetchAndStoreMatches(io);
  } catch (err) {
    console.error('Error in scheduled fetch:', err);
  } finally {
    isFetching = false;
  }
});

// Basic Route
app.get('/', (req, res) => {
  res.send('Cricket Live Score API is running');
});

// Start Server
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { io };

