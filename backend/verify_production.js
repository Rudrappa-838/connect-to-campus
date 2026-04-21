const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { pool } = require('./src/config/db');

async function run() {
    console.log("🔍 STARTING PRODUCTION VERIFICATION...");
    let errors = [];
    let warnings = [];

    // 1. Verify Login Fix (Middleware Code Check)
    try {
        const middlewarePath = path.join(__dirname, 'src', 'middleware', 'authMiddleware.js');
        const content = fs.readFileSync(middlewarePath, 'utf8');

        if (content.includes('RELAXED SECURITY') && content.includes('// if (userData.current_session_token')) {
            console.log("✅ Login Logic: FIXED (Code is updated)");
        } else if (content.includes('RELAXED SECURITY')) {
            console.log("✅ Login Logic: FIXED (Code is updated - Match 2)");
        } else {
            console.error("❌ Login Logic: OLD CODE DETECTED. (Git Pull failed or wasn't run)");
            errors.push("Login Fix Not Applied");
        }
    } catch (e) {
        console.error("❌ Login Logic: File not found", e);
    }

    // 2. Verify Firebase Keys
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        console.log("✅ Notifications: KEYS PRESENT");
    } else {
        console.error("❌ Notifications: MISSING KEYS in .env file");
        errors.push("Firebase Keys Missing");
    }

    // 3. Verify Database Column
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'fcm_token'");
        if (res.rows.length > 0) {
            console.log("✅ Database: FCM Column EXISTS");
        } else {
            console.error("❌ Database: FCM Column MISSING. (Run node check_fcm_column.js)");
            errors.push("Database Schema Outdated");
        }
    } catch (err) {
        console.error("❌ Database: Connection Failed", err.message);
        errors.push("Database Connection Error");
    }

    console.log("\n📊 SUMMARY:");
    if (errors.length === 0) {
        console.log("🎉 EVERYTHING LOOKS GOOD! Server is ready.");
        console.log("👉 NOTE: Users must LOGOUT and LOGIN once to get the new 'Persistent' session.");
    } else {
        console.log("⚠️ ISSUES FOUND:");
        errors.forEach(e => console.log(`   - ${e}`));
    }

    process.exit(0);
}

run();
