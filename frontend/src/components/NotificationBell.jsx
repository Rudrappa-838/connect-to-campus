import React, { useState } from 'react';
import { Bell, Check, X, FileText, Image as ImageIcon } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { Browser } from '@capacitor/browser';
import api from '../api/axios';

const NotificationBell = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const navigate = useNavigate();

    const toggleDropdown = () => setIsOpen(!isOpen);

    const handleMarkRead = (e, id) => {
        e.stopPropagation();
        markAsRead(id);
    };

    const handleNotificationClick = (notification) => {
        setSelectedNotification(notification);
        setIsOpen(false);
        if (!notification.is_read) {
            markAsRead(notification.id);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={toggleDropdown}
                className={`relative p-2 transition-all rounded-full group ${unreadCount > 0
                    ? 'text-red-600 bg-red-50 hover:bg-red-100 ring-4 ring-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                    }`}
            >
                <Bell size={24} className={`${unreadCount > 0 ? 'animate-bell-shake' : ''}`} />
                {unreadCount > 0 && (
                    <>
                        {/* Rotating Outer Ring */}
                        <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full border-2 border-red-500 border-t-transparent animate-spin z-20"></div>

                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white z-30 shadow-lg active:scale-95 transition-transform">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>

                        {/* Multi-layered Pulsing Radar */}
                        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40 scale-125"></span>
                        <span className="absolute inset-0 rounded-full bg-red-400 animate-pulse opacity-20 scale-150"></span>
                    </>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl overflow-hidden z-50 border border-gray-100 animate-fade-in-down">
                    <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-700">Notifications</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => {
                                        markAllAsRead();
                                        setIsOpen(false);
                                    }}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    Mark all read
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                                <p className="text-sm">No notifications</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {notifications.map((notification) => (
                                    <li
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!notification.is_read ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <p className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {notification.message}
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-2">
                                                    {new Date(notification.created_at).toLocaleDateString('en-GB', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                            {!notification.is_read && (
                                                <button
                                                    onClick={(e) => handleMarkRead(e, notification.id)}
                                                    className="ml-2 text-indigo-400 hover:text-indigo-600 p-1"
                                                    title="Mark as read"
                                                >
                                                    <Check size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* Backdrop to close when clicking outside */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Full-Screen Notification Details Modal */}
            {selectedNotification && (
                <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                <Bell size={20} className="text-indigo-600" />
                                Notification Details
                            </h3>
                            <button
                                onClick={() => setSelectedNotification(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <h2 className="text-xl font-bold text-slate-800 mb-2">
                                {selectedNotification.title}
                            </h2>
                            <p className="text-xs text-slate-400 mb-6 pb-4 border-b border-slate-100">
                                {new Date(selectedNotification.created_at).toLocaleDateString('en-GB', {
                                    day: '2-digit', month: '2-digit', year: '2-digit', 
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </p>
                            
                            <div className="text-slate-600 leading-relaxed whitespace-pre-wrap text-base mb-8">
                                {selectedNotification.message}
                            </div>

                            {selectedNotification.attachment_url && (
                                <div className="mt-4 pt-6 border-t border-slate-100">
                                    <button
                                        onClick={async () => {
                                            const url = `${api.defaults.baseURL}${selectedNotification.attachment_url}`;
                                            try {
                                                await Browser.open({ url });
                                            } catch (e) {
                                                window.open(url, '_blank', 'noreferrer');
                                            }
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 font-semibold hover:bg-indigo-100 transition-all"
                                    >
                                        {(selectedNotification.attachment_type || '').includes('pdf') ? <FileText size={18} /> : <ImageIcon size={18} />}
                                        View Attachment
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setSelectedNotification(null)}
                                className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
