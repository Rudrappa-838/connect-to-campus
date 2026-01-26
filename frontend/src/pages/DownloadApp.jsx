import { useNavigate } from 'react-router-dom';
import { Download, Smartphone, CheckCircle2, Shield, Zap, ArrowLeft } from 'lucide-react';
import loginBg from '../assets/login-bg.jpg';

const DownloadApp = () => {
    const navigate = useNavigate();

    const isProduction = import.meta.env.VITE_APP_ENV === 'production';

    // Dynamic Download URL Logic
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Local gets the NetworkFix (Test) APK, Production gets the official SchoolApp.apk
    const downloadUrl = isLocal ? '/SchoolApp_NetworkFix.apk' : '/SchoolApp.apk';
    const downloadFilename = isLocal ? 'SchoolApp_NetworkFix.apk' : 'SchoolApp.apk';
    const buttonText = isLocal ? 'Download Test APK (Debug)' : 'Download Official App';


    return (
        <div className="relative min-h-screen w-full overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 w-full h-full z-0">
                <img
                    src={loginBg}
                    alt="Background"
                    className="w-full h-full object-cover animate-ken-burns"
                />
                <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px]"></div>
            </div>

            {/* Floating Shapes */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#00C9FC]/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

            {/* Content */}
            <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
                <div className="w-full max-w-4xl">
                    {/* Main Card */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 md:p-12 animate-fade-in-up">

                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 mb-4 shadow-lg shadow-yellow-400/30">
                                <Smartphone size={40} className="text-black" />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-cursive text-white mb-3 drop-shadow-lg">
                                {!isLocal ? 'Get the App' : 'Download Test App'}
                            </h1>
                            <p className="text-gray-300 text-lg">
                                Complete School Management System
                            </p>
                            <div className="inline-block mt-4 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full">
                                <p className="text-green-300 text-sm font-bold">
                                    {!isLocal ? 'v1.0 - Official Release' : 'v9.0 - Development Build'}
                                </p>
                            </div>
                        </div>

                        {/* Features Grid */}
                        <div className="grid md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-all">
                                <CheckCircle2 className="mx-auto mb-3 text-green-400" size={32} />
                                <h3 className="text-white font-bold mb-2">All Features</h3>
                                <p className="text-gray-400 text-sm">Attendance, Fees, Exams, Library & More</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-all">
                                <Shield className="mx-auto mb-3 text-blue-400" size={32} />
                                <h3 className="text-white font-bold mb-2">Secure</h3>
                                <p className="text-gray-400 text-sm">Your data is protected with encryption</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-all">
                                <Zap className="mx-auto mb-3 text-yellow-400" size={32} />
                                <h3 className="text-white font-bold mb-2">Fast & Easy</h3>
                                <p className="text-gray-400 text-sm">Simple interface, instant access</p>
                            </div>
                        </div>

                        {/* Download Button */}
                        <div className="text-center mb-8 flex flex-col items-center gap-4">
                            {/* Force APK Download for now until Play Store launch */}
                            <a
                                href={`${downloadUrl}?v=${new Date().getTime()}`}
                                download={downloadFilename}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-black font-bold rounded-xl shadow-lg shadow-yellow-400/30 transform transition-all hover:scale-105 text-lg"
                            >
                                <Download size={24} />
                                {buttonText}
                            </a>

                            <button
                                onClick={() => navigate('/')}
                                className="inline-flex items-center gap-2 px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-all text-sm border border-white/10 mt-2"
                            >
                                <ArrowLeft size={16} />
                                Back to Home
                            </button>
                        </div>

                        {/* Installation Instructions */}
                        {!isProduction && (
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6">
                                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                    <Shield size={20} className="text-blue-400" />
                                    Installation Instructions
                                </h3>
                                <ol className="text-gray-300 space-y-2 text-sm">
                                    <li className="flex gap-2">
                                        <span className="text-yellow-400 font-bold">1.</span>
                                        <span>Download the APK file to your Android device</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-yellow-400 font-bold">2.</span>
                                        <span>Go to Settings → Security → Enable "Install from Unknown Sources"</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-yellow-400 font-bold">3.</span>
                                        <span>Open the downloaded APK file and tap "Install"</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-yellow-400 font-bold">4.</span>
                                        <span>Open the app and login with your credentials</span>
                                    </li>
                                </ol>
                            </div>
                        )}

                        {/* Note */}
                        <div className="mt-6 text-center">
                            <p className="text-gray-400 text-xs">
                                {isProduction ? '' : 'Note: This is a test build for development purposes.'}
                            </p>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="text-center mt-6">
                        <p className="text-white/30 text-xs font-cursive tracking-widest">Connect to Campus {isProduction ? 'v1.0' : 'v9.0'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DownloadApp;
