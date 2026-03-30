import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, CheckCircle, XCircle, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ChangePassword = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, login } = useAuth();
    const role = location.state?.role;

    // Pre-fill from navigation state
    const [email, setEmail] = useState(location.state?.email || '');
    const [oldPassword, setOldPassword] = useState(location.state?.oldPassword || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Visibility
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [isOldVerified, setIsOldVerified] = useState(false);

    // Validation State
    const [validations, setValidations] = useState({
        length: false,
        digits: false,
        special: false,
        noSpaces: true
    });

    // Check Old Password Validity (Simulation or Check against state if consistent)
    useEffect(() => {
        // If we have the old password from state, we can verify against it strictly
        const originOld = location.state?.oldPassword;
        if (originOld) {
            setIsOldVerified(oldPassword === originOld);
        } else {
            // If no origin state (direct access), just check if it has content length > 0
            // Real verification happens on backend submit
            setIsOldVerified(oldPassword.length > 0);
        }
    }, [oldPassword, location.state]);

    // Check New Password Requirements
    useEffect(() => {
        const v = {
            length: newPassword.length >= 4,
            digits: (newPassword.match(/\d/g) || []).length >= 3,
            special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
            noSpaces: !/\s/.test(newPassword) && newPassword.length > 0
        };
        setValidations(v);
    }, [newPassword]);

    const isFormValid = isOldVerified &&
        Object.values(validations).every(Boolean) &&
        newPassword === confirmPassword &&
        confirmPassword.length > 0;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!isFormValid) return;

        const cleanEmail = email.trim();

        if (newPassword === '123456' || newPassword === oldPassword) {
            return toast.error('Please choose a different password than your current one.');
        }

        setLoading(true);
        try {
            await axios.post('/auth/change-password', {
                email: cleanEmail,
                role: role || undefined,
                oldPassword,
                newPassword
            });

            toast.success('Password set successfully! Please login again with your new password.');

            // Force logout and redirect to login page for manual login
            await logout();
            window.location.href = '/login';

        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    const ValidationItem = ({ label, passed }) => (
        <div className={`flex items-center gap-2 text-xs font-semibold transition-colors ${passed ? 'text-green-400' : 'text-gray-500'}`}>
            {passed ? <Check size={14} strokeWidth={3} /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-600" />}
            {label}
        </div>
    );

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

            <div className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 transform transition-all">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-400/20 mb-4">
                        <Lock size={32} className="text-yellow-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Security Update Required</h2>
                    <p className="text-gray-400 text-sm mt-2">
                        To secure your account, please verify your current credentials and set a strong new password.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* ID / Email */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">User ID / Email</label>
                        <input
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-400 transition-colors"
                            placeholder="Enter your ID or Email"
                            required
                        />
                    </div>

                    {/* Old Password */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase flex justify-between">
                            Current Password
                            {isOldVerified && <span className="text-green-400 flex items-center gap-1"><CheckCircle size={12} /> Verified</span>}
                        </label>
                        <div className="relative group">
                            <input
                                type={showOld ? "text" : "password"}
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                className={`w-full px-4 py-3 bg-black/20 border rounded-xl text-white focus:outline-none transition-colors pr-10
                                    ${isOldVerified ? 'border-green-500/50 focus:border-green-500' : 'border-white/10 focus:border-yellow-400'}
                                `}
                                placeholder="Enter default/current password"
                                required
                            />
                            <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-3 text-gray-400 hover:text-white">
                                {showOld ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Step 2: New Password Fields (Only visible if old is somewhat verified) */}
                    {isOldVerified && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-2">
                            <div className="border-t border-white/10"></div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showNew ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value.replace(/\s/g, ''))}
                                        className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-400 transition-colors pr-10"
                                        placeholder="Create new password"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-3 text-gray-400 hover:text-white">
                                        {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                {/* Real-time Validation Rules */}
                                <div className="grid grid-cols-2 gap-2 pt-2 pl-1">
                                    <ValidationItem label="Min 4 Characters" passed={validations.length} />
                                    <ValidationItem label="At least 3 Digits" passed={validations.digits} />
                                    <ValidationItem label="1 Special Char" passed={validations.special} />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirm ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value.replace(/\s/g, ''))}
                                        className={`w-full px-4 py-3 bg-black/20 border rounded-xl text-white focus:outline-none transition-colors pr-10
                                            ${confirmPassword && confirmPassword !== newPassword ? 'border-red-500 border-2' : 'border-white/10 focus:border-yellow-400'}
                                        `}
                                        placeholder="Retype password"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-3 text-gray-400 hover:text-white">
                                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {confirmPassword && confirmPassword !== newPassword && (
                                    <p className="text-red-400 text-[10px] font-bold mt-1 pl-1">Passwords do not match</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={!isFormValid || loading}
                                className={`w-full py-3 font-bold rounded-xl shadow-lg transform transition-all flex items-center justify-center gap-2 mt-4
                                    ${isFormValid && !loading
                                        ? 'bg-yellow-400 hover:bg-yellow-300 text-black hover:scale-[1.02] shadow-yellow-400/20'
                                        : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'}
                                `}
                            >
                                {loading ? 'Updating...' : 'Set New Password'}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default ChangePassword;
