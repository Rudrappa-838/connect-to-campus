import React from 'react';
import './SoftnetPamphletFront.css';

const SoftnetPamphletFront = () => {
    const allFeatures = [
        {
            icon: "👥",
            title: "Student Management",
            features: [
                "Profiling & Admission",
                "Daily Attendance Tracking",
                "Certificates & ID Cards",
                "Leave Applications"
            ],
            color: "#1e40af"
        },
        {
            icon: "👨‍🏫",
            title: "Teacher Portal",
            features: [
                "Teacher Profiles",
                "Marks Entry & Grading",
                "Smart Attendance",
                "Salary Management"
            ],
            color: "#7c3aed"
        },
        {
            icon: "📊",
            title: "Academic System",
            features: [
                "Exam Scheduling",
                "Auto Report Cards",
                "Timetable Management",
                "Topper Lists & Rankings"
            ],
            color: "#0891b2"
        },
        {
            icon: "fees", // Emoji
            title: "Fee Management",
            features: [
                "Fee Structure Setup",
                "Payment Collection",
                "Auto Fee Receipts",
                "Defaulter Tracking"
            ],
            color: "#059669"
        },
        {
            icon: "📚", // New
            title: "Library Genius",
            features: [
                "Book Management",
                "Issue/Return Tracking",
                "Fine Calculation",
                "Barcode Support"
            ],
            color: "#9333ea"
        },
        {
            icon: "🏘️", // New
            title: "Hostel & Mess",
            features: [
                "Room Allocation",
                "Mess Dues Tracking",
                "Day/Night Attendance",
                "Warden Dashboard"
            ],
            color: "#be185d"
        },
        {
            icon: "🚌", // New
            title: "Transport (GPS)",
            features: [
                "Live Bus Tracking",
                "Route Management",
                "Driver App Mode",
                "Stop-wise Fees"
            ],
            color: "#ea580c"
        },
        {
            icon: "💸", // New
            title: "Finance & Expenses",
            features: [
                "Income vs Expense",
                "Petty Cash Tracking",
                "Balance Sheet",
                "Daily Daybook"
            ],
            color: "#0f766e"
        },
        {
            icon: "📱",
            title: "Mobile Apps",
            features: [
                "Android App (Play Store)",
                "Student Mobile Portal",
                "Teacher Mobile Access",
                "Push Notifications"
            ],
            color: "#dc2626"
        },
        {
            icon: "🔔",
            title: "Smart Notifications",
            features: [
                "Fee Payment Reminders",
                "Attendance Alerts",
                "Exam Schedules",
                "Important Announcements"
            ],
            color: "#ea580c"
        },
        {
            icon: "📅",
            title: "Calendar & Events",
            features: [
                "School Calendar",
                "Holiday Management",
                "Event Scheduling",
                "Important Date Reminders"
            ],
            color: "#d97706"
        },
        {
            icon: "📝",
            title: "Leave Management",
            features: [
                "Student Leave Requests",
                "Teacher Leave System",
                "Approval Workflow",
                "Leave History & Reports"
            ],
            color: "#65a30d"
        },
        {
            icon: "👔",
            title: "Staff & Salary",
            features: [
                "Staff Profile Management",
                "Auto Salary Slips",
                "Attendance Tracking",
                "Payment History"
            ],
            color: "#8b5cf6"
        },
        {
            icon: "🎓",
            title: "Digital Certificates",
            features: [
                "Custom Templates",
                "Auto Certificate Generation",
                "Student Certificates",
                "PDF Download & Print"
            ],
            color: "#ec4899"
        },
        {
            icon: "🏫",
            title: "School Admin",
            features: [
                "Multi-School Support",
                "Class & Section Mgmt",
                "User Role Management",
                "Comprehensive Reports"
            ],
            color: "#6366f1"
        },
        {
            icon: "🔐",
            title: "Security & Access",
            features: [
                "OTP-based Login",
                "Multi-role Auth",
                "Cloud Backup",
                "Encrypted Data"
            ],
            color: "#374151"
        }
    ];

    return (
        <div className="pamphlet-front-page">
            <div className="pamphlet-front-container">

                {/* Front Header */}
                <div className="front-hero">
                    <div className="front-hero-content">
                        <div className="softnet-branding-front">
                            <div className="company-name-front">SoftForge Technologies</div>
                            <div className="presents-text">presents</div>
                            <div className="software-name-front">CONNECT TO CAMPUS</div>
                            <div className="software-tagline-front">Complete School Management Solution</div>
                        </div>

                        <div className="hero-split-layout">
                            {/* Left Side: Compelling Thought */}
                            <div className="hero-thought-container">
                                <div className="thought-quote-mark">“</div>
                                <h2 className="thought-headline">
                                    Why Manage Manually<br />When You Can<br />
                                    <span className="highlight-text">Go Digital?</span>
                                </h2>
                                <p className="thought-subtext">
                                    Empower your school with <strong>Next-Gen Technology</strong>.
                                    Streamline operations, save time, and focus on what matters most —
                                    <strong>Education</strong>.
                                </p>
                                <div className="thought-action">
                                    Join the Digital Revolution Today! 🚀
                                </div>
                            </div>

                            {/* Right Side: App Icon */}
                            <div className="hero-app-right">
                                <div className="c2c-app-icon-grand">
                                    <div className="icon-gloss"></div>
                                    <div className="icon-book-grand">📖</div>
                                    <div className="icon-text-grand">C2C</div>
                                    <div className="icon-subtext">Connect to Campus</div>
                                    <div className="icon-scanlines"></div>
                                </div>
                                <div className="playstore-badge-grand">
                                    <span className="playstore-icon">▶</span> Available on Play Store
                                </div>
                            </div>
                        </div>

                        <h1 className="front-main-title">
                            Transform Your School Into a Smart Digital Campus
                        </h1>
                    </div>
                </div>

                {/* Features Section */}
                <div className="features-comprehensive-section">
                    <h2 className="front-section-title">16 Complete Modules - Production Ready</h2>

                    <div className="features-mega-grid">
                        {allFeatures.map((module, index) => (
                            <div key={index} className="module-comprehensive-card">
                                <div
                                    className="module-header"
                                    style={{ background: `linear-gradient(135deg, ${module.color} 0%, ${module.color}dd 100%)` }}
                                >
                                    <div className="module-icon-large">{module.icon === "fees" ? "💰" : module.icon}</div>
                                    <h3 className="module-title-large">{module.title}</h3>
                                </div>
                                <div className="module-body">
                                    <div className="features-checklist">
                                        {module.features.map((feature, idx) => (
                                            <div key={idx} className="feature-check-item">
                                                <span className="check-icon">✓</span>
                                                <span className="feature-text">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Message */}
                <div className="front-bottom-message">
                    <h2 className="message-title">👉 Turn Over for Pricing & Contact Details</h2>
                </div>

                {/* Footer */}
                <div className="front-footer">
                    <p className="front-footer-text">
                        <strong>SoftForge Technologies</strong> - Connect to Campus (C2C) | Available on Play Store
                    </p>
                </div>

            </div>
        </div>
    );
};

export default SoftnetPamphletFront;
