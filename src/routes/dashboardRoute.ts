import { Router } from 'express';
import {
	getAdminStudents,
	getAdminViolations,
	getStudentExams,
	getAdminExams,
	updateAdminExamSettings,
	sendAdminExamNotification,
	createCustomExam,
	terminateSession,
} from '../controllers/dashboardController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// Dashboard routes require authentication
router.use(authenticate);

router.get('/admin/students', requireRole(['admin']), getAdminStudents);
router.get('/admin/violations', requireRole(['admin']), getAdminViolations);
router.get('/admin/exams', requireRole(['admin']), getAdminExams);
router.post('/admin/exams', requireRole(['admin']), createCustomExam);
router.patch('/admin/exams/:examId/settings', requireRole(['admin']), updateAdminExamSettings);
router.post('/admin/exams/:examId/notify', requireRole(['admin']), sendAdminExamNotification);
router.delete('/admin/sessions/:sessionId', requireRole(['admin']), terminateSession);
router.get('/student/exams', getStudentExams);

export const dashboardRoutes = router;
