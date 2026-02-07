const express = require('express');
const router = express.Router();
const { createSchool, getSchools, getSchoolDetails, updateSchool, getMySchool, toggleSchoolStatus, deleteSchool, restoreSchool, getDeletedSchools, permanentDeleteSchool, updateSchoolFeatures, updateSchoolLogo, getDashboardStats, updateMySchoolSettings } = require('../controllers/schoolController');
const { authenticateToken, requireSuperAdmin, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticateToken);

// School Admin Routes
router.get('/my-school', authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'STAFF', 'DRIVER', 'TRANSPORT_MANAGER'), getMySchool);
router.get('/dashboard-stats', authorize('SCHOOL_ADMIN'), getDashboardStats);
router.put('/my-school/logo', authorize('SCHOOL_ADMIN'), updateSchoolLogo);
router.put('/my-school/settings', authorize('SCHOOL_ADMIN'), updateMySchoolSettings);

// Super Admin Routes (Protected)
router.post('/', requireSuperAdmin, createSchool);
router.get('/', requireSuperAdmin, getSchools);
router.get('/deleted/all', requireSuperAdmin, getDeletedSchools); // Get deleted schools (dustbin)
router.get('/:id', requireSuperAdmin, getSchoolDetails);
router.put('/:id', requireSuperAdmin, updateSchool);
router.put('/:id/features', requireSuperAdmin, updateSchoolFeatures); // Feature Toggles
router.put('/:id/status', requireSuperAdmin, toggleSchoolStatus);
router.delete('/:id', requireSuperAdmin, deleteSchool); // Soft delete school
router.delete('/:id/permanent', requireSuperAdmin, permanentDeleteSchool); // Permanent delete school
router.put('/:id/restore', requireSuperAdmin, restoreSchool); // Restore school from bin

module.exports = router;
