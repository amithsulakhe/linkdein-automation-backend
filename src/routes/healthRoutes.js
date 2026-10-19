import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/ready', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  if (!dbReady) {
    return res.status(503).json({ success: false, status: 'not_ready', db: false });
  }
  res.json({ success: true, status: 'ready', db: true });
});

export default router;
