import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { Scan, Users, Check, X, Shield, RefreshCw, Camera, UserCheck, Info, Edit2 } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const MATCH_THRESHOLD = 0.38;          // Strict: prevents wrong-person matches
const UNKNOWN_DEBOUNCE_TICKS = 3;     // Must fail 3 consecutive ticks before showing "Unknown"

// ─── Mobile Detection & Adaptive Settings ───────────────────────────────────
const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent)
    || window.innerWidth < 768;

// TinyFaceDetector: ~10ms/frame on Android vs 100ms+ for SsdMobilenetv1
// inputSize 224 = smallest/fastest (mobile), 320 = balanced (desktop)
const DETECTOR_INPUT_SIZE = isMobile ? 224 : 320;
const SCAN_INTERVAL_MS   = isMobile ? 700 : 400;   // Don't overwhelm slower mobile CPUs

// jsDelivr CDN: globally cached, 5x faster than GitHub raw, works offline after first load
const MODEL_URL = '/models/';

const FaceAttendanceScanner = ({ config, preferredFacingMode = 'user' }) => {
    const [loading, setLoading] = useState(true);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);

    const videoRef = useRef(null);
    const intervalRef = useRef(null);
    const isMatchingRef = useRef(false);        // Use ref to avoid stale closure in interval
    const unknownTicksRef = useRef(0);          // Debounce counter for unknown faces

    const [status, setStatus] = useState('idle'); // idle | scanning | recognized | already_marked | unknown | error
    const [lastRecognized, setLastRecognized] = useState(null);
    const [matchConfidence, setMatchConfidence] = useState(null);
    const [scanHistory, setScanHistory] = useState([]);
    const [enrolledCount, setEnrolledCount] = useState(0);

    // FaceMatcher is built ONCE from enrolled users — fast O(1) lookup
    const faceMatcherRef = useRef(null);
    const [stream, setStream] = useState(null);

    // ─── Load Models ────────────────────────────────────────────────────────────
    useEffect(() => {
        const loadModels = async () => {
            try {
                setLoading(true);
                // Load 3 models concurrently from jsDelivr CDN (globally cached)
                // TinyFaceDetector + TinyLandmarks = 5-10x faster on Android vs Ssd+Full
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setModelsLoaded(true);
                fetchTodayAttendance();
                await buildFaceMatcher();
            } catch (error) {
                console.error('Model loading failed', error);
                toast.error('AI Engine failed to initialize');
            } finally {
                setLoading(false);
            }
        };
        loadModels();

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // ─── Build FaceMatcher (once) ────────────────────────────────────────────────
    // faceapi.FaceMatcher is dramatically faster and more accurate than a manual loop.
    // It uses optimised KD-tree-style matching internally.
    const buildFaceMatcher = async () => {
        try {
            const res = await api.get('/biometric/enrolled');
            const labeledDescriptors = [];

            for (const u of res.data) {
                try {
                    const raw = typeof u.biometric_template === 'string'
                        ? JSON.parse(u.biometric_template)
                        : u.biometric_template;

                    if (!Array.isArray(raw) || raw.length < 128) continue;

                    // Support both single-descriptor (legacy) and multi-descriptor arrays
                    let descriptorArrays = [];
                    if (Array.isArray(raw[0])) {
                        // Multi-sample: [[...128 floats...], [...128 floats...], ...]
                        descriptorArrays = raw.map(d => new Float32Array(d));
                    } else {
                        // Legacy single descriptor
                        descriptorArrays = [new Float32Array(raw)];
                    }

                    // Label format: "id|name|type|user_id" — allows full reconstruction on match
                    const label = JSON.stringify({ id: u.id, name: u.name, type: u.type || 'student', user_id: u.user_id });
                    labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(label, descriptorArrays));
                } catch (e) {
                    console.warn('Skipping malformed descriptor for:', u.name);
                }
            }

            if (labeledDescriptors.length === 0) {
                console.warn('[FaceMatcher] No valid descriptors found');
                faceMatcherRef.current = null;
                setEnrolledCount(0);
                return;
            }

            faceMatcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD);
            setEnrolledCount(labeledDescriptors.length);
            console.log(`[FaceMatcher] Built with ${labeledDescriptors.length} enrolled users, threshold=${MATCH_THRESHOLD}`);
        } catch (err) {
            console.error('[FaceMatcher] Build failed:', err);
        }
    };

    const fetchTodayAttendance = async () => {
        try {
            const res = await api.get('/biometric/today-attendance');
            const history = res.data.map(item => ({
                id: Math.random(),
                name: item.name,
                admission_no: item.user_id,
                time: item.scan_time,
                mode: item.marking_mode,
                type: item.type || 'student',
                db_id: item.id
            }));
            setScanHistory(history);
        } catch (err) {
            console.error('Failed to fetch today attendance');
        }
    };

    // ─── Auto-start camera when models ready ─────────────────────────────────────
    useEffect(() => {
        if (modelsLoaded && !cameraActive) {
            startCamera();
        }
    }, [modelsLoaded]);

    const startCamera = async () => {
        try {
            // Adaptive resolution: lower on mobile = faster processing, less lag
            const videoConstraints = isMobile
                ? { facingMode: preferredFacingMode, width: { ideal: 320 }, height: { ideal: 240 } }
                : { facingMode: preferredFacingMode, width: { ideal: 640 }, height: { ideal: 480 } };

            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            setStream(mediaStream);
            setCameraActive(true);
            setStatus('scanning');
        } catch (err) {
            console.error('Camera error:', err);
            // Fallback: try without constraints if specific resolution fails
            try {
                const fallback = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: preferredFacingMode }
                });
                setStream(fallback);
                setCameraActive(true);
                setStatus('scanning');
            } catch (fallbackErr) {
                toast.error('Camera access denied. Please check site permissions.');
            }
        }
    };

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [stream]);

    const stopCamera = () => {
        if (stream) stream.getTracks().forEach(t => t.stop());
        setCameraActive(false);
        setStatus('idle');
        unknownTicksRef.current = 0;
        isMatchingRef.current = false;
    };

    // ─── Main Recognition Loop ───────────────────────────────────────────────────
    useEffect(() => {
        if (!cameraActive || status !== 'scanning') {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        intervalRef.current = setInterval(async () => {
            if (!videoRef.current || isMatchingRef.current) return;
            if (!faceMatcherRef.current) return;
            // Guard: video must be playing and have data — prevents hanging on paused frame
            if (videoRef.current.readyState < 2 || videoRef.current.paused) return;

            try {
                // TinyFaceDetector: ~10ms on Android (vs 100ms+ for SsdMobilenetv1)
                // withFaceLandmarks(true) = use tiny landmark model (much faster)
                const detectorOpts = new faceapi.TinyFaceDetectorOptions({
                    inputSize: DETECTOR_INPUT_SIZE,
                    scoreThreshold: 0.5
                });
                const result = await faceapi
                    .detectSingleFace(videoRef.current, detectorOpts)
                    .withFaceLandmarks(true)
                    .withFaceDescriptor();

                if (!result) {
                    // No face visible — reset debounce quietly
                    unknownTicksRef.current = 0;
                    return;
                }

                // TinyFaceDetector's scoreThreshold already gates low-confidence faces
                // No additional score check needed here

                const bestMatch = faceMatcherRef.current.findBestMatch(result.descriptor);

                if (bestMatch.label === 'unknown') {
                    // Debounce: only trigger after N consecutive unknown ticks
                    unknownTicksRef.current += 1;
                    if (unknownTicksRef.current >= UNKNOWN_DEBOUNCE_TICKS) {
                        unknownTicksRef.current = 0;
                        handleUnknownFace();
                    }
                } else {
                    unknownTicksRef.current = 0;
                    try {
                        const userData = JSON.parse(bestMatch.label);
                        const confidence = Math.round((1 - bestMatch.distance) * 100);
                        handleRecognition(userData, confidence);
                    } catch (e) {
                        console.error('Failed to parse matched label:', e);
                    }
                }
            } catch (err) {
                // Silent fail — keep scanning
                console.warn('[Scan] Detection error:', err.message);
            }
        }, SCAN_INTERVAL_MS); // Adaptive: 700ms mobile / 400ms desktop

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [cameraActive, status]);

    // ─── Unknown Face Handler ────────────────────────────────────────────────────
    const handleUnknownFace = useCallback(() => {
        isMatchingRef.current = true;
        setStatus('unknown');

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance('Face not recognized. Please enroll first.');
            window.speechSynthesis.speak(utterance);
        }
        toast.error('Face not recognized', { icon: '❌', id: 'face-unknown' });

        setTimeout(() => {
            isMatchingRef.current = false;
            setStatus('scanning');
        }, 2500);
    }, []);

    // ─── Recognized Face Handler ─────────────────────────────────────────────────
    const handleRecognition = useCallback(async (userData, confidence) => {
        isMatchingRef.current = true;
        setStatus('recognized');
        setLastRecognized(userData);
        setMatchConfidence(confidence);

        try {
            const res = await api.post('/biometric/mark-face-id', {
                userId: userData.id,
                type: userData.type || 'student',
                marking_mode: 'face'
            });

            if (res.data.success) {
                const serverUser = res.data.user || userData;

                if (res.data.alreadyMarked) {
                    setStatus('already_marked');
                    if ('speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(
                            new SpeechSynthesisUtterance(`${serverUser.name}, attendance already taken`)
                        );
                    }
                } else {
                    setStatus('recognized');
                    toast.success(`Present: ${serverUser.name}`, { icon: '✅', id: 'face-present' });

                    setScanHistory(prev => [{
                        ...serverUser,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
                        mode: 'face',
                        id: Date.now()
                    }, ...prev].slice(0, 10));

                    if ('speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(
                            new SpeechSynthesisUtterance(`Welcome, ${serverUser.name}`)
                        );
                    }
                }
            }
        } catch (error) {
            console.error('Attendance mark error:', error);
            setStatus('error');
            toast.error(error.response?.data?.message || 'Server error', { id: 'face-err' });
        } finally {
            setTimeout(() => {
                isMatchingRef.current = false;
                setStatus('scanning');
                setLastRecognized(null);
                setMatchConfidence(null);
                fetchTodayAttendance();
            }, 2000);
        }
    }, []);

    // ─── Loading Screen ───────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <RefreshCw size={48} className="animate-spin text-indigo-500" />
                <p className="font-bold text-slate-500">Waking up AI models...</p>
                <p className="text-xs text-slate-400">This only happens once. Subsequent loads are instant.</p>
            </div>
        );
    }

    // ─── Border color by status ───────────────────────────────────────────────────
    const borderClass = {
        recognized: 'border-emerald-500 ring-8 ring-emerald-500/20',
        already_marked: 'border-amber-400 ring-8 ring-amber-400/20',
        unknown: 'border-rose-500 ring-8 ring-rose-500/20',
        error: 'border-rose-500 ring-8 ring-rose-500/20',
        scanning: 'border-white/20',
        idle: 'border-slate-800',
    }[status] || 'border-slate-800';

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            {/* Top Bar */}
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
                            {enrolledCount > 0 && (
                                <span className="ml-2 bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[9px]">
                                    {enrolledCount} enrolled
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <button
                        onClick={buildFaceMatcher}
                        title="Refresh face database"
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all"
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>

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
                {/* Main Camera View */}
                <div className="lg:col-span-2 space-y-6">
                    <div className={`relative aspect-square md:aspect-video rounded-[3rem] overflow-hidden bg-slate-900 shadow-2xl border-4 transition-all duration-500 ${borderClass}`}>
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

                        {/* Scanning Overlay */}
                        {cameraActive && status === 'scanning' && (
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-0 border-[80px] border-black/30" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-80 border-2 border-white/60 rounded-[4rem] shadow-[0_0_0_2000px_rgba(0,0,0,0.3)]">
                                    <div className="absolute inset-x-0 h-0.5 bg-indigo-400 shadow-[0_0_15px_#818cf8] animate-scanline" />
                                    {/* Corner marks */}
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl" />
                                </div>
                                <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 text-white text-[10px] font-black uppercase tracking-widest animate-pulse">
                                    Scanning Live Feed...
                                </div>
                            </div>
                        )}

                        {/* Result Overlay */}
                        {(status === 'recognized' || status === 'already_marked' || status === 'unknown' || status === 'error') && (
                            <div className="absolute inset-0 bg-black/65 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in zoom-in duration-200">
                                {status === 'unknown' || status === 'error' ? (
                                    <div className="p-8 rounded-[3rem] shadow-2xl text-center max-w-sm w-full mx-4 bg-rose-600 text-white animate-in slide-in-from-bottom-10 scale-105">
                                        <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                            <X size={56} className="text-white" />
                                        </div>
                                        <h3 className="text-3xl font-black tracking-tight mb-3 uppercase">
                                            {status === 'error' ? 'Sync Error' : 'Not Recognized'}
                                        </h3>
                                        <p className="text-sm font-bold opacity-80 mb-5">
                                            {status === 'error' ? 'Could not save attendance. Try again.' : 'Face not enrolled in system'}
                                        </p>
                                        <div className="bg-black/20 py-3 px-6 rounded-2xl font-black uppercase tracking-widest text-base animate-pulse">
                                            ❌ ACCESS DENIED
                                        </div>
                                    </div>
                                ) : lastRecognized && (
                                    <div className={`p-8 rounded-[3rem] shadow-2xl text-center max-w-sm w-full mx-4 animate-in slide-in-from-bottom-10 scale-105 ${status === 'recognized' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-900'}`}>
                                        <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                            {status === 'recognized'
                                                ? <UserCheck size={56} className="text-white" />
                                                : <Info size={56} />}
                                        </div>
                                        <h3 className="text-3xl font-black tracking-tight mb-2 uppercase">{lastRecognized.name}</h3>
                                        <div className="flex items-center justify-center gap-2 mb-4">
                                            <p className="text-xs font-bold opacity-80 font-mono bg-black/10 rounded-full py-1 px-3">
                                                ID: {lastRecognized.user_id}
                                            </p>
                                            <span className="bg-white/20 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full">
                                                {lastRecognized.type}
                                            </span>
                                        </div>

                                        {/* Confidence Badge */}
                                        {matchConfidence !== null && status === 'recognized' && (
                                            <div className="mb-4">
                                                <span className="bg-white/20 text-white text-xs font-black px-4 py-1 rounded-full">
                                                    {matchConfidence}% match confidence
                                                </span>
                                            </div>
                                        )}

                                        <div className="bg-black/20 py-3 px-6 rounded-2xl font-black uppercase tracking-widest text-base animate-pulse">
                                            {status === 'recognized' ? '✓ PRESENT MARKED' : '⚠️ ALREADY TAKEN'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Info Bar */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                            <Shield size={20} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-700">AI Face Matcher Active</p>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                Using <strong>FaceMatcher</strong> with <strong>{MATCH_THRESHOLD * 100}% strictness threshold</strong>.
                                Only a very close facial match will be recognized. Unknown faces are debounced across 3 frames to avoid false alarms.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sidebar: Recent Activity */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200 min-h-[500px] flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Live Feed Status</h3>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>

                        <div className="space-y-4 flex-1">
                            {scanHistory.length > 0 ? (
                                scanHistory.map(scan => (
                                    <div key={scan.id} className="group flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all animate-in slide-in-from-right-4">
                                        <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-indigo-600 font-black shadow-sm group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors shrink-0">
                                            {scan.name[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-800 text-sm truncate">{scan.name}</h4>
                                            <p className="text-[10px] text-slate-400 font-mono italic">ID: {scan.admission_no}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1 shrink-0">
                                            <p className="text-[10px] font-black text-slate-900 border-b border-slate-200 mb-0.5">{scan.time}</p>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Present</span>
                                                {scan.mode === 'face'
                                                    ? <Camera size={10} className="text-indigo-400" />
                                                    : <Edit2 size={10} className="text-amber-400" />}
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
                                <button onClick={() => setScanHistory([])} className="hover:text-rose-500 transition-colors">
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
                                <p className="text-[10px] font-bold text-white/50 uppercase mb-1">Today's Scans</p>
                                <p className="text-2xl font-black">{scanHistory.length}</p>
                            </div>
                            <div className="bg-black/10 p-4 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-bold text-white/50 uppercase mb-1">Unique Present</p>
                                <p className="text-2xl font-black">{new Set(scanHistory.map(s => s.admission_no)).size}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .mirror { transform: scaleX(-1); }
                @keyframes scanline {
                    0%   { top: 0; }
                    50%  { top: 100%; }
                    100% { top: 0; }
                }
                .animate-scanline {
                    position: absolute;
                    animation: scanline 2.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default FaceAttendanceScanner;
