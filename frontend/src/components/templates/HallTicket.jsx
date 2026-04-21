import React from 'react';
import './HallTicket.css';

const HallTicket = ({ examData }) => {
    const {
        studentName = "STUDENT NAME",
        studentPhoto = "/placeholder-photo.jpg",
        rollNumber = "ROLL NO",
        className = "CLASS",
        examName = "ANNUAL EXAMINATION 2024-25",
        examCenter = "EXAM CENTER NAME",
        examDate = "DATE",
        subjects = [],
        schoolName = "SCHOOL NAME",
        schoolAddress = "School Address"
    } = examData || {};

    const defaultSubjects = subjects.length > 0 ? subjects : [
        { name: "Mathematics", date: "15/03/2025", time: "10:00 AM - 01:00 PM" },
        { name: "Science", date: "17/03/2025", time: "10:00 AM - 01:00 PM" },
        { name: "Social Studies", date: "19/03/2025", time: "10:00 AM - 01:00 PM" },
        { name: "English", date: "21/03/2025", time: "10:00 AM - 01:00 PM" }
    ];

    return (
        <div className="hall-ticket-page">
            <div className="hall-ticket-container">
                {/* Decorative Border */}
                <div className="decorative-border-top"></div>

                {/* Header */}
                <div className="hall-ticket-header">
                    <div className="softnet-brand">
                        <div className="softnet-logo-ht">SoftForge Technologies</div>
                        <div className="softnet-subtitle">School Management System</div>
                    </div>
                </div>

                {/* School Header */}
                <div className="school-header">
                    <div className="school-logo-ht">LOGO</div>
                    <div className="school-info-ht">
                        <h1 className="school-name-ht">{schoolName}</h1>
                        <p className="school-address-ht">{schoolAddress}</p>
                    </div>
                    <div className="school-logo-ht">LOGO</div>
                </div>

                {/* Hall Ticket Title */}
                <div className="hall-ticket-title-section">
                    <h2 className="hall-ticket-title">EXAMINATION HALL TICKET</h2>
                    <div className="exam-name-badge">{examName}</div>
                </div>

                {/* Student Information */}
                <div className="candidate-info-section">
                    <div className="photo-column">
                        <div className="student-photo-ht">
                            <img src={studentPhoto} alt="Student" />
                        </div>
                        <div className="photo-attestation">
                            <p>Attested Photo</p>
                        </div>
                    </div>

                    <div className="details-column">
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label">Candidate Name:</span>
                                <span className="info-value">{studentName}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Roll Number:</span>
                                <span className="info-value roll-highlight">{rollNumber}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Class:</span>
                                <span className="info-value">{className}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Examination Center:</span>
                                <span className="info-value">{examCenter}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Exam Schedule */}
                <div className="exam-schedule-section">
                    <h3 className="section-title">Examination Schedule</h3>
                    <table className="exam-schedule-table">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Subject</th>
                                <th>Date</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {defaultSubjects.map((subject, index) => (
                                <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td>{subject.name}</td>
                                    <td>{subject.date}</td>
                                    <td>{subject.time}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Instructions */}
                <div className="instructions-section">
                    <h3 className="section-title">Important Instructions</h3>
                    <ul className="instructions-list">
                        <li>Candidate must carry this hall ticket to the examination center.</li>
                        <li>Candidate should report at the exam center 30 minutes before the exam.</li>
                        <li>Mobile phones and electronic devices are strictly prohibited.</li>
                        <li>Candidate must bring their own stationery and geometry box.</li>
                        <li>Any form of malpractice will result in disqualification.</li>
                    </ul>
                </div>

                {/* Signatures */}
                <div className="signatures-section">
                    <div className="signature-block">
                        <div className="signature-space"></div>
                        <p className="signature-label-ht">Principal's Signature</p>
                    </div>
                    <div className="signature-block">
                        <div className="barcode-placeholder">BARCODE</div>
                    </div>
                    <div className="signature-block">
                        <div className="signature-space"></div>
                        <p className="signature-label-ht">Controller of Examinations</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="hall-ticket-footer">
                    <p>Generated by <strong>SoftForge Technologies</strong> School Management System | For queries: contact@softnet.com</p>
                </div>

                {/* Decorative Border */}
                <div className="decorative-border-bottom"></div>
            </div>
        </div>
    );
};

export default HallTicket;
