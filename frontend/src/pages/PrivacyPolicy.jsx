import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, MapPin, Bell, Database, Lock, Mail, Phone, ArrowLeft } from 'lucide-react';

const Section = ({ icon: Icon, title, children, color = '#4F46E5' }) => (
    <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{
                width: '42px', height: '42px', borderRadius: '10px',
                background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <Icon size={22} style={{ color }} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#1F2937' }}>{title}</h2>
        </div>
        <div style={{ paddingLeft: '3.2rem', color: '#4B5563', lineHeight: '1.8', fontSize: '0.95rem' }}>
            {children}
        </div>
    </div>
);

const PrivacyPolicy = () => {
    const lastUpdated = 'March 2, 2026';
    const appName = 'Connect to Campus (C2C)';
    const companyName = 'SoftForge Technologies';
    const email = 'contact@softforge.co.in';
    const website = 'https://softforge.co.in';

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #F0F4FF 0%, #FAF5FF 100%)',
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                padding: '2rem',
                color: 'white'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <Link to="/login" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        color: 'rgba(255,255,255,0.8)', textDecoration: 'none',
                        fontSize: '0.9rem', marginBottom: '1.5rem'
                    }}>
                        <ArrowLeft size={16} /> Back to App
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '56px', height: '56px', background: 'rgba(255,255,255,0.15)',
                            borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Shield size={30} color="white" />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '900' }}>Privacy Policy</h1>
                            <p style={{ margin: 0, opacity: 0.85, fontSize: '0.9rem' }}>{appName} · Last updated: {lastUpdated}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
                <div style={{
                    background: 'white', borderRadius: '20px',
                    padding: '2.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
                }}>

                    {/* Intro */}
                    <div style={{
                        background: '#EEF2FF', borderRadius: '12px', padding: '1.25rem',
                        marginBottom: '2.5rem', borderLeft: '4px solid #4F46E5'
                    }}>
                        <p style={{ margin: 0, color: '#3730A3', fontSize: '0.95rem', lineHeight: '1.7' }}>
                            <strong>{companyName}</strong> built the <strong>{appName}</strong> app as a School Management System.
                            This page informs users about our policies regarding the collection, use, and disclosure
                            of personal information. By using our app, you agree to the collection and use of
                            information as described in this policy.
                        </p>
                    </div>

                    {/* Location Data */}
                    <Section icon={MapPin} title="Location Data & GPS Tracking" color="#DC2626">
                        <p>
                            Our app collects and uses location data for the following purposes:
                        </p>
                        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem' }}>
                            <li style={{ marginBottom: '0.5rem' }}>
                                <strong>Foreground Location:</strong> Used to show the live position of school buses
                                on the map when the app is open.
                            </li>
                            <li style={{ marginBottom: '0.5rem' }}>
                                <strong>Background Location (GPS):</strong> Used by school bus drivers only —
                                to continuously broadcast the vehicle's live location to parents and school admins
                                for transport safety and tracking, even when the app is minimized.
                            </li>
                            <li>
                                <strong>Who it applies to:</strong> Only drivers assigned to school transport routes.
                                Students and parents only receive location data — they do not share their own location.
                            </li>
                        </ul>
                        <p style={{ marginTop: '1rem', background: '#FEF2F2', borderRadius: '8px', padding: '0.75rem', color: '#991B1B' }}>
                            📍 <strong>Background Location Disclosure:</strong> This app accesses location in the
                            background solely for real-time bus tracking. This data is never sold, shared with
                            advertisers, or used for any purpose outside school transport management.
                        </p>
                    </Section>

                    {/* Data Collected */}
                    <Section icon={Database} title="Data We Collect" color="#0891B2">
                        <p>We collect the following types of information:</p>
                        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem' }}>
                            <li style={{ marginBottom: '0.5rem' }}><strong>Personal Information:</strong> Name, email address, phone number, student admission number, employee ID</li>
                            <li style={{ marginBottom: '0.5rem' }}><strong>Academic Data:</strong> Attendance records, exam marks, fee payment status, library records</li>
                            <li style={{ marginBottom: '0.5rem' }}><strong>Device Information:</strong> Device token for push notifications (Firebase Cloud Messaging)</li>
                            <li style={{ marginBottom: '0.5rem' }}><strong>Location Data:</strong> GPS coordinates (drivers only, for bus tracking)</li>
                            <li><strong>Usage Data:</strong> App interaction logs for debugging and improvement</li>
                        </ul>
                    </Section>

                    {/* Notifications */}
                    <Section icon={Bell} title="Push Notifications" color="#D97706">
                        <p>
                            We use Firebase Cloud Messaging (FCM) to send push notifications. These include:
                        </p>
                        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem' }}>
                            <li style={{ marginBottom: '0.5rem' }}>Fee payment reminders</li>
                            <li style={{ marginBottom: '0.5rem' }}>Attendance alerts</li>
                            <li style={{ marginBottom: '0.5rem' }}>Announcements from school administration</li>
                            <li>General school updates and events</li>
                        </ul>
                        <p style={{ marginTop: '0.75rem' }}>
                            You can disable notifications at any time from your device's Settings → App Notifications.
                        </p>
                    </Section>

                    {/* Data Security */}
                    <Section icon={Lock} title="Data Security & Storage" color="#059669">
                        <p>All data is stored securely on our AWS (Amazon Web Services) servers:</p>
                        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem' }}>
                            <li style={{ marginBottom: '0.5rem' }}>All communication is encrypted via HTTPS/TLS</li>
                            <li style={{ marginBottom: '0.5rem' }}>Passwords are hashed using bcrypt — never stored in plain text</li>
                            <li style={{ marginBottom: '0.5rem' }}>Access is role-based — students see only their data, teachers see only their class</li>
                            <li style={{ marginBottom: '0.5rem' }}>Data is retained for the duration of your school's subscription</li>
                            <li>We do <strong>not</strong> sell, trade, or share your personal data with third parties</li>
                        </ul>
                    </Section>

                    {/* Third Party */}
                    <Section icon={Shield} title="Third-Party Services" color="#7C3AED">
                        <p>We use the following third-party services:</p>
                        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem' }}>
                            <li style={{ marginBottom: '0.5rem' }}><strong>Firebase (Google):</strong> Push notifications and authentication</li>
                            <li style={{ marginBottom: '0.5rem' }}><strong>AWS RDS (PostgreSQL):</strong> Secure cloud database</li>
                            <li><strong>Let's Encrypt:</strong> SSL certificate for HTTPS security</li>
                        </ul>
                        <p style={{ marginTop: '0.75rem' }}>
                            Each third-party service has its own privacy policy. We encourage users to review them.
                        </p>
                    </Section>

                    {/* Children */}
                    <Section icon={Shield} title="Children's Privacy" color="#EC4899">
                        <p>
                            Our app is used in school environments and may be used by students under 13 years of age
                            under the supervision and consent of their parents/guardians and school administrators.
                            We do not knowingly collect personal information from children without school or parental consent.
                        </p>
                    </Section>

                    {/* User Rights */}
                    <Section icon={Database} title="Your Rights" color="#0891B2">
                        <p>You have the right to:</p>
                        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.75rem' }}>
                            <li style={{ marginBottom: '0.5rem' }}>Request access to the personal data we hold about you</li>
                            <li style={{ marginBottom: '0.5rem' }}>Request correction of inaccurate data</li>
                            <li style={{ marginBottom: '0.5rem' }}>Request deletion of your account and data</li>
                            <li>Withdraw consent for location tracking at any time via device settings</li>
                        </ul>
                        <p style={{ marginTop: '0.75rem' }}>
                            To exercise any of these rights, contact your school administrator or email us directly.
                        </p>
                    </Section>

                    {/* Contact */}
                    <Section icon={Mail} title="Contact Us" color="#4F46E5">
                        <p>If you have any questions about this Privacy Policy, contact us:</p>
                        <div style={{ marginTop: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <Mail size={16} color="#4F46E5" />
                                <a href={`mailto:${email}`} style={{ color: '#4F46E5', fontWeight: '600' }}>{email}</a>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Shield size={16} color="#4F46E5" />
                                <a href={website} style={{ color: '#4F46E5', fontWeight: '600' }}>{website}</a>
                            </div>
                        </div>
                    </Section>

                    {/* Footer */}
                    <div style={{
                        borderTop: '1px solid #E5E7EB', paddingTop: '1.5rem', marginTop: '1rem',
                        textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem'
                    }}>
                        <p style={{ margin: 0 }}>
                            © 2026 {companyName} · {appName} · All rights reserved
                        </p>
                        <p style={{ margin: '0.25rem 0 0 0' }}>
                            This policy is effective as of {lastUpdated} and will remain in effect
                            unless updated. We will notify users of any changes via the app.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
