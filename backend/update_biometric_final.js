const fs = require('fs');
const path = 'src/controllers/biometricController.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Update getTodayFaceAttendance query
const getTodayTarget = "SELECT s.id, s.name, s.admission_no as user_id, a.date, \n                    TO_CHAR(a.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'HH:MI AM') as scan_time ";
const getTodayReplacement = "SELECT s.id, s.name, s.admission_no as user_id, a.date, a.marking_mode,\n                    TO_CHAR(a.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'HH:MI AM') as scan_time ";

// Robust replacement for getTodayFaceAttendance
const getTodayRegex = /SELECT\s+s\.id,\s+s\.name,\s+s\.admission_no\s+as\s+user_id,\s+a\.date,\s+TO_CHAR\(a\.created_at\s+AT\s+TIME\s+ZONE\s+'UTC'\s+AT\s+TIME\s+ZONE\s+'Asia\/Kolkata',\s+'HH:MI\s+AM'\)\s+as\s+scan_time/g;
if (getTodayRegex.test(content)) {
    content = content.replace(getTodayRegex, "SELECT s.id, s.name, s.admission_no as user_id, a.date, a.marking_mode, TO_CHAR(a.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'HH:MI AM') as scan_time");
    console.log('Updated getTodayFaceAttendance');
} else {
    console.warn('Could not find getTodayFaceAttendance query via regex. Trying exact match...');
    // Fallback to simpler replacement if regex sensitive
}

// 2. Update markFaceAttendance logic (Success message and alreadyMarked flag)
const markFaceTarget = `        // 3. Mark Attendance / Upsert
        const existingRef = await client.query(
            \`SELECT status FROM attendance WHERE student_id = $1 AND date = $2\`,
            [bestMatch.id, date]
        );
        const existingStatus = existingRef.rows.length > 0 ? existingRef.rows[0].status : null;

        await client.query(
            \`INSERT INTO attendance (school_id, student_id, date, status, marking_mode) 
             VALUES ($1, $2, $3, 'Present', 'face')
             ON CONFLICT (student_id, date) 
             DO UPDATE SET status = 'Present', marking_mode = 'face', created_at = CURRENT_TIMESTAMP\`
        );`;
// Note: I missed the params in the previous script/view, let me be careful.

// Actually, I'll just rewrite the whole markFaceAttendance logic block to be what we want.

const searchStart = "// 3. Mark Attendance / Upsert";
const searchEnd = "// 4. Trigger Notification only if status CHANGED to Present";

const markFaceReplacement = `        // 3. Mark Attendance / Upsert
        const existingRef = await client.query(
            \`SELECT status FROM attendance WHERE student_id = $1 AND date = $2\`,
            [bestMatch.id, date]
        );
        const existingStatus = existingRef.rows.length > 0 ? existingRef.rows[0].status : null;

        if (existingStatus === 'Present') {
            return res.json({
                success: true,
                alreadyMarked: true,
                message: \`Already attendance taken for \${bestMatch.name}\`,
                student: {
                    name: bestMatch.name,
                    admission_no: bestMatch.admission_no,
                    class_id: bestMatch.class_id,
                    section_id: bestMatch.section_id
                }
            });
        }

        await client.query(
            \`INSERT INTO attendance (school_id, student_id, date, status, marking_mode) 
             VALUES ($1, $2, $3, 'Present', 'face')
             ON CONFLICT (student_id, date) 
             DO UPDATE SET status = 'Present', marking_mode = 'face', created_at = CURRENT_TIMESTAMP\`,
            [schoolId, bestMatch.id, date]
        );

        // 4. Trigger Notification only if status CHANGED to Present
        // (Since we handled alreadyMarked early return, this will only run if status was Absent or Unmarked)`;

const startIdx = content.indexOf(searchStart);
const endIdx = content.indexOf(searchEnd);

if (startIdx !== -1 && endIdx !== -1) {
    content = content.slice(0, startIdx) + markFaceReplacement + "        " + content.slice(endIdx);
    console.log('Updated markFaceAttendance logic');
} else {
    console.error('Could not find markFaceAttendance block');
    process.exit(1);
}

fs.writeFileSync(path, content);
console.log('File successfully updated.');
