import { motion } from 'framer-motion'
import { Target, Heart, Zap, Users } from 'lucide-react'

export default function About() {
    return (
        <div className="min-h-screen pt-32 pb-20 px-6">
            <div className="max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">
                        About{' '}
                        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            C2C
                        </span>
                    </h1>
                    <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                        We're on a mission to transform school management through innovative technology
                    </p>
                </motion.div>

                {/* Story */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="mb-20 p-12 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl"
                >
                    <h2 className="text-3xl font-bold mb-6">Our Story</h2>
                    <p className="text-gray-300 text-lg leading-relaxed mb-4">
                        Founded in 2025, C2C (<span className="bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 bg-clip-text text-transparent font-medium">Connect to Campus</span>) was born from a simple observation:
                        schools needed better tools to manage their operations in the digital age.
                    </p>
                    <p className="text-gray-300 text-lg leading-relaxed">
                        Today, we serve hundreds of schools across India, helping them streamline operations,
                        improve communication, and focus on what matters most - education.
                    </p>
                </motion.div>

                {/* Values */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                        { icon: Target, title: 'Mission Driven', description: 'Committed to improving education' },
                        { icon: Heart, title: 'User First', description: 'Built with schools in mind' },
                        { icon: Zap, title: 'Innovation', description: 'Constantly evolving' },
                        { icon: Users, title: 'Community', description: 'Growing together' }
                    ].map((value, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 rounded-2xl text-center"
                        >
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
                                <value.icon className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">{value.title}</h3>
                            <p className="text-gray-400">{value.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    )
}
