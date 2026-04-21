import React, { useState } from 'react';
import { Download, Monitor, CheckCircle, AlertTriangle } from 'lucide-react';

const DownloadDesktop = () => {
    const [accepted, setAccepted] = useState(false);

    // In a real scenario, this would point to the hosted .exe on your server or S3
    // For now, we'll point to a placeholder or the location where you'd upload it.
    const downloadUrl = "/downloads/ConnectToCampus-Setup.exe";

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-indigo-600 p-8 text-center">
                    <Monitor className="w-16 h-16 text-white mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-white mb-2">Desktop Application</h1>
                    <p className="text-indigo-100">For School Administrators & Staff</p>
                </div>

                <div className="p-8">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-amber-800">
                            <strong>System Requirements:</strong> Windows 10 or Windows 11. <br />
                            An active internet connection is required for initial setup.
                        </div>
                    </div>

                    <h3 className="font-bold text-lg mb-4 text-slate-800">Terms & Conditions</h3>
                    <div className="h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 text-sm text-slate-600">
                        <p className="mb-2"><strong>1. Usage Policy:</strong> This software is intended solely for authorized administrative use.</p>
                        <p className="mb-2"><strong>2. Data Security:</strong> You agree not to share your login credentials or leave the application running on public computers.</p>
                        <p className="mb-2"><strong>3. Automatic Updates:</strong> The application will automatically check for and install updates to ensure security and compatibility.</p>
                        <p className="mb-2"><strong>4. Liability:</strong> The software provider is not liable for data loss due to hardware failure or misuse.</p>
                        <p>By downloading, you agree to abide by the school's digital usage guidelines.</p>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors mb-8 select-none">
                        <input
                            type="checkbox"
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                        />
                        <span className="font-medium text-slate-700">I have read and accept the Terms & Conditions</span>
                    </label>

                    <a
                        href={accepted ? downloadUrl : '#'}
                        onClick={(e) => !accepted && e.preventDefault()}
                        className={`block w-full text-center py-4 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2 ${accepted
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:translate-y-[-2px]'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <Download className="w-6 h-6" />
                        Download for Windows (64-bit)
                    </a>

                    {!accepted && (
                        <p className="text-center text-xs text-slate-400 mt-4">
                            Please accept the terms to unlock the download.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DownloadDesktop;
