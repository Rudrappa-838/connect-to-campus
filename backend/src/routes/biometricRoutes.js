const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const { 
    searchUsers, 
    getEnrolledUsers,
    getTodayFaceAttendance,
    updateCredentials, 
    markDeviceAttendance, 
    handleExternalDeviceLog,
    enrollFace,
    markFaceAttendance,
    markFaceAttendanceById
} = require('../controllers/biometricController');

// PUBLIC WEBHOOK (For Devices)
router.all('/external-log', handleExternalDeviceLog);

// PROTECTED ROUTES (Dashboard)
router.use(authenticateToken);
router.get('/search', authorize('SCHOOL_ADMIN', 'TEACHER', 'STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'), searchUsers);
router.get('/enrolled', authorize('SCHOOL_ADMIN', 'TEACHER', 'STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'), getEnrolledUsers);
router.get('/today-attendance', authorize('SCHOOL_ADMIN', 'TEACHER', 'STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'), getTodayFaceAttendance);
router.post('/enroll', authorize('SCHOOL_ADMIN'), updateCredentials);

// Face Specific
router.post('/enroll-face', authorize('SCHOOL_ADMIN', 'TEACHER', 'STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'), enrollFace);
router.post('/mark-face', authorize('SCHOOL_ADMIN', 'TEACHER', 'STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'), markFaceAttendance);
router.post('/mark-face-id', authorize('SCHOOL_ADMIN', 'TEACHER', 'STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'), markFaceAttendanceById);

// Device Attendance can be hit by Admin (Scanning using PC)
router.post('/attendance', authorize('SCHOOL_ADMIN'), markDeviceAttendance);

module.exports = router;
