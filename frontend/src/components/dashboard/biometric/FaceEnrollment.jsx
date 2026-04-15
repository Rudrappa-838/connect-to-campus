import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, Search, User, Check, X, Shield, RefreshCw, AlertCircle, ScanLine } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const FaceEnrollment = ({ config, preferredFacingMode = 'user' }) => {
    const [loading, setLoading] = useState(true);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [step, setStep] = useState(0); // 0: search, 1: capture 1, 2: capture 2, 3: confirm
    
    const [descriptor1, setDescriptor1] = useState(null);
    const [descriptor2, setDescriptor2] = useState(null);
    const [capturedImage1, setCapturedImage1] = useState(null);
    const [capturedImage2, setCapturedImage2] = useState(null);
    
    const [cameraActive, setCameraActive] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [scanning, setScanning] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);

    // Initial Model Loading
    useEffect(() => {
        const loadModels = async () => {
            try {
                setLoading(true);
                // Models hosted on standard face-api location or public weights folder
                const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
                
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setModelsLoaded(true);
                console.log('Face-api models loaded');
            } catch (error) {
                console.error('Failed to load models', error);
                toast.error('Could not load AI models. Please check your internet connection.');
            } finally {
                setLoading(false);
            }
        };
        loadModels();
    }, []);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        try {
            const res = await api.get('/biometric/search', { params: { type: 'student', query: searchQuery } });
            setUsers(res.data);
        } catch (error) {
            toast.error('Search failed');
        }
    };

    const [stream, setStream] = useState(null);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: preferredFacingMode,
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                } 
            });
            setStream(mediaStream);
            setCameraActive(true);
        } catch (err) {
            console.error('Enrollment Camera Error:', err);
            toast.error('Could not access camera. Please check permissions.');
        }
    };

    // Sync stream with video element
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, cameraActive]);

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setCameraActive(false);
    };

    // Real-time Face Detection Loop
    useEffect(() => {
        let interval;
        if (cameraActive && modelsLoaded && (step === 1 || step === 2)) {
            interval = setInterval(async () => {
                if (!videoRef.current) return;
                
                const detections = await faceapi.detectSingleFace(videoRef.current)
                    .withFaceLandmarks()
                    .withFaceDescriptor();
                
                if (detections) {
                    setFaceDetected(true);
                    setScanning(true);
                } else {
                    setFaceDetected(false);
                    setScanning(false);
                }
            }, 500);
        }
        return () => clearInterval(interval);
    }, [cameraActive, modelsLoaded, step]);

    const captureSample = async () => {
        if (!faceDetected) {
            return toast.error('No face detected in frame. Please adjust position.');
        }

        toast.loading('Capturing biometric fingerprint...', { id: 'capture' });
        
        try {
            const detections = await faceapi.detectSingleFace(videoRef.current)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detections) {
                toast.error('Face lost, try again', { id: 'capture' });
                return;
            }

            // Draw to a canvas to show user what we captured
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg');

            if (step === 1) {
                setDescriptor1(Array.from(detections.descriptor));
                setCapturedImage1(dataUrl);
                setStep(2);
                toast.success('Step 1 successful! Please look at the camera again for verification.', { id: 'capture' });
            } else if (step === 2) {
                const currentDescriptor = Array.from(detections.descriptor);
                
                // Compare with Descriptor 1
                const distance = faceapi.euclideanDistance(descriptor1, currentDescriptor);
                console.log('Distance:', distance);

                if (distance > 0.6) {
                    toast.error('Face match inconsistent. Please ensure clear lighting and try again.', { id: 'capture' });
                    // Restart enrollment
                    setStep(1);
                    setDescriptor1(null);
                    return;
                }

                setDescriptor2(currentDescriptor);
                setCapturedImage2(dataUrl);
                setStep(3);
                toast.success('Face Verified Successfully!', { id: 'capture' });
                stopCamera();
            }
        } catch (error) {
            console.error(error);
            toast.error('Error during capture', { id: 'capture' });
        }
    };

    const handleSave = async () => {
        if (!selectedUser || !descriptor2) return;
        
        const loadingToast = toast.loading('Saving face enrollment...');
        try {
            await api.post('/biometric/enroll-face', {
                type: 'student',
                id: selectedUser.id,
                biometric_template: descriptor2
            });
            toast.success('Face Profile Created Successfully!', { id: loadingToast });
            handleSearch(); // Refresh search list to update status
            resetEnrollment();
        } catch (error) {
            toast.error('Failed to save enrollment', { id: loadingToast });
        }
    };

    const resetEnrollment = () => {
        setStep(0);
        setSelectedUser(null);
        setDescriptor1(null);
        setDescriptor2(null);
        setCapturedImage1(null);
        setCapturedImage2(null);
        stopCamera();
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4 text-slate-500">
                <RefreshCw size={48} className="animate-spin text-indigo-500" />
                <p className="font-bold">Initializing Face Recognition Engine...</p>
                <p className="text-xs">Downloading models (ssd_mobilenet_v1, landmark68, recognition)</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Camera className="text-indigo-600" /> Face Enrollment
                    </h2>
                    <p className="text-slate-500 text-sm">Register student faces for entrance gate attendance</p>
                </div>
                {step > 0 && (
                    <button 
                        onClick={resetEnrollment}
                        className="text-rose-600 hover:text-rose-700 font-bold text-sm bg-rose-50 px-4 py-2 rounded-xl transition-all"
                    >
                        Cancel & Go Back
                    </button>
                )}
            </div>

            {/* Step 0: Search Student */}
            {step === 0 && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
                    <h3 className="text-lg font-bold text-slate-700 mb-6">Step 1: Find Student</h3>
                    <form onSubmit={handleSearch} className="flex gap-4 mb-8">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold"
                                placeholder="Search by Admission ID, Name, Class or Section..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">
                            <Search size={20} /> Search
                        </button>
                    </form>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {users.map(user => (
                            <div 
                                key={user.id} 
                                onClick={() => { setSelectedUser(user); setStep(1); startCamera(); }}
                                className={`group p-6 bg-white border-2 rounded-[2.5rem] transition-all duration-300 relative overflow-hidden ${user.biometric_template ? 'border-emerald-100' : 'border-rose-50'} hover:shadow-2xl hover:-translate-y-1 cursor-pointer`}
                            >
                                <div className="flex items-center gap-5 relative z-10">
                                    {/* Face Status Icon */}
                                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 ${user.biometric_template ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-rose-500 shadow-lg shadow-rose-200'}`}>
                                        {user.biometric_template ? (
                                            <Check size={32} className="text-white" strokeWidth={3} />
                                        ) : (
                                            <User size={32} className="text-white" strokeWidth={2.5} />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-slate-800 text-lg truncate tracking-tight mb-0.5">{user.name}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{user.user_id}</span>
                                            {user.biometric_template ? (
                                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter italic">Secured</span>
                                            ) : (
                                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter italic">Action Required</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end justify-center">
                                        {user.biometric_template ? (
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="bg-emerald-500 text-white p-1 rounded-full"><Check size={14} strokeWidth={4} /></div>
                                                <div className="text-[10px] font-black text-indigo-600 flex items-center gap-1 group-hover:underline underline-offset-4">
                                                    <ScanLine size={12} /> EDIT
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-rose-100 text-rose-500 p-2 rounded-full animate-pulse">
                                                <AlertCircle size={20} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Background Accent Layer */}
                                <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-[0.05] transition-transform duration-700 group-hover:scale-150 ${user.biometric_template ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                            </div>
                        ))}
                    </div>
                    {users.length === 0 && searchQuery && (
                        <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                             <Search size={48} className="mx-auto mb-4 text-slate-300" />
                             <p className="text-sm font-bold text-slate-400">Try searching with Admission ID or full name</p>
                        </div>
                    )}
                </div>
            )}

            {/* Step 1 & 2: Capture Flow */}
            {(step === 1 || step === 2) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20 animate-in fade-in duration-500">
                    {/* Camera Feed */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="relative aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl border-4 border-white ring-1 ring-slate-200">
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                muted 
                                playsInline 
                                className="w-full h-full object-cover mirror"
                            />
                            
                            {/* Scanning Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className={`w-64 h-80 border-2 rounded-[3rem] transition-all duration-500 relative flex items-center justify-center ${faceDetected ? 'border-emerald-500 ring-[200px] ring-black/40' : 'border-white/30 ring-0'}`}>
                                    {!faceDetected && (
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50 text-center w-full px-4 font-bold text-xs">
                                            Center face within frame
                                        </div>
                                    )}
                                    
                                    {/* Scan Line Animation */}
                                    {faceDetected && (
                                        <div className="absolute inset-x-0 h-0.5 bg-emerald-400/50 shadow-[0_0_15px_#10b981] animate-scanline z-10 w-full top-0"></div>
                                    )}
                                </div>
                            </div>

                            {/* Status Indicator */}
                            <div className="absolute top-6 left-6 flex items-center gap-3">
                                <div className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg backdrop-blur-md border ${faceDetected ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-black/60 text-white/70 border-white/20'}`}>
                                    <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-white animate-ping' : 'bg-slate-500'}`}></div>
                                    {faceDetected ? 'Sensing Pulse' : 'Detecting...'}
                                </div>
                            </div>

                            {/* Step Indicator */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-indigo-500' : 'bg-white/30'}`}></div>
                                <div className="w-12 h-1 bg-white/20 rounded-full"></div>
                                <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-indigo-500' : 'bg-white/30'}`}></div>
                            </div>
                        </div>

                        <div className="bg-slate-900/95 p-6 rounded-3xl text-white shadow-xl flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                    <Camera className="text-white" size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase text-white/40 tracking-wider">Instructions</p>
                                    <p className="font-bold text-sm">
                                        {step === 1 ? 'Look straight into the lens for the first capture' : 'Repeat for verification to ensure match stability'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={captureSample}
                                disabled={!faceDetected}
                                className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all flex items-center gap-3 ${faceDetected ? 'bg-white text-black hover:scale-105 active:scale-95 shadow-xl shadow-white/10' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
                            >
                                <ScanLine size={18} /> {step === 1 ? 'Start Capture' : 'Verify Face'}
                            </button>
                        </div>
                    </div>

                    {/* Sidebar: Progress & Profile */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-h-[400px]">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Target Student</p>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl">
                                    {selectedUser.name[0]}
                                </div>
                                <div>
                                    <h4 className="font-black text-lg text-slate-800">{selectedUser.name}</h4>
                                    <p className="font-mono text-xs text-slate-400">{selectedUser.user_id}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative overflow-hidden group">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-tighter italic">Sample 01 - Calibration</p>
                                    {capturedImage1 ? (
                                        <img src={capturedImage1} className="w-full h-32 object-cover rounded-xl border border-slate-200 animate-in zoom-in-75 duration-300" alt="Sample 1" />
                                    ) : (
                                        <div className="w-full h-32 bg-slate-200/50 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300">
                                            <Camera size={24} className="text-slate-300" />
                                        </div>
                                    )}
                                    {capturedImage1 && <div className="absolute top-6 right-6 bg-emerald-500 text-white p-1 rounded-full shadow-lg animate-in fade-in zoom-in"><Check size={12} /></div>}
                                </div>

                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative overflow-hidden group">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-tighter italic">Sample 02 - Verification</p>
                                    {capturedImage2 ? (
                                        <img src={capturedImage2} className="w-full h-32 object-cover rounded-xl border border-slate-200 animate-in zoom-in-75 duration-300" alt="Sample 2" />
                                    ) : (
                                        <div className="w-full h-32 bg-slate-200/50 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300">
                                            <Camera size={24} className="text-slate-300" />
                                        </div>
                                    )}
                                    {capturedImage2 && <div className="absolute top-6 right-6 bg-emerald-500 text-white p-1 rounded-full shadow-lg animate-in fade-in zoom-in"><Check size={12} /></div>}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 flex items-start gap-3">
                            <AlertCircle size={20} className="mt-1" />
                            <p className="text-xs leading-loose font-bold">Ensure direct overhead lighting. Avoid wearing sunglasses or heavy masks during enrollment.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Final Confirmation */}
            {step === 3 && (
                <div className="max-w-xl mx-auto space-y-8 animate-in zoom-in-95 duration-500 text-center pb-20">
                    <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-100">
                        <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-200 animate-bounce">
                           <Check size={48} />
                        </div>
                        
                        <h3 className="text-3xl font-black text-slate-800 mb-2">Face Profile Ready</h3>
                        <p className="text-slate-500 mb-10 font-bold">Mathematical match verified within safe threshold.</p>
                        
                        <div className="relative group mb-10">
                            <img 
                                src={capturedImage2} 
                                className="w-48 h-48 mx-auto object-cover rounded-[2rem] border-4 border-emerald-500 shadow-2xl transition-transform group-hover:scale-105" 
                                alt="Final" 
                            />
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-2 rounded-full font-black uppercase text-[10px] tracking-widest shadow-xl">
                                Biometric Secured
                            </div>
                        </div>

                        <div className="space-y-4 mb-10 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Student Name</p>
                                <p className="text-2xl font-black text-slate-800 tracking-tight">{selectedUser.name}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Admission No</p>
                                    <p className="font-mono font-bold text-indigo-600">{selectedUser.user_id}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Status</p>
                                    <p className="font-bold text-emerald-600">Verified</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={resetEnrollment}
                                className="flex-1 py-4 px-6 rounded-2xl bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-sm hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Re-Enroll
                            </button>
                            <button 
                                onClick={handleSave}
                                className="flex-[2] py-4 px-6 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95"
                            >
                                Confirm & Save Enrollment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .mirror { transform: scaleX(-1); }
                @keyframes scanline {
                    0% { top: 0; }
                    100% { top: 100%; }
                }
                .animate-scanline {
                    animation: scanline 2s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default FaceEnrollment;
