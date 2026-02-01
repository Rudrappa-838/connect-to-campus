import { Check, Zap, Shield, Cloud, Users, HeadphonesIcon } from 'lucide-react'

const features = [
    {
        icon: Cloud,
        title: '100% Cloud-Based',
        description: 'Access your school data anytime, anywhere. No servers to maintain, automatic updates included.'
    },
    {
        icon: Zap,
        title: 'Lightning Fast',
        description: 'Optimized performance ensures quick loading times and smooth operations for all users.'
    },
    {
        icon: Shield,
        title: 'Bank-Grade Security',
        description: 'Your data is protected with enterprise-level encryption and regular security audits.'
    },
    {
        icon: Users,
        title: 'Multi-User Support',
        description: 'Role-based access for administrators, teachers, students, and parents with custom permissions.'
    },
    {
        icon: HeadphonesIcon,
        title: '24/7 Support',
        description: 'Our dedicated support team is always available to help you with any questions or issues.'
    },
    {
        icon: Check,
        title: 'Easy Integration',
        description: 'Seamlessly integrate with existing systems and third-party applications via our API.'
    }
]

export default function Features() {
    return (
        <section id="features" className="min-h-screen py-20 px-6 bg-slate-900/50">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Powerful Features
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Everything you need in a modern institute management system
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="p-6 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-blue-500/50 transition-all duration-300"
                        >
                            <feature.icon className="w-10 h-10 text-blue-400 mb-4" />
                            <h3 className="text-xl font-bold mb-2 text-white">
                                {feature.title}
                            </h3>
                            <p className="text-gray-400 leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
