const fs = require('fs');
const path = 'src/controllers/biometricController.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix markFaceAttendance logic (UPSERT + Notifications)
const targetBlock = `        // 3. Mark Attendance if recognized
        // Check if already marked
        const existingRef = await client.query(
            \`SELECT id FROM attendance WHERE student_id = $1 AND date = $2\`,
            [bestMatch.id, date]
        );

        if (existingRef.rows.length > 0) {
            return res.json({
                success: true,
                alreadyMarked: true,
                message: \`\${bestMatch.name} is already marked Present.\`,
                student: { name: bestMatch.name, id: bestMatch.admission_no }
            });
        }

        await client.query(
            \`INSERT INTO attendance (student_id, date, status, school_id) VALUES ($1, $2, 'Present', $3)\`,
            [bestMatch.id, date, schoolId]
        );

        // 4. Trigger Notification
        await sendAttendanceNotification(bestMatch, 'Present');`;

const replacementBlock = `        // 3. Mark Attendance / Upsert
        const existingRef = await client.query(
            \`SELECT status FROM attendance WHERE student_id = $1 AND date = $2\`,
            [bestMatch.id, date]
        );
        const existingStatus = existingRef.rows.length > 0 ? existingRef.rows[0].status : null;

        await client.query(
            \`INSERT INTO attendance (school_id, student_id, date, status, marking_mode) 
             VALUES ($1, $2, $3, 'Present', 'face')
             ON CONFLICT (student_id, date) 
             DO UPDATE SET status = 'Present', marking_mode = 'face', created_at = CURRENT_TIMESTAMP\`,
            [schoolId, bestMatch.id, date]
        );

        // 4. Trigger Notification only if status CHANGED to Present
        if (existingStatus !== 'Present') {
            await sendAttendanceNotification(bestMatch, 'Present');
        }`;

// Use a regex with escape to handle variations in whitespace if any
const escapedTarget = targetBlock.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
const regex = new RegExp(escapedTarget, 'g');

if (regex.test(content)) {
    content = content.replace(regex, replacementBlock);
    fs.writeFileSync(path, content);
    console.log('Successfully updated biometricController.js');
} else {
    console.error('Target block not found. Checking for partial match...');
    if (content.includes("INSERT INTO attendance")) {
        console.log('Found INSERT INTO attendance, but bulk block mismatch.');
    }
    process.exit(1);
}
