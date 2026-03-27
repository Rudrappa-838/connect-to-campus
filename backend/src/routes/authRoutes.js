const express = require('express');
const router = express.Router();
const { login, logout, forgotPassword, getUserDetails, verifyOTP, resetPassword, registerFcmToken, changePassword } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.post('/forgot-password', forgotPassword);
router.post('/get-user-details', getUserDetails);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);
router.post('/change-password', changePassword);
router.post('/register-fcm', authenticateToken, registerFcmToken);
router.post('/register-fcm', authenticateToken, registerFcmToken);
router.post('/setup-admin', require('../controllers/authController').setupSuperAdmin);

// Canary Route to check if Auth Routes are reachable
router.get('/canary', (req, res) => res.json({ status: 'Canary Alive', time: new Date() }));

module.exports = router;
