const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateToken: protect, authorize } = require('../middleware/authMiddleware');

// Protect all routes
router.use(protect);

// Student Profile (Accessible by Student)
router.get('/profile', authorize('STUDENT'), studentController.getStudentProfile);
router.get('/attendance/my-report', authorize('STUDENT'), studentController.getMyAttendanceReport);
router.get('/my-attendance', authorize('STUDENT'), studentController.getMyAttendanceReport);
router.get('/my-fees', authorize('STUDENT'), studentController.getMyFees);

// Restrict remaining routes to Admin/Teacher
router.use(authorize('SCHOOL_ADMIN', 'TEACHER', 'STAFF')); // Added STAFF if they need access, usually Admin/Teacher

// Bin Routes - Placed at top priority
router.get('/bin', studentController.getDeletedStudents);
router.get('/unassigned', studentController.getUnassignedStudents); // Students whose class/section was deleted
router.put('/:id/restore', studentController.restoreStudent);
router.delete('/:id/permanent', studentController.permanentDeleteStudent);

// Deleted Students Search Routes (Left Students)
router.get('/deleted/marks', studentController.getDeletedStudentMarks);
router.get('/deleted/certificates', studentController.getDeletedStudentCertificates);

router.post('/', studentController.addStudent);
router.get('/', studentController.getStudents);
router.put('/:id', studentController.updateStudent);
router.delete('/:id', studentController.deleteStudent);

router.post('/attendance', studentController.markAttendance);
router.get('/attendance', studentController.getAttendanceReport);

router.get('/attendance/summary', studentController.getAttendanceSummary);
router.get('/attendance/daily', studentController.getDailyAttendance);

// Student Promotion Routes
const promotionController = require('../controllers/promotionController');
router.post('/promote', promotionController.promoteStudents);
router.get('/:student_id/promotion-history', promotionController.getPromotionHistory);
router.get('/academic-year/current', promotionController.getCurrentAcademicYear);

// Multer for Bulk Upload
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/bulk-upload', upload.single('file'), studentController.bulkUploadStudents);
router.post('/roll-numbers', studentController.reorderRollNumbers);

module.exports = router;
