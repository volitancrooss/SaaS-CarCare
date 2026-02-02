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
}
