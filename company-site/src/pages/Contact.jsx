import { motion } from 'framer-motion'
import { Mail, Phone, MapPin, Send } from 'lucide-react'
import { useState } from 'react'

export default function Contact() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        school: '',
        message: ''
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        // Handle form submission
        console.log('Form submitted:', formData)
    }

    return (
        <div className="min-h-screen pt-32 pb-20 px-6">
            <div className="max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">
                        Get in{' '}
                        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            Touch
                        </span>
                    </h1>
                    <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                        Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-12">
                    {/* Contact Info */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h2 className="text-3xl font-bold mb-8">Contact Information</h2>

                        <div className="space-y-6">
                            <div className="flex items-start space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">Email</h3>
                                    <a href="mailto:support@connect2campus.com" className="text-gray-400 hover:text-purple-400 transition">
                                        support@connect2campus.com
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Phone className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">Phone</h3>
                                    <a href="tel:+91XXXXXXXXXX" className="text-gray-400 hover:text-purple-400 transition">
                                        +91 XXXXX XXXXX
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">Address</h3>
                                    <p className="text-gray-400">
                                        Your City, State<br />
                                        India - 000000
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 p-8 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 rounded-2xl">
                            <h3 className="text-xl font-semibold mb-4">Business Hours</h3>
                            <div className="space-y-2 text-gray-400">
                                <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
                                <p>Saturday: 9:00 AM - 2:00 PM</p>
                                <p>Sunday: Closed</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Contact Form */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2">Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500 transition"
                                    placeholder="John Doe"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Email *</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500 transition"
                                    placeholder="john@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Phone</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500 transition"
                                    placeholder="+91 00000 00000"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">School Name</label>
                                <input
                                    type="text"
                                    value={formData.school}
                                    onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500 transition"
                                    placeholder="ABC School"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Message *</label>
                                <textarea
                                    required
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    rows="5"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500 transition resize-none"
                                    placeholder="Tell us about your requirements..."
                                ></textarea>
                            </div>

                            <motion.button
                                type="submit"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-semibold flex items-center justify-center space-x-2 shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 transition-shadow"
                            >
                                <span>Send Message</span>
                                <Send className="w-5 h-5" />
                            </motion.button>
                        </form>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
