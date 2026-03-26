import { Router } from 'express';
import { getAdminStudents, getAdminViolations, getStudentExams } from '../controllers/dashboardController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Dashboard routes require authentication
router.use(authenticate);

router.get('/admin/students', getAdminStudents);
router.get('/admin/violations', getAdminViolations);
router.get('/student/exams', getStudentExams);

export const dashboardRoutes = router;
