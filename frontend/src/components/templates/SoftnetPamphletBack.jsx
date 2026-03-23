import React from 'react';
import './SoftnetPamphletBack.css';

const SoftnetPamphletBack = () => {
    const pricingIncludes = [
        "✓ All 16 Modules",
        "✓ Unlimited Users",
        "✓ Android Apps",
        "✓ Play Store Published",
        "✓ Push Notifications",
        "✓ Free Updates",
        "✓ Cloud Backup",
        "✓ 24/7 Support"
    ];

    return (
        <div className="pamphlet-back-page">
            <div className="pamphlet-back-container">

                {/* Header */}
                <div className="back-hero-section">
                    <div className="back-hero-content">
                        <h1 className="back-main-title">CONNECT TO CAMPUS</h1>
                        <p className="back-subtitle">Complete School Management by SoftForge Technologies</p>
                        <div className="app-badge">📱 Available on Play Store</div>
                    </div>
                </div>

                {/* Why Choose */}
                <div className="why-choose-compact">
                    <h2 className="section-title-compact">Why Choose C2C?</h2>
                    <div className="why-grid-compact">
                        <div className="why-card-compact">
                            <div className="why-icon-compact">☁️</div>
                            <h3>100% Cloud</h3>
                            <p>Access Anywhere</p>
                        </div>
                        <div className="why-card-compact">
                            <div className="why-icon-compact">🔒</div>
                            <h3>Secure</h3>
                            <p>Bank-Level Security</p>
                        </div>
                        <div className="why-card-compact">
                            <div className="why-icon-compact">📱</div>
                            <h3>Mobile Apps</h3>
                            <p>Android App</p>
                        </div>
                        <div className="why-card-compact">
                            <div className="why-icon-compact">💯</div>
                            <h3>Complete</h3>
                            <p>Production Ready</p>
                        </div>
                    </div>
                </div>

                {/* Pricing */}
                <div className="pricing-compact">
                    <h2 className="section-title-compact">Complete Package</h2>
                    <div className="pricing-card-compact">
                        <div className="pricing-header-compact">
                            <h3>CONNECT TO CAMPUS (C2C)</h3>
                            <p className="price-compact">Contact for Custom Quote</p>
                        </div>
                        <div className="pricing-grid-compact">
                            {pricingIncludes.map((item, index) => (
                                <div key={index} className="pricing-item-compact">{item}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Offers */}
                <div className="offers-compact">
                    <h2 className="section-title-compact">Special Launch Offers</h2>
                    <div className="offers-grid-compact">
                        <div className="offer-compact">🎁 30 Days Free Trial</div>
                        <div className="offer-compact">🆓 Free Installation</div>
                        <div className="offer-compact">📚 Free Staff Training</div>
                    </div>
                </div>

                {/* Contact - UPDATED */}
                <div className="contact-compact">
                    <h2 className="section-title-compact">Get Started Today</h2>
                    <div className="contact-grid-compact" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                        <div className="contact-item-compact">
                            <div className="contact-icon-compact">📍</div>
                            <p className="contact-label-compact">Address</p>
                            <p className="contact-value-compact" style={{ fontSize: '9px', lineHeight: '1.2' }}>
                                A179, Sector 12,<br />Nava Nagar, Bagalkote,<br />Karnataka 587103
                            </p>
                        </div>
                        <div className="contact-item-compact">
                            <div className="contact-icon-compact">📞</div>
                            <p className="contact-label-compact">Call Us</p>
                            <p className="contact-value-compact">8618602743</p>
                            <p className="contact-value-compact">8095108913</p>
                        </div>
                        <div className="contact-item-compact">
                            <div className="contact-icon-compact">💬</div>
                            <p className="contact-label-compact">WhatsApp</p>
                            <p className="contact-value-compact">8618602743</p>
                            <p className="contact-value-compact">8095108913</p>
                        </div>
                        <div className="contact-item-compact">
                            <div className="contact-icon-compact">✉️</div>
                            <p className="contact-label-compact">Email</p>
                            <p className="contact-value-compact" style={{ fontSize: '9px' }}>contact@softforge.co.in</p>
                        </div>
                        <div className="contact-item-compact">
                            <div className="contact-icon-compact">🌐</div>
                            <p className="contact-label-compact">Website</p>
                            <p className="contact-value-compact">https://softforge.co.in/</p>
                        </div>
                    </div>
                </div>

                {/* CTA */}
                <div className="cta-compact">
                    <button className="cta-btn-compact primary">📅 Schedule Demo</button>
                    <button className="cta-btn-compact secondary">📱 Download App</button>
                </div>

                {/* Footer */}
                <div className="footer-compact">
                    <p className="footer-main-compact">
                        <strong>SoftForge Technologies</strong> - Connect to Campus (C2C)
                    </p>
                    <p className="footer-sub-compact">
                        Complete School Management Solution | Available on Play Store
                    </p>
                    <p className="footer-sub-compact">
                        © 2025 SoftForge Technologies. All Rights Reserved.
                    </p>
                </div>

            </div>
        </div>
    );
};

export default SoftnetPamphletBack;
