import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';


const Welcome = ({ onComplete }) => {
    const { user, loading } = useAuth();
    const [schoolName, setSchoolName] = useState(() => {
        const stored = localStorage.getItem('school_config');
        if (stored) {
            try {
                const conf = JSON.parse(stored);
                return conf.school_name || 'Connect to Campus';
            } catch (e) {}
        }
        return 'Connect to Campus';
    });
    const navigate = useNavigate();
    const hasNavigated = React.useRef(false);

    const handleComplete = () => {
        if (hasNavigated.current) return;
        hasNavigated.current = true;

        // Skip if already logged in and navigating to login
        if (user && !onComplete) {
            switch (user.role) {
                case 'SUPER_ADMIN': navigate('/super-admin', { replace: true }); return;
                case 'SCHOOL_ADMIN': navigate('/school-admin', { replace: true }); return;
                case 'TEACHER': navigate('/teacher', { replace: true }); return;
                case 'STUDENT': navigate('/student', { replace: true }); return;
                case 'STAFF':
                case 'DRIVER': navigate('/staff', { replace: true }); return;
                default: navigate('/login', { replace: true }); return;
            }
        }

        // Mark welcome as shown in permanent storage (Survives app restart)
        if (Capacitor.isNativePlatform()) {
            Preferences.set({ key: 'welcome_shown', value: 'true' });
        } else {
            localStorage.setItem('welcome_shown', 'true');
        }

        if (onComplete) {
            onComplete();
        } else {
            navigate('/login', { replace: true });
        }
    };

    useEffect(() => {
        if (loading) return;

        // Skip for Native App (per user request: "flights/buses only in web")
        if (user || Capacitor.isNativePlatform()) {
            handleComplete();
            return;
        }

        // Navigation after 5.5 seconds (Matches 5s Animation)
        const timeout = setTimeout(handleComplete, 5500);


        return () => clearTimeout(timeout);
    }, [loading, user, onComplete, navigate]);

    return (
        <div className="relative w-full h-[100dvh] bg-sky-300 overflow-hidden flex flex-col justify-between">
            {/* Sky Elements - Clouds */}
            <div className="absolute top-10 left-0 w-full h-full pointer-events-none">
                <Cloud size={64} className="text-white opacity-80 absolute top-20 animate-fly-right-slow" style={{ animationDuration: '25s' }} />
                <Cloud size={96} className="text-white opacity-60 absolute top-40 animate-fly-right-slow" style={{ animationDelay: '2s', animationDuration: '30s' }} />
                <Cloud size={120} className="text-white opacity-40 absolute top-60 animate-fly-right-slow" style={{ animationDelay: '1s', animationDuration: '35s' }} />
            </div>

            {/* Blue/White Modern Aeroplanes - Flying in Sequence */}
            <div className="absolute top-2 w-full h-full pointer-events-none z-20">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="absolute right-[-800px] animate-fly-big-plane"
                        style={{
                            animationDuration: '15s',
                            animationDelay: `${i * 3}s`,
                            top: `${i * 30}px` // Slight vertical offset for each
                        }}
                    >
                        <div className="relative transform scale-40 md:scale-50 drop-shadow-2xl">
                            <svg width="800" height="300" viewBox="0 0 800 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                                {/* Right Wing (Back) */}
                                <path d="M480 160 L580 140 L520 160 Z" fill="#cbd5e1" />
                                {/* Fuselage */}
                                <path d="M50 180 C20 180 0 170 0 150 C0 130 30 110 80 110 L650 110 L780 40 L800 40 L760 150 C760 170 730 180 700 180 L50 180 Z" fill="white" stroke="#e2e8f0" strokeWidth="2" />
                                {/* Tail Fin Designs */}
                                <path d="M500 180 L650 180 C680 180 700 175 720 150 L770 50 L800 50 L760 155 C750 170 740 180 700 180 H500 Z" fill="#1e3a8a" />
                                <path d="M720 150 L750 90 L770 50 L720 150 Z" fill="#38bdf8" opacity="0.8" />
                                {/* Underbelly Swoosh */}
                                <path d="M100 180 Q250 180 400 180 L600 180 L500 150 Q200 160 80 180 H100 Z" fill="#1e3a8a" opacity="0.9" />
                                {/* Left Wing (Front) */}
                                <path d="M380 165 L280 240 L450 180 Z" fill="white" stroke="#cbd5e1" />
                                <path d="M280 240 L300 230 L320 220 Z" fill="#1e3a8a" />
                                {/* Engine */}
                                <path d="M340 185 C340 195 350 205 390 205 L420 205 C430 205 440 195 440 185 H340 Z" fill="#cbd5e1" />
                                <path d="M340 185 C340 205 345 205 350 205 V185 H340 Z" fill="#334155" />
                                {/* Text */}
                                <text x="20" y="155" fontFamily="'Pacifico', cursive" fontSize="35" fill="#1e3a8a">{schoolName}</text>
                            </svg>
                        </div>
                    </div>
                ))}
            </div>

            {/* Central Text */}
            <div className="relative z-10 flex-1 flex items-center justify-center pb-32">
                <div className="text-center animate-fade-in-up">
                    <h1 className="text-4xl md:text-6xl lg:text-8xl font-cursive text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.3)] tracking-wide px-4">
                        {schoolName}
                    </h1>
                </div>
            </div>


            {/* Bottom Scene */}
            <div className="absolute bottom-0 w-full z-20">

                {/* Traffic Signal - Moved to RIGHT end, facing Left - Behind Bus */}
                <div className="absolute bottom-[40px] right-[5%] z-0 flex flex-col items-center transform scale-50 md:scale-100 origin-bottom-right">
                    <div className="absolute bottom-20 right-0 w-4 h-64 bg-slate-700"></div>
                    <div className="absolute bottom-80 right-0 w-32 h-4 bg-slate-700 rounded-l-lg"></div>
                    <div className="absolute bottom-[280px] right-[100px] w-16 h-40 bg-slate-900 rounded-lg border-4 border-slate-800 shadow-2xl flex flex-col items-center justify-around py-2">
                        <div className="w-10 h-10 bg-red-600 rounded-full shadow-inner" style={{ animation: 'signal-red 5s forwards' }}>
                            <div className="w-full h-full rounded-full animate-ping opacity-20"></div>
                        </div>
                        <div className="w-10 h-10 bg-yellow-600 rounded-full opacity-30"></div>
                        <div className="w-10 h-10 bg-green-600 rounded-full shadow-inner" style={{ animation: 'signal-green 5s forwards' }}></div>
                    </div>
                </div>

                {/* Road */}
                <div className="w-full h-32 bg-slate-800 border-t-8 border-slate-600 flex items-center justify-center relative z-10">
                    <div className="w-full h-0 border-t-4 border-dashed border-yellow-400 opacity-60"></div>

                    {/* Yellow School Bus */}
                    <div className="absolute bottom-4 animate-drive-bus-sequence" style={{ animationDuration: '5s' }}>
                        <div className="relative w-[400px] h-48 transform scale-[0.45] sm:scale-75 md:scale-100 origin-bottom">
                            {/* Body - Classic Yellow */}
                            <div className="w-full h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-[2rem] shadow-2xl relative overflow-hidden border-b-8 border-yellow-600">
                                {/* Top Black Stripe / Roof Line */}
                                <div className="absolute top-0 w-full h-20 bg-yellow-300 border-b-8 border-black flex items-center justify-around px-8">
                                    {/* Windows */}
                                    <div className="w-full h-12 bg-sky-200 rounded-lg flex items-center justify-between px-4 border-2 border-black/20 overflow-hidden relative">
                                        <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20"></div>
                                        {/* Passengers */}
                                        <div className="flex gap-10">
                                            <div className="w-8 h-8 bg-slate-800 rounded-full animate-bounce-slight"></div>
                                            <div className="w-8 h-8 bg-slate-800 rounded-full animate-bounce-slight" style={{ animationDelay: '0.3s' }}></div>
                                            <div className="w-8 h-8 bg-slate-800 rounded-full animate-bounce-slight" style={{ animationDelay: '0.5s' }}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Side Panel Text */}
                                <div className="absolute bottom-16 w-full text-center">
                                    <h2 className="text-3xl font-cursive text-slate-900 drop-shadow-sm tracking-wider">
                                        {schoolName}
                                    </h2>
                                </div>

                                {/* Side Structural Checkers/Stripes */}
                                <div className="absolute bottom-10 w-full h-4 bg-black flex items-center justify-between px-2"></div>
                                <div className="absolute bottom-4 w-full h-2 bg-black opacity-20"></div>
                            </div>

                            {/* Wheels */}
                            <div className="absolute -bottom-6 left-12 w-20 h-20 bg-black rounded-full border-[6px] border-slate-600 shadow-xl flex items-center justify-center animate-spin-slow">
                                <div className="w-12 h-12 bg-slate-700 rounded-full border-4 border-slate-500"></div>
                            </div>
                            <div className="absolute -bottom-6 right-12 w-20 h-20 bg-black rounded-full border-[6px] border-slate-600 shadow-xl flex items-center justify-center animate-spin-slow">
                                <div className="w-12 h-12 bg-slate-700 rounded-full border-4 border-slate-500"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Version Check - Removed for Final Release */}
        </div>
    );
};

export default Welcome;
