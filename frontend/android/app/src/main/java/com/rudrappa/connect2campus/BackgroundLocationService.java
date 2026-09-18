package com.rudrappa.connect2campus;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class BackgroundLocationService extends Service implements LocationListener {

    private static final String TAG = "BgLocationService";
    public static final String ACTION_START = "com.rudrappa.connect2campus.ACTION_START_TRACKING";
    public static final String ACTION_STOP = "com.rudrappa.connect2campus.ACTION_STOP_TRACKING";

    public static final String EXTRA_API_URL = "apiUrl";
    public static final String EXTRA_TOKEN = "token";
    public static final String EXTRA_VEHICLE_ID = "vehicleId";
    public static final String EXTRA_ROUTE_ID = "routeId";
    public static final String EXTRA_ROUTE_NAME = "routeName";
    public static final String EXTRA_VEHICLE_NUMBER = "vehicleNumber";

    private static final int NOTIFICATION_ID = 99881;
    private static final String CHANNEL_ID = "school_bus_live_tracking_channel";

    private static volatile boolean isRunning = false;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private LocationManager locationManager;
    private ExecutorService httpExecutor;

    private String apiUrl;
    private String token;
    private String vehicleId;
    private String routeId;
    private String routeName;
    private String vehicleNumber;

    private long lastSendTime = 0;

    public static boolean isServiceRunning() {
        return isRunning;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        httpExecutor = Executors.newSingleThreadExecutor();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            Log.d(TAG, "Stop action received");
            stopTracking();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_START.equals(action)) {
            apiUrl = intent.getStringExtra(EXTRA_API_URL);
            token = intent.getStringExtra(EXTRA_TOKEN);
            vehicleId = intent.getStringExtra(EXTRA_VEHICLE_ID);
            routeId = intent.getStringExtra(EXTRA_ROUTE_ID);
            routeName = intent.getStringExtra(EXTRA_ROUTE_NAME);
            vehicleNumber = intent.getStringExtra(EXTRA_VEHICLE_NUMBER);

            Log.d(TAG, "Starting background tracking for Vehicle ID: " + vehicleId + " (" + vehicleNumber + ")");
            startTracking();
            return START_STICKY;
        }

        return START_NOT_STICKY;
    }

    private void startTracking() {
        if (isRunning) {
            Log.d(TAG, "Service already tracking, updated parameters.");
            return;
        }
        isRunning = true;

        // 1. Acquire WakeLock to keep CPU active even when screen is locked/black
        acquireWakeLocks();

        // 2. Start Foreground Service with persistent notification
        Notification notification = buildNotification("Live GPS Active", "Bus " + (vehicleNumber != null ? vehicleNumber : "") + " tracking is running.");
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting foreground service", e);
        }

        // 3. Request native Location updates
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locationManager != null) {
            try {
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1500L, 1.0f, this, Looper.getMainLooper());
                    Log.d(TAG, "Registered GPS_PROVIDER location listener");
                }
                if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 3000L, 5.0f, this, Looper.getMainLooper());
                    Log.d(TAG, "Registered NETWORK_PROVIDER location listener");
                }
            } catch (SecurityException se) {
                Log.e(TAG, "SecurityException: Location permission missing", se);
            } catch (Exception e) {
                Log.e(TAG, "Exception registering location listeners", e);
            }
        }
    }

    private void stopTracking() {
        isRunning = false;
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (Exception e) {
                Log.e(TAG, "Error removing location updates", e);
            }
        }

        // Send final Idle update to server on exit
        if (vehicleId != null && apiUrl != null && token != null) {
            final String fApiUrl = apiUrl;
            final String fToken = token;
            final String fVehicleId = vehicleId;
            httpExecutor.execute(() -> {
                sendHttpLocation(fApiUrl, fToken, fVehicleId, 0, 0, 0, 0, 0, null, null, "Idle");
            });
        }

        releaseWakeLocks();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping foreground", e);
        }
    }

    private void acquireWakeLocks() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Connect2Campus::LocationWakeLock");
                wakeLock.acquire(4 * 60 * 60 * 1000L); // Max 4 hours safety timeout
                Log.d(TAG, "Acquired PARTIAL_WAKE_LOCK");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to acquire wake lock", e);
        }

        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null && (wifiLock == null || !wifiLock.isHeld())) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "Connect2Campus::WifiLock");
                wifiLock.acquire();
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to acquire wifi lock", e);
        }
    }

    private void releaseWakeLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
                Log.d(TAG, "Released PARTIAL_WAKE_LOCK");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error releasing wake lock", e);
        }

        try {
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
                wifiLock = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error releasing wifi lock", e);
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) return;

        double lat = location.getLatitude();
        double lng = location.getLongitude();

        // Reject invalid coordinates
        if (lat == 0 && lng == 0) return;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

        float accuracy = location.hasAccuracy() ? location.getAccuracy() : 50.0f;
        // Skip poor accuracy (>120 meters)
        if (accuracy > 120.0f) {
            Log.w(TAG, "Skipping poor accuracy fix: " + accuracy + "m");
            return;
        }

        float speed = location.hasSpeed() ? location.getSpeed() : 0.0f; // m/s
        float heading = location.hasBearing() ? location.getBearing() : 0.0f;

        long now = System.currentTimeMillis();
        // Debounce: send at most once every 1000ms
        if (now - lastSendTime < 1000) {
            return;
        }
        lastSendTime = now;

        // 1. Notify Capacitor plugin listeners so React UI updates in real-time
        BackgroundLocationPlugin.onLocationReceived(lat, lng, speed, heading, accuracy);

        // 2. Post directly to server via background thread (survives screen-off & WebView pauses)
        if (vehicleId != null && apiUrl != null && token != null) {
            final String fApiUrl = apiUrl;
            final String fToken = token;
            final String fVehicleId = vehicleId;
            final String fRouteId = routeId;
            final String fRouteName = routeName;

            httpExecutor.execute(() -> {
                sendHttpLocation(fApiUrl, fToken, fVehicleId, lat, lng, speed, heading, accuracy, fRouteId, fRouteName, "Active");
            });
        }
    }

    private void sendHttpLocation(String baseApiUrl, String authToken, String vId,
                                  double lat, double lng, float speed, float heading, float accuracy,
                                  String rId, String rName, String status) {
        HttpURLConnection conn = null;
        try {
            String cleanBase = baseApiUrl.endsWith("/") ? baseApiUrl.substring(0, baseApiUrl.length() - 1) : baseApiUrl;
            URL url = new URL(cleanBase + "/transport/vehicles/" + vId + "/location");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("PUT");
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setRequestProperty("Authorization", "Bearer " + authToken);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);

            JSONObject json = new JSONObject();
            json.put("lat", lat);
            json.put("lng", lng);
            json.put("speed", speed); // m/s (backend converts to km/h)
            json.put("heading", heading);
            json.put("accuracy", accuracy);
            json.put("status", status);

            if (rId != null && !rId.isEmpty()) {
                try {
                    json.put("route_id", Integer.parseInt(rId));
                } catch (NumberFormatException ignored) {
                    json.put("route_id", rId);
                }
            }
            if (rName != null && !rName.isEmpty()) {
                json.put("route_name", rName);
            }

            byte[] body = json.toString().getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(body.length);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            if (responseCode >= 200 && responseCode < 300) {
                // Success
            } else {
                Log.w(TAG, "Server responded with HTTP " + responseCode);
            }

        } catch (Exception e) {
            Log.w(TAG, "Network error updating location: " + e.getMessage());
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onProviderDisabled(String provider) {}

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // When app is completely swiped away by user, stop service and notify server
        Log.d(TAG, "App task removed from recents. Stopping tracking.");
        stopTracking();
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        stopTracking();
        if (httpExecutor != null) {
            httpExecutor.shutdown();
        }
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "School Bus Live GPS Tracking",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps bus GPS location broadcasting while driving even with screen off or during calls.");
            channel.setShowBadge(false);
            channel.enableVibration(false);
            channel.enableLights(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String title, String content) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                        : PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(content)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }
}
