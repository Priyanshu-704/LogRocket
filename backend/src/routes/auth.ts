import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect as any, getMe as any);

export default router;
