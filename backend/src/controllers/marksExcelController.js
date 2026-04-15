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

        res.json(Object.values(combos));
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
        const { exam_type_id, class_id, section_id } = req.query;

        if (!exam_type_id || !class_id) {
            return res.status(400).json({ message: 'exam_type_id and class_id are required' });
        }

        // 1. Get subjects for this class+section+exam
        const scheduleResult = await pool.query(`
            SELECT es.subject_id, es.max_marks, es.components, sub.name as subject_name, et.name as exam_type_name
            FROM exam_schedules es
            JOIN subjects sub ON es.subject_id = sub.id
            JOIN exam_types et ON es.exam_type_id = et.id
            WHERE es.school_id = $1 AND es.exam_type_id = $2 AND es.class_id = $3
              AND es.deleted_at IS NULL
              AND (es.section_id = $4 OR es.section_id IS NULL)
            ORDER BY sub.name
        `, [school_id, exam_type_id, class_id, section_id || null]);

        if (scheduleResult.rows.length === 0) {
            return res.status(404).json({ message: 'No exam schedule found for this class/section' });
        }

        const examTypeName = scheduleResult.rows[0].exam_type_name;
        const subjects = scheduleResult.rows;

        // 2. Get students for this class+section
        let studentQuery = `
            SELECT st.id as student_id, st.name as student_name, st.admission_no, st.roll_number,
                   c.name as class_name, sec.name as section_name
            FROM students st
            JOIN classes c ON st.class_id = c.id
            LEFT JOIN sections sec ON st.section_id = sec.id
            WHERE st.school_id = $1 AND st.class_id = $2
              AND (st.status IS NULL OR st.status != 'Deleted')
        `;
        const studentParams = [school_id, class_id];

        if (section_id) {
            studentQuery += ` AND st.section_id = $3`;
            studentParams.push(section_id);
        }
        studentQuery += ` ORDER BY st.roll_number, st.name`;

        const studentResult = await pool.query(studentQuery, studentParams);

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ message: 'No students found for this class/section' });
        }

        const students = studentResult.rows;
        const className = students[0].class_name;
        const sectionName = students[0].section_name || '';

        // 3. Build Excel
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'School Management System';
        const sheet = workbook.addWorksheet(`${className}${sectionName ? ` - ${sectionName}` : ''}`);

        // Build column headers
        const columns = [
            { header: 'Student ID', key: 'student_id', width: 15 },
            { header: 'Admission No', key: 'admission_no', width: 18 },
            { header: 'Roll No', key: 'roll_number', width: 10 },
            { header: 'Student Name', key: 'student_name', width: 30 },
        ];

        if (includeSats) {
            columns.push({ header: 'SATS Number', key: 'sats_number', width: 20 });
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
        for (const stu of students) {
            const rowData = { 
                student_id: stu.student_id, 
                admission_no: stu.admission_no || '', 
                roll_number: stu.roll_number || '', 
                student_name: stu.student_name,
            };
            if (includeSats) {
                rowData.sats_number = stu.sats_number || '';
            }
            const dataRow = sheet.addRow(rowData);

            // Lock student info columns (light blue)
            const lockCount = includeSats ? 5 : 4;
            for (let i = 1; i <= lockCount; i++) {
                const cell = dataRow.getCell(i);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
                cell.font = { bold: i === 4 };
            }
            dataRow.height = 20;
        }

        sheet.views = [{ state: 'frozen', xSplit: includeSats ? 5 : 4, ySplit: 1 }]; // freeze name columns + header

        // ── Metadata in a hidden sheet (avoids row shifting issues)
        const metaSheet = workbook.addWorksheet('__meta__');
        metaSheet.state = 'hidden';
        metaSheet.getCell('A1').value = `exam_type_id=${exam_type_id}`;
        metaSheet.getCell('A2').value = `class_id=${class_id}`;
        metaSheet.getCell('A3').value = `section_id=${section_id || ''}`;
        metaSheet.getCell('A4').value = `school_id=${school_id}`;

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

        const parseMeta = (row) => {
            const val = metaSheet.getCell(`A${row}`).value || '';
            return String(val).split('=').slice(1).join('='); // handle values with = in them
        };

        const exam_type_id = parseMeta(1);
        const class_id = parseMeta(2);
        const section_id = parseMeta(3);
        const templateSchoolId = parseMeta(4);

        if (String(templateSchoolId) !== String(school_id)) {
            return res.status(403).json({ message: 'This template belongs to a different school.' });
        }

        // Data is in the first non-meta worksheet
        const sheet = workbook.worksheets.find(ws => ws.name !== '__meta__');
        if (!sheet) return res.status(400).json({ message: 'Excel file has no data worksheets' });

        // 2. Get valid students for this class+section
        let studentQuery = `
            SELECT st.id, st.name, st.admission_no
            FROM students st
            WHERE st.school_id = $1 AND st.class_id = $2
              AND (st.status IS NULL OR st.status != 'Deleted')
        `;
        const sp = [school_id, class_id];
        if (section_id) { studentQuery += ` AND st.section_id = $3`; sp.push(section_id); }
        const studentRes = await pool.query(studentQuery, sp);
        const studentMap = new Map(studentRes.rows.map(s => [String(s.id), s]));

        // 3. Get subjects for this exam+class+section and build header-to-subject map
        const scheduleRes = await pool.query(`
            SELECT es.subject_id, es.max_marks, es.components, sub.name as subject_name
            FROM exam_schedules es
            JOIN subjects sub ON es.subject_id = sub.id
            WHERE es.school_id = $1 AND es.exam_type_id = $2 AND es.class_id = $3
              AND es.deleted_at IS NULL
              AND (es.section_id = $4 OR es.section_id IS NULL)
        `, [school_id, exam_type_id, class_id, section_id || null]);

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

        const year = new Date().getFullYear();
        await client.query('BEGIN');

        let savedCount = 0;
        let skippedCount = 0;
        const errors = [];

        // 5. Process data rows (from row 2 onward — row 1 is the header)
        sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
            if (rowNum <= 1) return; // skip header only

            const studentId = String(row.getCell(1).value || '').trim();
            const studentName = String(row.getCell(4).value || '').trim();
            const satsNumber = String(row.getCell(5).value || '').trim();

            if (!studentId) return;

            if (!studentMap.has(studentId)) {
                errors.push({ row: rowNum, student: studentName, error: 'Student ID not found in this class/section' });
                skippedCount++;
                return;
            }

            // Update SATS number if provided
            if (satsNumber) {
                row._satsToUpdate = satsNumber;
            }

            // Process each mark column
            for (let colNum = 6; colNum < headers.length + 1; colNum++) {
                const header = headers[colNum];
                if (!header || !subjectByHeader[header]) continue;

                const cellVal = row.getCell(colNum).value;
                // If cell is blank, treat as 0 as per user request
                let marks = 0;
                if (cellVal !== null && cellVal !== undefined && cellVal !== '') {
                    marks = parseFloat(cellVal);
                }

                if (isNaN(marks)) {
                    errors.push({ row: rowNum, student: studentName, col: header, error: 'Invalid marks value' });
                    continue;
                }

                const subInfo = subjectByHeader[header];
                if (marks > subInfo.comp_max || marks > subInfo.max_marks) {
                    errors.push({ row: rowNum, student: studentName, col: header, error: `Marks ${marks} exceed maximum allowed` });
                    continue;
                }

                // We'll accumulate for saving after all rows are read
                // (accumulate in a list to save in batch via saveMarks logic)
                row._marksToSave = row._marksToSave || [];
                row._marksToSave.push({
                    student_id: studentId,
                    class_id,
                    section_id: section_id || null,
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
            if (row._satsToUpdate) {
                const studentId = String(row.getCell(1).value).trim();
                try {
                    await client.query('UPDATE students SET sats_number = $1 WHERE id = $2 AND school_id = $3', [row._satsToUpdate, studentId, school_id]);
                } catch (e) {
                    console.log(`[Excel Upload] Failed to update SATS for student ${studentId}:`, e.message);
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
