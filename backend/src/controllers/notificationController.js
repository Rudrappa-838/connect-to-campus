const { pool } = require('../config/db');
const { sendPushNotification } = require('../services/firebaseService');

// Get notifications for the logged-in user
const getMyNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Server error fetching notifications' });
    }
};

// Mark a notification as read
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Notification not found or access denied' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Mark ALL notifications as read
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
            [userId]
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create a notification (Internal or Admin use)
const createNotification = async (userId, title, message, type = 'INFO', data = {}) => {
    try {
        // 1. Save to Database
        const result = await pool.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, title, message, type]
        );

        // 2. Get FCM token and unread count
        const userRes = await pool.query('SELECT fcm_token FROM users WHERE id = $1', [userId]);
        const token = userRes.rows[0]?.fcm_token;

        if (token) {
            // Calculate total unread count (including this new one)
            const unreadRes = await pool.query(
                'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
                [userId]
            );
            const badgeCount = parseInt(unreadRes.rows[0].count) || 1;

            // FIRE AND FORGET - Don't block the response
            sendPushNotification(token, title, message, { ...data, type }, badgeCount)
                .catch(err => console.error('Push delivery failed:', err));
        }

        return result.rows[0];
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

// Update FCM token for a user
const updateToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id;

        if (!token) {
            return res.status(400).json({ message: 'Token is required' });
        }

        await pool.query(
            'UPDATE users SET fcm_token = $1 WHERE id = $2',
            [token, userId]
        );

        console.log(`[PUSH] Token updated for user ${userId}`);
        res.json({ message: 'Token updated successfully' });
    } catch (error) {
        console.error('Error updating FCM token:', error);
        res.status(500).json({ message: 'Server error updating token' });
    }
};

module.exports = {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
    createNotification,
    updateToken
};
