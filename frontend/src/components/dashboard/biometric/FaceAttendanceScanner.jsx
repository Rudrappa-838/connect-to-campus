import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import { Scan, Users, Check, X, Shield, RefreshCw, Info, Filter, Camera, UserCheck, Edit2 } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const FaceAttendanceScanner = ({ config, preferredFacingMode = 'user' }) => {
    const [loading, setLoading] = useState(true);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    
    // Filters
    const [filterClass, setFilterClass] = useState('');
    const [filterSection, setFilterSection] = useState('');
    const availableSections = config?.classes?.find(c => c.class_id === parseInt(filterClass))?.sections || [];

    // Scanning State
    const videoRef = useRef(null);
    const [scanning, setScanning] = useState(false);
    const [lastRecognized, setLastRecognized] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, scanning, recognized, error, already_marked
    
    // Data
    const [scanHistory, setScanHistory] = useState([]);
    const [enrolledStudents, setEnrolledStudents] = useState([]);
    const [isMatching, setIsMatching] = useState(false);

    // Load Models
    useEffect(() => {
        const loadModels = async () => {
            try {
                setLoading(true);
                const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setModelsLoaded(true);
                fetchTodayAttendance();
                fetchEnrolledStudents();
            } catch (error) {
                console.error('Model loading failed', error);
                toast.error('AI Engine failed to initialize');
            } finally {
                setLoading(false);
            }
        };
        loadModels();
    }, []);

    const fetchEnrolledStudents = async () => {
        try {
            const res = await api.get('/biometric/enrolled');
            // Pre-parse the descriptors to speed up matching loop
            const data = res.data.map(s => ({
                ...s,
                descriptor: typeof s.biometric_template === 'string' ? JSON.parse(s.biometric_template) : s.biometric_template
            })).filter(s => Array.isArray(s.descriptor));
            setEnrolledStudents(data);
        } catch (err) {
            console.error('Failed to pre-fetch enrolled students');
        }
    };

    const fetchTodayAttendance = async () => {
        try {
            const res = await api.get('/biometric/today-attendance');
            // Map backend fields to frontend expected fields
            const history = res.data.map(item => ({
                id: Math.random(), // local unique key
                name: item.name,
                admission_no: item.user_id,
                time: item.scan_time,
                mode: item.marking_mode,
                db_id: item.id
            }));
            setScanHistory(history);
        } catch (err) {
            console.error('Failed to fetch today attendance');
        }
    };

    // Auto-start camera when models are ready
    useEffect(() => {
        if (modelsLoaded && !cameraActive) {
            startCamera();
        }
    }, [modelsLoaded]);

    const [stream, setStream] = useState(null);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: preferredFacingMode, width: { ideal: 640 }, height: { ideal: 480 } } 
            });
            setStream(mediaStream);
            setCameraActive(true);
            setScanning(true);
            setStatus('scanning');
        } catch (err) {
            console.error('Camera error:', err);
            toast.error('Camera access denied. Please check site permissions.');
        }
    };

    // Keep video source in sync with stream
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, cameraActive]);

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            setCameraActive(false);
            setScanning(false);
            setStatus('idle');
        }
    };

    // Main Recognition Loop
    useEffect(() => {
        let interval;
        if (cameraActive && scanning && status === 'scanning') {
            interval = setInterval(async () => {
                if (!videoRef.current || isMatching) return;

                const detections = await faceapi.detectSingleFace(videoRef.current)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detections && enrolledStudents.length > 0) {
                    // Local High-Speed Matching
                    const descriptor = detections.descriptor;
                    let bestMatch = null;
                    let minDistance = 0.55; // Slightly stricter for accuracy at speed

                    for (const student of enrolledStudents) {
                        const storedDescriptor = student.descriptor;
                        let sumSq = 0;
                        for (let i = 0; i < descriptor.length; i++) {
                            const diff = descriptor[i] - storedDescriptor[i];
                            sumSq += diff * diff;
                        }
                        const distance = Math.sqrt(sumSq);
                        if (distance < minDistance) {
                            minDistance = distance;
                            bestMatch = student;
                        }
                    }

                    if (bestMatch) {
                        handleRecognition(bestMatch);
                    }
                }
            }, 500); // 500ms loop for ultra-speed
        }
        return () => clearInterval(interval);
    }, [cameraActive, scanning, status, enrolledStudents, isMatching]);

    const handleRecognition = async (student) => {
        setScanning(false); 
        setIsMatching(true);
        setStatus('recognized'); 
        setLastRecognized(student); // Show name INSTANTLY (Optimistic)

        try {
            const res = await api.post('/biometric/mark-face-id', {
                studentId: student.id,
                marking_mode: 'face'
            });

            if (res.data.success) {
                // Keep the student object from matching since it's already local
                const studentData = res.data.student || student;
                
                if (res.data.alreadyMarked) {
                    setStatus('already_marked');
                    
                    // Voice feedback for already marked
                    if ('speechSynthesis' in window) {
                        const utterance = new SpeechSynthesisUtterance(`${studentData.name}, you are already present`);
                        window.speechSynthesis.speak(utterance);
                    }
                } else {
                    setStatus('recognized');
                    toast.success(`Present: ${studentData.name}`, { icon: '✅' });
                    
                    // Add to local history
                    setScanHistory(prev => [{
                        ...studentData,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
                        mode: 'face',
                        id: Date.now()
                    }, ...prev].slice(0, 10));

                    // Voice feedback for new attendance
                    if ('speechSynthesis' in window) {
                        const utterance = new SpeechSynthesisUtterance(`Welcome, ${studentData.name}`);
                        window.speechSynthesis.speak(utterance);
                    }
                }
            }
        } catch (error) {
            console.error('Recognition error:', error);
            setStatus('error');
            toast.error('Sync Error: Please check server connection');
        } finally {
            // Ultra-fast resume (1s for new mark, 2s for already marked so it can be read)
            const delay = 1800; // Fixed consistent delay for readability
            setTimeout(() => {
                setScanning(true);
                setIsMatching(false);
                setStatus('scanning');
                setLastRecognized(null);
                fetchTodayAttendance();
            }, delay);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <RefreshCw size={48} className="animate-spin text-indigo-500" />
                <p className="font-bold text-slate-500">Waking up AI models...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            {/* Top Bar with Modes */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <Scan size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Entrance Face Scanner</h2>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                            {cameraActive ? 'System Active' : 'Scanner Offline'}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                        <Filter size={16} className="text-slate-400 ml-2" />
                        <select 
                            className="bg-transparent text-sm font-bold outline-none text-slate-700 min-w-[120px]"
                            value={filterClass}
                            onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}
                        >
                            <option value="">All Classes (Random)</option>
                            {config?.classes?.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                        </select>
                        {filterClass && (
                            <select 
                                className="bg-transparent text-sm font-bold outline-none text-slate-700 border-l border-slate-200 pl-2 ml-2"
                                value={filterSection}
                                onChange={e => setFilterSection(e.target.value)}
                            >
                                <option value="">Sections</option>
                                {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        )}
                    </div>
                    
                    {!cameraActive ? (
                        <button 
                            onClick={startCamera}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-200 transition-all flex items-center gap-2 active:scale-95"
                        >
                            <Camera size={18} /> Open Scanner
                        </button>
                    ) : (
                        <button 
                            onClick={stopCamera}
                            className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2"
                        >
                            <X size={18} /> Turn Off
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Scanning View */}
                <div className="lg:col-span-2 space-y-6">
                    <div className={`relative aspect-square md:aspect-video rounded-[3rem] overflow-hidden bg-slate-900 shadow-2xl border-4 transition-all duration-500 ${status === 'recognized' ? 'border-emerald-500 ring-8 ring-emerald-500/20' : status === 'already_marked' ? 'border-amber-400 ring-8 ring-amber-400/20' : status === 'scanning' ? 'border-white' : 'border-slate-800'}`}>
                        {cameraActive ? (
                            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover mirror" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center">
                                    <Scan size={40} />
                                </div>
                                <p className="font-bold uppercase tracking-widest text-xs">Camera Inactive</p>
                            </div>
                        )}

                        {/* Overlays */}
                        {cameraActive && status === 'scanning' && (
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-0 border-[100px] border-black/40"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-80 border-2 border-white/50 rounded-[4rem] shadow-[0_0_0_2000px_rgba(0,0,0,0.4)]">
                                     <div className="absolute inset-x-0 h-0.5 bg-indigo-400 shadow-[0_0_15px_#818cf8] animate-scanline"></div>
                                </div>
                                <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 text-white text-[10px] font-black uppercase tracking-widest animate-pulse">
                                    System Scanning Live Feed...
                                </div>
                            </div>
                        )}

                        {/* Result Overlay */}
                        {(status === 'recognized' || status === 'already_marked') && lastRecognized && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center animate-in fade-in zoom-in duration-200 z-50">
                                <div className={`p-10 rounded-[3rem] shadow-2xl text-center max-w-md w-full mx-4 transform animate-in slide-in-from-bottom-12 scale-110 ${status === 'recognized' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-900 font-black'}`}>
                                    <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                                        {status === 'recognized' ? <UserCheck size={64} className="text-white" /> : <Info size={64} className="text-slate-900" />}
                                    </div>
                                    <h3 className="text-4xl font-black tracking-tight mb-4 uppercase drop-shadow-sm">{lastRecognized.name}</h3>
                                    <p className="text-md font-bold opacity-80 mb-8 font-mono tracking-widest bg-black/10 rounded-full py-1">ID: {lastRecognized.admission_no}</p>
                                    
                                    <div className="bg-black/20 py-4 px-8 rounded-2xl font-black uppercase text-lg tracking-widest shadow-xl animate-pulse">
                                        {status === 'recognized' ? '✓ PRESENT MARKED' : '⚠️ ALREADY TAKEN'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                            <Info size={20} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-700">Scanner Optimization</p>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                For faster matching, select a <strong>Specific Class</strong>. This reduces the search group. 
                                "Random" mode scans the entire school database but may take an extra second on older phones.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sidebar: Recent Activity */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200 min-h-[500px] flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Live Feed Status</h3>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        </div>

                        <div className="space-y-4 flex-1">
                            {scanHistory.length > 0 ? (
                                scanHistory.map(scan => (
                                    <div key={scan.id} className="group flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all animate-in slide-in-from-right-4">
                                        <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-indigo-600 font-black shadow-sm group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                                            {scan.name[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-800 text-sm truncate">{scan.name}</h4>
                                            <p className="text-[10px] text-slate-400 font-mono italic">ID: {scan.admission_no}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <p className="text-[10px] font-black text-slate-900 border-b border-slate-200 mb-0.5">{scan.time}</p>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">Present</span>
                                                {scan.mode === 'face' ? (
                                                    <Camera size={10} className="text-indigo-400" />
                                                ) : (
                                                    <Edit2 size={10} className="text-amber-400" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 pb-20">
                                    <Shield size={64} className="mb-4" />
                                    <p className="font-black uppercase tracking-widest text-[10px]">No Scans Logged</p>
                                    <p className="text-[10px] italic">Scanner waiting for traffic</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-100">
                             <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <span>Recent (Last 10)</span>
                                <button 
                                    onClick={() => setScanHistory([])}
                                    className="hover:text-rose-500 transition-colors"
                                >
                                    Clear Logs
                                </button>
                             </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="bg-indigo-600 p-6 rounded-[2.5rem] shadow-xl shadow-indigo-200 text-white">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                                <Users size={20} />
                            </div>
                            <h4 className="font-black uppercase text-xs tracking-widest">Session Stats</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/10 p-4 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-bold text-white/50 uppercase mb-1">Total Scans</p>
                                <p className="text-2xl font-black">{scanHistory.length}</p>
                            </div>
                            <div className="bg-black/10 p-4 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-bold text-white/50 uppercase mb-1">Authenticated</p>
                                <p className="text-2xl font-black">{new Set(scanHistory.map(s => s.admission_no)).size}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .mirror { transform: scaleX(-1); }
                @keyframes scanline {
                    0% { top: 0; }
                    100% { top: 100%; }
                }
                .animate-scanline {
                    animation: scanline 2.5s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default FaceAttendanceScanner;
