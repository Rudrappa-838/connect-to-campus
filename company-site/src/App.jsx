import { useState } from 'react'
import Hero3D from './components/Hero3D'
import Services from './components/Services'
import Features from './components/Features'
import About from './components/About'
import Testimonials from './components/Testimonials'
import Contact from './components/Contact'

function App() {
  return (
    <div className="min-h-screen bg-brand-dark text-white font-sans">
      <header className="fixed w-full p-6 flex justify-between items-center z-50 bg-opacity-50 backdrop-blur-md">
        <h1 className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          SoftNet
        </h1>
        <nav className="space-x-8 text-sm font-medium text-gray-300">
          <a href="#" className="hover:text-white transition">Home</a>
          <a href="#services" className="hover:text-white transition">Services</a>
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#about" className="hover:text-white transition">About</a>
          <a href="#testimonials" className="hover:text-white transition">Testimonials</a>
          <a href="#contact" className="hover:text-white transition">Contact</a>
        </nav>
      </header>

      <main className="pt-32 px-6 pb-20 flex flex-col items-center justify-center text-center">
        <div className="max-w-4xl space-y-4">
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight animated-gradient-text">
            Transforming Education Through Technology
          </h2>
          <p className="text-xl max-w-2xl mx-auto animated-gradient-text">
            SoftNet delivers comprehensive institute management software to streamline operations and enhance learning experiences.
          </p>
        </div>
      </main>

      {/* Services Section */}
      <Services />

      {/* Features Section */}
      <Features />

      {/* About Section */}
      <About />

      {/* Testimonials Section */}
      <Testimonials />

      {/* Contact Section */}
      <Contact />

      {/* 3D Placeholder - Temporarily disabled to fix blinking */}
      {/* <Hero3D /> */}
    </div>
  )
}

export default App
