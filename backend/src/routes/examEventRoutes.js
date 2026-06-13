const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/examEventController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.use(authenticateToken);

const ADMIN = ['SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN'];
const TEACHER_ADMIN = ['SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'TEACHER'];

// ── Exam Events ──────────────────────────────────────────────────────────────
router.get('/events', ctrl.getEvents);
router.get('/events/:id', ctrl.getEventById);
router.post('/events', authorize(...ADMIN), ctrl.createEvent);
router.put('/events/:id', authorize(...ADMIN), ctrl.updateEvent);
router.post('/events/:id/publish', authorize(...ADMIN), ctrl.publishEvent);
router.delete('/events/:id', authorize(...ADMIN), ctrl.deleteEvent);

// ── Timetable Slots ──────────────────────────────────────────────────────────
router.get('/events/:event_id/slots', ctrl.getSlots);
router.post('/events/:event_id/slots', authorize(...ADMIN), ctrl.saveSlots);

// ── Marks Entry ──────────────────────────────────────────────────────────────
router.get('/slots/:slot_id/students', authorize(...TEACHER_ADMIN), ctrl.getStudentsForSlot);
router.post('/slots/:slot_id/marks', authorize(...TEACHER_ADMIN), ctrl.saveMarks);

// ── Reports ──────────────────────────────────────────────────────────────────
router.get('/marksheet', ctrl.getStudentMarksheet);                 // ?student_id=&event_id=
router.get('/events/:event_id/ranks', authorize(...TEACHER_ADMIN), ctrl.getClassRanks);
router.get('/my-marks', ctrl.getMyExamMarks);                       // Student's own marks

module.exports = router;
