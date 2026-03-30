try {
    const routes = require('./src/routes/studentReviewRoutes');
    console.log('✅ studentReviewRoutes loaded OK:', typeof routes);
} catch (e) {
    console.error('❌ FAILED to load studentReviewRoutes:', e.message);
    console.error(e.stack);
}

try {
    const ctrl = require('./src/controllers/studentReviewController');
    console.log('✅ studentReviewController loaded OK:', Object.keys(ctrl));
} catch (e) {
    console.error('❌ FAILED to load studentReviewController:', e.message);
}

try {
    const { createNotification } = require('./src/controllers/notificationController');
    console.log('✅ createNotification loaded OK:', typeof createNotification);
} catch (e) {
    console.error('❌ FAILED to load createNotification:', e.message);
}

process.exit(0);
