const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');

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
        'https://connect2campus.co.in',          // Production domain
        'https://www.connect2campus.co.in',       // Production domain (www)
        'https://connect-to-campus-b56ac.web.app', // Firebase (Testing)
        process.env.FRONTEND_URL,                 // Fallback env override
        'capacitor://localhost',                  // Mobile App (iOS)
        'http://localhost',                       // Mobile App (Android - Debug)
        'https://localhost',                      // Mobile App (Android - Release)
    ].filter(Boolean) // Remove undefined values
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'capacitor://localhost', 'http://localhost'];

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
    if (process.env.NODE_ENV !== 'production') {
        console.log(`📡 Request: ${req.method} ${req.url}`);
        console.log(`   Origin: ${req.headers.origin || 'No Origin'}`);
    }
    next();
});

app.use(process.env.NODE_ENV === 'production' ? morgan('combined') : morgan('dev')); // Logger
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
app.use('/api', express.static(path.join(__dirname, '../public'))); // Serve under /api so Nginx routes to Node

// Rate Limiter (Prevent Crashing from DoS/Spam)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased limit to prevent false positives
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// ==========================================
// 🚀 CONSOLIDATED ROUTES
// ==========================================
const route = (path, file) => app.use([`/api/${path}`, `/${path}`], require(`./routes/${file}`));

app.use(['/api/auth', '/auth'], authRoutes);
route('schools', 'schoolRoutes');
route('classes', 'classRoutes');
route('students', 'studentRoutes');
route('teachers', 'teacherRoutes');
route('staff', 'staffRoutes');
route('fees', 'feeRoutes');
route('library', 'libraryRoutes');
route('salary', 'salaryRoutes');
route('holidays', 'holidayRoutes');
route('timetable', 'timetableRoutes');
route('marks', 'marksRoutes');
route('hostel', 'hostelRoutes');
route('transport', 'transportRoutes');
route('admissions', 'admissionsRoutes');
route('finance', 'financeRoutes');
route('calendar', 'calendarRoutes');
route('biometric', 'biometricRoutes');
route('ai', 'aiRoutes');
route('notifications', 'notificationRoutes');
route('certificates', 'certificateRoutes');
route('exams', 'examScheduleRoutes');
route('exam-schedule', 'examScheduleRoutes');
route('academic-years', 'academicYearRoutes');
route('years', 'academicYearRoutes');
route('doubts', 'doubtRoutes');
route('leaves', 'leaveRoutes');
route('grades', 'gradeRoutes');
route('student-reviews', 'studentReviewRoutes');
route('debug', 'debugRoutes');
route('question-bank', 'questionBankRoutes');

// --- ADMS / Biometric Device Default Routes ---
const { handleExternalDeviceLog } = require('./controllers/biometricController');
app.all('/iclock/cdata', handleExternalDeviceLog);
app.all('/iclock/getrequest', (req, res) => res.send('OK'));
app.all('/iclock/devicecmd', (req, res) => res.send('OK'));
app.all('/iclock/options', (req, res) => res.send('OK'));

// ==========================================
// 📱 APP VERSION CHECK (In-App Update)
// ==========================================
// Update MINIMUM_VERSION whenever you release a critical update
// that ALL users MUST install. Users below this version will be
// forced to update from the Play Store.
const MINIMUM_APP_VERSION = 37; // Version Code (not name). Update this to force update.
const LATEST_APP_VERSION = 37;  // Current latest version code.

app.get(['/api/app-version', '/app-version'], (req, res) => {
    res.json({
        minimum_version: MINIMUM_APP_VERSION,
        latest_version: LATEST_APP_VERSION,
        play_store_url: 'https://play.google.com/store/apps/details?id=com.rudrappa.connect2campus',
        update_message: 'A new version of Connect to Campus is available. Please update to continue using the app.'
    });
});

app.get('/app-launch', (req, res) => {
    res.redirect(`https://connect-to-campus-b56ac.web.app?t=${Date.now()}`);
});


app.get(['/api/download-app', '/download-app'], (req, res) => {
    res.redirect('https://play.google.com/store/apps/details?id=com.rudrappa.connect2campus');
});

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

app.use((err, req, res, next) => {
    console.error('🔥 Global Error Handler:', err);
    res.status(500).json({
        message: 'Something went wrong on the server',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

module.exports = app;
