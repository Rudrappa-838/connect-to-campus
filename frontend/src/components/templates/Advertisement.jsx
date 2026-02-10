import React from 'react';
import './Advertisement.css';

const Advertisement = ({ adData }) => {
    const {
        mainHeading = "Transform Your School Management",
        subHeading = "Experience the Future of Education Administration",
        schoolName = "YOUR SCHOOL NAME",
        features = [],
        contactInfo = {
            phone: "+91 XXXXX XXXXX",
            email: "info@yourschool.com",
            website: "www.yourschool.com",
            address: "School Address Here"
        },
        adType = "software" // "software", "admission", "event"
    } = adData || {};

    const defaultFeatures = features.length > 0 ? features : [
        { icon: "📚", title: "Student Management", desc: "Comprehensive student records & tracking" },
        { icon: "👨‍🏫", title: "Staff Management", desc: "Efficient faculty administration" },
        { icon: "💰", title: "Fee Management", desc: "Automated billing & payment tracking" },
        { icon: "📊", title: "Academic Reports", desc: "Real-time performance analytics" },
        { icon: "🏠", title: "Hostel Management", desc: "Complete hostel operations control" },
        { icon: "📱", title: "Mobile App", desc: "Access anywhere, anytime" }
    ];

    return (
        <div className="advertisement-page">
            <div className="advertisement-container">
                {/* Premium Header */}
                <div className="ad-header-section">
                    <div className="ad-pattern-bg"></div>
                    <div className="ad-header-content">
                        <div className="softnet-branding-ad">
                            <div className="softnet-logo-ad">SOFTNET</div>
                            <div className="softnet-tagline-ad">School Management System</div>
                        </div>
                        <div className="ad-main-heading">
                            <h1 className="headline-text">{mainHeading}</h1>
                            <p className="subheadline-text">{subHeading}</p>
                        </div>
                    </div>
                    <div className="ad-wave-divider">
                        <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
                            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className="wave-fill"></path>
                        </svg>
                    </div>
                </div>

                {/* School Branding */}
                <div className="school-branding-section">
                    <div className="school-logo-large">
                        <div className="logo-placeholder-ad">SCHOOL LOGO</div>
                    </div>
                    <h2 className="school-name-ad">{schoolName}</h2>
                    <div className="accent-line"></div>
                </div>

                {/* Features Grid */}
                <div className="features-section">
                    <h3 className="section-heading">Our Premium Features</h3>
                    <div className="features-grid">
                        {defaultFeatures.map((feature, index) => (
                            <div key={index} className="feature-card">
                                <div className="feature-icon">{feature.icon}</div>
                                <h4 className="feature-title">{feature.title}</h4>
                                <p className="feature-desc">{feature.desc}</p>
                                <div className="feature-shine"></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Call to Action */}
                <div className="cta-section">
                    <div className="cta-content">
                        <h3 className="cta-heading">Ready to Digitize Your School?</h3>
                        <p className="cta-text">Join hundreds of schools already using SOFTNET</p>
                        <div className="cta-buttons">
                            <button className="btn-primary-ad">Request Demo</button>
                            <button className="btn-secondary-ad">Learn More</button>
                        </div>
                    </div>
                </div>

                {/* Benefits Banner */}
                <div className="benefits-banner">
                    <div className="benefit-item">
                        <div className="benefit-number">100+</div>
                        <div className="benefit-label">Schools</div>
                    </div>
                    <div className="benefit-item">
                        <div className="benefit-number">50K+</div>
                        <div className="benefit-label">Students</div>
                    </div>
                    <div className="benefit-item">
                        <div className="benefit-number">24/7</div>
                        <div className="benefit-label">Support</div>
                    </div>
                    <div className="benefit-item">
                        <div className="benefit-number">99.9%</div>
                        <div className="benefit-label">Uptime</div>
                    </div>
                </div>

                {/* Contact Information */}
                <div className="contact-section">
                    <h3 className="contact-heading">Get In Touch</h3>
                    <div className="contact-grid">
                        <div className="contact-card">
                            <div className="contact-icon">📞</div>
                            <div className="contact-label">Phone</div>
                            <div className="contact-value">{contactInfo.phone}</div>
                        </div>
                        <div className="contact-card">
                            <div className="contact-icon">✉️</div>
                            <div className="contact-label">Email</div>
                            <div className="contact-value">{contactInfo.email}</div>
                        </div>
                        <div className="contact-card">
                            <div className="contact-icon">🌐</div>
                            <div className="contact-label">Website</div>
                            <div className="contact-value">{contactInfo.website}</div>
                        </div>
                        <div className="contact-card">
                            <div className="contact-icon">📍</div>
                            <div className="contact-label">Address</div>
                            <div className="contact-value">{contactInfo.address}</div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="ad-footer">
                    <div className="footer-content">
                        <p className="footer-text">Powered by <strong>SOFTNET</strong> - India's Leading School Management Solution</p>
                        <p className="footer-subtext">Trusted by Educational Institutions Nationwide</p>
                    </div>
                    <div className="footer-pattern"></div>
                </div>
            </div>
        </div>
    );
};

export default Advertisement;
