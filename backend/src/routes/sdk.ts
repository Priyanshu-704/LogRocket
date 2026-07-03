import { Router } from 'express';
import { ingestReport } from '../controllers/sdk';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiter to telemetry ingestion to prevent spamming
router.post('/report', rateLimiter(60, 60 * 1000), ingestReport);

export default router;
