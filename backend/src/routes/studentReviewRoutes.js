const express = require('express');
const router = express.Router();
const studentReviewController = require('../controllers/studentReviewController');
const { authenticateToken: protect, authorize } = require('../middleware/authMiddleware');

// All review routes require authentication
router.use(protect);

// Add a new review (Teachers and School Admins only)
router.post('/', authorize('TEACHER', 'SCHOOL_ADMIN'), studentReviewController.addReview);

// Get reviews for a specific student (Teacher/Admin/Student view)
router.get('/student/:student_id', authorize('TEACHER', 'SCHOOL_ADMIN', 'STUDENT'), studentReviewController.getStudentReviews);

// Get logical student's own reviews (Self access)
router.get('/my-reviews', authorize('STUDENT'), studentReviewController.getMyReviews);

// Delete a review
router.delete('/:id', authorize('TEACHER', 'SCHOOL_ADMIN'), studentReviewController.deleteReview);

module.exports = router;
