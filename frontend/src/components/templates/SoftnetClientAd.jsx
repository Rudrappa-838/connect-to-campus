import React from 'react';
import './SoftnetClientAd.css';

const SoftnetClientAd = () => {
    const coreFeatures = [
        { icon: "👥", title: "Student Management", desc: "Complete student lifecycle from admission to graduation", color: "#4F46E5" },
        { icon: "👨‍🏫", title: "Teacher Portal", desc: "Comprehensive tools for educators & staff", color: "#7C3AED" },
        { icon: "💰", title: "Fee Management", desc: "Automated billing, receipts & payment tracking", color: "#2563EB" },
        { icon: "📊", title: "Smart Analytics", desc: "Real-time insights & performance reports", color: "#0891B2" },
        { icon: "📱", title: "Mobile App", desc: "Android & iOS apps for students, parents & staff", color: "#059669" },
        { icon: "🔔", title: "Push Notifications", desc: "Instant alerts & updates for everyone", color: "#DC2626" },
        { icon: "🏠", title: "Hostel Management", desc: "Room allocation, mess bills & attendance", color: "#EA580C" },
        { icon: "📚", title: "Digital Library", desc: "Book tracking, issue/return & fines", color: "#D97706" },
        { icon: "🚌", title: "GPS Transport", desc: "Real-time vehicle tracking & route management", color: "#65A30D" },
        { icon: "🤖", title: "AI Integration", desc: "Auto-generate question papers with AI", color: "#8B5CF6" },
        { icon: "📅", title: "Smart Calendar", desc: "Events, holidays & timetable management", color: "#EC4899" },
        { icon: "🎓", title: "Exam System", desc: "Schedule, marks, grades & report cards", color: "#6366F1" }
    ];

    const benefits = [
        { number: "100%", label: "Cloud Based", icon: "☁️" },
        { number: "24/7", label: "Support", icon: "💬" },
        { number: "99.9%", label: "Uptime", icon: "⚡" },
        { number: "∞", label: "Scalable", icon: "📈" }
    ];

    const testimonials = [
        { school: "St. Mary's School", feedback: "SoftForge Technologies transformed our administration. Highly recommended!", rating: 5 },
        { school: "Delhi Public School", feedback: "Best school management software we've ever used!", rating: 5 },
        { school: "National Academy", feedback: "Excellent support and features. Worth every penny!", rating: 5 }
    ];

    const pricingFeatures = [
        "✓ Unlimited Students & Staff",
        "✓ Mobile Apps Included",
        "✓ Free Updates Forever",
        "✓ 24/7 Technical Support",
        "✓ Data Backup & Security",
        "✓ Custom Branding"
    ];

    return (
        <div className="softnet-ad-page">
            <div className="softnet-ad-container">

                {/* Hero Section */}
                <div className="softnet-hero">
                    <div className="hero-bg-pattern"></div>
                    <div className="hero-content-wrapper">
                        <div className="softnet-logo-large">
                            <div className="logo-text">SoftForge Technologies</div>
                            <div className="logo-tagline">School Management System</div>
                        </div>

                        <h1 className="hero-main-heading">
                            Transform Your School into a
                            <span className="highlight-text"> Smart Institution</span>
                        </h1>

                        <p className="hero-description">
                            Complete Digital Solution for Modern Schools | Trusted by 100+ Institutions Across India
                        </p>

                        <div className="hero-cta-buttons">
                            <button className="cta-primary">Start Free Trial</button>
                            <button className="cta-secondary">Schedule Demo</button>
                        </div>
                    </div>

                    <div className="hero-wave-bottom">
                        <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
                            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" className="wave-shape"></path>
                        </svg>
                    </div>
                </div>

                {/* Why Choose SoftForge Technologies */}
                <div className="why-section">
                    <h2 className="section-title-main">Why Schools Choose SoftForge Technologies?</h2>
                    <p className="section-subtitle">Everything you need to run your school efficiently in one powerful platform</p>

                    <div className="benefits-showcase">
                        {benefits.map((benefit, index) => (
                            <div key={index} className="benefit-card-large">
                                <div className="benefit-icon-large">{benefit.icon}</div>
                                <div className="benefit-number-large">{benefit.number}</div>
                                <div className="benefit-label-large">{benefit.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Features Grid */}
                <div className="features-showcase-section">
                    <h2 className="section-title-main">Complete Feature Suite</h2>
                    <p className="section-subtitle">12 Powerful Modules to Digitize Every Aspect of Your School</p>

                    <div className="features-grid-attractive">
                        {coreFeatures.map((feature, index) => (
                            <div key={index} className="feature-card-attractive">
                                <div className="feature-icon-circle" style={{ background: `linear-gradient(135deg, ${feature.color} 0%, ${feature.color}dd 100%)` }}>
                                    <span className="feature-icon-large">{feature.icon}</span>
                                </div>
                                <h3 className="feature-title-attractive">{feature.title}</h3>
                                <p className="feature-desc-attractive">{feature.desc}</p>
                                <div className="feature-shine-effect"></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Testimonials */}
                <div className="testimonials-section">
                    <h2 className="section-title-main">Loved by Schools Nationwide</h2>
                    <div className="testimonials-grid">
                        {testimonials.map((test, index) => (
                            <div key={index} className="testimonial-card">
                                <div className="stars">
                                    {[...Array(test.rating)].map((_, i) => (
                                        <span key={i} className="star">⭐</span>
                                    ))}
                                </div>
                                <p className="testimonial-text">"{test.feedback}"</p>
                                <div className="testimonial-school">— {test.school}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pricing Section */}
                <div className="pricing-section">
                    <h2 className="section-title-main">Simple, Transparent Pricing</h2>
                    <p className="section-subtitle">No hidden charges. Pay only for what works for you.</p>

                    <div className="pricing-card-wrapper">
                        <div className="pricing-card-main">
                            <div className="pricing-badge">Most Popular</div>
                            <h3 className="pricing-plan-name">Enterprise Plan</h3>
                            <div className="pricing-cost">
                                <span className="currency">₹</span>
                                <span className="amount">Contact Us</span>
                            </div>
                            <p className="pricing-period">Custom pricing based on student count</p>

                            <div className="pricing-features-list">
                                {pricingFeatures.map((feature, index) => (
                                    <div key={index} className="pricing-feature-item">{feature}</div>
                                ))}
                            </div>

                            <button className="pricing-cta-btn">Get Custom Quote</button>
                        </div>
                    </div>
                </div>

                {/* Technology Stack */}
                <div className="tech-section">
                    <h2 className="section-title-main">Built with Modern Technology</h2>
                    <div className="tech-badges">
                        <div className="tech-badge">⚛️ React</div>
                        <div className="tech-badge">🟢 Node.js</div>
                        <div className="tech-badge">🐘 PostgreSQL</div>
                        <div className="tech-badge">🔥 Firebase</div>
                        <div className="tech-badge">☁️ AWS</div>
                        <div className="tech-badge">📱 Capacitor</div>
                    </div>
                </div>

                {/* Final CTA */}
                <div className="final-cta-section">
                    <div className="final-cta-content">
                        <h2 className="final-cta-heading">Ready to Digitize Your School?</h2>
                        <p className="final-cta-text">Join 100+ schools already using SoftForge Technologies. Start your free trial today!</p>
                        <div className="final-cta-buttons">
                            <button className="btn-final-primary">Start Free 30-Day Trial</button>
                            <button className="btn-final-secondary">Book a Live Demo</button>
                        </div>
                    </div>
                </div>

                {/* Contact Footer */}
                <div className="contact-footer-section">
                    <div className="contact-footer-grid">
                        <div className="contact-footer-item">
                            <div className="contact-footer-icon">📞</div>
                            <h4>Call Us</h4>
                            <p>+91 86186 02743</p>
                        </div>
                        <div className="contact-footer-item">
                            <div className="contact-footer-icon">✉️</div>
                            <h4>Email</h4>
                            <p>contact@softforge.co.in</p>
                        </div>
                        <div className="contact-footer-item">
                            <div className="contact-footer-icon">🌐</div>
                            <h4>Website</h4>
                            <p>https://softforge.co.in/</p>
                        </div>
                        <div className="contact-footer-item">
                            <div className="contact-footer-icon">💬</div>
                            <h4>Live Chat</h4>
                            <p>Available 24/7</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="softnet-footer">
                    <p className="footer-main-text">
                        <strong>SoftForge Technologies</strong> - India's Leading School Management Solution
                    </p>
                    <p className="footer-sub-text">Empowering Education Through Technology Since 2020</p>
                </div>

            </div>
        </div>
    );
};

export default SoftnetClientAd;
