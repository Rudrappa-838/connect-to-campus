const express = require('express');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const {
    getVehicles, addVehicle, updateVehicle, deleteVehicle,
    getRoutes, addRoute, updateRoute, deleteRoute, updateLocation, handleGpsWebhook, getMyRoute
} = require('../controllers/transportController');

const router = express.Router();

// =====================================================
// PUBLIC GPS WEBHOOK — No auth (hardware GPS devices can't send JWT)
// Accepts data from ANY GPS company:
//   POST /api/transport/gps/webhook        (preferred)
//   POST /api/transport/gps-webhook        (legacy alias)
//
// Configure your GPS device to POST to:
//   https://connect2campus.co.in/api/transport/gps/webhook
//
// Payload (any of these formats will auto-detect):
//   Traccar:   { device: { uniqueId }, position: { latitude, longitude, speed } }
//   Jimi:      { IMEI, lat, lng, speed }
//   Teltonika: { imei, gps: { lat, lng, speed } }
//   Generic:   { imei, lat, lng, speed }
// =====================================================
router.post('/gps/webhook', handleGpsWebhook);
router.post('/gps-webhook', handleGpsWebhook); // legacy alias

// GPS test endpoint — confirm device IMEI is registered
router.get('/gps/test/:imei', async (req, res) => {
    const { pool } = require('../config/db');
    const { imei } = req.params;
    try {
        const result = await pool.query(
            'SELECT id, vehicle_number, school_id FROM transport_vehicles WHERE gps_device_id = $1',
            [imei]
        );
        if (result.rows.length === 0) {
            return res.json({
                registered: false,
                message: `IMEI "${imei}" is NOT registered. Go to Transport → Vehicles → edit vehicle → GPS Device ID field.`,
            });
        }
        res.json({
            registered: true,
            vehicle: result.rows[0].vehicle_number,
            message: `IMEI "${imei}" is registered to vehicle ${result.rows[0].vehicle_number}. Webhook will work.`,
        });
    } catch (err) {
        res.status(500).json({ message: 'DB error', error: err.message });
    }
});

// =====================================================
// AUTHENTICATED ROUTES
// =====================================================
router.use(authenticateToken);

// Vehicle Management
router.get('/vehicles', authorize('SCHOOL_ADMIN', 'TRANSPORT_MANAGER', 'DRIVER', 'STUDENT', 'TEACHER', 'STAFF'), getVehicles);
router.post('/vehicles', authorize('SCHOOL_ADMIN'), addVehicle);
router.put('/vehicles/:id', authorize('SCHOOL_ADMIN', 'TRANSPORT_MANAGER'), updateVehicle);
router.delete('/vehicles/:id', authorize('SCHOOL_ADMIN'), deleteVehicle);

// Driver Mobile GPS Location Push
router.put('/vehicles/:id/location', authorize('SCHOOL_ADMIN', 'DRIVER', 'STAFF'), updateLocation);

// Route Management
router.get('/routes', authorize('SCHOOL_ADMIN', 'TRANSPORT_MANAGER', 'PARENT', 'STUDENT', 'TEACHER', 'STAFF', 'DRIVER'), getRoutes);
router.get('/my-route', authorize('STUDENT', 'DRIVER', 'PARENT', 'STAFF'), getMyRoute);
router.post('/routes', authorize('SCHOOL_ADMIN'), addRoute);
router.put('/routes/:id', authorize('SCHOOL_ADMIN'), updateRoute);
router.delete('/routes/:id', authorize('SCHOOL_ADMIN'), deleteRoute);

module.exports = router;
