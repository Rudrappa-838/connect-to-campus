const express = require('express');
const router = express.Router();
const questionBankController = require('../controllers/questionBankController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get questions (Admins, Teachers)
router.get('/questions', authenticateToken, questionBankController.getQuestions);

// Generate Paper PDFs (Admins, Teachers)
router.post('/generate-paper', authenticateToken, questionBankController.generatePaper);

module.exports = router;
