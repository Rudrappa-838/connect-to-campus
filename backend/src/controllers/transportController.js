const { pool } = require('../config/db');

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
        const { vehicle_number, vehicle_model, driver_name, driver_phone, capacity, driver_id } = req.body;
        const school_id = req.user.schoolId;

        const result = await pool.query(
            `INSERT INTO transport_vehicles (school_id, vehicle_number, vehicle_model, driver_name, driver_phone, capacity, driver_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [school_id, vehicle_number, vehicle_model, driver_name, driver_phone, capacity, driver_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error adding vehicle' });
    }
};

// Update vehicle details
exports.updateVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const { vehicle_number, vehicle_model, driver_name, driver_phone, capacity, status, driver_id } = req.body;
        const school_id = req.user.schoolId;

        const result = await pool.query(
            `UPDATE transport_vehicles 
             SET vehicle_number = $1, vehicle_model = $2, driver_name = $3, driver_phone = $4, capacity = $5, status = $6, driver_id = $7
             WHERE id = $8 AND school_id = $9 RETURNING *`,
            [vehicle_number, vehicle_model, driver_name, driver_phone, capacity, status, driver_id, id, school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error updating vehicle' });
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

// Get all routes with stops
exports.getRoutes = async (req, res) => {
    try {
        const school_id = req.user.schoolId;

        // Fetch routes with assigned vehicle details
        const routesResult = await pool.query(`
            SELECT r.*, v.vehicle_number, v.driver_name, v.current_lat, v.current_lng, v.status as vehicle_status
            FROM transport_routes r
            LEFT JOIN transport_vehicles v ON r.vehicle_id = v.id
            WHERE r.school_id = $1 ORDER BY r.id ASC
        `, [school_id]);

        const routes = routesResult.rows;

        // Fetch stops for these routes
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

// Add a new route
exports.addRoute = async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('Adding Route Payload:', req.body);
        const { route_name, start_point, end_point, start_time, vehicle_id, stops } = req.body;
        const school_id = req.user.schoolId;

        // Sanitize inputs
        const validStartTime = (start_time && start_time.trim() !== '') ? start_time : null;

        await client.query('BEGIN');

        const routeRes = await client.query(
            `INSERT INTO transport_routes (school_id, vehicle_id, route_name, start_point, end_point, start_time)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [school_id, vehicle_id || null, route_name, start_point, end_point, validStartTime]
        );
        const routeId = routeRes.rows[0].id;

        if (stops && stops.length > 0) {
            for (let i = 0; i < stops.length; i++) {
                const stop = stops[i];
                const validPickupTime = (stop.time && stop.time.trim() !== '') ? stop.time : null;
                // Ensure number or 0, avoiding empty strings for lat/lng
                const lat = (stop.lat && stop.lat !== '') ? stop.lat : 0;
                const lng = (stop.lng && stop.lng !== '') ? stop.lng : 0;

                await client.query(
                    `INSERT INTO transport_stops (route_id, stop_name, stop_order, lat, lng, pickup_time)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [routeId, stop.name, i + 1, lat, lng, validPickupTime]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Route created successfully', routeId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding route:', error);
        res.status(500).json({ message: 'Server error adding route', error: error.message });
    } finally {
        client.release();
    }
};

// Update Route (Assign Vehicle etc)
exports.updateRoute = async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('Updating Route ID:', req.params.id);
        console.log('Update Payload:', req.body);
        const { id } = req.params;
        const { route_name, start_point, end_point, start_time, vehicle_id, stops } = req.body;
        const school_id = req.user.schoolId;

        // Sanitize inputs
        const validStartTime = (start_time && start_time.trim() !== '') ? start_time : null;

        await client.query('BEGIN');

        // Update Route Details
        const routeRes = await client.query(
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
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Route not found' });
        }

        // Update Stops if provided (Delete all and Re-insert)
        if (stops && stops.length > 0) {
            await client.query('DELETE FROM transport_stops WHERE route_id = $1', [id]);
            for (let i = 0; i < stops.length; i++) {
                const stop = stops[i];
                const validPickupTime = (stop.time && stop.time.trim() !== '') ? stop.time : null;
                // Parse lat/lng as floats, default to 0 if invalid
                const latitude = parseFloat(stop.lat);
                const longitude = parseFloat(stop.lng);
                const lat = !isNaN(latitude) ? latitude : 0;
                const lng = !isNaN(longitude) ? longitude : 0;

                const stopName = stop.name || `Stop ${i + 1}`;

                console.log(`Processing stop ${i}:`, stopName, lat, lng, validPickupTime); // Debug log

                await client.query(
                    `INSERT INTO transport_stops (route_id, stop_name, stop_order, lat, lng, pickup_time)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [id, stopName, i + 1, lat, lng, validPickupTime]
                );
            }
        }

        await client.query('COMMIT');
        res.json(routeRes.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating route:', error);
        res.status(500).json({ message: 'Server error updating route', error: error.message });
    } finally {
        client.release();
    }
};

// Delete Route
exports.deleteRoute = async (req, res) => {
    try {
        const { id } = req.params;
        const school_id = req.user.schoolId;

        await pool.query('DELETE FROM transport_stops WHERE route_id = $1', [id]); // Cascades usually, but safe to be explicit
        const result = await pool.query('DELETE FROM transport_routes WHERE id = $1 AND school_id = $2 RETURNING *', [id, school_id]);

        if (result.rows.length === 0) return res.status(404).json({ message: 'Route not found' });
        res.json({ message: 'Route deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error deleting route' });
    }
};
// Update Vehicle Location (Simulation)
exports.updateLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lng, speed } = req.body;
        const school_id = req.user.schoolId;

        // Ensure valid speed (Driver App sends speed in km/h or m/s depending on device, usually needs no conversion here as App handles it or raw is fine)
        // Capacitor Geolocation speed is in m/s. We might want to convert to km/h * 3.6 to match Traccar default (Knots->km/h) or just store as is.
        // Let's store as km/h for consistency with Webhook. 1 m/s = 3.6 km/h.
        // But DriverTracking.jsx sends raw speed. Let's multiply by 3.6 if it seems small? No, let's just store raw and handle display.
        // Actually, Webhook stores km/h. Capacitor sends m/s.
        // Let's convert m/s to km/h: speed * 3.6
        const currentSpeed = speed ? parseFloat(speed) * 3.6 : 0;

        const result = await pool.query(
            `UPDATE transport_vehicles 
             SET current_lat = $1, current_lng = $2, speed = $3, status = 'Active', last_updated = NOW()
             WHERE id = $4 AND school_id = $5 RETURNING *`,
            [lat, lng, currentSpeed, id, school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error updating location' });
    }
};

// Hardware GPS Webhook (Works with Direct HTTP and Traccar Forwarding)
exports.handleGpsWebhook = async (req, res) => {
    try {
        console.log('GPS Webhook received:', JSON.stringify(req.body, null, 2)); // Debug log

        let imei, latitude, longitude, speed;
        let isKnots = false; // Flag to track unit conversion

        // 1. Check for Traccar Format (Standard Open Source GPS Server)
        if (req.body.device && req.body.position) {
            imei = req.body.device.uniqueId;
            latitude = req.body.position.latitude;
            longitude = req.body.position.longitude;
            speed = req.body.position.speed; // usually in knots, might need conversion
            isKnots = true;
        }
        // 2. Check for Simple Format (Direct HTTP Post)
        else {
            imei = req.body.imei || req.body.device_id || req.body.uniqueId;
            latitude = req.body.lat || req.body.latitude;
            longitude = req.body.lng || req.body.long || req.body.longitude;
            speed = req.body.speed;
        }

        if (!imei || !latitude || !longitude) {
            return res.status(400).json({ message: 'Invalid Format. Required: imei/uniqueId, lat/latitude, lng/longitude' });
        }

        // Normalize Coordinates
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        // Speed Calculation: Convert Knots (Traccar) to km/h, otherwise assume km/h
        const spd = speed ? (isKnots ? parseFloat(speed) * 1.852 : parseFloat(speed)) : 0;

        // Update Vehicle Location logic
        const result = await pool.query(
            `UPDATE transport_vehicles 
             SET current_lat = $1, current_lng = $2, speed = $3, status = 'Active', last_updated = NOW()
             WHERE gps_device_id = $4 RETURNING *`,
            [lat, lng, spd, imei]
        );

        if (result.rows.length === 0) {
            console.warn(`GPS Device ID ${imei} not found in database.`);
            return res.status(404).json({ message: 'Device IMEI not registered in Transport Management' });
        }

        console.log(`Updated location for Vehicle ${result.rows[0].vehicle_number} (IMEI: ${imei})`);
        res.json({ message: 'Location updated via GPS Hardware', vehicle: result.rows[0].vehicle_number });
    } catch (error) {
        console.error('GPS Webhook Error:', error);
        res.status(500).json({ message: 'Server error processing GPS data' });
    }
};

// Get My Transport Route (For Students/Drivers)
// Get My Transport Route (For Students/Drivers)
exports.getMyRoute = async (req, res) => {
    try {
        const { id, role, email, schoolId, linkedId } = req.user;
        let route_id = null;
        let pickup_point = 'School';

        if (role === 'STUDENT') {
            if (linkedId) {
                // Optimized Path: PK Lookup
                const sY = await pool.query('SELECT route_id, pickup_point FROM students WHERE id = $1', [linkedId]);
                if (sY.rows.length > 0) {
                    route_id = sY.rows[0].route_id;
                    pickup_point = sY.rows[0].pickup_point || 'School';
                }
            } else {
                // Fallback Path
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
            // Find staff record for this driver
            const staffRes = await pool.query('SELECT id FROM staff WHERE email = $1 AND school_id = $2', [email, schoolId]);
            if (staffRes.rows.length > 0) {
                const staffId = staffRes.rows[0].id;
                // Find vehicle assigned to this staff member
                const vehicleRes = await pool.query('SELECT id FROM transport_vehicles WHERE driver_id = $1', [staffId]);
                if (vehicleRes.rows.length > 0) {
                    const vehicleId = vehicleRes.rows[0].id;
                    // Find route for this vehicle
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

        // Fetch Route Details
        const routeResult = await pool.query(`
            SELECT r.*, v.vehicle_number, v.driver_name, v.driver_phone, v.current_lat, v.current_lng, v.status as vehicle_status
            FROM transport_routes r
            LEFT JOIN transport_vehicles v ON r.vehicle_id = v.id
            WHERE r.id = $1 AND r.school_id = $2
        `, [route_id, schoolId]);

        if (routeResult.rows.length === 0) {
            return res.status(404).json({ message: 'Route not found' });
        }

        const route = routeResult.rows[0];
        route.route_id = route.id; // Alias for Mobile
        route.pickup_point = pickup_point; // Attach pickup point

        // Mock Times/Data needed for Mobile App
        route.pickup_time = '07:30 AM';
        route.drop_time = '03:30 PM';
        route.is_tracking = true;
        route.monthly_fee = 2500;
        route.payment_status = 'Pending';

        // Fetch Stops
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
