import { Router } from 'express';
import { createProject, getProjects, generateApiKey, updateProjectSettings, getProjectApiKeys } from '../controllers/project';
import { protect } from '../middleware/auth';
import { uploadSourceMap } from '../controllers/sourceMap';

const router = Router();

// Apply auth protection to all project management endpoints
router.use(protect as any);

router.post('/', createProject as any);
router.get('/', getProjects as any);
router.post('/:projectId/api-key', generateApiKey as any);
router.get('/:projectId/api-keys', getProjectApiKeys as any);
router.put('/:projectId/settings', updateProjectSettings as any);
router.post('/:projectId/source-maps', uploadSourceMap as any);

export default router;
