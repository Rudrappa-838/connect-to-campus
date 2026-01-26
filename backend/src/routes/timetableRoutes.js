const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

// Timetable Routes
router.post('/generate', timetableController.generateTimetable);
router.get('/teacher', timetableController.getTeacherTimetable);
router.put('/:id', timetableController.updateTimetableSlot);
router.delete('/', timetableController.deleteTimetable);
router.get('/my-schedule', timetableController.getMyTimetable);
router.get('/', timetableController.getTimetable);

module.exports = router;
