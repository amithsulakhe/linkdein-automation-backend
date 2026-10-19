import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, me } from '../controllers/authController.js';
import { validateBody } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/authValidators.js';
import { authenticate, loadUser } from '../middleware/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, validateBody(registerSchema), register);
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/logout', authenticate, loadUser, logout);
router.get('/me', authenticate, loadUser, me);

export default router;
