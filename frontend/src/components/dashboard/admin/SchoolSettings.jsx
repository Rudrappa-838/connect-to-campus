import React, { useState, useEffect } from 'react';
import { Save, Building, Upload, Image as ImageIcon, Trash2, Calendar, Layers, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import ClassManagement from './ClassManagement';
import AcademicYearSettings from '../settings/AcademicYearSettings';

import { useAuth } from '../../../context/AuthContext';
import { useInstitution } from '../../../context/InstitutionContext';

// Fix for default Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapController = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center && center[0] && center[1]) {
            map.setView(center, zoom || 15);
            map.invalidateSize();
        }
    }, [center, zoom, map]);
    return null;
};

const MapClickHandler = ({ onMapClick }) => {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
};

const SchoolSettings = () => {
    const { user } = useAuth();
    const { getLabel } = useInstitution();
    const [activeTab, setActiveTab] = useState('branding'); // 'branding', 'academic-year', 'classes'
    const [logoUrl, setLogoUrl] = useState('');
    const [logoFile, setLogoFile] = useState(null);
    const [signatureUrl, setSignatureUrl] = useState('');
    const [signatureFile, setSignatureFile] = useState(null);
    const [uploadingSignature, setUploadingSignature] = useState(false);
    const [geminiKey, setGeminiKey] = useState('');
    const [smsProvider, setSmsProvider] = useState('');
    const [smsApiKey, setSmsApiKey] = useState('');
    const [smsSenderId, setSmsSenderId] = useState('');
    const [marksheetTemplate, setMarksheetTemplate] = useState('STANDARD');
    const [wordTemplates, setWordTemplates] = useState([]);
    const [wordName, setWordName] = useState('');
    const [wordFile, setWordFile] = useState(null);
    const [uploadingWord, setUploadingWord] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [editName, setEditName] = useState('');
    const [editFile, setEditFile] = useState(null);
    const [updatingWord, setUpdatingWord] = useState(false);
    const [loading, setLoading] = useState(false);

    // GPS Settings States
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [attendanceRadius, setAttendanceRadius] = useState(200);
    const [detectingLocation, setDetectingLocation] = useState(false);

    useEffect(() => {
        loadSchoolInfo();
    }, []);

    const loadSchoolInfo = async () => {
        try {
            setLoading(true);
            const response = await api.get('/schools/my-school');
            if (response.data) {
                // Assuming response.data contains school info directly or wrapped
                const school = response.data.data || response.data; // Handle potential wrapping
                setLogoUrl(school.logo || '');
                setSignatureUrl(school.principal_signature || '');
                setGeminiKey(school.gemini_api_key || '');
                setSmsProvider(school.sms_provider || '');
                setSmsApiKey(school.sms_api_key || '');
                setSmsSenderId(school.sms_sender_id || '');
                setMarksheetTemplate(school.marksheet_template || 'STANDARD');
                setLatitude(school.latitude || '');
                setLongitude(school.longitude || '');
                setAttendanceRadius(school.attendance_radius || 200);
            }

            const templatesRes = await api.get('/schools/my-school/word-templates').catch(() => null);
            if (templatesRes && templatesRes.data) {
                setWordTemplates(templatesRes.data);
            }
        } catch (error) {
            console.error('Error loading school info:', error);
            // toast.error('Failed to load school settings'); 
            // Suppress error if 404/empty to avoid annoying user on first load? 
            // But 'my-school' should exist if logged in.
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('File size must be less than 5MB');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoUrl(reader.result);
            };
            reader.readAsDataURL(file);
            setLogoFile(file);
        }
    };

    const handleRemoveLogo = () => {
        setLogoUrl('');
        setLogoFile(null);
    };

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }
        setDetectingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLatitude(position.coords.latitude.toFixed(6));
                setLongitude(position.coords.longitude.toFixed(6));
                setDetectingLocation(false);
                toast.success('Current coordinates detected successfully!');
            },
            (error) => {
                console.error('Error detecting location:', error);
                setDetectingLocation(false);
                toast.error(error.message || 'Failed to detect location. Please grant permission.');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleWordUpload = async () => {
        if (!wordFile || !wordName) return toast.error('Template name and file are required');
        try {
            setUploadingWord(true);
            const formData = new FormData();
            formData.append('template', wordFile);
            formData.append('name', wordName);
            await api.post('/schools/my-school/word-templates', formData);
            toast.success('Word template uploaded successfully');
            setWordFile(null);
            setWordName('');
            loadSchoolInfo();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Upload failed');
        } finally {
            setUploadingWord(false);
        }
    };

    const handleDeleteWord = async (id) => {
        if (!window.confirm('Are you sure you want to delete this custom template?')) return;
        try {
            await api.delete(`/schools/my-school/word-templates/${id}`);
            toast.success('Template deleted');
            loadSchoolInfo();
        } catch (error) {
            toast.error('Failed to delete template');
        }
    };

    const handleEditStart = (template) => {
        setEditingTemplate(template);
        setEditName(template.name);
        setEditFile(null);
    };

    const handleUpdateWord = async () => {
        if (!editName) return toast.error('Template name is required');
        try {
            setUpdatingWord(true);
            const formData = new FormData();
            formData.append('name', editName);
            if (editFile) formData.append('template', editFile);

            await api.put(`/schools/my-school/word-templates/${editingTemplate.id}`, formData);
            toast.success('Template updated successfully');
            setEditingTemplate(null);
            loadSchoolInfo();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Update failed');
        } finally {
            setUpdatingWord(false);
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);

            const updateData = {
                geminiApiKey: geminiKey,
                smsProvider: smsProvider,
                smsApiKey: smsApiKey,
                smsSenderId: smsSenderId,
                marksheet_template: marksheetTemplate,
                latitude: latitude === '' ? null : parseFloat(latitude),
                longitude: longitude === '' ? null : parseFloat(longitude),
                attendanceRadius: attendanceRadius ? parseInt(attendanceRadius) : 200
            };

            // 1. Update Basic Settings (API Key)
            if (user?.schoolId) {
                await api.put('/schools/my-school/settings', updateData);
            }

            // 2. Upload Logo if changed
            if (logoUrl && logoUrl.startsWith('data:image')) {
                await api.put('/schools/my-school/logo', { logo: logoUrl });
            }

            // 3. Upload Principal Signature if changed
            if (signatureUrl && signatureUrl.startsWith('data:image')) {
                await api.put('/schools/my-school/principal-signature', { principal_signature: signatureUrl });
            }

            toast.success('Settings saved successfully');
            setLogoFile(null); // Reset file input
            loadSchoolInfo();

        } catch (error) {
            console.error('Error saving settings:', error);
            // safe access error message
            const message = error.response?.data?.message || error.message || 'Failed to save settings';

            if (error.response?.data?.debug) {
                const debugInfo = JSON.stringify(error.response.data.debug);
                toast.error(`${message} | Debug: ${debugInfo}`, { duration: 10000 });
            } else {
                toast.error(message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('branding')}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'branding'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <Building size={20} />
                        {getLabel('school', 'School')} Branding
                    </button>
                    <button
                        onClick={() => setActiveTab('academic-year')}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'academic-year'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <Calendar size={20} />
                        Academic Year
                    </button>
                    <button
                        onClick={() => setActiveTab('gps-attendance')}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'gps-attendance'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <MapPin size={20} />
                        GPS Attendance
                    </button>
                    {user?.role === 'SUPER_ADMIN' && (
                        <button
                            onClick={() => setActiveTab('classes')}
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'classes'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <Layers size={20} />
                            Classes & Sections
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'branding' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
                        <Building className="text-indigo-600" /> {getLabel('school', 'School')} Branding
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3">{getLabel('school', 'School')} Logo</label>

                            <div className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                                {logoUrl ? (
                                    <div className="relative group">
                                        <img
                                            src={logoUrl}
                                            alt="Logo Preview"
                                            className="h-32 object-contain"
                                        />
                                        <button
                                            onClick={handleRemoveLogo}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-colors"
                                            title="Remove Logo"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="bg-indigo-100 p-3 rounded-full inline-block mb-3">
                                            <ImageIcon className="text-indigo-600" size={32} />
                                        </div>
                                        <p className="text-sm font-medium text-slate-900">Click to upload logo</p>
                                        <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 5MB</p>
                                    </div>
                                )}

                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    title={logoUrl ? "Click to change logo" : "Click to upload logo"}
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-2 text-center">
                                This logo will appear in the Sidebar and Mobile App Header.
                            </p>
                        </div>

                        {/* Principal Signature Upload */}
                        <div className="pt-6 border-t border-slate-100">
                            <label className="block text-sm font-bold text-slate-700 mb-3">Principal Signature</label>
                            <div className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                                {signatureUrl ? (
                                    <div className="relative group">
                                        <img
                                            src={signatureUrl}
                                            alt="Principal Signature Preview"
                                            className="h-24 object-contain bg-white rounded border border-slate-200 p-2"
                                        />
                                        <button
                                            onClick={() => { setSignatureUrl(''); setSignatureFile(null); }}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-colors"
                                            title="Remove Signature"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="bg-violet-100 p-3 rounded-full inline-block mb-3">
                                            <Upload className="text-violet-600" size={32} />
                                        </div>
                                        <p className="text-sm font-medium text-slate-900">Click to upload Principal Signature</p>
                                        <p className="text-xs text-slate-500 mt-1">PNG with transparent background recommended, max 5MB</p>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            if (file.size > 5 * 1024 * 1024) { toast.error('File size must be less than 5MB'); return; }
                                            const reader = new FileReader();
                                            reader.onloadend = () => setSignatureUrl(reader.result);
                                            reader.readAsDataURL(file);
                                            setSignatureFile(file);
                                        }
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-2 text-center">
                                This signature will appear on all student marks cards / progress reports.
                            </p>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-2xl">🤖</span> AI Configuration
                            </h3>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Google Gemini API Key</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        placeholder="AIzaSy..."
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Required for Question Paper Generator. Get your free key from <a href="https://aistudio.google.com" target="_blank" className="text-indigo-600 underline">Google AI Studio</a>.
                                    <br />
                                    <span className="text-amber-600 font-medium">Leave empty to use System Default (if available).</span>
                                </p>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-2xl">📱</span> SMS Configuration
                            </h3>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <p className="text-sm text-slate-600 mb-4">
                                    Configure your own SMS gateway for attendance notifications and alerts.
                                </p>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">SMS Provider</label>
                                        <select
                                            value={smsProvider}
                                            onChange={(e) => setSmsProvider(e.target.value)}
                                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                                        >
                                            <option value="">-- Use System Default (if available) --</option>
                                            <option value="MSG91">MSG91</option>
                                            <option value="FAST2SMS">Fast2SMS (Fast SMS without GST)</option>
                                            <option value="TEXTLOCAL">TextLocal</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">API / Auth Key</label>
                                        <input
                                            type="password"
                                            placeholder="Your SMS Provider API Key"
                                            value={smsApiKey}
                                            onChange={(e) => setSmsApiKey(e.target.value)}
                                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Sender ID</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. SCHOOL (6 characters for India)"
                                            value={smsSenderId}
                                            onChange={(e) => setSmsSenderId(e.target.value)}
                                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-2xl">📄</span> Custom MS Word Templates
                            </h3>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <p className="text-sm text-slate-600 mb-4 italic">
                                    Manage your custom Microsoft Word templates here. You can select these templates dynamically when viewing student results.
                                </p>

                                {wordTemplates.length < 3 && (
                                    <div className="mt-6 pt-4 border-t border-slate-200">
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Upload Custom MS Word Template</label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="text"
                                                placeholder="Template Name (e.g. Midterm Format)"
                                                value={wordName}
                                                onChange={e => setWordName(e.target.value)}
                                                className="flex-1 p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <input
                                                type="file"
                                                accept=".docx"
                                                onChange={e => setWordFile(e.target.files[0])}
                                                className="flex-1 p-2 text-sm border border-slate-300 rounded bg-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 text-slate-500 cursor-pointer"
                                            />
                                            <button
                                                onClick={handleWordUpload}
                                                disabled={uploadingWord}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-bold shadow-sm transition-all disabled:opacity-50"
                                            >
                                                {uploadingWord ? '...' : 'Upload'}
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">Requires .docx files with docxtemplater tags (e.g. &#123;&#123;student_name&#125;&#125;).</p>
                                    </div>
                                )}

                                {wordTemplates.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                        <p className="text-sm font-bold text-slate-700 mb-2">My Custom Templates ({wordTemplates.length}/3):</p>
                                        <ul className="space-y-2">
                                            {wordTemplates.map(t => (
                                                <li key={t.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
                                                    <span className="text-sm font-medium text-slate-800 flex items-center gap-2">
                                                        <span className="text-blue-600">📄</span> {t.name}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={() => handleEditStart(t)} 
                                                            className="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded text-xs font-bold transition-colors"
                                                            title="Edit Template"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteWord(t.id)} 
                                                            className="text-slate-400 hover:text-red-600 transition-colors p-1" 
                                                            title="Delete Template"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Template Guide Section */}
                                <div className="mt-8 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                    <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2 mb-3">
                                        <span className="text-lg">💡</span> Word Template Guide
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-blue-700">
                                        <div>
                                            <p className="font-bold mb-1">Standard Tags:</p>
                                            <ul className="list-disc list-inside space-y-0.5">
                                                <li><code>{'{student_name}'}</code>, <code>{'{admission_no}'}</code></li>
                                                <li><code>{'{total_obtained}'}</code>, <code>{'{percentage}'}</code></li>
                                                <li><code>{'{total_obtained_words}'}</code></li>
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="font-bold text-red-600 mb-1">Dynamic Subject Table (Recommended):</p>
                                            <p className="inline-block text-slate-600 leading-tight mb-2">
                                                Do <strong>not</strong> type subject names (like "Science:") directly, or they will always print! Instead, create a 1-row table in Word and use the <strong>all_subjects</strong> loop to automatically generate rows <em>only</em> for scheduled subjects.
                                            </p>
                                            <ul className="list-disc list-inside space-y-0.5 bg-blue-100/50 p-2 rounded">
                                                <li>Start the row with: <code>{'{#all_subjects}'}</code></li>
                                                <li>Inside the row, use: <code>{'{subject_name}'}</code></li>
                                                <li>Marks column: <code>{'{marks_obtained}'}</code></li>
                                                <li>End the row with: <code>{'{/all_subjects}'}</code></li>
                                            </ul>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-[9px] text-blue-500 italic">
                                        Note: Only subjects where marks have been entered will show up on the generated card.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Edit Template Modal */}
                        {editingTemplate && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">Edit Custom Template</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Display Name</label>
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Replace File (Optional)</label>
                                            <input
                                                type="file"
                                                accept=".docx"
                                                onChange={(e) => setEditFile(e.target.files[0])}
                                                className="w-full p-3 border border-slate-300 rounded-xl bg-slate-50 text-xs"
                                            />
                                        </div>
                                        <div className="flex gap-3 pt-4">
                                            <button
                                                onClick={() => setEditingTemplate(null)}
                                                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleUpdateWord}
                                                disabled={updatingWord}
                                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2"
                                            >
                                                {updatingWord ? 'Updating...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm hover:shadow active:scale-95"
                            >
                                <Save size={18} /> {loading ? 'Saving Changes...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Academic Year Tab */}
            {activeTab === 'academic-year' && (
                <AcademicYearSettings />
            )}

            {/* GPS Attendance Tab */}
            {activeTab === 'gps-attendance' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto animate-in fade-in">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
                        <MapPin className="text-indigo-600 animate-bounce" /> GPS Attendance & Geofencing Settings
                    </h2>

                    <div className="space-y-6">
                        <p className="text-sm text-slate-600 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            Configure the geographical coordinates of the school and the check-in radius boundary.
                            Teachers must be within this designated radius to check in or out from the dashboard.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Latitude</label>
                                <input
                                    type="number"
                                    step="0.000001"
                                    placeholder="e.g. 12.971598"
                                    value={latitude}
                                    onChange={(e) => setLatitude(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Longitude</label>
                                <input
                                    type="number"
                                    step="0.000001"
                                    placeholder="e.g. 77.594562"
                                    value={longitude}
                                    onChange={(e) => setLongitude(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                                />
                            </div>
                        </div>

                        <div className="flex justify-start">
                            <button
                                type="button"
                                onClick={handleDetectLocation}
                                disabled={detectingLocation}
                                className="px-4 py-2 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold rounded-lg transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                            >
                                <MapPin size={16} />
                                {detectingLocation ? 'Detecting Location...' : 'Use My Current Location'}
                            </button>
                        </div>

                        {/* Leaflet Map Geofence Boundary Display/Selection */}
                        <div className="pt-6 border-t border-slate-100">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Campus Location Geofence</label>
                            <p className="text-xs text-slate-500 mb-3">
                                Click on the map to pin the school coordinates. The circle visualizes the active allowed attendance radius.
                            </p>
                            <div className="h-80 w-full rounded-xl border border-slate-300 overflow-hidden shadow-inner relative z-10">
                                <MapContainer
                                    center={latitude && longitude ? [parseFloat(latitude), parseFloat(longitude)] : [12.971598, 77.594562]}
                                    zoom={15}
                                    style={{ height: '100%', width: '100%' }}
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    {latitude && longitude && (
                                        <>
                                            <Marker position={[parseFloat(latitude), parseFloat(longitude)]} />
                                            <Circle
                                                center={[parseFloat(latitude), parseFloat(longitude)]}
                                                radius={attendanceRadius || 200}
                                                pathOptions={{ color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.2 }}
                                            />
                                            <MapController center={[parseFloat(latitude), parseFloat(longitude)]} zoom={15} />
                                        </>
                                    )}
                                    <MapClickHandler
                                        onMapClick={(lat, lng) => {
                                            setLatitude(lat.toFixed(6));
                                            setLongitude(lng.toFixed(6));
                                        }}
                                    />
                                </MapContainer>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Allowed Boundary Radius</label>
                            <select
                                value={attendanceRadius}
                                onChange={(e) => setAttendanceRadius(parseInt(e.target.value))}
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white cursor-pointer"
                            >
                                <option value={50}>50 meters (Very strict)</option>
                                <option value={100}>100 meters (Standard)</option>
                                <option value={200}>200 meters (Recommended)</option>
                                <option value={500}>500 meters (Broad campus)</option>
                                <option value={1000}>1000 meters (1 Kilometer)</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-2">
                                Set the distance buffer within which check-in is allowed. Recommending 100m to 200m depending on school grounds size.
                            </p>
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm hover:shadow active:scale-95"
                            >
                                <Save size={18} /> {loading ? 'Saving Changes...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Classes Tab */}
            {activeTab === 'classes' && user?.role === 'SUPER_ADMIN' && (
                <ClassManagement />
            )}
        </div>
    );
};

export default SchoolSettings;
