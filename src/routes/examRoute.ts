import { Router } from 'express';
import { generatePairingLink } from '../controllers/examController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// Endpoint for the primary laptop to request pairing for a secondary device
router.post('/:examId/pair', authenticate, requireRole(['primary']), generatePairingLink);

export const examRoutes = router;
