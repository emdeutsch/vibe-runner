/**
 * VibeRunner API Server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getConfig } from './config.js';
import authRoutes from './routes/auth.js';
import repoRoutes from './routes/repos.js';
import heartbeatRoutes from './routes/heartbeat.js';
import { startHeartbeatChecker, stopHeartbeatChecker } from './services/heartbeat-checker.js';

// Load environment variables
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '0.1.0',
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/repos', repoRoutes);
app.use('/heartbeat', heartbeatRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
function start(): void {
  try {
    const config = getConfig();

    // Start heartbeat checker
    startHeartbeatChecker();

    app.listen(config.port, () => {
      console.log(`VibeRunner API running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down...');
      stopHeartbeatChecker();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down...');
      stopHeartbeatChecker();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export { app };
