const express = require('express');
const router = express.Router();
const outPassController = require('../controllers/outPassController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.use(authenticateToken);

// Teacher/Staff routes
router.post('/', outPassController.createOutPass);
router.put('/:id/checkin', outPassController.checkIn);
router.get('/my', outPassController.getMyOutPasses);

// Admin route
router.get('/', authorize('SCHOOL_ADMIN', 'SUPER_ADMIN'), outPassController.getAllOutPasses);

module.exports = router;
