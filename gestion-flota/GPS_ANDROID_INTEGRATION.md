# Integración GPS Android - Backend API

## Endpoints disponibles para el dispositivo Android

### 1. Enviar ubicación GPS en tiempo real
```
POST /api/rutas/{id}/gps
Content-Type: application/json

{
  "latitud": 40.4168,
  "longitud": -3.7038
}
```

### 2. Obtener última ubicación conocida
```
GET /api/rutas/{id}/last-location
```

### 3. Solicitar actualización de GPS (WebSocket/SSE futuro)
```
POST /api/rutas/{id}/request-gps
```

## Implementación recomendada en Android

### Kotlin Example - GPS Tracking Service

```kotlin
class GPSTrackingService : Service() {
    
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var currentRouteId: String? = null
    private val API_URL = "https://tu-backend.com/api/rutas"
    
    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    sendGPSToBackend(location.latitude, location.longitude)
                }
            }
        }
    }
    
    fun startTracking(routeId: String) {
        currentRouteId = routeId
        
        // Configurar actualizaciones de GPS cada 2 segundos
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            2000L // 2 segundos
        ).apply {
            setMinUpdateIntervalMillis(1000L) // Mínimo 1 segundo
            setMaxUpdateDelayMillis(3000L)     // Máximo 3 segundos
        }.build()
        
        // Verificar permisos y empezar tracking
        if (ContextCompat.checkSelfPermission(this, 
            Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
            
            Log.d("GPSTracking", "🚀 GPS Tracking iniciado para ruta: $routeId")
        }
    }
    
    private fun sendGPSToBackend(latitude: Double, longitude: Double) {
        currentRouteId?.let { routeId ->
            val gpsData = JSONObject().apply {
                put("latitud", latitude)
                put("longitud", longitude)
            }
            
            val requestBody = gpsData.toString().toRequestBody("application/json".toMediaType())
            
            val request = Request.Builder()
                .url("$API_URL/$routeId/gps")
                .put(requestBody)
                .build()
            
            OkHttpClient().newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Log.e("GPSTracking", "❌ Error enviando GPS: ${e.message}")
                }
                
                override fun onResponse(call: Call, response: Response) {
                    if (response.isSuccessful) {
                        Log.d("GPSTracking", "✅ GPS enviado: [$latitude, $longitude]")
                    } else {
                        Log.e("GPSTracking", "❌ Error backend: ${response.code}")
                    }
                }
            })
        }
    }
    
    fun stopTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        currentRouteId = null
        Log.d("GPSTracking", "🛑 GPS Tracking detenido")
    }
}
```

### JavaScript Bridge para WebView

Si usas WebView en Android:

```javascript
// En tu HTML/JavaScript
window.AndroidTracker = {
    startTracking: function(routeId) {
        // Llama al método nativo de Android
        if (window.android && window.android.startTracking) {
            window.android.startTracking(routeId);
        }
    },
    
    stopTracking: function() {
        if (window.android && window.android.stopTracking) {
            window.android.stopTracking();
        }
    },
    
    requestGPSUpdate: function(routeId) {
        if (window.android && window.android.requestGPSUpdate) {
            window.android.requestGPSUpdate(routeId);
        }
    }
};
```

### Configuración en AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

### Flujo de trabajo

1. **Iniciar Ruta**: El frontend llama a `AndroidTracker.startTracking(routeId)`
2. **Android recibe**: Inicia el servicio de GPS con actualizaciones cada 2 segundos
3. **GPS → Backend**: Android envía coordenadas a `/api/rutas/{id}/gps`
4. **Frontend actualiza**: Cada 2 segundos solicita los datos actualizados
5. **Mapa en vivo**: El mapa muestra la ubicación real en tiempo real

### Importante

- **Frecuencia**: Enviar GPS cada 2 segundos como está configurado en el frontend
- **Precisión**: Usar `PRIORITY_HIGH_ACCURACY` para mejor precisión
- **Background**: El servicio debe funcionar en background para tracking continuo
- **Batería**: Considerar optimizaciones para no consumir excesiva batería
- **Errores**: Implementar reintentos automáticos si falla el envío de GPS