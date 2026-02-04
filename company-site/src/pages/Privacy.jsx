import { motion } from 'framer-motion'
import { Shield, Lock, Eye, FileText } from 'lucide-react'

export default function Privacy() {
    return (
        <div className="min-h-screen pt-32 pb-20 px-6">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mb-6">
                        <Shield className="w-10 h-10" />
                    </div>
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">
                        Privacy{' '}
                        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            Policy
                        </span>
                    </h1>
                    <p className="text-xl text-gray-300">
                        Last updated: February 4, 2026
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="prose prose-invert prose-lg max-w-none"
                >
                    {/* Quick Summary */}
                    <div className="grid md:grid-cols-3 gap-6 mb-12">
                        {[
                            { icon: Lock, title: 'Data Security', description: 'All data encrypted in transit and at rest' },
                            { icon: Eye, title: 'Transparency', description: 'Clear about what data we collect' },
                            { icon: FileText, title: 'Your Rights', description: 'Full control over your data' }
                        ].map((item, index) => (
                            <div key={index} className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center">
                                <div className="w-12 h-12 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
                                    <item.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                                <p className="text-sm text-gray-400">{item.description}</p>
                            </div>
                        ))}
                    </div>

                    {/* Privacy Policy Content */}
                    <div className="space-y-8 p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl">
                        <section>
                            <h2 className="text-2xl font-bold mb-4">Welcome to C2C Privacy Policy</h2>
                            <p className="text-gray-300">
                                At C2C (<span className="bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 bg-clip-text text-transparent font-medium">Connect to Campus</span>), we take your privacy seriously. This Privacy Policy explains how we collect,
                                use, disclose, and safeguard your information when you use our mobile application and services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>
                            <p className="text-gray-300 mb-4">We collect information that you provide directly to us, including:</p>
                            <ul className="list-disc list-inside space-y-2 text-gray-300">
                                <li>Personal information (name, email, phone number)</li>
                                <li>Student academic records and attendance</li>
                                <li>Fee payment information</li>
                                <li>Location data (for fleet tracking features)</li>
                                <li>Device information and usage data</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
                            <p className="text-gray-300 mb-4">We use the collected information to:</p>
                            <ul className="list-disc list-inside space-y-2 text-gray-300">
                                <li>Provide and maintain our services</li>
                                <li>Send you notifications and updates</li>
                                <li>Process payments and manage finances</li>
                                <li>Improve our application and user experience</li>
                                <li>Ensure security and prevent fraud</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4">3. Data Security</h2>
                            <p className="text-gray-300">
                                We implement appropriate technical and organizational security measures to protect your personal information.
                                All data is encrypted in transit using SSL/TLS protocols and stored securely on AWS infrastructure with
                                bank-grade encryption.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4">4. Data Sharing</h2>
                            <p className="text-gray-300">
                                We do not sell your personal information. We may share your information with:
                            </p>
                            <ul className="list-disc list-inside space-y-2 text-gray-300 mt-4">
                                <li>Authorized school staff and administrators</li>
                                <li>Third-party service providers (AWS, Firebase)</li>
                                <li>Legal authorities when required by law</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4">5. Your Rights</h2>
                            <p className="text-gray-300 mb-4">You have the right to:</p>
                            <ul className="list-disc list-inside space-y-2 text-gray-300">
                                <li>Access your personal information</li>
                                <li>Request correction of inaccurate data</li>
                                <li>Request deletion of your data</li>
                                <li>Opt-out of notifications</li>
                                <li>Disable location services</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4">6. Children's Privacy</h2>
                            <p className="text-gray-300">
                                Our service is designed for educational institutions and may be used by students of various ages.
                                We collect and process student information only with proper authorization from school administration
                                and parents/guardians.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4">7. Changes to This Policy</h2>
                            <p className="text-gray-300">
                                We may update this Privacy Policy from time to time. We will notify you of any changes by posting
                                the new Privacy Policy on this page and updating the "Last updated" date.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4">8. Contact Us</h2>
                            <p className="text-gray-300 mb-4">
                                If you have any questions or concerns about this Privacy Policy, please contact us:
                            </p>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-xl text-gray-300">
                                <p><strong>Email:</strong> support@connect2campus.com</p>
                                <p><strong>Phone:</strong> +91 XXXXX XXXXX</p>
                                <p><strong>Address:</strong> Your City, State, India</p>
                            </div>
                        </section>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
