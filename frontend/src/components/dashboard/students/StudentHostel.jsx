import React, { useState, useEffect } from 'react';
import { Home, DollarSign, Calendar, AlertCircle, FileText } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const StudentHostel = () => {
    const [hostelData, setHostelData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHostelData = async () => {
            try {
                const res = await api.get('/hostel/my-details');
                setHostelData(res.data);
            } catch (error) {
                // if 404, it might mean not allocated
                if (error.response && error.response.status === 404) {
                    setHostelData(null);
                } else {
                    console.error("Failed to fetch hostel details", error);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchHostelData();
    }, []);

    if (loading) return <div className="p-4">Loading hostel details...</div>;

    if (!hostelData || !hostelData.is_allocated) {
        return (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-200">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Home className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Not Allocated</h3>
                <p className="text-slate-500 mt-2">You are not currently allocated to any hostel room.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Room Details Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Home className="text-indigo-600" /> My Room
                        </h3>
                        <p className="text-slate-500 mt-1">{hostelData.hostel_name}</p>
                    </div>
                    <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold">
                        Active
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Room Number</p>
                        <p className="text-2xl font-black text-slate-800">{hostelData.room_number}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Cost Per Term</p>
                        <p className="text-lg font-bold text-slate-800">₹{parseFloat(hostelData.cost_per_term).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Warden Contact</p>
                        <p className="text-lg font-bold text-slate-800">--</p>
                    </div>
                </div>
            </div>

            {/* Mess Bills & Payments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Bills */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-slate-500" /> Mess Bills
                    </h3>
                    <div className="space-y-3">
                        {hostelData.bills && hostelData.bills.length > 0 ? (
                            hostelData.bills.slice(0, 5).map(bill => (
                                <div key={bill.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                                    <div>
                                        <p className="font-bold text-slate-800">{bill.month} {bill.year}</p>
                                        <p className="text-xs text-slate-500">Mess Charges</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-slate-800">₹{parseFloat(bill.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${bill.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                                            bill.status === 'Partial' ? 'bg-amber-100 text-amber-700' :
                                                'bg-rose-100 text-rose-700'
                                            }`}>
                                            {bill.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-500 text-sm text-center py-4">No mess bills found.</p>
                        )}
                    </div>
                </div>

                {/* Recent Payments */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                        <DollarSign size={20} className="text-slate-500" /> Payment History
                    </h3>
                    <div className="space-y-3">
                        {hostelData.payments && hostelData.payments.length > 0 ? (
                            hostelData.payments.slice(0, 5).map(pay => (
                                <div key={pay.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                                    <div>
                                        <p className="font-bold text-slate-800">{pay.payment_type}</p>
                                        <p className="text-xs text-slate-500">{new Date(pay.payment_date).toLocaleDateString('en-GB')}</p>
                                    </div>
                                    <p className="font-bold text-emerald-600">+₹{parseFloat(pay.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-500 text-sm text-center py-4">No payments recorded.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentHostel;
