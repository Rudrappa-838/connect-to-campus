const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const schoolRoutes = require('./routes/schoolRoutes');

const app = express();

// Trust Proxy (Required for Rate Limiting behind Render/Vercel Load Balancers)
app.set('trust proxy', 1);

// Middleware
app.use(compression()); // Gzip compression (Faster Response)

// Configure Helmet with production-grade security headers
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    } : false,
    crossOriginEmbedderPolicy: false, // Allow cross-origin requests for mobile apps
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    }
}));

// Configure CORS with environment-based whitelist
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [
        'https://connect-to-campus-b56ac.web.app', // Firebase (Testing)
        process.env.FRONTEND_URL, // AWS S3/CloudFront (Production)
        'capacitor://localhost', // Mobile App (iOS)
        'http://localhost', // Mobile App (Android - Debug)
        'https://localhost', // Mobile App (Android - Release/Debug)
    ].filter(Boolean) // Remove undefined values
    : ['http://localhost:5173', 'http://localhost:5174', 'capacitor://localhost', 'http://localhost'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow all in development
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }

        // Allow requests with no origin (mobile apps, Postman)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost')) {
            callback(null, true);
        } else {
            console.warn(`🚫 Blocked CORS request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Debug Middleware: Log Origin and Headers for troubleshooting
app.use((req, res, next) => {
    console.log(`📡 Request: ${req.method} ${req.url}`);
    console.log(`   Origin: ${req.headers.origin || 'No Origin'}`);
    next();
});

app.use(morgan('dev')); // Logger
app.use(express.json({ limit: '50mb' })); // Parse JSON bodies (Increased for Base64 Images)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Force No-Cache for index.html to ensure updates are seen immediately
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Surrogate-Control', 'no-store');
    }
    next();
});

app.use(express.static(path.join(__dirname, '../public'))); // Serve static files (APKs, etc.)

// Rate Limiter (Prevent Crashing from DoS/Spam)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased limit to prevent false positives
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Routes (Handle both /api prefix and root for Firebase compatibility)
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/schools', '/schools'], schoolRoutes);
app.use(['/api/classes', '/classes'], require('./routes/classRoutes'));
app.use(['/api/students', '/students'], require('./routes/studentRoutes'));
app.use(['/api/teachers', '/teachers'], require('./routes/teacherRoutes'));
app.use(['/api/staff', '/staff'], require('./routes/staffRoutes'));
app.use(['/api/fees', '/fees'], require('./routes/feeRoutes'));
app.use(['/api/library', '/library'], require('./routes/libraryRoutes'));
app.use(['/api/salary', '/salary'], require('./routes/salaryRoutes'));
app.use(['/api/holidays', '/holidays'], require('./routes/holidayRoutes'));
app.use(['/api/timetable', '/timetable'], require('./routes/timetableRoutes'));
app.use(['/api/marks', '/marks'], require('./routes/marksRoutes'));

// ==========================================
// 🚀 MOUNTING MISSING ROUTES (FIXED)
// ==========================================
app.use(['/api/hostel', '/hostel'], require('./routes/hostelRoutes'));
app.use(['/api/transport', '/transport'], require('./routes/transportRoutes'));
app.use(['/api/admissions', '/admissions'], require('./routes/admissionsRoutes'));
app.use(['/api/finance', '/finance'], require('./routes/financeRoutes'));
app.use(['/api/calendar', '/calendar'], require('./routes/calendarRoutes')); // Events & Announcements
app.use(['/api/biometric', '/biometric'], require('./routes/biometricRoutes'));
app.use(['/api/ai', '/ai'], require('./routes/aiRoutes'));
app.use(['/api/notifications', '/notifications'], require('./routes/notificationRoutes'));
app.use(['/api/certificates', '/certificates'], require('./routes/certificateRoutes'));
app.use(['/api/exams', '/exams'], require('./routes/examScheduleRoutes'));
app.use(['/api/years', '/years'], require('./routes/academicYearRoutes'));
app.use(['/api/doubts', '/doubts'], require('./routes/doubtRoutes'));

app.use(['/api/exam-schedule', '/exam-schedule'], require('./routes/examScheduleRoutes'));
app.use(['/api/hostel', '/hostel'], require('./routes/hostelRoutes'));
app.use(['/api/finance', '/finance'], require('./routes/financeRoutes'));
app.use(['/api/calendar', '/calendar'], require('./routes/calendarRoutes'));
app.use(['/api/leaves', '/leaves'], require('./routes/leaveRoutes'));
app.use(['/api/transport', '/transport'], require('./routes/transportRoutes'));
app.use(['/api/certificates', '/certificates'], require('./routes/certificateRoutes'));
app.use(['/api/admissions', '/admissions'], require('./routes/admissionsRoutes'));
app.use(['/api/biometric', '/biometric'], require('./routes/biometricRoutes'));
app.use(['/api/doubts', '/doubts'], require('./routes/doubtRoutes'));
app.use(['/api/notifications', '/notifications'], require('./routes/notificationRoutes'));
app.use(['/api/ai', '/ai'], require('./routes/aiRoutes'));
app.use(['/api/grades', '/grades'], require('./routes/gradeRoutes'));
app.use(['/api/grades', '/grades'], require('./routes/gradeRoutes'));
app.use(['/api/academic-years', '/academic-years'], require('./routes/academicYearRoutes'));
app.use(['/api/debug', '/debug'], require('./routes/debugRoutes'));

// --- ADMS / Biometric Device Default Routes ---
// Many devices (Secureye, ZKTeco) hardcode these paths if "Request URL" isn't configurable.
const { handleExternalDeviceLog } = require('./controllers/biometricController');
app.all('/iclock/cdata', handleExternalDeviceLog);      // Main Attendance Log URL
app.all('/iclock/getrequest', (req, res) => res.send('OK')); // Command checks
app.all('/iclock/devicecmd', (req, res) => res.send('OK'));  // Device commands
app.all('/iclock/options', (req, res) => res.send('OK'));    // Configuration checks

// --- Mobile App "Switchboard" Route ---
// The APK points here. We redirect it to wherever the frontend is currently hosted.
// If we change hosting, we just update this URL. No APK rebuild needed!
app.get('/app-launch', (req, res) => {
    // Redirect to the currently active frontend hosting URL
    res.redirect(`https://connect-to-campus-b56ac.web.app?t=${Date.now()}`);
});

// Download App Route
app.get(['/api/download-app', '/download-app'], (req, res) => {
    const file = path.join(__dirname, '../public/school_app_optimized.apk');
    res.download(file, 'school_app_optimized.apk', (err) => {
        if (err) {
            console.error('Error downloading file:', err);
            res.status(404).send('App file not found on server.');
        }
    });
});

// Health Check (Handles both prefixed and non-prefixed roots)
app.get(['/api', '/'], async (req, res) => {
    try {
        await require('./config/db').pool.query('SELECT 1');
        res.json({
            status: 'OK',
            message: 'School Management API is running',
            db: 'Connected',
            timestamp: new Date()
        });
    } catch (e) {
        res.status(500).json({
            status: 'ERROR',
            message: 'API Running but DB Failed',
            error: e.message
        });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('🔥 Global Error Handler:', err);
    res.status(500).json({
        message: 'Something went wrong on the server',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

module.exports = app;
