import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, Search, User, Check, X, Shield, RefreshCw, AlertCircle, ScanLine } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

// Mobile-adaptive constants (shared pattern with scanner)
const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent)
    || window.innerWidth < 768;
const DETECTOR_INPUT_SIZE = isMobile ? 224 : 320;
const DETECT_INTERVAL_MS  = isMobile ? 800 : 500;  // Face detection preview loop
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/';

const FaceEnrollment = ({ config, preferredFacingMode = 'user' }) => {
    // === Multi-sample enrollment constants ===
    const TOTAL_SAMPLES = 5;  // 5 samples → averaged descriptor → much more accurate

    const [loading, setLoading] = useState(true);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [userRole, setUserRole] = useState('student');
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    // step: 0=search, 1=capturing, 2=confirm
    const [step, setStep] = useState(0);

    // Multi-sample state
    const [collectedDescriptors, setCollectedDescriptors] = useState([]); // Array of Float32Array-like arrays
    const [capturedImages, setCapturedImages] = useState([]);             // Preview images
    const [finalDescriptor, setFinalDescriptor] = useState(null);         // Averaged descriptor
    const [isCapturing, setIsCapturing] = useState(false);               // Prevent double-tap

    const [cameraActive, setCameraActive] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [scanning, setScanning] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);

    // Initial Model Loading — TinyFaceDetector is 5-10x faster on Android
    useEffect(() => {
        const loadModels = async () => {
            try {
                setLoading(true);
                // jsDelivr CDN: globally cached edge delivery, faster than GitHub raw
                // tinyFaceDetector + faceLandmark68TinyNet = designed for mobile/low-power devices
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setModelsLoaded(true);
                console.log(`[Enrollment] Models loaded. Mobile=${isMobile}`);
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
            const res = await api.get('/biometric/search', { params: { type: userRole, query: searchQuery } });
            setUsers(res.data);
        } catch (error) {
            toast.error('Search failed');
        }
    };

    const [stream, setStream] = useState(null);

    const startCamera = async () => {
        try {
            // Lower resolution on mobile = faster frame processing = no hang
            const constraints = isMobile
                ? { facingMode: preferredFacingMode, width: { ideal: 320 }, height: { ideal: 240 } }
                : { facingMode: preferredFacingMode, width: { ideal: 640 }, height: { ideal: 480 } };

            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: constraints });
            setStream(mediaStream);
            setCameraActive(true);
        } catch (err) {
            // Fallback: try without resolution constraints
            try {
                const fallback = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: preferredFacingMode }
                });
                setStream(fallback);
                setCameraActive(true);
            } catch (fallbackErr) {
                console.error('Enrollment Camera Error:', fallbackErr);
                toast.error('Could not access camera. Please check permissions.');
            }
        }
    };

    // Sync stream with video element & cleanup on unmount
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setCameraActive(false);
    };

    // Real-time Face Detection Preview Loop (live green box feedback)
    useEffect(() => {
        let interval;
        if (cameraActive && modelsLoaded && step === 1) {
            interval = setInterval(async () => {
                if (!videoRef.current) return;
                // Guard: skip if video not yet playing
                if (videoRef.current.readyState < 2 || videoRef.current.paused) return;

                try {
                    // TinyFaceDetector: fast detection for live preview indicator
                    const detectorOpts = new faceapi.TinyFaceDetectorOptions({
                        inputSize: DETECTOR_INPUT_SIZE,
                        scoreThreshold: 0.5
                    });
                    const detected = await faceapi.detectSingleFace(videoRef.current, detectorOpts);
                    setFaceDetected(!!detected);
                    setScanning(!!detected);
                } catch (e) {
                    // Ignore — UI still updates next tick
                }
            }, DETECT_INTERVAL_MS);
        }
        return () => clearInterval(interval);
    }, [cameraActive, modelsLoaded, step]);

    // Average N descriptor arrays into a single 128-float array
    const averageDescriptors = (descriptors) => {
        const len = descriptors[0].length;
        const avg = new Array(len).fill(0);
        for (const d of descriptors) {
            for (let i = 0; i < len; i++) avg[i] += d[i];
        }
        return avg.map(v => v / descriptors.length);
    };

    const captureSample = async () => {
        if (!faceDetected || isCapturing) return;
        if (collectedDescriptors.length >= TOTAL_SAMPLES) return;

        setIsCapturing(true);
        toast.loading(`Capturing sample ${collectedDescriptors.length + 1}/${TOTAL_SAMPLES}...`, { id: 'capture' });

        try {
            // TinyFaceDetector for capture: same 128-dim descriptor quality, much faster on mobile
            const captureDet = await faceapi
                .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({
                    inputSize: DETECTOR_INPUT_SIZE,
                    scoreThreshold: 0.5
                }))
                .withFaceLandmarks(true)
                .withFaceDescriptor();

            if (!captureDet) {
                toast.error('No face in frame, try again.', { id: 'capture' });
                setIsCapturing(false);
                return;
            }

            const newDescriptor = Array.from(captureDet.descriptor);

            // Consistency check: every capture after the first must be within distance 0.55 of first
            if (collectedDescriptors.length > 0) {
                const dist = faceapi.euclideanDistance(collectedDescriptors[0], newDescriptor);
                if (dist > 0.55) {
                    toast.error('Different face detected! Ensure only one person is in frame.', { id: 'capture' });
                    setIsCapturing(false);
                    return;
                }
            }

            // Capture preview image
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

            const updatedDescriptors = [...collectedDescriptors, newDescriptor];
            const updatedImages = [...capturedImages, dataUrl];

            setCollectedDescriptors(updatedDescriptors);
            setCapturedImages(updatedImages);

            if (updatedDescriptors.length >= TOTAL_SAMPLES) {
                // All samples collected — compute averaged descriptor
                const averaged = averageDescriptors(updatedDescriptors);
                setFinalDescriptor(averaged);
                setStep(2); // Move to confirmation
                toast.success('All samples captured! Review and confirm.', { id: 'capture' });
                stopCamera();
            } else {
                const remaining = TOTAL_SAMPLES - updatedDescriptors.length;
                toast.success(`Sample ${updatedDescriptors.length}/${TOTAL_SAMPLES} captured. ${remaining} more needed.`, { id: 'capture' });
            }
        } catch (error) {
            console.error(error);
            toast.error('Error during capture, try again.', { id: 'capture' });
        } finally {
            setIsCapturing(false);
        }
    };

    const handleSave = async () => {
        if (!selectedUser || !finalDescriptor) return;

        const loadingToast = toast.loading('Saving face enrollment...');
        try {
            // Save the averaged single descriptor (backward-compatible with legacy scanner)
            await api.post('/biometric/enroll-face', {
                type: selectedUser.type || userRole,
                id: selectedUser.id,
                biometric_template: finalDescriptor
            });
            toast.success('Face Profile Created Successfully! ✓', { id: loadingToast });
            handleSearch();
            resetEnrollment();
        } catch (error) {
            const msg = error.response?.data?.message || 'Failed to save enrollment';
            toast.error(msg, { id: loadingToast });
        }
    };

    const resetEnrollment = () => {
        setStep(0);
        setSelectedUser(null);
        setCollectedDescriptors([]);
        setCapturedImages([]);
        setFinalDescriptor(null);
        setIsCapturing(false);
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
                    <p className="text-slate-500 text-sm">Register face biometric fingerprints for access control and attendance</p>
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
                    <div className="flex justify-between items-end mb-6">
                        <h3 className="text-lg font-bold text-slate-700">Step 1: Find User</h3>
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                            {['student', 'teacher', 'staff'].map(role => (
                                <button
                                    key={role}
                                    onClick={() => { setUserRole(role); setUsers([]); }}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${userRole === role ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {role}s
                                </button>
                            ))}
                        </div>
                    </div>
                    <form onSubmit={handleSearch} className="flex gap-4 mb-8">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold"
                                placeholder={`Search ${userRole}s by ID, Name or Email...`}
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
                             <p className="text-sm font-bold text-slate-400">No {userRole}s found. Try searching with ID or full name</p>
                        </div>
                    )}
                </div>
            )}

            {/* Step 1: Multi-Sample Capture */}
            {step === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20 animate-in fade-in duration-500">
                    {/* Camera Feed */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="relative aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl border-4 border-white ring-1 ring-slate-200">
                            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover mirror" />

                            {/* Scanning Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className={`w-64 h-80 border-2 rounded-[3rem] transition-all duration-500 relative ${faceDetected ? 'border-emerald-500 shadow-[0_0_0_2000px_rgba(0,0,0,0.35)]' : 'border-white/30'}`}>
                                    {!faceDetected && (
                                        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-center px-4 font-bold text-xs">
                                            Center face within frame
                                        </div>
                                    )}
                                    {faceDetected && (
                                        <div className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_15px_#10b981] animate-scanline top-0" />
                                    )}
                                    {/* Corner marks */}
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl" />
                                </div>
                            </div>

                            {/* Face Status */}
                            <div className="absolute top-6 left-6">
                                <div className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg backdrop-blur-md border ${faceDetected ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-black/60 text-white/70 border-white/20'}`}>
                                    <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-white animate-ping' : 'bg-slate-500'}`} />
                                    {faceDetected ? 'Face Detected' : 'Looking...'}
                                </div>
                            </div>

                            {/* Sample progress dots */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
                                {Array.from({ length: TOTAL_SAMPLES }).map((_, i) => (
                                    <div key={i} className={`w-3 h-3 rounded-full transition-all duration-300 ${
                                        i < collectedDescriptors.length ? 'bg-emerald-400 scale-110' : 'bg-white/30'
                                    }`} />
                                ))}
                            </div>
                        </div>

                        {/* Capture Bar */}
                        <div className="bg-slate-900 p-5 rounded-3xl text-white shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Multi-Sample Capture</p>
                                    <p className="font-bold text-sm">
                                        {collectedDescriptors.length === 0
                                            ? 'Look straight, then tap Capture'
                                            : collectedDescriptors.length < TOTAL_SAMPLES
                                                ? `Great! ${TOTAL_SAMPLES - collectedDescriptors.length} more sample(s) needed`
                                                : 'All samples ready!'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-emerald-400">{collectedDescriptors.length}</p>
                                    <p className="text-[10px] text-white/40">of {TOTAL_SAMPLES}</p>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-white/10 rounded-full h-1.5 mb-4">
                                <div
                                    className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${(collectedDescriptors.length / TOTAL_SAMPLES) * 100}%` }}
                                />
                            </div>

                            <button
                                onClick={captureSample}
                                disabled={!faceDetected || isCapturing}
                                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 ${
                                    faceDetected && !isCapturing
                                        ? 'bg-white text-black hover:scale-[1.02] active:scale-95 shadow-xl'
                                        : 'bg-white/10 text-white/30 cursor-not-allowed'
                                }`}
                            >
                                <ScanLine size={18} />
                                {isCapturing ? 'Processing...' : `Capture Sample ${collectedDescriptors.length + 1}`}
                            </button>
                        </div>
                    </div>

                    {/* Sidebar: Captured Previews */}
                    <div className="space-y-4">
                        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Captured Samples</p>

                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-lg">
                                    {selectedUser.name[0]}
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800">{selectedUser.name}</h4>
                                    <p className="font-mono text-xs text-slate-400">{selectedUser.user_id}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {Array.from({ length: TOTAL_SAMPLES }).map((_, i) => (
                                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50">
                                        {capturedImages[i] ? (
                                            <>
                                                <img src={capturedImages[i]} alt={`Sample ${i + 1}`} className="w-full h-full object-cover" />
                                                <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5">
                                                    <Check size={10} strokeWidth={3} />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs font-black">
                                                {i + 1}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 flex items-start gap-3">
                            <AlertCircle size={18} className="mt-0.5 shrink-0" />
                            <p className="text-xs leading-loose font-bold">5 different angles improve accuracy. Try: straight, slight left, slight right.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Final Confirmation */}
            {step === 2 && (
                <div className="max-w-xl mx-auto space-y-8 animate-in zoom-in-95 duration-500 text-center pb-20">
                    <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-100">
                        <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-200">
                            <Check size={48} />
                        </div>

                        <h3 className="text-3xl font-black text-slate-800 mb-2">Face Profile Ready</h3>
                        <p className="text-slate-500 mb-8 font-bold">{TOTAL_SAMPLES} samples captured & averaged into a high-accuracy biometric template.</p>

                        {/* Sample grid preview */}
                        <div className="grid grid-cols-5 gap-2 mb-8">
                            {capturedImages.map((img, i) => (
                                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-emerald-200">
                                    <img src={img} alt={`Sample ${i + 1}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-emerald-500/10" />
                                    <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5">
                                        <Check size={8} strokeWidth={3} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-4 mb-8 bg-slate-50 p-6 rounded-3xl border border-slate-100 text-left">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">{selectedUser.type?.toUpperCase() || 'USER'} NAME</p>
                                <p className="text-2xl font-black text-slate-800 tracking-tight">{selectedUser.name}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{selectedUser.type === 'student' ? 'Admission No' : 'Employee ID'}</p>
                                    <p className="font-mono font-bold text-indigo-600">{selectedUser.user_id}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Samples</p>
                                    <p className="font-bold text-emerald-600">{TOTAL_SAMPLES} × Averaged</p>
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
                                Confirm & Save ✓
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
