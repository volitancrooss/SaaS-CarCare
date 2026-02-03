package com.ecofleet.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document(collection = "rutas")
public class Ruta {
    @Id
    private String id;

    private String origen;
    private String destino;
    private Double distanciaEstimadaKm;
    private String estado; // "PLANIFICADA", "EN_PROCESO", "COMPLETADA"
    
    private String vehiculoId; // Vehiculo asignado
    private String fecha;

    // Coordenadas para el Tracking
    private Double latitudOrigen;
    private Double longitudOrigen;
    private Double latitudDestino;
    private Double longitudDestino;
    
    private Double latitudActual;
    private Double longitudActual;
    
    private Boolean desviado = false;
}
