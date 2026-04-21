import React from 'react';
import { RefreshCw, AlertTriangle, WifiOff } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Critical UI Crash:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            const isNetworkError = this.state.error?.toString().toLowerCase().includes('network') ||
                this.state.error?.toString().toLowerCase().includes('timeout');

            return (
                <div className="min-h-screen flex items-center justify-center bg-indigo-50 p-6 z-[9999] relative font-sans">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border-t-8 border-indigo-500">
                        <div className="flex justify-center mb-6">
                            <div className="bg-indigo-100 p-5 rounded-full animate-pulse">
                                {isNetworkError ? (
                                    <WifiOff size={48} className="text-indigo-600" />
                                ) : (
                                    <AlertTriangle size={48} className="text-indigo-600" />
                                )}
                            </div>
                        </div>

                        <h1 className="text-2xl font-black text-slate-800 mb-3 uppercase tracking-tight">
                            {isNetworkError ? 'Connection Issue' : 'App Glitch Detected'}
                        </h1>
                        <p className="text-slate-500 mb-8 text-sm leading-relaxed px-4">
                            {isNetworkError
                                ? "The app couldn't reach the server. This usually happens on slow internet or initial startup."
                                : "A temporary issue stopped the app. Clicking reload usually fixes this."}
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    this.setState({ hasError: false });
                                    window.location.reload();
                                }}
                                className="w-full bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={20} />
                                REFRESH & CONTINUE
                            </button>

                            <button
                                onClick={() => {
                                    localStorage.clear();
                                    sessionStorage.clear();
                                    window.location.href = '/'; // Go to root, not /login
                                }}
                                className="w-full bg-slate-100 text-slate-600 px-6 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all text-sm"
                            >
                                RESET APP DATA
                            </button>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 italic text-[10px] text-slate-400 font-mono break-all opacity-50">
                            {this.state.error?.toString()}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
