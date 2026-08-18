const { pool } = require('../config/db');
const ExcelJS = require('exceljs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Multer Setup (in-memory upload) ────────────────────────────────────────
const storage = multer.memoryStorage();
exports.upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.xlsx') return cb(new Error('Only .xlsx files are supported'), false);
        cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max
});

// ─── HELPER: Get exam schedules grouped per class+section ───────────────────
async function getSchedulesForExam(school_id, exam_type_id) {
    const result = await pool.query(`
        SELECT es.id, es.class_id, es.section_id, es.subject_id, es.max_marks, es.components,
               c.name as class_name, s.name as section_name, sub.name as subject_name,
               et.name as exam_type_name
        FROM exam_schedules es
        JOIN classes c ON es.class_id = c.id
        LEFT JOIN sections s ON es.section_id = s.id
        JOIN subjects sub ON es.subject_id = sub.id
        JOIN exam_types et ON es.exam_type_id = et.id
        WHERE es.school_id = $1 AND es.exam_type_id = $2 AND es.deleted_at IS NULL
        ORDER BY c.name, s.name, sub.name
    `, [school_id, exam_type_id]);
    return result.rows;
}

// ─── HELPER: Build a unique key per class+section combo ─────────────────────
function getComboKey(class_id, section_id) {
    return `${class_id}_${section_id || 'null'}`;
}

// ─── GET /api/marks/excel/combos?exam_type_id=X ─────────────────────────────
// Returns available class+section combos so frontend can show download buttons
exports.getExamCombos = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { exam_type_id } = req.query;

        if (!exam_type_id) return res.status(400).json({ message: 'exam_type_id is required' });

        const schedules = await getSchedulesForExam(school_id, exam_type_id);

        const combos = {};
        for (const row of schedules) {
            const key = getComboKey(row.class_id, row.section_id);
            if (!combos[key]) {
                combos[key] = {
                    class_id: row.class_id,
                    class_name: row.class_name,
                    section_id: row.section_id,
                    section_name: row.section_name,
                    exam_type_name: row.exam_type_name,
                    subjects: []
                };
            }
            const components = Array.isArray(row.components) ? row.components : (row.components ? JSON.parse(row.components || '[]') : []);
            combos[key].subjects.push({
                subject_id: row.subject_id,
                subject_name: row.subject_name,
                max_marks: row.max_marks,
                components
            });
        }

        const comboList = Object.values(combos);
        if (comboList.length > 1) {
            comboList.unshift({
                class_id: 'ALL',
                class_name: 'All Scheduled Classes',
                section_id: null,
                section_name: 'Combined Sheet',
                exam_type_name: comboList[0]?.exam_type_name || '',
                subjects: []
            });
        }

        res.json(comboList);
    } catch (error) {
        console.error('[Excel Combos]', error);
        res.status(500).json({ message: 'Server error fetching exam combos' });
    }
};

// ─── GET /api/marks/excel/template?exam_type_id=X&class_id=Y&section_id=Z ───
// Downloads a pre-filled Excel template for the given class+section
exports.downloadTemplate = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { exam_type_id, class_id, section_id, include_sats, match_by } = req.query;
        const includeSats = include_sats === 'true';
        const matchBy = match_by === 'custom_roll' ? 'custom_roll' : 'student_id';

        if (!exam_type_id || !class_id) {
            return res.status(400).json({ message: 'exam_type_id and class_id are required' });
        }

        const isAllClasses = String(class_id).toUpperCase() === 'ALL';

        // 1. Get subjects for this class+section+exam (or ALL classes)
        let scheduleQuery = `
            SELECT es.subject_id, es.max_marks, es.components, sub.name as subject_name, et.name as exam_type_name
            FROM exam_schedules es
            JOIN subjects sub ON es.subject_id = sub.id
            JOIN exam_types et ON es.exam_type_id = et.id
            WHERE es.school_id = $1 AND es.exam_type_id = $2 AND es.deleted_at IS NULL
        `;
        const scheduleParams = [school_id, exam_type_id];

        if (!isAllClasses) {
            scheduleQuery += ` AND es.class_id = $3 AND (es.section_id = $4 OR es.section_id IS NULL)`;
            scheduleParams.push(class_id, section_id || null);
        }
        scheduleQuery += ` ORDER BY sub.name`;

        const scheduleResult = await pool.query(scheduleQuery, scheduleParams);

        if (scheduleResult.rows.length === 0) {
            return res.status(404).json({ message: 'No exam schedule found for this class/section' });
        }

        // Deduplicate subjects by subject_id
        const subjectsMap = new Map();
        scheduleResult.rows.forEach(r => {
            if (!subjectsMap.has(r.subject_id)) {
                subjectsMap.set(r.subject_id, r);
            }
        });
        const subjects = Array.from(subjectsMap.values());
        const examTypeName = scheduleResult.rows[0].exam_type_name;

        // 2. Get students for this class+section or ALL scheduled classes
        let studentQuery = `
            SELECT st.id as student_id, st.name as student_name, st.admission_no, st.roll_number, st.custom_roll_number,
                   c.name as class_name, sec.name as section_name
            FROM students st
            JOIN classes c ON st.class_id = c.id
            LEFT JOIN sections sec ON st.section_id = sec.id
            WHERE st.school_id = $1 AND (st.status IS NULL OR st.status != 'Deleted')
        `;
        const studentParams = [school_id];

        if (isAllClasses) {
            studentQuery += ` AND st.class_id IN (SELECT class_id FROM exam_schedules WHERE school_id = $1 AND exam_type_id = $2 AND deleted_at IS NULL)`;
            studentParams.push(exam_type_id);
        } else {
            studentQuery += ` AND st.class_id = $2`;
            studentParams.push(class_id);
            if (section_id) {
                studentQuery += ` AND st.section_id = $3`;
                studentParams.push(section_id);
            }
        }
        studentQuery += ` ORDER BY c.name, sec.name, st.roll_number, st.name`;

        const studentResult = await pool.query(studentQuery, studentParams);

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ message: 'No students found for this class/section' });
        }

        const students = studentResult.rows;
        const className = isAllClasses ? 'All Classes' : students[0].class_name;
        const sectionName = isAllClasses ? 'Combined' : (students[0].section_name || '');

        // 3. Build Excel
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'School Management System';
        const sheet = workbook.addWorksheet(`${className}${sectionName ? ` - ${sectionName}` : ''}`);

        // Build column headers dynamically
        const columns = [];
        if (matchBy === 'custom_roll') {
            columns.push(
                { header: 'Custom ID', key: 'custom_roll_number', width: 20 }
            );
        } else {
            columns.push(
                { header: 'Student ID', key: 'student_id', width: 15 },
                { header: 'Admission No', key: 'admission_no', width: 18 },
                { header: 'Roll No', key: 'roll_number', width: 10 },
                { header: 'Student Name', key: 'student_name', width: 30 }
            );
            if (includeSats) {
                columns.push({ header: 'SATS Number', key: 'sats_number', width: 20 });
            }
        }

        for (const sub of subjects) {
            const comps = Array.isArray(sub.components) ? sub.components : (sub.components ? JSON.parse(sub.components || '[]') : []);
            if (comps && comps.length > 0) {
                // Has internal/external or multi-component
                for (const comp of comps) {
                    columns.push({
                        header: `${sub.subject_name} - ${comp.name || comp.component_name} (Max: ${comp.max_marks})`,
                        key: `${sub.subject_id}_comp_${comp.name || comp.component_name}`,
                        width: 30
                    });
                }
            } else {
                // Simple total marks
                columns.push({
                    header: `${sub.subject_name} (Max: ${sub.max_marks})`,
                    key: `${sub.subject_id}`,
                    width: 25
                });
            }
        }

        // ── Set up columns (this overwrites row 1, so metadata must be in a separate sheet)
        sheet.columns = columns;

        // Style header row (now row 1 since columns sets it)
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // indigo
        headerRow.alignment = { horizontal: 'center', wrapText: true };
        headerRow.height = 40;

        // Student rows
        if (matchBy !== 'custom_roll') {
            for (const stu of students) {
                const rowData = {
                    student_id: stu.student_id,
                    admission_no: stu.admission_no || '',
                    roll_number: stu.roll_number || '',
                    student_name: stu.student_name
                };
                if (includeSats) {
                    rowData.sats_number = stu.sats_number || '';
                }
                const dataRow = sheet.addRow(rowData);

                // Lock student info columns (light blue)
                const lockCount = includeSats ? 5 : 4;
                const nameColIndex = 4;
                
                for (let i = 1; i <= lockCount; i++) {
                    const cell = dataRow.getCell(i);
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
                    if (i === nameColIndex) {
                        cell.font = { bold: true };
                    }
                }
                dataRow.height = 20;
            }
        }

        const lockCount = matchBy === 'custom_roll' ? 1 : (includeSats ? 5 : 4);
        sheet.views = [{ state: 'frozen', xSplit: lockCount, ySplit: 1 }]; // freeze name columns + header

        // ── Metadata in a hidden sheet (avoids row shifting issues)
        const metaSheet = workbook.addWorksheet('__meta__');
        metaSheet.state = 'hidden';
        metaSheet.getCell('A1').value = `exam_type_id=${exam_type_id}`;
        metaSheet.getCell('A2').value = `class_id=${class_id}`;
        metaSheet.getCell('A3').value = `section_id=${section_id || ''}`;
        metaSheet.getCell('A4').value = `school_id=${school_id}`;
        metaSheet.getCell('A5').value = `match_by=${matchBy}`;

        // File name
        const safeClass = className.replace(/[^a-zA-Z0-9]/g, '_');
        const safeSection = sectionName ? `_${sectionName.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
        const safeExam = examTypeName.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `Marks_${safeClass}${safeSection}_${safeExam}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('[Excel Download]', error);
        res.status(500).json({ message: 'Failed to generate template: ' + error.message });
    }
};

// ─── POST /api/marks/excel/upload ────────────────────────────────────────────
// Upload filled Excel and import marks
exports.uploadMarks = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);

        if (workbook.worksheets.length === 0) return res.status(400).json({ message: 'Excel file has no worksheets' });

        // Debug: log all sheets found in uploaded file
        console.log('[Excel Upload] Sheets found:', workbook.worksheets.map(ws => `"${ws.name}" (state: ${ws.state})`).join(', '));

        // 1. Read metadata from hidden '__meta__' sheet
        // Try multiple names for robustness
        let metaSheet = workbook.getWorksheet('__meta__') || 
                        workbook.getWorksheet('meta') || 
                        workbook.getWorksheet('Metadata') ||
                        workbook.getWorksheet('METADATA');
        
        // Fallback: search all sheets for metadata content if not found by name
        if (!metaSheet) {
            for (const ws of workbook.worksheets) {
                const val = ws.getCell('A1').value;
                if (val && String(val).includes('exam_type_id=')) {
                    metaSheet = ws;
                    console.log(`[Excel Upload] Found metadata in sheet: "${ws.name}" by content scan`);
                    break;
                }
            }
        }

        if (!metaSheet) {
            const foundSheets = workbook.worksheets.map(ws => `"${ws.name}"`).join(', ');
            return res.status(400).json({ 
                message: `Invalid template: metadata sheet missing. Found sheets: ${foundSheets}. Please use the original downloaded template file.` 
            });
        }

        console.log('[Excel Upload] Meta sheet found. Reading values...');
        console.log('[Excel Upload] A1:', metaSheet.getCell('A1').value);
        console.log('[Excel Upload] A2:', metaSheet.getCell('A2').value);
        console.log('[Excel Upload] A3:', metaSheet.getCell('A3').value);
        console.log('[Excel Upload] A4:', metaSheet.getCell('A4').value);
        console.log('[Excel Upload] A5:', metaSheet.getCell('A5').value);

        const parseMeta = (row) => {
            const val = metaSheet.getCell(`A${row}`).value || '';
            return String(val).split('=').slice(1).join('='); // handle values with = in them
        };

        const exam_type_id = parseMeta(1);
        const class_id = parseMeta(2);
        const section_id = parseMeta(3);
        const templateSchoolId = parseMeta(4);
        const matchBy = parseMeta(5) || 'student_id';

        if (String(templateSchoolId) !== String(school_id)) {
            return res.status(403).json({ message: 'This template belongs to a different school.' });
        }

        // Data is in the first non-meta worksheet
        const sheet = workbook.worksheets.find(ws => ws.name !== '__meta__');
        if (!sheet) return res.status(400).json({ message: 'Excel file has no data worksheets' });

        const isAllClasses = String(class_id).toUpperCase() === 'ALL';

        // 2. Get valid students for this class+section or ALL scheduled classes
        let studentQuery = `
            SELECT st.id, st.name, st.admission_no, st.custom_roll_number, st.class_id, st.section_id
            FROM students st
            WHERE st.school_id = $1 AND (st.status IS NULL OR st.status != 'Deleted')
        `;
        const sp = [school_id];
        if (isAllClasses) {
            studentQuery += ` AND st.class_id IN (SELECT class_id FROM exam_schedules WHERE school_id = $1 AND exam_type_id = $2 AND deleted_at IS NULL)`;
            sp.push(exam_type_id);
        } else {
            studentQuery += ` AND st.class_id = $2`;
            sp.push(class_id);
            if (section_id) { studentQuery += ` AND st.section_id = $3`; sp.push(section_id); }
        }
        const studentRes = await pool.query(studentQuery, sp);
        
        // Build lookup maps
        const studentMapById = new Map();
        const studentMapByCustomRoll = new Map();
        const studentMapByAdmissionNo = new Map();
        studentRes.rows.forEach(s => {
            studentMapById.set(String(s.id), s);
            if (s.custom_roll_number) {
                studentMapByCustomRoll.set(String(s.custom_roll_number).trim().toLowerCase(), s);
            }
            if (s.admission_no) {
                studentMapByAdmissionNo.set(String(s.admission_no).trim().toLowerCase(), s);
            }
        });

        // 3. Get subjects for this exam+class+section (or ALL classes) and build header-to-subject map
        let scheduleQuery = `
            SELECT es.subject_id, es.max_marks, es.components, sub.name as subject_name
            FROM exam_schedules es
            JOIN subjects sub ON es.subject_id = sub.id
            WHERE es.school_id = $1 AND es.exam_type_id = $2 AND es.deleted_at IS NULL
        `;
        const schedParams = [school_id, exam_type_id];

        if (!isAllClasses) {
            scheduleQuery += ` AND es.class_id = $3 AND (es.section_id = $4 OR es.section_id IS NULL)`;
            schedParams.push(class_id, section_id || null);
        }
        const scheduleRes = await pool.query(scheduleQuery, schedParams);

        // Build subject map by header
        const subjectByHeader = {};
        for (const sub of scheduleRes.rows) {
            const comps = Array.isArray(sub.components) ? sub.components : (sub.components ? JSON.parse(sub.components || '[]') : []);
            if (comps && comps.length > 0) {
                for (const comp of comps) {
                    const h = `${sub.subject_name} - ${comp.name || comp.component_name} (Max: ${comp.max_marks})`;
                    subjectByHeader[h] = { subject_id: sub.subject_id, max_marks: sub.max_marks, comp_name: comp.name || comp.component_name, comp_max: comp.max_marks };
                }
            } else {
                const h = `${sub.subject_name} (Max: ${sub.max_marks})`;
                subjectByHeader[h] = { subject_id: sub.subject_id, max_marks: sub.max_marks };
            }
        }

        // 4. Read header row (now row 1 of data sheet)
        const headerRow = sheet.getRow(1);
        const headers = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
            headers[colNum] = cell.value ? String(cell.value).trim() : '';
        });

        // Find header columns dynamically
        const satsColNum = headers.indexOf('SATS Number');
        const nameColNum = headers.indexOf('Student Name');
        const hasSatsColumn = satsColNum !== -1;
        
        let startMarksColNum = 5;
        for (let colNum = 1; colNum <= headers.length; colNum++) {
            if (headers[colNum] && subjectByHeader[headers[colNum]]) {
                startMarksColNum = colNum;
                break;
            }
        }

        const year = new Date().getFullYear();
        await client.query('BEGIN');

        let savedCount = 0;
        let skippedCount = 0;
        const errors = [];

        // 5. Process data rows (from row 2 onward — row 1 is the header)
        sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
            if (rowNum <= 1) return; // skip header only

            const studentIdRaw = String(row.getCell(1).value || '').trim();
            if (!studentIdRaw) return;
            const studentName = nameColNum !== -1 ? String(row.getCell(nameColNum).value || '').trim() : '';
            
            let satsNumber = '';
            if (hasSatsColumn) {
                satsNumber = String(row.getCell(satsColNum).value || '').trim();
            }

            let matchedStudent = null;
            if (matchBy === 'custom_roll') {
                const customRollVal = studentIdRaw.toLowerCase();
                if (customRollVal && studentMapByCustomRoll.has(customRollVal)) {
                    matchedStudent = studentMapByCustomRoll.get(customRollVal);
                } else if (customRollVal && studentMapByAdmissionNo.has(customRollVal)) {
                    matchedStudent = studentMapByAdmissionNo.get(customRollVal);
                }
            } else {
                if (studentIdRaw && studentMapById.has(studentIdRaw)) {
                    matchedStudent = studentMapById.get(studentIdRaw);
                } else if (studentIdRaw && studentMapByAdmissionNo.has(studentIdRaw.toLowerCase())) {
                    matchedStudent = studentMapByAdmissionNo.get(studentIdRaw.toLowerCase());
                }
            }

            if (!matchedStudent) {
                const label = matchBy === 'custom_roll' ? 'Custom ID' : 'Student ID';
                errors.push({ row: rowNum, student: studentName || `Custom ID: ${studentIdRaw}`, error: `Student not found by ${label}: "${studentIdRaw}"` });
                skippedCount++;
                return;
            }

            const studentId = String(matchedStudent.id);
            row._resolvedStudentId = studentId;

            // Update SATS number if provided
            if (hasSatsColumn && satsNumber) {
                row._satsToUpdate = satsNumber;
            }

            // Process each mark column
            for (let colNum = startMarksColNum; colNum < headers.length + 1; colNum++) {
                const header = headers[colNum];
                if (!header || !subjectByHeader[header]) continue;

                const cellVal = row.getCell(colNum).value;
                // If cell is blank, treat as 0 as per user request
                let marks = 0;
                if (cellVal !== null && cellVal !== undefined && cellVal !== '') {
                    marks = parseFloat(cellVal);
                }

                if (isNaN(marks)) {
                    errors.push({ row: rowNum, student: studentName || `Custom ID: ${studentIdRaw}`, col: header, error: 'Invalid marks value' });
                    continue;
                }

                const subInfo = subjectByHeader[header];
                if (marks > subInfo.comp_max || marks > subInfo.max_marks) {
                    errors.push({ row: rowNum, student: studentName || `Custom ID: ${studentIdRaw}`, col: header, error: `Marks ${marks} exceed maximum allowed` });
                    continue;
                }

                // We'll accumulate for saving after all rows are read
                row._marksToSave = row._marksToSave || [];
                row._marksToSave.push({
                    student_id: studentId,
                    class_id: matchedStudent.class_id,
                    section_id: matchedStudent.section_id || null,
                    subject_id: subInfo.subject_id,
                    exam_type_id,
                    marks_obtained: marks,
                    year,
                    comp_name: subInfo.comp_name || null
                });
            }
        });

        // 6. Save marks in DB
        const marksBatch = [];
        sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
            if (rowNum <= 1 || !row._marksToSave) return;
            marksBatch.push(...row._marksToSave);
        });

        // Group by student + subject for component_scores JSON
        const markMap = {}; // key: studentId_subjectId
        for (const m of marksBatch) {
            const key = `${m.student_id}_${m.subject_id}`;
            if (!markMap[key]) {
                markMap[key] = { ...m, component_scores: {} };
            }
            if (m.comp_name) {
                markMap[key].component_scores[m.comp_name] = m.marks_obtained;
            } else {
                markMap[key].marks_obtained = m.marks_obtained;
            }
        }

        for (const m of Object.values(markMap)) {
            // Calculate total if components exist
            const scores = m.component_scores;
            const hasComponents = Object.keys(scores).length > 0;
            const total = hasComponents
                ? Object.values(scores).reduce((a, b) => a + b, 0)
                : m.marks_obtained;

            await client.query(`
                INSERT INTO marks
                  (school_id, student_id, class_id, section_id, subject_id, exam_type_id, marks_obtained, year, component_scores, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
                ON CONFLICT (school_id, student_id, subject_id, exam_type_id, year)
                DO UPDATE SET
                  marks_obtained = EXCLUDED.marks_obtained,
                  component_scores = EXCLUDED.component_scores,
                  updated_at = CURRENT_TIMESTAMP
            `, [school_id, m.student_id, m.class_id, m.section_id, m.subject_id, m.exam_type_id, total, year, hasComponents ? scores : {}]);

            savedCount++;
        }

        // 7. Update SATS Numbers in a separate pass
        for (const row of sheet._rows) {
            if (row._satsToUpdate && row._resolvedStudentId) {
                try {
                    await client.query('UPDATE students SET sats_number = $1 WHERE id = $2 AND school_id = $3', [row._satsToUpdate, row._resolvedStudentId, school_id]);
                } catch (e) {
                    console.log(`[Excel Upload] Failed to update SATS for student ${row._resolvedStudentId}:`, e.message);
                }
            }
        }

        await client.query('COMMIT');

        res.json({
            status: 'SUCCESS',
            message: `Import complete: ${savedCount} marks saved, ${skippedCount} rows skipped.`,
            savedCount,
            skippedCount,
            errors: errors.slice(0, 20) // send up to 20 errors to frontend
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Excel Upload]', error);
        res.status(500).json({ message: 'Failed to import marks: ' + error.message });
    } finally {
        client.release();
    }
};
