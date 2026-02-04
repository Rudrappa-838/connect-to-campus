import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Product from './pages/Product'
import About from './pages/About'
import Contact from './pages/Contact'
import Download from './pages/Download'
import Privacy from './pages/Privacy'
import Background3D from './components/Background3D'
import ScrollToTop from './components/ScrollToTop'

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-gray-900 text-white font-sans relative overflow-hidden">
        {/* 3D Animated Background */}
        <Background3D />

        {/* Navigation */}
        <Navbar />

        {/* Main Content */}
        <main className="relative z-10">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product" element={<Product />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/download" element={<Download />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </Router>
  )
}

export default App
