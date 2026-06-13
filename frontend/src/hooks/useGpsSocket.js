/**
 * useGpsSocket.js
 * 
 * React hook for real-time GPS tracking via WebSocket.
 * 
 * Usage:
 *   const { vehicles, connected } = useGpsSocket(schoolId);
 * 
 * Returns a live-updating map of vehicleId → latest position data.
 * When a GPS update arrives from ANY source (hardware GPS or driver mobile),
 * the map updates instantly — no polling needed.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// Backend WebSocket URL — same server as API
const SOCKET_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : (import.meta.env.PROD
        ? 'https://connect2campus.co.in'
        : 'http://localhost:5000');

/**
 * @param {number|string} schoolId - Join this school's GPS room
 * @param {object} [initialVehicles=[]] - Initial vehicle list (from REST API, for first render)
 */
const useGpsSocket = (schoolId, initialVehicles = []) => {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [vehicleMap, setVehicleMap] = useState(() => {
        // Seed with initial data from REST
        const map = {};
        initialVehicles.forEach(v => { map[v.id] = v; });
        return map;
    });

    // Sync initial vehicles into map when they load
    useEffect(() => {
        if (initialVehicles && initialVehicles.length > 0) {
            setVehicleMap(prev => {
                const next = { ...prev };
                initialVehicles.forEach(v => {
                    // Only overwrite if we don't have a newer WebSocket update
                    if (!next[v.id]) next[v.id] = v;
                });
                return next;
            });
        }
    }, [initialVehicles]);

    useEffect(() => {
        if (!schoolId) return;

        // Connect to WebSocket server
        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            timeout: 10000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            console.log('🔌 GPS Socket connected:', socket.id);
            // Join school-specific room for scoped GPS updates
            socket.emit('join:school', schoolId);
        });

        socket.on('disconnect', (reason) => {
            setConnected(false);
            console.warn('🔌 GPS Socket disconnected:', reason);
        });

        socket.on('connect_error', (err) => {
            console.warn('🔌 GPS Socket connection error:', err.message);
        });

        // 🚀 Real-time GPS update from server
        // { vehicleId, vehicleNumber, driverName, lat, lng, speed, status, lastUpdated, source }
        socket.on('vehicle:location', (data) => {
            setVehicleMap(prev => ({
                ...prev,
                [data.vehicleId]: {
                    ...prev[data.vehicleId], // Keep existing data (route info etc.)
                    id: data.vehicleId,
                    vehicle_number: data.vehicleNumber,
                    driver_name: data.driverName,
                    current_lat: data.lat,
                    current_lng: data.lng,
                    speed: data.speed,
                    status: data.status,
                    last_updated: data.lastUpdated,
                    _source: data.source, // 'mobile' | 'hardware'
                    _isLive: true,
                },
            }));
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
            setConnected(false);
        };
    }, [schoolId]);

    // Convert map to array for easy use
    const vehicles = Object.values(vehicleMap);

    return { vehicles, vehicleMap, connected };
};

export default useGpsSocket;
