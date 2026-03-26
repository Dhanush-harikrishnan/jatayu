import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { errorHandler } from './middlewares/errorHandler';
import { authRoutes } from './routes/authRoute';
import { examRoutes } from './routes/examRoute';
import { awsService } from './services/awsService';

export const configureApp = (): Application => {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  // Serve static UI
  app.use(express.static(path.join(__dirname, '../public')));

  // Health check
  app.get('/health', (req: Request, res: Response) => res.status(200).json({ status: 'ok' }));

  app.get('/health/db', async (req: Request, res: Response) => {
    const isDbConnected = await awsService.checkDatabaseConnection();
    if (isDbConnected) {
      res.status(200).json({ status: 'ok', database: 'connected' });
    } else {
      res.status(503).json({ status: 'error', database: 'disconnected', message: 'Failed to connect to DynamoDB' });
    }
  });

  // Routes
  app.use('/auth', authRoutes);
  app.use('/exam', examRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
