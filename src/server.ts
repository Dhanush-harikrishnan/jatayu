import http from 'http';
import { configureApp } from './app';
import { initializeSocketServer } from './socket';
import { config } from './config/env';
import { logger } from './logger';

const startServer = async () => {
  try {
    const app = configureApp();
    const server = http.createServer(app);

    // Initialize Socket.io (WebSocket only)
    initializeSocketServer(server);

    server.listen(config.port, () => {
      logger.info(`Server is running in ${config.env} mode on port ${config.port}`);
    });

    // Graceful Shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
