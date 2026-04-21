import React from 'react';

// Utility: convert number to words (for marks)
const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
    'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

function numberToWords(num) {
    if (num === null || num === undefined || num === '' || isNaN(num)) return '-';
    const n = Math.round(Number(num));
    if (n === 0) return 'ZERO';
    if (n < 0) return 'MINUS ' + numberToWords(-n);
    if (n < 20) return ones[n];
    if (n < 100) {
        return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    }
    if (n < 1000) {
        return ones[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 !== 0 ? ' ' + numberToWords(n % 100) : '');
    }
    return n.toString(); // fallback
}

function getClass(percentage) {
    if (percentage >= 75) return 'FIRST CLASS WITH DISTINCTION';
    if (percentage >= 60) return 'FIRST CLASS';
    if (percentage >= 50) return 'SECOND CLASS';
    if (percentage >= 35) return 'PASS';
    return 'FAIL';
}

/**
 * ProfessionalMarksheet
 * Props:
 *   student - student object from API
 *   exam    - single exam object from API (with marks array)
 *   school  - school object from API
 */
const ProfessionalMarksheet = ({ student, exam, school }) => {
    if (!student || !exam) return null;

    const subjects = exam.marks || [];

    // Separate languages (Part I) from optionals (Part II)
    // Logic: if subject code <= 05 or name contains KANNADA/HINDI/ENGLISH treat as Part I
    const isLanguage = (s) => {
        const name = (s.subject_name || '').toUpperCase();
        const code = Number(s.subject_code || 0);
        return name.includes('KANNADA') || name.includes('HINDI') || name.includes('ENGLISH') ||
            name.includes('LANGUAGE') || name.includes('URDU') || name.includes('TAMIL') ||
            name.includes('TELUGU') || name.includes('MARATHI') || (code > 0 && code <= 10);
    };

    const part1 = subjects.filter(isLanguage);
    const part2 = subjects.filter(s => !isLanguage(s));

    const totalMax = subjects.reduce((sum, s) => sum + (Number(s.max_marks) || 100), 0);
    const totalObtained = subjects.reduce((sum, s) => sum + (Number(s.marks_obtained) || 0), 0);
    const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(0) : 0;
    const grade = getClass(Number(percentage));

    const schoolName = school?.name || 'SHRAMA PU SCIENCE COLLEGE';
    const schoolLocation = school?.address || 'VIDYAGIRI, BAGALKOT.';
    const collegeCode = school?.school_code || 'EB0467';

    const examYear = exam.exam_date
        ? new Date(exam.exam_date).getFullYear()
        : new Date().getFullYear();

    const resultDate = exam.exam_date
        ? new Date(exam.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '31/03/' + examYear;

    return (
        <div className="puc-marksheet-container" style={{
            width: '210mm',
            height: '296mm',
            padding: '12mm 15mm', // Physical spacing from the edge of the paper since browser margin is 0
            boxSizing: 'border-box',
            backgroundColor: '#fff',
            margin: '0 auto',
            pageBreakAfter: 'always',
            pageBreakInside: 'avoid'
        }}>
            <div className="puc-marksheet" style={{
                fontFamily: '"Times New Roman", Times, serif',
                fontSize: '13px',
                width: '100%',
                height: '100%',
                border: '2px solid #000',
                padding: '10px 16px 14px',
                boxSizing: 'border-box',
                color: '#000',
                position: 'relative',
            }}>

                {/* ──── HEADER ──── */}
                <div style={{ textAlign: 'center', position: 'relative', marginBottom: '4px' }}>
                    {/* Photo placeholder top-right */}
                    <div style={{
                        position: 'absolute', right: 0, top: 0,
                        width: '70px', height: '80px',
                        border: '1px solid #555',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', color: '#888', background: '#f9f9f9',
                    }}>
                        Photo
                    </div>



                    <p style={{ margin: 0, fontFamily: 'Serif', fontSize: '12px' }}>ಕರ್ನಾಟಕ ಸರ್ಕಾರ</p>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px' }}>GOVERNMENT OF KARNATAKA</p>
                    <p style={{ margin: 0, fontFamily: 'Serif', fontSize: '12px' }}>ಶಾಲಾ ಶಿಕ್ಷಣ ಇಲಾಖೆ (ಪದವಿ ಪೂರ್ವ)</p>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px', textDecoration: 'underline' }}>
                        DEPARTMENT OF SCHOOL EDUCATION (PRE-UNIVERSITY)
                    </p>

                    {/* Certificate title box */}
                    <div style={{
                        display: 'inline-block',
                        border: '2px solid #000',
                        padding: '3px 20px',
                        margin: '5px 0',
                        fontWeight: 'bold',
                        fontSize: '15px',
                    }}>
                        ಪ್ರಮಾಣ ಪತ್ರ &nbsp; CERTIFICATE
                    </div>
                </div>

                {/* ──── INTRO TEXT ──── */}
                <p style={{ margin: '4px 0', fontFamily: 'Serif', fontSize: '11.5px', lineHeight: 1.4 }}>
                    ಈ ಕೆಳಗೆ ನಮೂದಿಸಿದ ಅಭ್ಯರ್ಥಿಯು ಪದವಿ ಪೂರ್ವ ಶಿಕ್ಷಣದ ಪ್ರಥಮ ವರ್ಷದ ಪರೀಕ್ಷೆಯಲ್ಲಿ ಕೆಳಗಿನ ವಿವರಗಳೊಂದಿಗೆ ತೇರ್ಗಡೆಯಾಗಿರುತ್ತಾರೆ ಎಂದು ಪ್ರಮಾಣೀಕರಿಸಲಾಗಿದೆ.
                </p>
                <p style={{ margin: '2px 0 6px', fontFamily: 'Monotype Corsiva, Palatino, serif', fontSize: '12px', fontStyle: 'italic', lineHeight: 1.4 }}>
                    This is to certify that the candidate mentioned below has passed the first year pre-university examination with the following details
                </p>

                {/* ──── STUDENT INFO ──── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '48%', paddingBottom: '2px', verticalAlign: 'top' }}>
                                <span style={{ fontFamily: 'Serif' }}>ಅಭ್ಯರ್ಥಿಯ ಹೆಸರು</span><br />
                                <strong>Candidate&apos;s Name :</strong>&nbsp;
                                <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '200px' }}>
                                    {student.name || (student.first_name + ' ' + student.last_name) || ''}
                                </span>
                            </td>
                            <td style={{ width: '52%', paddingBottom: '2px', verticalAlign: 'top' }}>
                                <span style={{ fontFamily: 'Serif' }}>ನೊಂದಣಿ ಸಂಖ್ಯೆ</span><br />
                                <strong>Roll No :</strong>&nbsp;
                                <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '120px' }}>
                                    {student.roll_number || student.admission_no || ''}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style={{ paddingBottom: '2px', verticalAlign: 'top' }}>
                                <span style={{ fontFamily: 'Serif' }}>ತಾಯಿಯ ಹೆಸರು</span><br />
                                <strong>Mother&apos;s Name :</strong>&nbsp;
                                <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '180px' }}>
                                    {student.mother_name || ''}
                                </span>
                            </td>
                            <td style={{ paddingBottom: '2px', verticalAlign: 'top' }}>
                                <span style={{ fontFamily: 'Serif' }}>ಸ್ಯಾಟ್ಸ್ ಸಂಖ್ಯೆ</span><br />
                                <strong>SATS Number :</strong>&nbsp;
                                <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '120px' }}>
                                    {student.sats_number || ''}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style={{ paddingBottom: '2px', verticalAlign: 'top' }}>
                                <span style={{ fontFamily: 'Serif' }}>ತಂದೆಯ ಹೆಸರು</span><br />
                                <strong>Father&apos;s Name :</strong>&nbsp;
                                <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '180px' }}>
                                    {student.father_name || ''}
                                </span>
                            </td>
                            <td style={{ paddingBottom: '2px', verticalAlign: 'top' }}>
                                <span style={{ fontFamily: 'Serif' }}>ಪರೀಕ್ಷಾ ವರ್ಷ/ತಿಂಗಳು : </span>
                                <strong>{examYear}</strong>&nbsp;&nbsp;
                                <strong>Exam year Month &nbsp; March</strong>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* ──── MARKS TABLE ──── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', tableLayout: 'fixed' }}>
                    <thead>
                        <tr style={{ background: '#fff' }}>
                            <th rowSpan={2} style={thStyle}>
                                <span style={{ fontFamily: 'Serif' }}>ವಿಷಯಗಳು</span> Subject<br />
                            </th>
                            <th rowSpan={2} style={thStyle}>
                                <span style={{ fontFamily: 'Serif' }}>ವಿಷಯದ ಸಂಕೇತ</span><br />
                                Subject Code
                            </th>
                            <th rowSpan={2} style={thStyle}>
                                <span style={{ fontFamily: 'Serif' }}>ಗರಿಷ್ಠಾಂಕ</span><br />
                                Max Marks
                            </th>
                            <th colSpan={2} style={thStyle}>
                                <span style={{ fontFamily: 'Serif' }}>ಪಡೆದ ಅಂಕಗಳು</span><br />
                                Marks Obtained
                            </th>
                        </tr>
                        <tr>
                            <th style={thStyle}>
                                <span style={{ fontFamily: 'Serif' }}>ಅಂಕಗಳಲ್ಲಿ</span><br />
                                In Figures
                            </th>
                            <th style={thStyle}>
                                <span style={{ fontFamily: 'Serif' }}>ಅಕ್ಷರಗಳಲ್ಲಿ</span><br />
                                In words
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Part I - Languages */}
                        {part1.length > 0 && (
                            <tr style={{ background: '#f0f0f0' }}>
                                <td colSpan={5} style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'center' }}>
                                    <span style={{ fontFamily: 'Serif' }}>ಭಾಗ 1 - ಭಾಷೆಗಳು</span>&nbsp;&nbsp;
                                    <strong>Part 1 - Languages</strong>
                                </td>
                            </tr>
                        )}
                        {part1.map((s, i) => (
                            <tr key={'p1-' + i}>
                                <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'center' }}>
                                    {(s.subject_name || '').toUpperCase()}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {s.subject_code || '-'}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {s.max_marks || 100}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {s.marks_obtained !== null && s.marks_obtained !== undefined && s.marks_obtained !== ''
                                        ? s.marks_obtained : '-'}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {s.marks_obtained !== null && s.marks_obtained !== undefined && s.marks_obtained !== ''
                                        ? numberToWords(s.marks_obtained) : '-'}
                                </td>
                            </tr>
                        ))}

                        {/* Part II - Optionals */}
                        {part2.length > 0 && (
                            <tr style={{ background: '#f0f0f0' }}>
                                <td colSpan={5} style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'center' }}>
                                    <span style={{ fontFamily: 'Serif' }}>ಭಾಗ-2 ಐಚ್ಛಿಕ ವಿಷಯಗಳು</span>&nbsp;&nbsp;
                                    <strong>Part-II Optionals</strong>
                                </td>
                            </tr>
                        )}
                        {part2.map((s, i) => (
                            <tr key={'p2-' + i}>
                                <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'center' }}>
                                    {(s.subject_name || '').toUpperCase()}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {s.subject_code || '-'}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {s.max_marks || 100}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {s.marks_obtained !== null && s.marks_obtained !== undefined && s.marks_obtained !== ''
                                        ? s.marks_obtained : '-'}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {s.marks_obtained !== null && s.marks_obtained !== undefined && s.marks_obtained !== ''
                                        ? numberToWords(s.marks_obtained) : '-'}
                                </td>
                            </tr>
                        ))}

                        {/* ── TOTALS ROW ── */}
                        <tr style={{ borderTop: '2px solid #000' }}>
                            <td colSpan={2} style={{ ...tdStyle }}>
                                <span style={{ fontFamily: 'Serif' }}>ಒಟ್ಟು ಅಂಕಗಳು</span><br />
                                <strong>Total Marks</strong>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>
                                {totalMax}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>
                                {totalObtained}
                            </td>
                            <td style={{ ...tdStyle }}>
                                <span style={{ fontFamily: 'Serif', fontSize: '11px' }}>ಪ್ರತಿಶತ</span><br />
                                <strong>Percentage : {percentage}%</strong>
                            </td>
                        </tr>

                        {/* ── MARKS IN WORDS + CLASS ROW ── */}
                        <tr>
                            <td colSpan={3} style={{ ...tdStyle }}>
                                <span style={{ fontFamily: 'Serif', fontSize: '11px' }}>ಅಂಕಗಳು ಅಕ್ಷರಗಳಲ್ಲಿ</span><br />
                                <strong style={{ fontSize: '12px' }}>Marks in words : {numberToWords(totalObtained)}</strong>
                            </td>
                            <td colSpan={2} style={{ ...tdStyle }}>
                                <span style={{ fontFamily: 'Serif', fontSize: '11px' }}>ಪಡೆದ ದರ್ಜೆ</span><br />
                                <strong>Class Obtained : {grade}</strong>
                            </td>
                        </tr>

                        {/* ── COLLEGE ROW ── */}
                        <tr>
                            <td colSpan={2} style={{ ...tdStyle }}>
                                <span style={{ fontFamily: 'Serif', fontSize: '11px' }}>ಕಾಲೇಜು ಸಂಕೇತ ಸಂಖ್ಯೆ</span>&nbsp;
                                <strong>{collegeCode}</strong><br />
                                <strong>College Code No :</strong>
                            </td>
                            <td colSpan={3} style={{ ...tdStyle, textAlign: 'center' }}>
                                <span style={{ fontFamily: 'Serif', fontSize: '11px' }}>ಕಾಲೇಜು : </span>
                                <strong>{schoolName}</strong><br />
                                <strong>College &nbsp; {schoolLocation}</strong>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* ──── BOTTOM INFO ──── */}
                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div>
                        <span style={{ fontFamily: 'Serif' }}>ವಿದ್ಯಾರ್ಥಿ ವಿಧ</span><br />
                        <strong>Student Type : FRESHER</strong>
                    </div>
                    <div>
                        <span style={{ fontFamily: 'Serif' }}>ವಾಣಿಜ್ಯ ಮಾಧ್ಯಮ</span><br />
                        <strong>ENGLISH</strong>
                    </div>
                    <div>
                        <span style={{ fontFamily: 'Serif' }}>ಫಲಿತಾಂಶ ದಿನಾಂಕ</span><br />
                        <strong>Date of Result : {resultDate}</strong>
                    </div>
                </div>

                {/* ──── SIGNATURE ROW ──── */}
                <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <span style={{ fontFamily: 'Serif' }}>ಅಭ್ಯರ್ಥಿಯ ಸಹಿ</span><br />
                        Signature of the Candidate
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <span style={{ fontFamily: 'Serif' }}>ಪ್ರಾಚಾರ್ಯರ ಸಹಿ ವಮತ್ತು ವೊಹರು</span><br />
                        Signature of the principal and Seal
                    </div>
                </div>

            </div>
        </div>
    );
};

// Shared cell styles
const thStyle = {
    border: '1px solid #000',
    padding: '4px 6px',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: '12px',
    lineHeight: 1.3,
};
const tdStyle = {
    border: '1px solid #000',
    padding: '4px 6px',
    fontSize: '12px',
    lineHeight: 1.3,
};

export default ProfessionalMarksheet;
