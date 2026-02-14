import React, { useState } from 'react';
import axios from '../api/axios';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, KeyRound, Mail, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import loginBg from '../assets/login-bg.jpg';

const ForgotPassword = () => {
    const [step, setStep] = useState(1); // 1: Enter ID, 2: Enter OTP, 3: Set Password
    const [userId, setUserId] = useState('');
    const [role, setRole] = useState('STUDENT');
    const [userName, setUserName] = useState('');
    const [fetchingName, setFetchingName] = useState(false);
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [inlineError, setInlineError] = useState('');

    const handleUserIdChange = async (value) => {
        setUserId(value);
        setInlineError('');

        // Fetch user details if ID is at least 3 characters
        if (value.trim().length >= 3) {
            setFetchingName(true);
            try {
                const response = await axios.post('/auth/get-user-details', {
                    email: value.trim(),
                    role
                });
                if (response.data.success) {
                    setUserName(response.data.name);
                    setInlineError('');
                }
            } catch (error) {
                // If 404, we can optionally clear name or keep it if it was previously valid? 
                // Usually clear it if the new ID is invalid.
                setUserName('');
            } finally {
                setFetchingName(false);
            }
        } else {
            setUserName('');
        }
    };

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setInlineError('');

        try {
            const response = await axios.post('/auth/forgot-password', {
                email: userId,
                role
            });
            toast.success(response.data.message);
            setStep(2);
        } catch (error) {
            const msg = error.response?.data?.message || 'Failed to send OTP';
            if (msg.includes('User not found') || error.response?.status === 404) {
                setInlineError('User not found. Please check the ID and the selected Role.');
            } else {
                toast.error(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await axios.post('/auth/verify-otp', {
                otp,
                role,
                email: userId
            });

            if (response.data.verified) {
                setOtpVerified(true);
                toast.success('OTP verified successfully!');
                setTimeout(() => setStep(3), 500);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post('/auth/reset-password', {
                otp,
                newPassword,
                role,
                email: userId
            });
            toast.success(response.data.message);

            // Reset form and redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
            {/* Animated Background Image */}
            <div className="absolute inset-0 w-full h-full z-0">
                <img
                    src={loginBg}
                    alt="Classroom Background"
                    className="w-full h-full object-cover animate-ken-burns"
                />
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"></div>
            </div>

            {/* Floating Modern Shapes */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#00C9FC]/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

            {/* Content Card - Glassmorphism */}
            <div className="relative z-10 w-full max-w-md p-4 mx-4">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 transform transition-all hover:scale-[1.01] animate-fade-in-up">

                    <div className="text-center mb-8 space-y-2">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 border border-white/20 mb-2 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                            <KeyRound size={28} className="text-yellow-400" />
                        </div>
                        <h2 className="text-3xl font-cursive text-white drop-shadow-md">Reset Password</h2>
                        <p className="text-gray-300 text-xs tracking-wide uppercase font-medium">
                            {step === 1 && 'Enter your ID to receive OTP'}
                            {step === 2 && 'Verify OTP sent to your email'}
                            {step === 3 && 'Set your new password'}
                        </p>
                    </div>

                    {/* Step Indicator */}
                    <div className="flex justify-center items-center gap-2 mb-6">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-yellow-400 text-black' : 'bg-white/10 text-gray-400'}`}>
                            {step > 1 ? '✓' : '1'}
                        </div>
                        <div className={`h-1 w-12 ${step >= 2 ? 'bg-yellow-400' : 'bg-white/10'}`}></div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-yellow-400 text-black' : 'bg-white/10 text-gray-400'}`}>
                            {step > 2 ? '✓' : '2'}
                        </div>
                        <div className={`h-1 w-12 ${step >= 3 ? 'bg-yellow-400' : 'bg-white/10'}`}></div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= 3 ? 'bg-yellow-400 text-black' : 'bg-white/10 text-gray-400'}`}>
                            3
                        </div>
                    </div>

                    {/* Step 1: Enter ID and Role */}
                    {step === 1 && (
                        <form onSubmit={handleSendOTP} className="space-y-6 animate-fade-in-up">
                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Select Your Role</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 transition-all font-sans text-sm appearance-none cursor-pointer hover:bg-white/10"
                                    style={{ colorScheme: 'dark' }}
                                >
                                    <option value="STUDENT" className="bg-slate-900 text-white">Student</option>
                                    <option value="TEACHER" className="bg-slate-900 text-white">Teacher</option>
                                    <option value="STAFF" className="bg-slate-900 text-white">Staff</option>
                                    <option value="SCHOOL_ADMIN" className="bg-slate-900 text-white">School Admin</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Your ID</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        id="forgot-password-userid"
                                        name="userId"
                                        value={userId}
                                        onChange={(e) => handleUserIdChange(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 transition-all font-sans text-sm"
                                        placeholder="Enter your Admission/Employee ID"
                                        required
                                    />
                                </div>
                                {fetchingName && (
                                    <p className="text-xs text-gray-400 ml-1 mt-1 flex items-center gap-1">
                                        <Loader2 size={12} className="animate-spin" />
                                        Fetching details...
                                    </p>
                                )}
                                {userName && !fetchingName && (
                                    <p className="text-sm text-green-400 ml-1 mt-2 flex items-center gap-1 animate-fade-in-up">
                                        <CheckCircle2 size={16} />
                                        <span className="font-medium">{userName}</span>
                                    </p>
                                )}
                                {inlineError && (
                                    <p className="text-sm text-red-400 ml-1 mt-2 animate-fade-in-up bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                        {inlineError}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-black font-bold rounded-xl shadow-lg shadow-yellow-400/20 transform transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-sm ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Send OTP'}
                            </button>

                            <div className="text-center mt-6">
                                <Link to="/login" state={{ skipWelcome: true }} className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors">
                                    <ArrowLeft size={14} />
                                    Back to Login
                                </Link>
                            </div>
                        </form>
                    )}

                    {/* Step 2: Enter OTP */}
                    {step === 2 && (
                        <form onSubmit={handleVerifyOTP} className="space-y-6 animate-fade-in-up">
                            <div className="bg-blue-500/20 border border-blue-500/50 rounded-2xl p-4 mb-4">
                                <p className="text-blue-200 text-sm text-center">
                                    OTP sent to your registered email
                                </p>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Enter 6-Digit OTP</label>
                                <div className="relative">
                                    {otpVerified && (
                                        <CheckCircle2 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-green-400" size={20} />
                                    )}
                                    <input
                                        type="text"
                                        id="forgot-password-otp"
                                        name="otp"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 transition-all font-mono text-2xl text-center tracking-[0.5em]"
                                        placeholder="000000"
                                        maxLength="6"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || otp.length !== 6}
                                className={`w-full py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-black font-bold rounded-xl shadow-lg shadow-yellow-400/20 transform transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-sm ${(loading || otp.length !== 6) ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Verify OTP'}
                            </button>

                            <div className="text-center mt-4">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="text-xs font-bold text-gray-400 hover:text-white transition-colors"
                                >
                                    Resend OTP
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Step 3: Set New Password */}
                    {step === 3 && (
                        <form onSubmit={handleResetPassword} className="space-y-6 animate-fade-in-up">
                            <div className="bg-green-500/20 border border-green-500/50 rounded-2xl p-4 mb-4 flex items-center gap-2">
                                <CheckCircle2 className="text-green-400" size={20} />
                                <p className="text-green-200 text-sm">
                                    OTP Verified Successfully
                                </p>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="forgot-password-new"
                                        name="newPassword"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 transition-all font-sans text-sm pr-12"
                                        placeholder="Enter new password"
                                        required
                                        minLength="6"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        id="forgot-password-confirm"
                                        name="confirmPassword"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 transition-all font-sans text-sm pr-12"
                                        placeholder="Re-enter new password"
                                        required
                                        minLength="6"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {newPassword && confirmPassword && newPassword !== confirmPassword && (
                                <p className="text-red-400 text-xs">Passwords do not match</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                                className={`w-full py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-black font-bold rounded-xl shadow-lg shadow-yellow-400/20 transform transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-sm ${(loading || !newPassword || !confirmPassword || newPassword !== confirmPassword) ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Reset Password'}
                            </button>
                        </form>
                    )}

                    <div className="text-center mt-8">
                        <p className="text-white/30 text-[10px] font-cursive tracking-widest">Connect to Campus</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
