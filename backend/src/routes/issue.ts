import { Router } from 'express';
import { getIssues, resolveIssue } from '../controllers/issue';
import { protect } from '../middleware/auth';

const router = Router();

// Apply auth protection to all dashboard issue query endpoints
router.use(protect as any);

router.get('/:projectId', getIssues as any);
router.put('/:projectId/:issueId/resolve', resolveIssue as any);

export default router;
