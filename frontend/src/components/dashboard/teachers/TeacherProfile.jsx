import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, MapPin, Camera, Save, Edit2, X, GraduationCap, BookOpen, Fingerprint } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const TeacherProfile = ({ profile, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        gender: '',
        address: '',
        profile_image: ''
    });

    useEffect(() => {
        if (profile) {
            setFormData({
                name: profile.name || '',
                phone: profile.phone || '',
                gender: profile.gender || '',
                address: profile.address || '',
                profile_image: profile.profile_image || ''
            });
        }
    }, [profile]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                toast.error("Image size should be less than 2MB");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, profile_image: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.put('/teachers/profile', formData);
            toast.success("Profile updated successfully!");
            setIsEditing(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error("Update failed", error);
            toast.error(error.response?.data?.message || "Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            {/* Header Card */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    {/* Profile Image Section */}
                    <div className="relative group">
                        <div className="w-40 h-40 rounded-3xl bg-slate-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl ring-1 ring-slate-200">
                            {formData.profile_image ? (
                                <img src={formData.profile_image} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <User size={64} className="text-slate-300" />
                            )}
                        </div>
                        {isEditing && (
                            <label className="absolute bottom-2 right-2 p-2.5 bg-blue-600 text-white rounded-xl shadow-lg cursor-pointer hover:bg-blue-700 transition-all hover:scale-110">
                                <Camera size={20} />
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                            </label>
                        )}
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                                    {isEditing ? (
                                        <input
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className="bg-slate-50 border-none focus:ring-2 ring-blue-500 rounded-lg px-2 -ml-2 w-full"
                                            placeholder="Your Name"
                                        />
                                    ) : (
                                        profile?.name || 'Teacher'
                                    )}
                                </h1>
                                <p className="text-blue-600 font-bold uppercase tracking-widest text-xs mt-1">
                                    {profile?.subject_specialization || 'Academic Member'}
                                </p>
                            </div>
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                >
                                    <Edit2 size={18} /> Edit Profile
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                                    >
                                        <Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex flex-wrap gap-4 justify-center md:justify-start">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-sm font-medium border border-slate-100">
                                <Fingerprint size={16} className="text-slate-400" />
                                <span>ID: {profile?.employee_id || '--'}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-100">
                                <GraduationCap size={16} />
                                <span>{profile?.class_name || 'No Class'} {profile?.section_name || ''}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Tabs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Information */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4">
                        Contact Information
                    </h3>

                    <div className="space-y-4">
                        <div className="group">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Email Address</label>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 group-hover:border-blue-200 transition-colors">
                                <Mail size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                                <span className="text-slate-700 font-medium">{profile?.email || '--'}</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1 ml-1">* Email can only be changed by Admin</p>
                        </div>

                        <div className="group">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Phone Number</label>
                            <div className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${isEditing ? 'bg-white border-blue-500 ring-4 ring-blue-50' : 'bg-slate-50 border-slate-100 group-hover:border-blue-200'}`}>
                                <Phone size={18} className={`transition-colors ${isEditing ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-500'}`} />
                                {isEditing ? (
                                    <input
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-slate-700 font-medium"
                                        placeholder="Phone Number"
                                    />
                                ) : (
                                    <span className="text-slate-700 font-medium">{profile?.phone || '--'}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Personal Information */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4">
                        Personal Details
                    </h3>

                    <div className="space-y-4">
                        <div className="group">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Gender</label>
                            {isEditing ? (
                                <div className="flex gap-2">
                                    {['Male', 'Female', 'Other'].map(g => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, gender: g }))}
                                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${formData.gender === g
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 group-hover:border-blue-200 transition-colors">
                                    <div className="w-4 h-4 rounded-full bg-blue-100 border-2 border-white"></div>
                                    <span className="text-slate-700 font-medium">{profile?.gender || '--'}</span>
                                </div>
                            )}
                        </div>

                        <div className="group">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Address</label>
                            <div className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${isEditing ? 'bg-white border-blue-500 ring-4 ring-blue-50' : 'bg-slate-50 border-slate-100 group-hover:border-blue-200'}`}>
                                <MapPin size={18} className={`mt-0.5 transition-colors ${isEditing ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-500'}`} />
                                {isEditing ? (
                                    <textarea
                                        name="address"
                                        rows={3}
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-slate-700 font-medium resize-none"
                                        placeholder="Your full address..."
                                    />
                                ) : (
                                    <span className="text-slate-700 font-medium leading-relaxed">{profile?.address || '--'}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Academic Specialization */}
                <div className="col-span-full bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/20 rounded-full -mr-40 -mt-40 blur-3xl group-hover:bg-blue-500/30 transition-all"></div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="space-y-4 text-center md:text-left">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 mx-auto md:mx-0">
                                <BookOpen size={24} className="text-blue-300" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black italic tracking-tight">Academic Specialization</h3>
                                <p className="text-blue-200/80 font-medium">Subjects and focus areas assigned by administration</p>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                            <span className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl text-xl font-black tracking-widest border border-white/10 shadow-xl group-hover:scale-105 transition-transform">
                                {profile?.subject_specialization || 'General Education'}
                            </span>
                            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.2em]">Current Department</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeacherProfile;
