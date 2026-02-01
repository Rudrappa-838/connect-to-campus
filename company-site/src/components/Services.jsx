import { GraduationCap, Users, BarChart3, Shield, Calendar, BookOpen } from 'lucide-react'

const features = [
    {
        icon: GraduationCap,
        title: '🎓 Student Management',
        description: 'Complete student lifecycle from admission to graduation with digital records.'
    },
    {
        icon: Users,
        title: '👥 Staff & Teachers',
        description: 'Manage faculty, track attendance, assign classes, and handle payroll seamlessly.'
    },
    {
        icon: BarChart3,
        title: '📊 Analytics & Reports',
        description: 'Real-time insights into performance, attendance, and financial metrics.'
    },
    {
        icon: Shield,
        title: '🔒 Secure & Compliant',
        description: 'Bank-grade security with role-based access and data encryption.'
    },
    {
        icon: Calendar,
        title: '📅 Timetable & Events',
        description: 'Automated scheduling, exam management, and calendar integration.'
    },
    {
        icon: BookOpen,
        title: '📚 Library & Resources',
        description: 'Digital library management with book tracking and resource allocation.'
    }
]

export default function Services() {
    return (
        <section id="services" className="min-h-screen py-20 px-6">
            <div className="max-w-7xl mx-auto">
                <div
                    className="text-center mb-16"
                >
                    <h2 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Complete Institute Management
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Everything you need to run a modern educational institution, all in one platform.
                    </p>
                </div>

                <div className="grid grid-cols-1 md://grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="group relative p-8 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 backdrop-blur-sm hover:border-blue-500/50 transition-all duration-300"
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="relative z-10">
                                <feature.icon className="w-12 h-12 text-blue-400 mb-4 group-hover:text-blue-300 transition-colors" />
                                <h3 className="text-2xl font-bold mb-3 text-white group-hover:text-blue-300 transition-colors">
                                    {feature.title}
                                </h3>
                                <p className="text-gray-400 leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
