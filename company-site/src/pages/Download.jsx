import { motion } from 'framer-motion'
import { Download as DownloadIcon, Smartphone, CheckCircle, QrCode } from 'lucide-react'

export default function Download() {
    return (
        <div className="min-h-screen pt-32 pb-20 px-6">
            <div className="max-w-5xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mb-6">
                        <Smartphone className="w-10 h-10" />
                    </div>
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">
                        Download{' '}
                        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            C2C App
                        </span>
                    </h1>
                    <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                        Get the C2C mobile app and stay connected with your campus on the go
                    </p>
                </motion.div>

                {/* Download Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="p-12 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 rounded-3xl backdrop-blur-md mb-12"
                >
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-3xl font-bold mb-6">Android App</h2>
                            <ul className="space-y-4 mb-8">
                                {[
                                    'Real-time notifications',
                                    'Offline access',
                                    'Biometric login',
                                    'Fast & secure',
                                    'Regular updates'
                                ].map((feature, index) => (
                                    <li key={index} className="flex items-center space-x-3">
                                        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                                        <span className="text-gray-300">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="w-full px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full font-semibold text-lg flex items-center justify-center space-x-2 shadow-2xl shadow-purple-500/50"
                            >
                                <DownloadIcon className="w-6 h-6" />
                                <span>Download APK</span>
                            </motion.button>

                            <p className="text-sm text-gray-400 mt-4 text-center">
                                Version 1.0.0 • Last updated: Feb 2026 • Size: ~20MB
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="w-64 h-64 mx-auto bg-white rounded-2xl p-4 mb-4 flex items-center justify-center">
                                <QrCode className="w-full h-full text-gray-800" />
                            </div>
                            <p className="text-gray-400">Scan QR code to download</p>
                        </div>
                    </div>
                </motion.div>

                {/* Requirements */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl"
                >
                    <h3 className="text-2xl font-bold mb-6">System Requirements</h3>
                    <div className="grid md:grid-cols-2 gap-6 text-gray-300">
                        <div>
                            <h4 className="font-semibold text-white mb-2">Minimum</h4>
                            <ul className="space-y-1 text-sm">
                                <li>• Android 8.0 or higher</li>
                                <li>• 2GB RAM</li>
                                <li>• 100MB free storage</li>
                                <li>• Internet connection</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-2">Recommended</h4>
                            <ul className="space-y-1 text-sm">
                                <li>• Android 11 or higher</li>
                                <li>• 4GB RAM</li>
                                <li>• 200MB free storage</li>
                                <li>• 4G/WiFi connection</li>
                            </ul>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
