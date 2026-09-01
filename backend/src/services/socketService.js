/**
 * socketService.js
 * Central WebSocket (Socket.IO) service for real-time GPS push.
 * 
 * Pattern:
 *   - Server starts Socket.IO attached to HTTP server
 *   - Each school gets its own room: "school:{schoolId}"
 *   - When GPS data arrives (any source), we call broadcastLocation()
 *   - All clients in that school room instantly receive the update
 */

let io = null;

/**
 * Initialize Socket.IO with the HTTP server.
 * Called once from server.js
 */
const initSocket = (httpServer) => {
    const { Server } = require('socket.io');

    const allowedOrigins = process.env.NODE_ENV === 'production'
        ? [
            'https://connect2campus.co.in',
            'https://www.connect2campus.co.in',
            'https://connect-to-campus-b56ac.web.app',
            'capacitor://localhost',
            'http://localhost',
            'https://localhost',
            process.env.FRONTEND_URL,
        ].filter(Boolean)
        : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'capacitor://localhost', 'http://localhost'];

    io = new Server(httpServer, {
        cors: {
            origin: allowedOrigins,
            methods: ['GET', 'POST'],
            credentials: true,
        },
        // Tuned for low-latency GPS tracking
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'], // prefer WebSocket
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.id}`);

        // Client joins a school-specific room for scoped broadcasts
        socket.on('join:school', (schoolId) => {
            if (!schoolId) return;
            const room = `school:${schoolId}`;
            socket.join(room);
            console.log(`📡 Socket ${socket.id} joined room: ${room}`);
            socket.emit('joined', { room, message: 'GPS tracking live' });
        });

        socket.on('disconnect', (reason) => {
            console.log(`🔌 Socket disconnected: ${socket.id} — ${reason}`);
        });
    });

    console.log('✅ Socket.IO initialized for real-time GPS tracking');
    return io;
};

/**
 * Broadcast a vehicle location update to all clients in a school room.
 * Called by transportController after any GPS update (hardware or mobile).
 * 
 * @param {number|string} schoolId - The school ID
 * @param {object} vehicleData - { id, vehicle_number, driver_name, current_lat, current_lng, speed, status, last_updated }
 */
const broadcastLocation = (schoolId, vehicleData) => {
    if (!io) return; // Socket not initialized yet (shouldn't happen)
    if (!schoolId || !vehicleData) return;

    const room = `school:${schoolId}`;
    io.to(room).emit('vehicle:location', {
        vehicleId: vehicleData.id,
        vehicleNumber: vehicleData.vehicle_number,
        driverName: vehicleData.driver_name,
        driverPhone: vehicleData.driver_phone,
        routeName: vehicleData.current_route_name || vehicleData.route_name || null,
        routeId: vehicleData.current_route_id || vehicleData.route_id || null,
        lat: parseFloat(vehicleData.current_lat),
        lng: parseFloat(vehicleData.current_lng),
        speed: parseFloat(vehicleData.speed || 0).toFixed(1),
        heading: parseFloat(vehicleData.heading || 0),
        status: vehicleData.status,
        lastUpdated: vehicleData.last_updated || new Date(),
        source: vehicleData._source || 'mobile', // 'gps' | 'mobile' | 'hardware'
    });
};

/**
 * Get the io instance (for use in other services if needed)
 */
const getIO = () => io;

module.exports = { initSocket, broadcastLocation, getIO };
