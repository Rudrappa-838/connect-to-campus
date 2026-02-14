import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShieldCheck, Lock, Mail } from 'lucide-react';

const SuperAdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await login(email, password, 'SUPER_ADMIN');
        if (result.success) {
            toast.success('Welcome, Super Admin!');
            navigate('/super-admin');
        } else {
            toast.error(result.message || 'Invalid credentials');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">

            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 -translate-x-1/2 -translate-y-1/2 animate-blob"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 translate-x-1/2 -translate-y-1/2 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-32 left-20 w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>

            <div className="bg-slate-800/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md border border-red-500/30 relative z-10">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="bg-gradient-to-br from-red-600 to-orange-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-500/50 transform rotate-3 hover:rotate-6 transition-transform">
                        <ShieldCheck className="text-white w-10 h-10" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Super Admin Portal</h1>
                    <p className="text-red-400 mt-2 text-sm font-bold uppercase tracking-wider">Restricted Access Only</p>
                    <div className="w-16 h-1 bg-gradient-to-r from-red-500 to-orange-500 mx-auto mt-3 rounded-full"></div>
                </div>

                {/* Warning Banner */}
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-6 flex items-start gap-3">
                    <Lock className="text-red-400 w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-red-300 text-xs font-bold">Authorized Personnel Only</p>
                        <p className="text-red-400/70 text-[10px] mt-1">Unauthorized access attempts are logged and monitored.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Email Input */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 mb-2 ml-1 flex items-center gap-2">
                            <Mail size={14} className="text-red-400" />
                            Super Admin Email
                        </label>
                        <input
                            type="email"
                            required
                            id="super-admin-email"
                            name="email"
                            autoComplete="username"
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all font-semibold text-sm text-white placeholder:text-slate-500"
                            placeholder="admin@system.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 mb-2 ml-1 flex items-center gap-2">
                            <Lock size={14} className="text-red-400" />
                            Password
                        </label>
                        <input
                            type="password"
                            required
                            id="super-admin-password"
                            name="password"
                            autoComplete="current-password"
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all font-semibold text-sm text-white placeholder:text-slate-500"
                            placeholder="Enter Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-black py-3.5 rounded-xl transition-all transform active:scale-[0.98] shadow-lg shadow-red-500/40 flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                    >
                        <ShieldCheck size={18} />
                        Secure Access
                    </button>

                    {/* Back to Regular Login */}
                    <div className="pt-4 border-t border-slate-700">
                        <Link
                            to="/login"
                            className="text-center text-xs text-slate-400 hover:text-red-400 transition-colors block font-medium"
                        >
                            ← Back to Regular Login
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SuperAdminLogin;
