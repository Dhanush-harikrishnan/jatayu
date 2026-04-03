import { Router } from 'express';
import { createQuestion, batchCreateQuestions, getQuestionsByExamId, updateQuestion, deleteQuestion } from '../controllers/questionController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// Admin routes
router.post('/batch', authenticate, requireRole(['admin']), batchCreateQuestions);
router.post('/', authenticate, requireRole(['admin']), createQuestion);
router.put('/:questionId', authenticate, requireRole(['admin']), updateQuestion);
router.delete('/:questionId', authenticate, requireRole(['admin']), deleteQuestion);

// Student accessible routes
router.get('/:examId', authenticate, getQuestionsByExamId);

export default router;