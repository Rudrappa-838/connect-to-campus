const express = require('express');
const router = express.Router();
const { 
    createSchool, getSchools, getSchoolDetails, updateSchool, getMySchool, 
    toggleSchoolStatus, deleteSchool, restoreSchool, getDeletedSchools, 
    permanentDeleteSchool, updateSchoolFeatures, updateSchoolLogo, 
    getDashboardStats, updateMySchoolSettings, uploadWordTemplate, 
    getWordTemplates, setDefaultWordTemplate, deleteWordTemplate, 
    updateWordTemplate 
} = require('../controllers/schoolController');
const { authenticateToken, requireSuperAdmin, authorize } = require('../middleware/authMiddleware');
const multer = require('multer');

// Configure multer for memory storage (for docx templates)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB Limit
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(docx)$/)) {
            return cb(new Error('Only .docx files are allowed'), false);
        }
        cb(null, true);
    }
});

// All routes require authentication
router.use(authenticateToken);

// Word Template Routes (Must come BEFORE generic /my-school to avoid shadowing)
router.get('/my-school/word-templates', authorize('SCHOOL_ADMIN'), getWordTemplates);
router.post('/my-school/word-templates', authorize('SCHOOL_ADMIN'), upload.single('template'), uploadWordTemplate);
router.put('/my-school/word-templates/:id', authorize('SCHOOL_ADMIN'), upload.single('template'), updateWordTemplate);
router.put('/my-school/word-templates/:id/default', authorize('SCHOOL_ADMIN'), setDefaultWordTemplate);
router.delete('/my-school/word-templates/:id', authorize('SCHOOL_ADMIN'), deleteWordTemplate);

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
