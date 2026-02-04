import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, Github, Linkedin, Twitter } from 'lucide-react'

export default function Footer() {
    return (
        <footer className="relative z-10 bg-slate-900/80 backdrop-blur-md border-t border-purple-500/20 mt-20">
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">
                            C2C
                        </h3>
                        <p className="text-sm mb-4">
                            <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 bg-clip-text text-transparent font-medium">Connect to Campus</span> <span className="text-gray-400">- Modern school management platform connecting students, teachers, and parents.</span>
                        </p>
                        <div className="flex space-x-4">
                            <a href="#" className="text-gray-400 hover:text-purple-400 transition">
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a href="#" className="text-gray-400 hover:text-purple-400 transition">
                                <Linkedin className="w-5 h-5" />
                            </a>
                            <a href="#" className="text-gray-400 hover:text-purple-400 transition">
                                <Github className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link to="/" className="text-gray-400 hover:text-purple-400 transition">
                                    Home
                                </Link>
                            </li>
                            <li>
                                <Link to="/product" className="text-gray-400 hover:text-purple-400 transition">
                                    Product
                                </Link>
                            </li>
                            <li>
                                <Link to="/about" className="text-gray-400 hover:text-purple-400 transition">
                                    About Us
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="text-lg font-semibold mb-4">Resources</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link to="/download" className="text-gray-400 hover:text-purple-400 transition">
                                    Download App
                                </Link>
                            </li>
                            <li>
                                <Link to="/contact" className="text-gray-400 hover:text-purple-400 transition">
                                    Contact Support
                                </Link>
                            </li>
                            <li>
                                <Link to="/privacy" className="text-gray-400 hover:text-purple-400 transition">
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <a href="#" className="text-gray-400 hover:text-purple-400 transition">
                                    Terms of Service
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
                        <ul className="space-y-3 text-sm text-gray-400">
                            <li className="flex items-center space-x-2">
                                <Mail className="w-4 h-4 text-purple-400" />
                                <span>support@connect2campus.com</span>
                            </li>
                            <li className="flex items-center space-x-2">
                                <Phone className="w-4 h-4 text-purple-400" />
                                <span>+91 XXXXX XXXXX</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <MapPin className="w-4 h-4 text-purple-400 mt-1" />
                                <span>Your City, State<br />India</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
                    <p>&copy; {new Date().getFullYear()} <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 bg-clip-text text-transparent font-medium">C2C - Connect to Campus</span>. All rights reserved.</p>
                </div>
            </div>
        </footer>
    )
}
