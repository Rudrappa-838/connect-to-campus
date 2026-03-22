import React from 'react';
import './StudentIDCard.css';

const StudentIDCard = ({ studentData }) => {
    const {
        studentName = "STUDENT NAME",
        studentPhoto = "/placeholder-photo.jpg",
        className = "CLASS",
        rollNumber = "ROLL NO",
        bloodGroup = "B+",
        contact = "CONTACT",
        schoolName = "SCHOOL NAME",
        academicYear = "2024-25",
        address = "School Address"
    } = studentData || {};

    return (
        <div className="id-card-page">
            <div className="id-card-container">
                {/* Header Section */}
                <div className="id-card-header">
                    <div className="softnet-branding">
                        <div className="softnet-logo">SoftForge Technologies</div>
                        <div className="softnet-tagline">School Management System</div>
                    </div>
                </div>

                {/* School Info */}
                <div className="school-info-section">
                    <div className="school-logo-placeholder">
                        <span>SCHOOL LOGO</span>
                    </div>
                    <div className="school-details">
                        <h2 className="school-name">{schoolName}</h2>
                        <p className="school-address">{address}</p>
                    </div>
                </div>

                {/* ID Card Title */}
                <div className="id-card-title">
                    <h1>STUDENT IDENTITY CARD</h1>
                    <div className="title-underline"></div>
                </div>

                {/* Student Information */}
                <div className="student-info-section">
                    <div className="student-photo-container">
                        <div className="photo-frame">
                            <img src={studentPhoto} alt="Student" className="student-photo" />
                        </div>
                    </div>

                    <div className="student-details">
                        <div className="detail-row">
                            <span className="detail-label">Name:</span>
                            <span className="detail-value">{studentName}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Class:</span>
                            <span className="detail-value">{className}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Roll No:</span>
                            <span className="detail-value">{rollNumber}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Blood Group:</span>
                            <span className="detail-value blood-group">{bloodGroup}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Contact:</span>
                            <span className="detail-value">{contact}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Academic Year:</span>
                            <span className="detail-value">{academicYear}</span>
                        </div>
                    </div>
                </div>

                {/* QR Code Section */}
                <div className="qr-section">
                    <div className="qr-placeholder">
                        <div className="qr-code">QR CODE</div>
                    </div>
                    <p className="qr-instruction">Scan for verification</p>
                </div>

                {/* Signature Section */}
                <div className="signature-section">
                    <div className="signature-box">
                        <div className="signature-line"></div>
                        <p className="signature-label">Principal's Signature</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="id-card-footer">
                    <p>Powered by <strong>SoftForge Technologies</strong> | School Management System</p>
                </div>
            </div>
        </div>
    );
};

export default StudentIDCard;
