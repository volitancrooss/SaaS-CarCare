package com.carcare.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class TrackingService extends Service {

    private static final String CHANNEL_ID = "TrackingChannel";
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private String rutaId;
    private static final String TAG = "TrackingService";

    // URL de tu backend - Usamos 10.0.2.2 para el emulador o la URL de Railway
    private String API_URL = "http://10.0.2.2:8080"; // Cambiar por URL real si es necesario

    @Override
    public void onCreate() {
        super.onCreate();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        crearCanalNotificacion();
        
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                for (Location location : locationResult.getLocations()) {
                    enviarUbicacionAlBackend(location);
                }
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.hasExtra("rutaId")) {
            rutaId = intent.getStringExtra("rutaId");
            if (intent.hasExtra("apiUrl")) {
                API_URL = intent.getStringExtra("apiUrl");
            }
        }

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EcoFleet Tracking Activo")
                .setContentText("Rastreo de ruta en progreso...")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .build();

        startForeground(1, notification);
        solicitarActualizacionesUbicacion();
        
        return START_NOT_STICKY;
    }

    private void solicitarActualizacionesUbicacion() {
        LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
                .setWaitForAccurateLocation(false)
                .setMinUpdateIntervalMillis(3000)
                .setMaxUpdateDelayMillis(10000)
                .build();

        try {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
        } catch (SecurityException e) {
            Log.e(TAG, "Error: Sin permisos de ubicación", e);
        }
    }

    private void enviarUbicacionAlBackend(Location location) {
        new Thread(() -> {
            try {
                URL url = new URL(API_URL + "/api/rutas/" + rutaId);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("PUT");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);

                String jsonInputString = String.format(
                    "{\"latitudActual\": %f, \"longitudActual\": %f, \"estado\": \"EN_CURSO\"}",
                    location.getLatitude(), location.getLongitude()
                );

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonInputString.getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                Log.d(TAG, "Ubicación enviada: " + responseCode);
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Error enviando ubicación", e);
            }
        }).start();
    }

    private void crearCanalNotificacion() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Tracking Service Channel",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    @Override
    public void onDestroy() {
        fusedLocationClient.removeLocationUpdates(locationCallback);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
