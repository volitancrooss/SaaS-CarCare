package com.ecofleet.controller;

import com.ecofleet.model.Ruta;
import com.ecofleet.repository.RutaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.time.Instant;

@RestController
@RequestMapping("/api/rutas")
public class RutaController {

    @Autowired
    private RutaRepository rutaRepository;

    @GetMapping
    public List<Ruta> listarRutas() {
        return rutaRepository.findAll();
    }

    @PostMapping
    public Ruta crearRuta(@RequestBody Ruta ruta) {
        if (ruta.getEstado() == null) {
            ruta.setEstado("PLANIFICADA");
        }
        return rutaRepository.save(ruta);
    }
    
    @GetMapping("/vehiculo/{vehiculoId}")
    public List<Ruta> obtenerRutasPorVehiculo(@PathVariable String vehiculoId) {
        return rutaRepository.findByVehiculoId(vehiculoId);
    }

    @PutMapping("/{id}")
    public Ruta actualizarRuta(@PathVariable String id, @RequestBody Ruta rutaActualizada) {
        return rutaRepository.findById(id)
                .map(ruta -> {
                    // Si se está iniciando la ruta (cambio a EN_CURSO) y no tiene posición GPS actual
                    // Inicializar con la posición de origen
                    if (rutaActualizada.getEstado() != null && 
                        "EN_CURSO".equals(rutaActualizada.getEstado()) && 
                        ruta.getLatitudActual() == null) {
                       
                        System.out.println("[RutaController] Iniciando ruta - ESPERANDO GPS REAL del dispositivo");
                        // NO inicializar con origen - esperar GPS real del emulador/dispositivo
                        ruta.setLatitudActual(null);
                        ruta.setLongitudActual(null);
                    }
                    
                    if (rutaActualizada.getEstado() != null) {
                        ruta.setEstado(rutaActualizada.getEstado());
                        System.out.println("[RutaController] Estado actualizado: " + rutaActualizada.getEstado());
                    }
                    if (rutaActualizada.getLatitudActual() != null) {
                        ruta.setLatitudActual(rutaActualizada.getLatitudActual());
                        System.out.println("[RutaController] GPS RECIBIDO del dispositivo: " + rutaActualizada.getLatitudActual());
                    }
                    if (rutaActualizada.getLongitudActual() != null) {
                        ruta.setLongitudActual(rutaActualizada.getLongitudActual());
                        System.out.println("[RutaController] GPS RECIBIDO del dispositivo: " + rutaActualizada.getLongitudActual());
                    }
                    
                    // Actualizar timestamp si se recibieron coordenadas GPS
                    if (rutaActualizada.getLatitudActual() != null || rutaActualizada.getLongitudActual() != null) {
                        String timestamp = Instant.now().toString();
                        ruta.setUltimaActualizacionGPS(timestamp);
                        System.out.println("[RutaController] ⏱️ Timestamp GPS actualizado: " + timestamp);
                    }
                    
                    if (rutaActualizada.getDesviado() != null) ruta.setDesviado(rutaActualizada.getDesviado());
                    
                    Ruta rutaGuardada = rutaRepository.save(ruta);
                    System.out.println("[RutaController] Ruta actualizada - Estado: " + rutaGuardada.getEstado() + 
                                     ", GPS: [" + rutaGuardada.getLatitudActual() + ", " + rutaGuardada.getLongitudActual() + "]");
                    return rutaGuardada;
                })
                .orElse(null);
    }

    @GetMapping("/{id}")
    public Ruta obtenerRuta(@PathVariable String id) {
        return rutaRepository.findById(id).orElse(null);
    }

    // Endpoint específico para que Android envíe actualizaciones de GPS en tiempo real
    @PostMapping("/{id}/gps")
    public Ruta actualizarGPS(@PathVariable String id, @RequestBody GPSCoordinates gps) {
        System.out.println("[RutaController] 📱 GPS RECIBIDO de Android: " + gps);
        return rutaRepository.findById(id)
                .map(ruta -> {
                    // Guardar posición anterior para calcular velocidad
                    Double latitudAnterior = ruta.getLatitudActual();
                    Double longitudAnterior = ruta.getLongitudActual();
                    String timestampAnterior = ruta.getUltimaActualizacionGPS();
                    
                    // Actualizar posición actual
                    ruta.setLatitudActual(gps.getLatitud());
                    ruta.setLongitudActual(gps.getLongitud());
                    
                    // Guardar timestamp actual
                    String timestampActual = Instant.now().toString();
                    ruta.setUltimaActualizacionGPS(timestampActual);
                    
                    // Calcular velocidad si tenemos posición y timestamp anterior
                    if (latitudAnterior != null && longitudAnterior != null && timestampAnterior != null) {
                        try {
                            // Calcular distancia recorrida en km
                            double distanciaRecorrida = calcularDistancia(
                                latitudAnterior, longitudAnterior,
                                gps.getLatitud(), gps.getLongitud()
                            );
                            
                            // Calcular tiempo transcurrido en horas
                            Instant instanteAnterior = Instant.parse(timestampAnterior);
                            Instant instanteActual = Instant.parse(timestampActual);
                            double segundosTranscurridos = (instanteActual.toEpochMilli() - instanteAnterior.toEpochMilli()) / 1000.0;
                            double horasTranscurridas = segundosTranscurridos / 3600.0;
                            
                            // Calcular velocidad en km/h (solo si hay movimiento significativo)
                            if (horasTranscurridas > 0 && distanciaRecorrida > 0.001) { // Más de 1 metro
                                double velocidad = distanciaRecorrida / horasTranscurridas;
                                // Limitar a valores razonables (0-200 km/h)
                                velocidad = Math.max(0, Math.min(200, velocidad));
                                ruta.setVelocidadActualKmh(velocidad);
                                System.out.println("[RutaController] 🚗 Velocidad calculada: " + String.format("%.1f", velocidad) + " km/h");
                            } else {
                                ruta.setVelocidadActualKmh(0.0); // Detenido
                            }
                        } catch (Exception e) {
                            System.err.println("[RutaController] Error calculando velocidad: " + e.getMessage());
                            ruta.setVelocidadActualKmh(0.0);
                        }
                    } else {
                        ruta.setVelocidadActualKmh(0.0); // Primera actualización GPS
                    }
                    
                    // Calcular distancia restante al destino
                    if (ruta.getLatitudDestino() != null && ruta.getLongitudDestino() != null) {
                        double distanciaRestante = calcularDistancia(
                            gps.getLatitud(), gps.getLongitud(),
                            ruta.getLatitudDestino(), ruta.getLongitudDestino()
                        );
                        ruta.setDistanciaRestanteKm(distanciaRestante);
                        System.out.println("[RutaController] 📍 Distancia restante: " + String.format("%.2f", distanciaRestante) + " km");
                    }
                    
                    // Calcular si está desviado
                    if (ruta.getLatitudOrigen() != null && ruta.getLongitudOrigen() != null &&
                        ruta.getLatitudDestino() != null && ruta.getLongitudDestino() != null) {
                        
                        double distanciaTotal = calcularDistancia(
                            ruta.getLatitudOrigen(), ruta.getLongitudOrigen(),
                            ruta.getLatitudDestino(), ruta.getLongitudDestino()
                        );
                        double distanciaActualADestino = ruta.getDistanciaRestanteKm();
                        
                        // Si la distancia actual es mayor que la distancia total + 20% margen, está desviado
                        ruta.setDesviado(distanciaActualADestino > (distanciaTotal * 1.2));
                        
                        System.out.println("[RutaController] 📊 Análisis - Distancia total: " + 
                                         String.format("%.2f", distanciaTotal) + "km, Restante: " + 
                                         String.format("%.2f", distanciaActualADestino) + "km, Desviado: " + ruta.getDesviado());
                    }
                    
                    Ruta rutaGuardada = rutaRepository.save(ruta);
                    System.out.println("[RutaController] ✅ GPS actualizado - Pos: [" + 
                                     rutaGuardada.getLatitudActual() + ", " + rutaGuardada.getLongitudActual() + 
                                     "], Vel: " + String.format("%.1f", rutaGuardada.getVelocidadActualKmh()) + " km/h");
                    return rutaGuardada;
                })
                .orElse(null);
    }

    // Endpoint para obtener última ubicación conocida
    @GetMapping("/{id}/last-location")
    public GPSCoordinates obtenerUltimaUbicacion(@PathVariable String id) {
        return rutaRepository.findById(id)
                .map(ruta -> {
                    GPSCoordinates gps = new GPSCoordinates();
                    gps.setLatitud(ruta.getLatitudActual());
                    gps.setLongitud(ruta.getLongitudActual());
                    return gps;
                })
                .orElse(null);
    }

    // Endpoint para solicitar actualización de GPS al dispositivo móvil
    @PostMapping("/{id}/request-gps")
    public String solicitarGPSMovil(@PathVariable String id) {
        System.out.println("[RutaController] 📡 Solicitud de GPS recibida para ruta: " + id);
        
        // Aquí podríamos implementar WebSocket, SSE, o FCM para notificar al móvil
        // Por ahora, devolvemos una respuesta indicando que la solicitud fue recibida
        // El móvil debería estar haciendo polling a este endpoint o escuchando notificaciones
        
        return "GPS_REQUEST_SENT";
    }

    @DeleteMapping("/{id}")
    public void eliminarRuta(@PathVariable String id) {
        rutaRepository.deleteById(id);
    }

    // Clase interna para recibir coordenadas GPS
    public static class GPSCoordinates {
        private Double latitud;
        private Double longitud;
        
        public Double getLatitud() { return latitud; }
        public void setLatitud(Double latitud) { this.latitud = latitud; }
        public Double getLongitud() { return longitud; }
        public void setLongitud(Double longitud) { this.longitud = longitud; }
        
        @Override
        public String toString() {
            return String.format("GPS[lat=%.6f, lng=%.6f]", latitud, longitud);
        }
    }

    // Método para calcular distancia entre dos puntos GPS (fórmula de Haversine)
    private double calcularDistancia(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Radio de la Tierra en kilómetros
        
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // distancia en kilómetros
    }
}
