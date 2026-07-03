import { Router } from 'express';
import { createProject, getProjects, generateApiKey, updateProjectSettings } from '../controllers/project';
import { protect } from '../middleware/auth';

const router = Router();

// Apply auth protection to all project management endpoints
router.use(protect as any);

router.post('/', createProject as any);
router.get('/', getProjects as any);
router.post('/:projectId/api-key', generateApiKey as any);
router.put('/:projectId/settings', updateProjectSettings as any);

export default router;
