import React, { useState, useEffect, useRef } from 'react';
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

/**
 * ExcelMarksManager
 * Provides: Download Excel template per class+section and Re-upload filled template to save marks.
 * 
 * Props:
 *   examTypeId: currently selected exam type id (string/number)
 */
const ExcelMarksManager = ({ examTypeId }) => {
    const [combos, setCombos] = useState([]);
    const [loadingCombos, setLoadingCombos] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [uploadResult, setUploadResult] = useState(null); // { savedCount, skippedCount, errors }
    const [uploading, setUploading] = useState(false);
    const [activeUpload, setActiveUpload] = useState(null); // { class_id, section_id, class_name, section_name }
    const [includeSats, setIncludeSats] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (examTypeId && isOpen) {
            fetchCombos();
        }
    }, [examTypeId, isOpen]);

    const fetchCombos = async () => {
        setLoadingCombos(true);
        try {
            const res = await api.get('/marks/excel/combos', { params: { exam_type_id: examTypeId } });
            setCombos(res.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load class combinations');
        } finally {
            setLoadingCombos(false);
        }
    };

    const handleDownload = async (combo) => {
        const toastId = toast.loading(`Generating template for ${combo.class_name}${combo.section_name ? ` - ${combo.section_name}` : ''}...`);
        try {
            const response = await api.get('/marks/excel/template', {
                params: {
                    exam_type_id: examTypeId,
                    class_id: combo.class_id,
                    section_id: combo.section_id || '',
                    include_sats: includeSats
                },
                responseType: 'blob'
            });

            // Extract filename from content-disposition header
            const disposition = response.headers['content-disposition'];
            let filename = `Marks_${combo.class_name}${combo.section_name ? `_${combo.section_name}` : ''}.xlsx`;
            if (disposition && disposition.includes('filename=')) {
                filename = disposition.split('filename=')[1].replace(/"/g, '').trim();
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success(`Template downloaded: ${filename}`, { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Failed to download template', { id: toastId });
        }
    };

    const handleUploadClick = (combo) => {
        setActiveUpload(combo);
        setUploadResult(null);
        fileInputRef.current.value = '';
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.name.endsWith('.xlsx')) {
            toast.error('Only .xlsx files are supported');
            return;
        }

        setUploading(true);
        setUploadResult(null);
        const toastId = toast.loading('Importing marks from Excel...');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post('/marks/excel/upload', formData, {
                params: { exam_type_id: examTypeId }
            });

            setUploadResult(res.data);
            if (res.data.savedCount > 0) {
                toast.success(`✅ ${res.data.savedCount} marks imported successfully!`, { id: toastId, duration: 5000 });
            } else {
                toast.error('No marks were imported. Check the errors below.', { id: toastId });
            }
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || 'Upload failed';
            toast.error(msg, { id: toastId });
        } finally {
            setUploading(false);
        }
    };

    if (!examTypeId) return null;

    return (
        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
            {/* Header Toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-emerald-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <FileSpreadsheet className="text-emerald-600 w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Excel Bulk Marks Entry</h3>
                        <p className="text-xs text-slate-500">Download templates per class/section → fill marks → upload back</p>
                    </div>
                </div>
                {isOpen ? <ChevronUp className="text-slate-400 w-5 h-5" /> : <ChevronDown className="text-slate-400 w-5 h-5" />}
            </button>

            {isOpen && (
                <div className="border-t border-emerald-100">
                    {loadingCombos ? (
                        <div className="p-6 text-center">
                            <Loader2 className="animate-spin w-6 h-6 text-emerald-500 mx-auto mb-2" />
                            <p className="text-sm text-slate-400">Loading class combinations...</p>
                        </div>
                    ) : combos.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-sm">
                            No exam schedule found. Please save an exam schedule first.
                        </div>
                    ) : (
                        <div className="p-4 space-y-3">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-slate-100">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                    Download template, fill marks offline, then upload:
                                </p>
                                <label className="flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all group">
                                    <input
                                        type="checkbox"
                                        checked={includeSats}
                                        onChange={(e) => setIncludeSats(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Include SATS Number</span>
                                </label>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                {combos.map((combo, idx) => {
                                    const label = `${combo.class_name}${combo.section_name ? ` — ${combo.section_name}` : ''}`;
                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all"
                                        >
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{label}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {combo.subjects.length} subjects · {combo.exam_type_name}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleDownload(combo)}
                                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all"
                                                    title="Download Template"
                                                >
                                                    <Download size={14} /> Template
                                                </button>
                                                <button
                                                    onClick={() => handleUploadClick(combo)}
                                                    disabled={uploading}
                                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all"
                                                    title="Upload Filled Template"
                                                >
                                                    {uploading && activeUpload?.class_id === combo.class_id
                                                        ? <Loader2 size={14} className="animate-spin" />
                                                        : <Upload size={14} />}
                                                    Upload
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Upload Result */}
                            {uploadResult && (
                                <div className={`mt-4 p-4 rounded-xl border ${uploadResult.savedCount > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        {uploadResult.savedCount > 0
                                            ? <CheckCircle className="text-emerald-600 w-5 h-5" />
                                            : <AlertCircle className="text-amber-600 w-5 h-5" />}
                                        <p className="font-bold text-sm text-slate-800">
                                            Import Result: {uploadResult.savedCount} saved · {uploadResult.skippedCount} skipped
                                        </p>
                                        <button onClick={() => setUploadResult(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                                            <X size={16} />
                                        </button>
                                    </div>
                                    {uploadResult.errors && uploadResult.errors.length > 0 && (
                                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                                            {uploadResult.errors.map((e, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 p-2 rounded">
                                                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                                    <span>Row {e.row} · {e.student} · {e.error}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileChange}
            />
        </div>
    );
};

export default ExcelMarksManager;
