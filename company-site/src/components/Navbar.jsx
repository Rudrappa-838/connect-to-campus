import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Menu, X, Download as DownloadIcon } from 'lucide-react'
import { useState } from 'react'

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false)
    const location = useLocation()

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Product', path: '/product' },
        { name: 'About', path: '/about' },
        { name: 'Contact', path: '/contact' },
    ]

    const isActive = (path) => location.pathname === path

    return (
        <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            className="fixed w-full top-0 z-50 backdrop-blur-md bg-black/50 border-b border-purple-500/20"
        >
            <nav className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                {/* Logo */}
                <Link to="/" className="flex items-center space-x-2">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="text-3xl font-bold"
                    >
                        <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 bg-clip-text text-transparent">
                            C2C
                        </span>
                    </motion.div>
                    <span className="hidden md:block text-sm font-medium bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 bg-clip-text text-transparent">
                        Connect to Campus
                    </span>
                </Link>

                {/* Desktop Navigation - Right Side */}
                <div className="hidden md:flex items-center space-x-8 ml-auto">
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className="relative group"
                        >
                            <span
                                className={`text-sm font-medium transition-colors ${isActive(link.path)
                                    ? 'text-purple-400'
                                    : 'text-gray-300 hover:text-white'
                                    }`}
                            >
                                {link.name}
                            </span>
                            {isActive(link.path) && (
                                <motion.div
                                    layoutId="navbar-indicator"
                                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-500"
                                />
                            )}
                        </Link>
                    ))}

                    {/* Download Button */}
                    <Link to="/download">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full font-medium text-sm flex items-center space-x-2 shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 transition-shadow text-white"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            <span>Download App</span>
                        </motion.button>
                    </Link>
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="md:hidden p-2"
                >
                    {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </nav>

            {/* Mobile Menu */}
            <motion.div
                initial={false}
                animate={{ height: isOpen ? 'auto' : 0 }}
                className="md:hidden overflow-hidden bg-slate-900/95 backdrop-blur-md"
            >
                <div className="px-6 py-4 space-y-4">
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            onClick={() => setIsOpen(false)}
                            className={`block py-2 text-sm font-medium ${isActive(link.path)
                                ? 'text-purple-400'
                                : 'text-gray-300'
                                }`}
                        >
                            {link.name}
                        </Link>
                    ))}
                    <Link to="/download" onClick={() => setIsOpen(false)}>
                        <button className="w-full px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full font-medium text-sm flex items-center justify-center space-x-2">
                            <DownloadIcon className="w-4 h-4" />
                            <span>Download App</span>
                        </button>
                    </Link>
                </div>
            </motion.div>
        </motion.header>
    )
}
