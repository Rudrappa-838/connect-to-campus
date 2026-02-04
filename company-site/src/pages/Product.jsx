import { motion } from 'framer-motion'
import {
    GraduationCap,
    Users,
    DollarSign,
    Home,
    Bus,
    Calendar,
    FileText,
    BarChart,
    Bell,
    Shield,
    Smartphone,
    Cloud
} from 'lucide-react'

export default function Product() {
    const modules = [
        {
            icon: GraduationCap,
            title: 'Academic Management',
            description: 'Complete academic lifecycle from admission to results',
            features: ['Student Records', 'Attendance Tracking', 'Marks & Grades', 'Certificates', 'Report Cards']
        },
        {
            icon: DollarSign,
            title: 'Fee Management',
            description: 'Automated fee collection and financial tracking',
            features: ['Online Payments', 'Fee Receipts', 'Due Reminders', 'Financial Reports', 'Multiple Payment Modes']
        },
        {
            icon: Home,
            title: 'Hostel Management',
            description: 'Complete hostel operations and student care',
            features: ['Room Allocation', 'Mess Management', 'Attendance', 'Visitor Tracking', 'Complaint System']
        },
        {
            icon: Bus,
            title: 'Fleet Tracking',
            description: 'Real-time GPS tracking for student safety',
            features: ['Live Location', 'Route Monitoring', 'Parent Notifications', 'Driver Management', 'Geofencing']
        },
        {
            icon: Calendar,
            title: 'Timetable & Scheduling',
            description: 'Intelligent scheduling and calendar management',
            features: ['Class Timetable', 'Exam Schedule', 'Leave Management', 'Events Calendar', 'Substitution']
        },
        {
            icon: FileText,
            title: 'Library Management',
            description: 'Digital library with inventory management',
            features: ['Book Catalog', 'Issue/Return', 'Fine Management', 'Digital Library', 'Reports']
        },
        {
            icon: Users,
            title: 'Staff Management',
            description: 'Complete HR and payroll solutions',
            features: ['Employee Records', 'Attendance', 'Payroll', 'Leave Management', 'Performance Review']
        },
        {
            icon: Bell,
            title: 'Communication Hub',
            description: 'Multi-channel communication platform',
            features: ['Push Notifications', 'SMS Alerts', 'Email Notifications', 'Announcements', 'Chat Support']
        }
    ]

    const highlights = [
        {
            icon: Smartphone,
            title: 'Mobile First',
            description: 'Native Android app with offline support'
        },
        {
            icon: Cloud,
            title: 'Cloud Based',
            description: 'Secure AWS infrastructure with 99.9% uptime'
        },
        {
            icon: Shield,
            title: 'Enterprise Security',
            description: 'Bank-grade encryption and data protection'
        },
        {
            icon: BarChart,
            title: 'Advanced Analytics',
            description: 'Detailed insights and customizable reports'
        }
    ]

    return (
        <div className="min-h-screen pt-32 pb-20 px-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-20"
                >
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">
                        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            Complete School
                        </span>
                        <br />
                        Management Platform
                    </h1>
                    <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                        All the tools you need to run your school efficiently - from academics to operations,
                        all in one powerful platform
                    </p>
                </motion.div>

                {/* Highlights */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
                    {highlights.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 rounded-2xl backdrop-blur-md text-center"
                        >
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
                                <item.icon className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                            <p className="text-sm text-gray-400">{item.description}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Modules Grid */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="mb-16"
                >
                    <h2 className="text-4xl font-bold text-center mb-12">
                        Powerful{' '}
                        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            Modules
                        </span>
                    </h2>

                    <div className="grid md:grid-cols-2 gap-8">
                        {modules.map((module, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.05 }}
                                whileHover={{ scale: 1.02 }}
                                className="p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl hover:bg-white/10 transition-all group"
                            >
                                <div className="flex items-start space-x-4 mb-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        <module.icon className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold mb-2">{module.title}</h3>
                                        <p className="text-gray-400">{module.description}</p>
                                    </div>
                                </div>

                                <ul className="space-y-2 mt-6">
                                    {module.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-center space-x-2 text-sm text-gray-300">
                                            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="mt-20 p-12 bg-gradient-to-r from-blue-600 to-purple-700 rounded-3xl text-center"
                >
                    <h2 className="text-4xl font-bold mb-4">Ready to get started?</h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Schedule a personalized demo and see C2C in action
                    </p>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-10 py-4 bg-white text-purple-600 rounded-full font-semibold text-lg shadow-xl"
                    >
                        Request a Demo
                    </motion.button>
                </motion.div>
            </div>
        </div>
    )
}
