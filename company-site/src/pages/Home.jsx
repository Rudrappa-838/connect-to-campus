import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle, Sparkles, Zap, Shield, Users } from 'lucide-react'

export default function Home() {
    const features = [
        {
            icon: Users,
            title: 'Student Management',
            description: 'Complete student lifecycle management from admission to graduation'
        },
        {
            icon: Zap,
            title: 'Real-time Updates',
            description: 'Instant notifications for attendance, fees, and announcements'
        },
        {
            icon: Shield,
            title: 'Secure & Reliable',
            description: 'Enterprise-grade security with AWS infrastructure'
        },
        {
            icon: Sparkles,
            title: 'Modern Interface',
            description: 'Beautiful, intuitive UI that everyone loves to use'
        }
    ]

    const stats = [
        { value: '0', label: 'Schools' },
        { value: '0', label: 'Students' },
        { value: '99.9%', label: 'Uptime' },
        { value: '24/7', label: 'Support' }
    ]

    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-center max-w-4xl mx-auto"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
                            className="inline-block mb-6"
                        >
                            <span className="text-sm font-medium bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                                ✨ Professional Web & Mobile App Development
                            </span>
                        </motion.div>

                        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                            <span className="text-white drop-shadow-lg" style={{ textShadow: '0 2px 10px rgba(138, 92, 246, 0.5)' }}>
                                We Build Stunning
                            </span>
                            <br />
                            <span className="text-4xl md:text-6xl bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent drop-shadow-lg">
                                Websites & Mobile Apps
                            </span>
                            <br />
                            <span className="text-3xl md:text-4xl text-gray-300 drop-shadow-lg" style={{ textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)' }}>
                                For Your Business
                            </span>
                        </h1>

                        <p className="text-lg text-gray-200 mb-8 max-w-3xl mx-auto leading-relaxed">
                            Transform your business with our <span className="text-purple-300 font-semibold">custom-built solutions</span>.
                            We create beautiful, responsive websites and powerful Android mobile apps
                            tailored to your unique needs.
                        </p>

                        {/* Service Highlights */}
                        <div className="flex flex-wrap justify-center gap-6 mb-10 max-w-4xl mx-auto">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="px-6 py-3 bg-purple-900/30 backdrop-blur-sm border border-purple-500/30 rounded-xl"
                            >
                                <div className="text-2xl mb-1">🌐</div>
                                <div className="text-sm font-semibold text-white">Custom Websites</div>
                                <div className="text-xs text-gray-400">Responsive & Modern</div>
                            </motion.div>

                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="px-6 py-3 bg-pink-900/30 backdrop-blur-sm border border-pink-500/30 rounded-xl"
                            >
                                <div className="text-2xl mb-1">📱</div>
                                <div className="text-sm font-semibold text-white">Android Apps</div>
                                <div className="text-xs text-gray-400">Native Performance</div>
                            </motion.div>

                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="px-6 py-3 bg-blue-900/30 backdrop-blur-sm border border-blue-500/30 rounded-xl"
                            >
                                <div className="text-2xl mb-1">💼</div>
                                <div className="text-sm font-semibold text-white">Business Solutions</div>
                                <div className="text-xs text-gray-400">End-to-End Development</div>
                            </motion.div>

                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="px-6 py-3 bg-indigo-900/30 backdrop-blur-sm border border-indigo-500/30 rounded-xl"
                            >
                                <div className="text-2xl mb-1">⚡</div>
                                <div className="text-sm font-semibold text-white">Fast Delivery</div>
                                <div className="text-xs text-gray-400">Quick Turnaround</div>
                            </motion.div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <Link to="/download">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full font-semibold text-lg flex items-center space-x-2 shadow-2xl shadow-blue-600/60 text-white border-2 border-white/30"
                                    style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}
                                >
                                    <span>Get Started Free</span>
                                    <ArrowRight className="w-5 h-5" />
                                </motion.button>
                            </Link>

                            <Link to="/product">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="px-8 py-4 bg-white/90 backdrop-blur-md border-2 border-blue-400 rounded-full font-semibold text-lg text-blue-700 hover:bg-white transition shadow-xl"
                                >
                                    Explore Features
                                </motion.button>
                            </Link>
                        </div>
                    </motion.div>

                    {/* Featured Product Section */}
                    <motion.section
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8, duration: 0.8 }}
                        className="relative z-10 py-12 max-w-6xl mx-auto px-6"
                    >
                        <div className="bg-gradient-to-r from-purple-900/40 via-pink-900/40 to-blue-900/40 backdrop-blur-lg border border-purple-500/30 rounded-3xl p-8 md:p-12 shadow-2xl">
                            <div className="text-center mb-6">
                                <span className="inline-block px-6 py-3 bg-purple-500/20 border border-purple-400/30 rounded-full text-purple-300 text-base font-semibold mb-4">
                                    <span className="text-2xl mr-2">🚀</span> Our Flagship Product
                                </span>
                                <h2 className="text-4xl md:text-5xl font-bold mb-4">
                                    <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 bg-clip-text text-transparent">
                                        Connect to Campus (C2C)
                                    </span>
                                </h2>
                                <p className="text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed">
                                    Complete school management solution with powerful mobile app and web dashboard.
                                    Transform how your institution manages academics, attendance, fees, hostel, transport, and more.
                                </p>
                            </div>

                            {/* Product Features Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="text-3xl mb-2">📚</div>
                                    <div className="text-sm font-semibold text-white">Academic Management</div>
                                </div>
                                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="text-3xl mb-2">✓</div>
                                    <div className="text-sm font-semibold text-white">Attendance Tracking</div>
                                </div>
                                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="text-3xl mb-2">💰</div>
                                    <div className="text-sm font-semibold text-white">Fee Management</div>
                                </div>
                                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="text-3xl mb-2">🚌</div>
                                    <div className="text-sm font-semibold text-white">Transport & Hostel</div>
                                </div>
                            </div>

                            {/* CTA Button */}
                            <div className="text-center mt-8">
                                <Link to="/product">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold text-white shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 transition-shadow"
                                    >
                                        Learn More About C2C →
                                    </motion.button>
                                </Link>
                            </div>
                        </div>
                    </motion.section>

                    {/* Stats */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1, duration: 0.8 }}
                        className="relative z-10 py-16"
                    >
                        <div className="text-center mb-8">
                            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                                Trusted by Schools & Students Nationwide
                            </h3>
                            <p className="text-gray-400"><span className="bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 bg-clip-text text-transparent font-medium">Connect to Campus</span> in action</p>
                        </div>

                        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto px-6">
                            {stats.map((stat, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 1.2 + index * 0.1 }}
                                    className="text-center p-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border-2 border-blue-300/50"
                                >
                                    <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2">
                                        {stat.value}
                                    </div>
                                    <div className="text-gray-700 text-sm font-medium">{stat.label}</div>
                                </motion.div>
                            ))
                            }
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            Everything You Need,{' '}
                            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                                All in One Place
                            </span>
                        </h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            Powerful features designed to streamline school operations and enhance learning
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                whileHover={{ y: -5 }}
                                className="p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                            >
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <feature.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                                <p className="text-gray-400">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="relative overflow-hidden p-12 bg-gradient-to-r from-blue-600 to-purple-700 rounded-3xl text-center"
                    >
                        <div className="relative z-10">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6">
                                Ready to Transform Your School?
                            </h2>
                            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                                Join hundreds of schools already using C2C to manage their operations efficiently
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link to="/contact">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="px-8 py-4 bg-white text-purple-600 rounded-full font-semibold text-lg shadow-xl hover:shadow-2xl transition"
                                    >
                                        Schedule a Demo
                                    </motion.button>
                                </Link>
                            </div>
                        </div>

                        {/* Background Animation */}
                        <div className="absolute inset-0 opacity-20">
                            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
                            <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-300 rounded-full blur-3xl"></div>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    )
}
