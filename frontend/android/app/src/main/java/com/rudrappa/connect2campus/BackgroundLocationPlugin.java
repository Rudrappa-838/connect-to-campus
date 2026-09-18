package com.rudrappa.connect2campus;

import android.content.Intent;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundLocation")
public class BackgroundLocationPlugin extends Plugin {

    private static BackgroundLocationPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void onLocationReceived(double lat, double lng, float speed, float heading, float accuracy) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("latitude", lat);
            data.put("longitude", lng);
            data.put("speed", speed);
            data.put("heading", heading);
            data.put("accuracy", accuracy);
            instance.notifyListeners("onLocationUpdate", data);
        }
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        try {
            String apiUrl = call.getString("apiUrl", "");
            String token = call.getString("token", "");
            String vehicleId = call.getString("vehicleId", "");
            String routeId = call.getString("routeId", null);
            String routeName = call.getString("routeName", null);
            String vehicleNumber = call.getString("vehicleNumber", "");

            if (vehicleId == null || vehicleId.isEmpty()) {
                call.reject("vehicleId is required");
                return;
            }

            Intent intent = new Intent(getContext(), BackgroundLocationService.class);
            intent.setAction(BackgroundLocationService.ACTION_START);
            intent.putExtra(BackgroundLocationService.EXTRA_API_URL, apiUrl);
            intent.putExtra(BackgroundLocationService.EXTRA_TOKEN, token);
            intent.putExtra(BackgroundLocationService.EXTRA_VEHICLE_ID, vehicleId);
            intent.putExtra(BackgroundLocationService.EXTRA_ROUTE_ID, routeId);
            intent.putExtra(BackgroundLocationService.EXTRA_ROUTE_NAME, routeName);
            intent.putExtra(BackgroundLocationService.EXTRA_VEHICLE_NUMBER, vehicleNumber);

            ContextCompat.startForegroundService(getContext(), intent);

            JSObject ret = new JSObject();
            ret.put("status", "started");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start background tracking: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), BackgroundLocationService.class);
            intent.setAction(BackgroundLocationService.ACTION_STOP);
            getContext().startService(intent);

            JSObject ret = new JSObject();
            ret.put("status", "stopped");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop background tracking: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isTracking(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isTracking", BackgroundLocationService.isServiceRunning());
        call.resolve(ret);
    }
}
