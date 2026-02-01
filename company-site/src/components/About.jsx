export default function About() {
    return (
        <section id="about" className="min-h-screen py-20 px-6">
            <div className="max-w-7xl mx-auto">
                {/* About Company */}
                <div className="text-center mb-20">
                    <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        About Us 👋
                    </h2>
                    <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-4">
                        We're a passionate team of developers 💻 building modern solutions for educational institutions.
                        Our mission is to simplify institute management and make education more accessible through technology. 🚀
                    </p>
                    <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                        Started as a college project, SoftNet has evolved into a comprehensive institute management platform
                        designed to help colleges and schools focus on what matters most - education. 📚
                    </p>
                </div>

                {/* Team Section */}
                <div className="mb-16">
                    <h3 className="text-4xl font-bold text-center mb-12 text-white">
                        Meet Our Team 🤝
                    </h3>

                    <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
                        {/* Team Member 1 */}
                        <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50">
                            <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-6xl">
                                👨‍💻
                            </div>
                            <h4 className="text-2xl font-bold text-white mb-2">Your Name</h4>
                            <p className="text-blue-400 mb-4">Co-Founder & Lead Developer</p>
                            <p className="text-gray-400 leading-relaxed">
                                Full-stack developer passionate about creating efficient solutions for real-world problems.
                                Specializes in backend architecture and database design. ⚡
                            </p>
                        </div>

                        {/* Team Member 2 */}
                        <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50">
                            <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-6xl">
                                👨‍💼
                            </div>
                            <h4 className="text-2xl font-bold text-white mb-2">Friend's Name</h4>
                            <p className="text-purple-400 mb-4">Co-Founder & Frontend Developer</p>
                            <p className="text-gray-400 leading-relaxed">
                                UI/UX enthusiast focused on creating beautiful and intuitive user experiences.
                                Loves building responsive interfaces that users enjoy. 🎨
                            </p>
                        </div>
                    </div>
                </div>

                {/* Mission & Vision */}
                <div className="grid md:grid-cols-2 gap-8 mt-20">
                    <div className="p-8 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                        <div className="text-4xl mb-4">🎯</div>
                        <h3 className="text-2xl font-bold text-white mb-4">Our Mission</h3>
                        <p className="text-gray-300 leading-relaxed">
                            To empower educational institutions with cutting-edge technology that simplifies administration,
                            enhances communication, and improves the overall learning experience for students and teachers.
                        </p>
                    </div>

                    <div className="p-8 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                        <div className="text-4xl mb-4">🌟</div>
                        <h3 className="text-2xl font-bold text-white mb-4">Our Vision</h3>
                        <p className="text-gray-300 leading-relaxed">
                            To become the leading institute management platform in India, helping thousands of colleges and schools
                            digitize their operations and focus on delivering quality education to every student.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
