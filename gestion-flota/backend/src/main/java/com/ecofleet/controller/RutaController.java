package com.ecofleet.controller;

import com.ecofleet.model.Ruta;
import com.ecofleet.repository.RutaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rutas")
@CrossOrigin(origins = "http://localhost:3000")
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
                    if (rutaActualizada.getEstado() != null) ruta.setEstado(rutaActualizada.getEstado());
                    if (rutaActualizada.getLatitudActual() != null) ruta.setLatitudActual(rutaActualizada.getLatitudActual());
                    if (rutaActualizada.getLongitudActual() != null) ruta.setLongitudActual(rutaActualizada.getLongitudActual());
                    if (rutaActualizada.getDesviado() != null) ruta.setDesviado(rutaActualizada.getDesviado());
                    return rutaRepository.save(ruta);
                })
                .orElse(null);
    }

    @GetMapping("/{id}")
    public Ruta obtenerRuta(@PathVariable String id) {
        return rutaRepository.findById(id).orElse(null);
    }

    @DeleteMapping("/{id}")
    public void eliminarRuta(@PathVariable String id) {
        rutaRepository.deleteById(id);
    }
}
