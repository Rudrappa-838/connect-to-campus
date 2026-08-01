const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', staffController.addStaff);
router.get('/', staffController.getStaff);
router.put('/:id', staffController.updateStaff);
router.delete('/:id', staffController.deleteStaff);

// Attendance Routes
router.post('/attendance', staffController.markAttendance);
router.get('/attendance', staffController.getAttendanceReport); // Monthly Query
router.get('/attendance/my', staffController.getMyAttendance);
router.get('/attendance/daily', staffController.getDailyAttendance); // Daily View
router.get('/attendance/today', staffController.getTodayAttendanceStatus);
router.post('/attendance/check-in', staffController.checkInStaff);
router.post('/attendance/check-out', staffController.checkOutStaff);
router.get('/attendance/geofence-logs', staffController.getStaffGeofenceLogs);
router.get('/profile', staffController.getProfile);
router.get('/salary/history', staffController.getSalarySlips);

module.exports = router;
