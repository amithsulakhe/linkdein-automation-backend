import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDb } from './config/db.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { sendHome, sendPrivacy, sendTerms } from './pages/publicSite.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      autoLogging: env.NODE_ENV !== 'test',
    })
  );

  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    })
  );

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ success: true, status: 'ok' });
  });

  app.get('/', sendHome);
  app.get('/privacy', sendPrivacy);
  app.get('/terms', sendTerms);

  app.use(async (req, res, next) => {
    try {
      await connectDb();
      next();
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;

export const config = {
  maxDuration: 60,
};
