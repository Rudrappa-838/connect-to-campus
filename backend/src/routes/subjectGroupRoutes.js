const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/subjectGroupController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.use(authenticateToken);

const ADMIN = ['SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN'];

// ── Subjects Master ──────────────────────────────────────────────────────────
router.get('/subjects', ctrl.getSubjects);
router.post('/subjects', authorize(...ADMIN), ctrl.createSubject);
router.put('/subjects/:id', authorize(...ADMIN), ctrl.updateSubject);
router.delete('/subjects/:id', authorize(...ADMIN), ctrl.deleteSubject);

// ── Subject Groups (Combinations) ────────────────────────────────────────────
router.get('/groups', ctrl.getGroups);
router.post('/groups', authorize(...ADMIN), ctrl.createGroup);
router.put('/groups/:id', authorize(...ADMIN), ctrl.updateGroup);
router.delete('/groups/:id', authorize(...ADMIN), ctrl.deleteGroup);

// ── Student Combination Assignment ───────────────────────────────────────────
router.get('/assignments/class', ctrl.getClassAssignments);
router.get('/assignments/student/:student_id', ctrl.getStudentAssignment);
router.post('/assignments', authorize(...ADMIN), ctrl.assignStudentGroup);
router.post('/assignments/bulk', authorize(...ADMIN), ctrl.bulkAssignGroup);
router.post('/assignments/clear', authorize(...ADMIN), ctrl.clearAssignments);

module.exports = router;
