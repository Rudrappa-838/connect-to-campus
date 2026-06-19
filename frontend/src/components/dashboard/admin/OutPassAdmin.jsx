import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../api/axios';
import { LogOut, LogIn, Clock, Users, RefreshCw, CalendarDays, AlertCircle } from 'lucide-react';

const OutPassAdmin = ({ defaultType = 'TEACHER' }) => {
    const [activeType, setActiveType] = useState(defaultType);
    const [passes, setPasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const fetchPasses = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/out-passes?type=${activeType}&date=${date}`);
            setPasses(res.data || []);
            setLastRefresh(new Date());
        } catch (error) {
            console.error('Failed to fetch out passes', error);
        } finally {
            setLoading(false);
        }
    }, [activeType, date]);

    useEffect(() => {
        fetchPasses();
        const interval = setInterval(fetchPasses, 60000); // auto refresh every min
        return () => clearInterval(interval);
    }, [fetchPasses]);

    const formatTime = (ts) => {
        if (!ts) return '--';
        return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const getDuration = (checkout, checkin) => {
        if (!checkout) return '--';
        const end = checkin ? new Date(checkin) : new Date();
        const start = new Date(checkout);
        const mins = Math.floor((end - start) / 60000);
        if (mins < 0) return '0 min';
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        const rem = mins % 60;
        return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
    };

    const currentlyOut = passes.filter(p => p.status === 'OUT');
    const returned = passes.filter(p => p.status === 'RETURNED');

    return (
        <div className="space-y-5">
            {/* Header Controls */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Type Tabs */}
                    <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                        {['TEACHER', 'STAFF'].map(type => (
                            <button
                                key={type}
                                onClick={() => setActiveType(type)}
                                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                                    activeType === type
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {type === 'TEACHER' ? '👩‍🏫 Teachers' : '👷 Staff'}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Date Picker */}
                        <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2">
                            <CalendarDays size={16} className="text-slate-400" />
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="text-sm font-medium text-slate-700 outline-none bg-transparent"
                            />
                        </div>

                        {/* Refresh */}
                        <button
                            onClick={fetchPasses}
                            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Last refresh info */}
                <p className="text-[11px] text-slate-400 mt-2 text-right">
                    Last updated: {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                    <span className="ml-2 text-slate-300">• Auto-refreshes every 60s</span>
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                        <AlertCircle size={22} className="text-amber-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-amber-700">{currentlyOut.length}</p>
                        <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Currently Outside</p>
                    </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Users size={22} className="text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-emerald-700">{returned.length}</p>
                        <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Returned Today</p>
                    </div>
                </div>
            </div>

            {/* Currently Out - highlighted section */}
            {currentlyOut.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
                        <AlertCircle size={16} className="text-amber-600" />
                        <h3 className="font-bold text-amber-800 text-sm">
                            Currently Outside ({currentlyOut.length})
                        </h3>
                        <span className="ml-auto flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            <span className="text-xs text-amber-600 font-bold">LIVE</span>
                        </span>
                    </div>
                    <div className="divide-y divide-amber-100">
                        {currentlyOut.map(p => (
                            <OutPassRow key={p.id} pass={p} formatTime={formatTime} getDuration={getDuration} isActive={true} />
                        ))}
                    </div>
                </div>
            )}

            {/* All Passes Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <LogOut size={16} className="text-slate-400" />
                    <h3 className="font-bold text-slate-700">
                        All Out Passes — {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </h3>
                    <span className="ml-auto text-xs text-slate-400 font-medium">{passes.length} total</span>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-slate-400 animate-pulse">Loading...</div>
                ) : passes.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                        <LogOut size={36} className="mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No out passes found for this date</p>
                    </div>
                ) : (
                    <>
                        {/* Table header */}
                        <div className="grid grid-cols-12 px-5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                            <div className="col-span-3">Name</div>
                            <div className="col-span-4">Reason</div>
                            <div className="col-span-2">Checkout</div>
                            <div className="col-span-2">Return</div>
                            <div className="col-span-1">Status</div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {passes.map(p => (
                                <OutPassRow key={p.id} pass={p} formatTime={formatTime} getDuration={getDuration} isActive={p.status === 'OUT'} showTable />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const OutPassRow = ({ pass, formatTime, getDuration, isActive, showTable }) => {
    if (showTable) {
        return (
            <div className={`grid grid-cols-12 px-5 py-3.5 items-center text-sm hover:bg-slate-50 transition-colors ${isActive ? 'bg-amber-50/50' : ''}`}>
                <div className="col-span-3 font-bold text-slate-800 truncate pr-2">{pass.person_name || 'Unknown'}</div>
                <div className="col-span-4 text-slate-600 truncate pr-2 text-xs">{pass.reason}</div>
                <div className="col-span-2 text-slate-500 text-xs">
                    <Clock size={11} className="inline mr-1" />
                    {formatTime(pass.checkout_time)}
                </div>
                <div className="col-span-2 text-slate-500 text-xs">
                    {pass.checkin_time ? (
                        <><LogIn size={11} className="inline mr-1" />{formatTime(pass.checkin_time)}</>
                    ) : (
                        <span className="text-amber-500 font-bold">Still Out</span>
                    )}
                    <span className="block text-slate-400 mt-0.5">{getDuration(pass.checkout_time, pass.checkin_time)}</span>
                </div>
                <div className="col-span-1">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                        isActive ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                        {isActive ? 'Out' : '✅'}
                    </span>
                </div>
            </div>
        );
    }

    // Card style (for "Currently Out" section)
    return (
        <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-900">{pass.person_name || 'Unknown'}</p>
                    <p className="text-sm text-amber-700 mt-0.5">{pass.reason}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-amber-600">
                        <span className="flex items-center gap-1">
                            <LogOut size={11} /> Left: {formatTime(pass.checkout_time)}
                        </span>
                        <span className="font-bold">⏱ {getDuration(pass.checkout_time, null)} outside</span>
                    </div>
                </div>
                <span className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    OUTSIDE
                </span>
            </div>
        </div>
    );
};

export default OutPassAdmin;
