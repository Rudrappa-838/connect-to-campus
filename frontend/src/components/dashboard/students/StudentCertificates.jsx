import React, { useState, useRef, useEffect } from 'react';
import { FileText, Download, Printer, Award, Shield, AlertCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import api from '../../../api/axios';

const CertificateTemplate = React.forwardRef(({ type, student, schoolName, details }, ref) => {
    const date = details?.issue_date ? new Date(details.issue_date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

    return (
        <div ref={ref} className="p-10 bg-white text-slate-900 font-serif relative overflow-hidden" style={{ minHeight: '800px', width: '100%' }}>
            {/* Border */}
            <div className="absolute inset-4 border-4 border-double border-slate-800 pointer-events-none"></div>
            <div className="absolute inset-6 border border-slate-300 pointer-events-none"></div>

            {/* Header */}
            <div className="text-center mt-8 mb-12">
                <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-slate-800">
                    <Shield size={40} className="text-slate-800" />
                </div>
                <h1 className="text-4xl font-black uppercase tracking-widest text-slate-800 mb-2">{schoolName || 'High School Name'}</h1>
                <p className="text-sm text-slate-500 font-sans tracking-widest uppercase">Excellence in Education</p>
                <div className="w-32 h-1 bg-slate-800 mx-auto mt-6"></div>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold text-center mb-12 italic text-indigo-900 border-b-2 border-indigo-100 inline-block pb-2 px-8 mx-auto table">
                {type} Certificate
            </h2>

            {/* Content */}
            <div className="px-12 text-lg leading-loose text-justify text-slate-700">
                <p className="mb-6 indent-8">
                    This is to certify that <strong>{student?.name || '[Student Name]'}</strong>,
                    son/daughter of <strong>{student?.parent_name || '[Parent Name]'}</strong>,
                    bearing Admission Number <strong>{student?.admission_no || '[ID]'}</strong>,
                    is a bona fide student of this institution.
                </p>

                <p className="mb-6 indent-8">
                    He/She is currently studying in <strong>Class {student?.class_name || '...'}{student?.section_name ? ` - ${student.section_name}` : ''}</strong>
                    during the academic year <strong>{new Date().getFullYear()}</strong>.
                </p>

                {type === 'Character' && (
                    <p className="mb-6 indent-8">
                        To the best of my knowledge, he/she bears a good moral character and has shown exemplary conduct during his/her tenure at this school.
                    </p>
                )}

                {type === 'Transfer' && (
                    <p className="mb-6 indent-8">
                        This certificate is issued regarding his/her request for transfer. We wish him/her all the best for future endeavors.
                    </p>
                )}

                {details?.remarks && (
                    <p className="mb-6 indent-8 text-sm italic text-slate-500">
                        Remarks: {details.remarks}
                    </p>
                )}

                <p className="mb-12">
                    This certificate is issued upon the request of the student/parent for <strong>{type === 'Bonafide' ? 'general' : 'official'}</strong> purposes.
                </p>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-end px-12 mt-20">
                <div className="text-center">
                    <p className="font-bold mb-16">{date}</p>
                    <div className="w-32 border-t border-slate-400"></div>
                    <p className="text-sm font-sans uppercase font-bold text-slate-500 mt-2">Date Issue</p>
                </div>

                <div className="text-center">
                    <div className="w-24 h-24 mb-4 mx-auto opacity-20 transform rotate-12">
                        <Award size={96} />
                    </div>
                </div>

                <div className="text-center">
                    <div className="h-16 mb-0"></div> {/* Space for Signature */}
                    <div className="w-48 border-t border-slate-800"></div>
                    <p className="font-bold text-slate-800 mt-2 uppercase">Principal Signature</p>
                    <p className="text-xs text-slate-400 font-sans">(with School Seal)</p>
                </div>
            </div>

            {/* Cert No */}
            <div className="absolute bottom-6 left-10 text-xs font-mono text-slate-400">
                Cert No: {details?.certificate_no || 'Pending'}
            </div>
        </div>
    );
});

const StudentCertificates = ({ student, schoolName }) => {
    const [certificates, setCertificates] = useState([]);
    const [selectedCert, setSelectedCert] = useState(null); // Full cert object
    const [loading, setLoading] = useState(true);
    const componentRef = useRef();

    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
    });

    useEffect(() => {
        const fetchCertificates = async () => {
            try {
                const res = await api.get('/certificates/my-certificates');
                setCertificates(res.data);
            } catch (error) {
                console.error("Failed to fetch certificates", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCertificates();
    }, []);

    const getIcon = (type) => {
        switch (type) {
            case 'Bonafide': return FileText;
            case 'Character': return UserIcon;
            case 'Transfer': return Download;
            default: return Award;
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading certificates...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Award className="text-indigo-600" /> My Certificates
                    </h3>
                    <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">{certificates.length} Issued</span>
                </div>

                {certificates.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="text-slate-400" size={32} />
                        </div>
                        <h4 className="font-bold text-slate-600">No Certificates Issued Yet</h4>
                        <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
                            Certificates generated by the school administration will appear here automatically.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {certificates.map((cert) => {
                            const Icon = getIcon(cert.certificate_type);
                            return (
                                <div key={cert.id} className="border border-slate-100 rounded-xl p-5 hover:border-indigo-200 hover:shadow-md transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Icon size={80} className="text-indigo-600" />
                                    </div>
                                    <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center mb-4 text-indigo-600 relative z-10">
                                        <Icon size={24} />
                                    </div>
                                    <h4 className="font-bold text-slate-800 mb-1 relative z-10">{cert.certificate_type} Certificate</h4>
                                    <p className="text-xs text-slate-500 mb-4 relative z-10">Issued: {new Date(cert.issue_date).toLocaleDateString('en-GB')}</p>

                                    <button
                                        onClick={() => setSelectedCert(cert)}
                                        className="w-full py-2 bg-slate-800 text-white font-bold rounded-lg text-sm hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 relative z-10"
                                    >
                                        <FileText size={16} /> View & Print
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {selectedCert && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">Preview: {selectedCert.certificate_type} Certificate</h3>
                            <div className="flex gap-3">
                                <button
                                    onClick={handlePrint}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 flex items-center gap-2"
                                >
                                    <Printer size={16} /> Print / Save PDF
                                </button>
                                <button
                                    onClick={() => setSelectedCert(null)}
                                    className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-50"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-8 bg-slate-200 flex justify-center">
                            <div className="bg-white shadow-lg mx-auto transform scale-90 origin-top">
                                <CertificateTemplate
                                    ref={componentRef}
                                    type={selectedCert.certificate_type}
                                    student={student}
                                    schoolName={schoolName}
                                    details={selectedCert}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden render for print */}
            <div style={{ display: 'none' }}>
                <CertificateTemplate
                    ref={componentRef}
                    type={selectedCert?.certificate_type || ''}
                    student={student}
                    schoolName={schoolName}
                    details={selectedCert}
                />
            </div>
        </div>
    );
};

// Helper icon
const UserIcon = (props) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24" height="24" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        {...props}
    >
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
)

export default StudentCertificates;
