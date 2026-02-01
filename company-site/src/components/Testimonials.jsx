import { Quote } from 'lucide-react'

const testimonials = [
    {
        name: 'Dr. Rajesh Kumar',
        role: 'Principal, Delhi Public School',
        content: 'SoftNet has transformed how we manage our school. The automation saves us countless hours every week.',
        rating: 5
    },
    {
        name: 'Priya Sharma',
        role: 'Administrator, Greenwood Academy',
        content: 'The mobile app is a game-changer. Parents love being able to track their child\'s progress in real-time.',
        rating: 5
    },
    {
        name: 'Amit Patel',
        role: 'IT Head, St. Xavier\'s School',
        content: 'Implementation was smooth and the support team was incredibly helpful throughout the process.',
        rating: 5
    }
]

export default function Testimonials() {
    return (
        <section id="testimonials" className="min-h-screen py-20 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Trusted by Educators
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        See what school administrators are saying about SoftNet
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {testimonials.map((testimonial, index) => (
                        <div
                            key={index}
                            className="p-8 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50"
                        >
                            <Quote className="w-10 h-10 text-blue-400 mb-4" />

                            <div className="flex mb-4">
                                {[...Array(testimonial.rating)].map((_, i) => (
                                    <span key={i} className="text-yellow-400 text-xl">★</span>
                                ))}
                            </div>

                            <p className="text-gray-300 mb-6 leading-relaxed">
                                "{testimonial.content}"
                            </p>

                            <div className="border-t border-slate-700 pt-4">
                                <div className="font-bold text-white">{testimonial.name}</div>
                                <div className="text-sm text-gray-400">{testimonial.role}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
