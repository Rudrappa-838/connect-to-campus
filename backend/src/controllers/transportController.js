const { pool } = require('../config/db');
const { broadcastLocation } = require('../services/socketService');

// =====================================================
// UNIVERSAL GPS PARSER
// Handles ANY GPS hardware company format automatically
// =====================================================
/**
 * Parses GPS data from ANY hardware vendor.
 * Returns normalized { imei, lat, lng, speed } or null if unrecognized.
 * 
 * Supported vendors (auto-detected, no config needed):
 *  - Traccar (open source GPS server)
 *  - Jimi / Concox GT06 / GT300 / JC100
 *  - Teltonika FMB / FM series
 *  - Meitrack T333 / T355
 *  - Syrotech / Ruptela
 *  - Queclink GV series
 *  - Coban TK103 / TK303
 *  - Suntech ST series
 *  - Any vendor using generic flat format (imei/device_id + lat/lng)
 */
const parseUniversalGPS = (body) => {
    // Safety check
    if (!body || typeof body !== 'object') return null;

    let imei = null, lat = null, lng = null, speed = 0;
    let isKnots = false;

    // ── FORMAT 1: Traccar Server Forward ──────────────────────
    // { device: { uniqueId }, position: { latitude, longitude, speed } }
    if (body.device && body.position) {
        imei = body.device.uniqueId || body.device.id;
        lat = body.position.latitude;
        lng = body.position.longitude;
        speed = body.position.speed; // knots by default in Traccar
        isKnots = true;
    }

    // ── FORMAT 2: Teltonika FMB series ────────────────────────
    // { imei, gps: { lat, lng, speed } }
    else if (body.imei && body.gps && typeof body.gps === 'object') {
        imei = body.imei;
        lat = body.gps.lat || body.gps.latitude;
        lng = body.gps.lng || body.gps.lon || body.gps.longitude;
        speed = body.gps.speed || 0; // km/h
    }

    // ── FORMAT 3: Meitrack / Some Concox ──────────────────────
    // { imei, latitude, longitude, speed }
    else if (body.imei && (body.latitude !== undefined || body.lat !== undefined)) {
        imei = body.imei;
        lat = body.latitude ?? body.lat;
        lng = body.longitude ?? body.lng ?? body.lon;
        speed = body.speed || body.speed_kmh || 0;
    }

    // ── FORMAT 4: Jimi JC series / ConcoxGT HTTP ──────────────
    // { IMEI, lat, lng, speed } (capital IMEI)
    else if (body.IMEI && body.lat !== undefined) {
        imei = body.IMEI;
        lat = body.lat;
        lng = body.lng || body.lon;
        speed = body.speed || body.Speed || 0;
    }

    // ── FORMAT 5: Queclink GV series / Coban TK ───────────────
    // { device_id, latitude, longitude, speed_kmh }
    else if (body.device_id && body.latitude !== undefined) {
        imei = body.device_id;
        lat = body.latitude;
        lng = body.longitude;
        speed = body.speed_kmh || body.speed || 0;
    }

    // ── FORMAT 6: Suntech / Ruptela ───────────────────────────
    // { id, position: { lat, lon, speed } }
    else if (body.id && body.position && typeof body.position === 'object') {
        imei = body.id;
        lat = body.position.lat || body.position.latitude;
        lng = body.position.lon || body.position.lng || body.position.longitude;
        speed = body.position.speed || 0;
    }

    // ── FORMAT 7: Syrotech / Generic IoT ─────────────────────
    // { uniqueId, lat, lon, spd }
    else if (body.uniqueId && body.lat !== undefined) {
        imei = body.uniqueId;
        lat = body.lat;
        lng = body.lon || body.lng;
        speed = body.spd || body.speed || 0;
    }

    // ── FORMAT 8: Generic Flat (fallback) ─────────────────────
    // Any payload with (imei or device_id) + (lat/lng) + optional speed
    else {
        imei = body.imei || body.IMEI || body.device_id || body.uniqueId || body.deviceId || body.uid;
        lat = body.lat || body.latitude || body.Lat || body.LATITUDE;
        lng = body.lng || body.lon || body.longitude || body.Lng || body.LONGITUDE;
        speed = body.speed || body.Speed || body.speed_kmh || body.spd || 0;
    }

    // Validate we got something
    if (!imei || lat === null || lat === undefined || lng === null || lng === undefined) {
        return null;
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    // Reject invalid coordinates
    if (isNaN(parsedLat) || isNaN(parsedLng)) return null;
    if (parsedLat === 0 && parsedLng === 0) return null; // GPS cold start
    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) return null;

    // Speed conversion: knots → km/h (1 knot = 1.852 km/h)
    const rawSpeed = parseFloat(speed) || 0;
    const speedKmh = isKnots ? rawSpeed * 1.852 : rawSpeed;

    return {
        imei: String(imei).trim(),
        lat: parsedLat,
        lng: parsedLng,
        speed: Math.round(speedKmh * 10) / 10, // 1 decimal place
    };
};

// =====================================================
// VEHICLE CRUD
// =====================================================

// Get all vehicles
exports.getVehicles = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const result = await pool.query('SELECT * FROM transport_vehicles WHERE school_id = $1 ORDER BY id DESC', [school_id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching vehicles' });
    }
};

// Add a new vehicle
exports.addVehicle = async (req, res) => {
    try {
        const { vehicle_number, vehicle_model, driver_name, driver_phone, capacity, driver_id, gps_device_id } = req.body;
        const school_id = req.user.schoolId;

        const parsedDriverId = driver_id && !isNaN(parseInt(driver_id)) ? parseInt(driver_id) : null;
        const parsedCapacity = capacity && !isNaN(parseInt(capacity)) ? parseInt(capacity) : null;
        const cleanGpsId = (gps_device_id && String(gps_device_id).trim() !== '') ? String(gps_device_id).trim() : null;

        const result = await pool.query(
            `INSERT INTO transport_vehicles (school_id, vehicle_number, vehicle_model, driver_name, driver_phone, capacity, driver_id, gps_device_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [school_id, vehicle_number, vehicle_model, driver_name, driver_phone, parsedCapacity, parsedDriverId, cleanGpsId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding vehicle:', error);
        res.status(500).json({ message: error.message || 'Server error adding vehicle' });
    }
};

// Update vehicle details
exports.updateVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const { vehicle_number, vehicle_model, driver_name, driver_phone, capacity, status, driver_id, gps_device_id } = req.body;
        const school_id = req.user.schoolId;

        const parsedDriverId = driver_id && !isNaN(parseInt(driver_id)) ? parseInt(driver_id) : null;
        const parsedCapacity = capacity && !isNaN(parseInt(capacity)) ? parseInt(capacity) : null;
        const cleanGpsId = (gps_device_id && String(gps_device_id).trim() !== '') ? String(gps_device_id).trim() : null;

        const result = await pool.query(
            `UPDATE transport_vehicles 
             SET vehicle_number = $1, vehicle_model = $2, driver_name = $3, driver_phone = $4, capacity = $5, status = $6, driver_id = $7, gps_device_id = $8
             WHERE id = $9 AND school_id = $10 RETURNING *`,
            [vehicle_number, vehicle_model, driver_name, driver_phone, parsedCapacity, status || 'Active', parsedDriverId, cleanGpsId, id, school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating vehicle:', error);
        res.status(500).json({ message: error.message || 'Server error updating vehicle' });
    }
};

// Delete vehicle
exports.deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const school_id = req.user.schoolId;

        const result = await pool.query(
            'DELETE FROM transport_vehicles WHERE id = $1 AND school_id = $2 RETURNING *',
            [id, school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        res.json({ message: 'Vehicle deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error deleting vehicle' });
    }
};

// =====================================================
// ROUTE CRUD
// =====================================================

// Get all routes with stops
exports.getRoutes = async (req, res) => {
    try {
        const school_id = req.user.schoolId;

        const routesResult = await pool.query(`
            SELECT r.*, v.vehicle_number, v.driver_name, v.current_lat, v.current_lng, v.status as vehicle_status
            FROM transport_routes r
            LEFT JOIN transport_vehicles v ON r.vehicle_id = v.id
            WHERE r.school_id = $1 ORDER BY r.id ASC
        `, [school_id]);

        const routes = routesResult.rows;

        for (let route of routes) {
            const stopsResult = await pool.query(
                'SELECT * FROM transport_stops WHERE route_id = $1 ORDER BY stop_order ASC',
                [route.id]
            );
            route.stops = stopsResult.rows;
        }

        res.json(routes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching routes' });
    }
};

// Add a new route (Simplified: name, start point, end point)
exports.addRoute = async (req, res) => {
    try {
        const { route_name, start_point, end_point, start_time, vehicle_id } = req.body;
        const school_id = req.user.schoolId;

        const validStartTime = (start_time && start_time.trim() !== '') ? start_time : null;

        const routeRes = await pool.query(
            `INSERT INTO transport_routes (school_id, vehicle_id, route_name, start_point, end_point, start_time)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [school_id, vehicle_id || null, route_name, start_point, end_point, validStartTime]
        );

        res.status(201).json({ message: 'Route created successfully', route: routeRes.rows[0] });
    } catch (error) {
        console.error('Error adding route:', error);
        res.status(500).json({ message: 'Server error adding route', error: error.message });
    }
};

// Update Route
exports.updateRoute = async (req, res) => {
    try {
        const { id } = req.params;
        const { route_name, start_point, end_point, start_time, vehicle_id } = req.body;
        const school_id = req.user.schoolId;

        const validStartTime = (start_time && start_time.trim() !== '') ? start_time : null;

        const routeRes = await pool.query(
            `UPDATE transport_routes 
             SET route_name = COALESCE($1, route_name), 
                 start_point = COALESCE($2, start_point), 
                 end_point = COALESCE($3, end_point), 
                 start_time = COALESCE($4, start_time), 
                 vehicle_id = COALESCE($5, vehicle_id)
             WHERE id = $6 AND school_id = $7 RETURNING *`,
            [route_name, start_point, end_point, validStartTime, vehicle_id || null, id, school_id]
        );

        if (routeRes.rows.length === 0) {
            return res.status(404).json({ message: 'Route not found' });
        }

        res.json(routeRes.rows[0]);
    } catch (error) {
        console.error('Error updating route:', error);
        res.status(500).json({ message: 'Server error updating route', error: error.message });
    }
};

// Delete Route
exports.deleteRoute = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const school_id = req.user.schoolId;

        await client.query('BEGIN');

        // Check if route exists first
        const check = await client.query('SELECT id FROM transport_routes WHERE id = $1 AND school_id = $2', [id, school_id]);
        if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Route not found' });
        }

        // Unassign from students, teachers, and staff to prevent foreign key constraint violations
        await client.query('UPDATE students SET route_id = NULL WHERE route_id = $1', [id]);
        await client.query('UPDATE teachers SET transport_route_id = NULL WHERE transport_route_id = $1', [id]);
        await client.query('UPDATE staff SET transport_route_id = NULL WHERE transport_route_id = $1', [id]);

        // Delete stops if any
        await client.query('DELETE FROM transport_stops WHERE route_id = $1', [id]);
        
        // Delete route
        await client.query('DELETE FROM transport_routes WHERE id = $1 AND school_id = $2', [id, school_id]);

        await client.query('COMMIT');
        res.json({ message: 'Route deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting route:', error);
        res.status(500).json({ message: 'Server error deleting route' });
    } finally {
        client.release();
    }
};

// =====================================================
// GPS LOCATION UPDATE (Driver Mobile App)
// =====================================================
/**
 * Called by the driver's mobile app.
 * Saves location, heading, route AND broadcasts via WebSocket instantly.
 * Speed from Capacitor is in m/s — convert to km/h.
 */
exports.updateLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lng, speed, heading, route_id, route_name, status } = req.body;
        const school_id = req.user.schoolId;

        // Capacitor sends speed in m/s → convert to km/h (if < 100 assume m/s or direct km/h)
        let speedKmh = 0;
        if (speed !== undefined && speed !== null && !isNaN(speed)) {
            const rawSpeed = parseFloat(speed);
            speedKmh = rawSpeed > 0 ? Math.round(rawSpeed * 3.6 * 10) / 10 : 0;
        }

        const headingVal = heading !== undefined && !isNaN(heading) ? parseFloat(heading) : 0;
        const vehicleStatus = status || 'Active';

        const result = await pool.query(
            `UPDATE transport_vehicles 
             SET current_lat = $1, 
                 current_lng = $2, 
                 speed = $3, 
                 heading = $4,
                 current_route_id = COALESCE($5, current_route_id),
                 current_route_name = COALESCE($6, current_route_name),
                 status = $7, 
                 last_updated = NOW()
             WHERE id = $8 AND school_id = $9 RETURNING *`,
            [lat, lng, speedKmh, headingVal, route_id || null, route_name || null, vehicleStatus, id, school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        const vehicle = result.rows[0];
        vehicle._source = 'mobile';

        // 🚀 Push to all students/admins in this school instantly via WebSocket
        broadcastLocation(school_id, vehicle);

        res.json({ ok: true, speed: speedKmh, vehicle_number: vehicle.vehicle_number, route_name: vehicle.current_route_name });
    } catch (error) {
        console.error('Error updating vehicle location:', error);
        res.status(500).json({ message: 'Server error updating location' });
    }
};

// =====================================================
// UNIVERSAL GPS HARDWARE WEBHOOK
// Accepts data from ANY GPS company — auto-detects format
// =====================================================
/**
 * POST /api/transport/gps/webhook
 * Public endpoint — no auth required (GPS devices can't send JWT)
 * 
 * This single endpoint handles ALL GPS hardware brands:
 * Traccar, Jimi, Teltonika, Meitrack, Queclink, Coban, Syrotech, and any generic format
 */
exports.handleGpsWebhook = async (req, res) => {
    try {
        console.log('📡 GPS Webhook received:', JSON.stringify(req.body));

        // Auto-detect and parse ANY GPS format
        const parsed = parseUniversalGPS(req.body);

        if (!parsed) {
            console.warn('⚠️ GPS Webhook: Unrecognized format:', JSON.stringify(req.body));
            return res.status(400).json({
                message: 'Unrecognized GPS format. Ensure payload contains: IMEI/device_id + lat/lng',
                receivedKeys: Object.keys(req.body),
                tip: 'Supported: Traccar, Jimi, Teltonika, Meitrack, Queclink, Coban, Syrotech, or any flat {imei, lat, lng} format',
            });
        }

        const { imei, lat, lng, speed } = parsed;

        // Find vehicle by GPS device IMEI
        const result = await pool.query(
            `UPDATE transport_vehicles 
             SET current_lat = $1, current_lng = $2, speed = $3, status = 'Active', last_updated = NOW()
             WHERE gps_device_id = $4 RETURNING *, school_id`,
            [lat, lng, speed, imei]
        );

        if (result.rows.length === 0) {
            console.warn(`⚠️ GPS Device IMEI "${imei}" not registered in any vehicle`);
            return res.status(404).json({
                message: `GPS device IMEI "${imei}" is not registered. Add this IMEI in Transport → Vehicles → GPS Device ID field.`,
                imei,
            });
        }

        const vehicle = result.rows[0];
        vehicle._source = 'hardware';

        // 🚀 Instantly push to all clients in this school via WebSocket
        broadcastLocation(vehicle.school_id, vehicle);

        console.log(`✅ GPS Update: ${vehicle.vehicle_number} | ${lat}, ${lng} | ${speed} km/h`);
        res.json({ ok: true, vehicle: vehicle.vehicle_number, speed: `${speed} km/h` });

    } catch (error) {
        console.error('❌ GPS Webhook Error:', error);
        res.status(500).json({ message: 'Server error processing GPS data' });
    }
};

// =====================================================
// MY ROUTE (Student / Driver)
// =====================================================
exports.getMyRoute = async (req, res) => {
    try {
        const { id, role, email, schoolId, linkedId } = req.user;
        let route_id = null;
        let pickup_point = 'School';

        if (role === 'STUDENT') {
            if (linkedId) {
                const sY = await pool.query('SELECT route_id, pickup_point FROM students WHERE id = $1', [linkedId]);
                if (sY.rows.length > 0) {
                    route_id = sY.rows[0].route_id;
                    pickup_point = sY.rows[0].pickup_point || 'School';
                }
            } else {
                let studentRes = await pool.query(
                    'SELECT route_id, pickup_point FROM students WHERE school_id = $1 AND LOWER(email) = LOWER($2)',
                    [schoolId, email]
                );
                if (studentRes.rows.length === 0) {
                    const prefix = email.split('@')[0];
                    studentRes = await pool.query(
                        'SELECT route_id, pickup_point FROM students WHERE school_id = $1 AND LOWER(admission_no) = LOWER($2)',
                        [schoolId, prefix]
                    );
                }
                if (studentRes.rows.length > 0) {
                    route_id = studentRes.rows[0].route_id;
                    pickup_point = studentRes.rows[0].pickup_point || 'School';
                }
            }
        } else if (role === 'DRIVER') {
            const staffRes = await pool.query('SELECT id FROM staff WHERE email = $1 AND school_id = $2', [email, schoolId]);
            if (staffRes.rows.length > 0) {
                const staffId = staffRes.rows[0].id;
                const vehicleRes = await pool.query('SELECT id FROM transport_vehicles WHERE driver_id = $1', [staffId]);
                if (vehicleRes.rows.length > 0) {
                    const vehicleId = vehicleRes.rows[0].id;
                    const routeRes = await pool.query('SELECT id FROM transport_routes WHERE vehicle_id = $1', [vehicleId]);
                    if (routeRes.rows.length > 0) {
                        route_id = routeRes.rows[0].id;
                    }
                }
            }
        }

        if (!route_id) {
            return res.status(404).json({ message: 'No transport route assigned' });
        }

        const routeResult = await pool.query(`
            SELECT r.*, v.vehicle_number, v.driver_name, v.driver_phone, v.current_lat, v.current_lng, v.speed, v.heading, v.current_route_name, v.status as vehicle_status, v.last_updated
            FROM transport_routes r
            LEFT JOIN transport_vehicles v ON (r.vehicle_id = v.id OR v.current_route_id = r.id)
            WHERE r.id = $1 AND r.school_id = $2
        `, [route_id, schoolId]);

        if (routeResult.rows.length === 0) {
            return res.status(404).json({ message: 'Route not found' });
        }

        const route = routeResult.rows[0];
        route.route_id = route.id;
        route.pickup_point = pickup_point;
        route.pickup_time = '07:30 AM';
        route.drop_time = '03:30 PM';
        route.is_tracking = true;
        route.monthly_fee = 2500;
        route.payment_status = 'Pending';

        const stopsResult = await pool.query(
            'SELECT * FROM transport_stops WHERE route_id = $1 ORDER BY stop_order ASC',
            [route_id]
        );
        route.stops = stopsResult.rows;

        res.json(route);

    } catch (error) {
        console.error('Error fetching my route:', error);
        res.status(500).json({ message: 'Server error fetching route' });
    }
};
