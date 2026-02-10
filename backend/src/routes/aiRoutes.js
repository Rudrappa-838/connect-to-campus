const express = require('express');
const router = express.Router();
const { generateQuestions, generateQuestionPaper } = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/authMiddleware');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Route: POST /api/ai/generate-questions (Image based)
router.post('/generate-questions', authenticateToken, upload.array('files', 5), generateQuestions);

// Route: POST /api/ai/generate-paper (Text Prompt based)
router.post('/generate-paper', authenticateToken, express.json(), generateQuestionPaper);

module.exports = router;
