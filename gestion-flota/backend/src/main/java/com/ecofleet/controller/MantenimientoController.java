package com.ecofleet.controller;

import com.ecofleet.model.Mantenimiento;
import com.ecofleet.repository.MantenimientoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mantenimientos")
@CrossOrigin(origins = "*")
public class MantenimientoController {

    @Autowired
    private MantenimientoRepository mantenimientoRepository;

    @GetMapping
    public List<Mantenimiento> obtenerTodos() {
        return mantenimientoRepository.findAll();
    }

    @GetMapping("/vehiculo/{vehiculoId}")
    public List<Mantenimiento> obtenerPorVehiculo(@PathVariable String vehiculoId) {
        return mantenimientoRepository.findByVehiculoIdOrderByFechaDesc(vehiculoId);
    }

    @PostMapping
    public Mantenimiento crear(@RequestBody Mantenimiento mantenimiento) {
        return mantenimientoRepository.save(mantenimiento);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Mantenimiento> obtenerPorId(@PathVariable String id) {
        return mantenimientoRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        if (mantenimientoRepository.existsById(id)) {
            mantenimientoRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
