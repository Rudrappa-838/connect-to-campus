const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

// Subject Summary & Rename Routes (Specific routes MUST precede /:id)
router.get('/school-subjects', classController.getSchoolSubjectsSummary);
router.get('/school-subjects/:schoolId', classController.getSchoolSubjectsSummary);
router.put('/rename-subject', classController.renameSubject);
router.put('/subjects/rename', classController.renameSubject);

// Class Routes
router.get('/', classController.getAllClasses);
router.post('/', classController.createClass);
router.put('/:id', classController.updateClass);
router.delete('/:id', classController.deleteClass);

// Section Routes
router.get('/:classId/sections', classController.getSections);
router.post('/:classId/sections', classController.createSection);
router.put('/:classId/sections/:sectionId', classController.updateSection);
router.delete('/:classId/sections/:sectionId', classController.deleteSection);

// Subject Routes
router.get('/:classId/subjects', classController.getSubjects);
router.post('/:classId/subjects', classController.createSubject);
router.put('/:classId/subjects/:subjectId', classController.updateSubject);
router.delete('/:classId/subjects/:subjectId', classController.deleteSubject);

// Alias for consistency (legacy support if needed)
router.get('/:classId/sections/:sectionId/subjects', classController.getSubjects);

module.exports = router;
