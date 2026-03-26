import { Router } from 'express';
import { generatePairingLink, createLivenessSession, getLivenessResult, getPresignedUrl, analyzeFrame, analyzeSetupFrame, analyzeLiveFrame, sendExamReport } from '../controllers/examController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// Endpoint for the primary laptop to request pairing for a secondary device
router.post('/:examId/pair', authenticate, requireRole(['primary']), generatePairingLink);
router.post('/:examId/create-liveness-session', authenticate, requireRole(['primary']), createLivenessSession);
router.get('/:examId/get-liveness-result/:sessionId', authenticate, requireRole(['primary']), getLivenessResult);
router.post('/:examId/presigned-url', authenticate, requireRole(['primary']), getPresignedUrl);
router.post('/:examId/analyze-frame', authenticate, requireRole(['primary']), analyzeFrame);
router.post('/:examId/analyze-setup-frame', authenticate, requireRole(['primary']), analyzeSetupFrame);
router.post('/:examId/analyze-live-frame', authenticate, requireRole(['primary']), analyzeLiveFrame);
router.post('/:examId/report/:sessionId', authenticate, requireRole(['primary', 'admin']), sendExamReport);

export const examRoutes = router;
