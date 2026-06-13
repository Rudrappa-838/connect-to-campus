const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/profile', teacherController.getTeacherProfile);
router.put('/profile', teacherController.updateMyProfile);
router.get('/subjects', teacherController.getSubjects);
router.post('/', teacherController.addTeacher);
router.get('/', teacherController.getTeachers);
router.put('/:id', teacherController.updateTeacher);
router.delete('/:id', teacherController.deleteTeacher);

// Attendance Routes
router.post('/attendance', teacherController.markAttendance);
router.get('/attendance', teacherController.getAttendanceReport); // Monthly Query
router.get('/attendance/my', teacherController.getMyAttendanceHistory); // My History
router.get('/attendance/daily', teacherController.getDailyAttendance); // Daily View
router.get('/attendance/today', teacherController.getTodayAttendanceStatus);
router.post('/attendance/check-in', teacherController.checkInTeacher);
router.post('/attendance/check-out', teacherController.checkOutTeacher);
router.get('/attendance/geofence-logs', teacherController.getTeacherGeofenceLogs);

module.exports = router;
