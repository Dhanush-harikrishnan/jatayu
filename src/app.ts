import express, { Application, Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { errorHandler } from './middlewares/errorHandler';
import { authRoutes } from './routes/authRoute';
import { examRoutes } from './routes/examRoute';
import { dashboardRoutes } from './routes/dashboardRoute';
import { awsService } from './services/awsService';
import { config } from './config/env';

export const configureApp = (): Application => {
  const app = express();
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow non-browser clients (curl, server-to-server) that do not send Origin.
      if (!origin) {
        return callback(null, true);
      }

      if (config.cors.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  };

  // Middleware
  app.use(helmet());
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  // Serve static UI
  app.use(express.static(path.join(__dirname, '../public')));

  // Health check
  app.get('/health', (req: Request, res: Response) => res.status(200).json({ status: 'ok' }));
  app.get('/api/health', (req: Request, res: Response) => res.status(200).json({ status: 'ok' }));

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
  app.use('/dashboard', dashboardRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
