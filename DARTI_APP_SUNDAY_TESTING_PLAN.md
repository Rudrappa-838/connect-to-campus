# Darti School App — Sunday Deployment & Testing Plan
*Last updated: Thursday, Oct 1, 2026*

---

## 📌 Context & What Has Been Done

1. **Android Flavor (Darti School)**:
   - Package Name: `com.darti.connect2campus`
   - School ID Lock: `852262` (Darti School)
   - Current Version: `1.0.1` (VersionCode `2`)
   - Branded Icon & Name: "Darti School" (Green campus icon)
   - Configuration file: `android/app/src/darti/assets/public/school_config.json`
   - Play Store Internal Testing Link: 
     `https://play.google.com/apps/internaltest/4701733142769227161`

2. **In-App Update Conflict Fixed**:
   - `frontend/src/components/AppUpdateChecker.jsx` updated to bypass C2C version 47 check for `com.darti.connect2campus` / custom school flavors.
   - Tested & verified on device.

3. **Backend Changes Ready (Local)**:
   - `backend/src/controllers/authController.js`:
     When `school_id` is sent during login, verifies user belongs to that school (`852262`). If not, rejects with `401`.
     When `school_id` is NOT sent (standard C2C app / web portal / other schools), check is completely skipped. 100% backward compatible and safe for live schools.

---

## 🚀 Exact Steps for Sunday

### Step 1: Deploy Backend to AWS (2 minutes)
- Push & deploy local backend changes to AWS EC2 / production server.
- Restart backend service (`pm2 restart all` or service restart).

### Step 2: Verification Tests (5 minutes)
1. **Test 1 (Darti Login)**:
   - Open Darti School App on phone.
   - Enter Darti School user credentials (Teacher / Student / Parent).
   - **Expected**: Logs in successfully into Darti dashboard.

2. **Test 2 (School Isolation)**:
   - Enter credentials of a user from another school in the Darti App.
   - **Expected**: Rejected with `"Invalid credentials or role mismatch"`.

3. **Test 3 (Existing Schools Safety Check)**:
   - Open Connect2Campus main app or web portal (`connect2campus.co.in`).
   - Log in with any existing non-Darti school account.
   - **Expected**: Logs in normally. Zero impact on existing schools.

---

## 📂 Key Files Reference
- `frontend/android/app/build.gradle` (darti flavor config)
- `frontend/src/components/AppUpdateChecker.jsx` (version bypass logic)
- `backend/src/controllers/authController.js` (school lock logic)
- `playstore_assets/` (512x512 icon, 1024x500 banner, screenshots)
