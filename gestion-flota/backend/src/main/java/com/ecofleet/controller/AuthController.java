package com.ecofleet.controller;

import com.ecofleet.model.Usuario;
import com.ecofleet.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UsuarioRepository usuarioRepository;

    // Encriptador de contraseñas seguro
    private BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody Usuario usuario) {
        // 1. Validar si el email ya existe
        if (usuarioRepository.existsByEmail(usuario.getEmail())) {
            return ResponseEntity.badRequest().body(Map.of("error", "El email ya está registrado"));
        }

        // 2. Encriptar la contraseña antes de guardar
        usuario.setPassword(passwordEncoder.encode(usuario.getPassword()));
        
        // 3. Guardar usuario
        usuarioRepository.save(usuario);

        return ResponseEntity.ok(Map.of("message", "Usuario registrado correctamente"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email y contraseña son obligatorios"));
        }

        // 1. Buscar usuario
        Optional<Usuario> usuarioOpt = usuarioRepository.findByEmail(email);

        if (usuarioOpt.isEmpty()) {
             return ResponseEntity.status(401).body(Map.of("error", "Credenciales inválidas"));
        }

        Usuario usuario = usuarioOpt.get();

        // 2. Verificar contraseña
        if (passwordEncoder.matches(password, usuario.getPassword())) {
            // Login exitoso: Devolvemos los datos del usuario (menos la contraseña)
            Map<String, Object> response = new HashMap<>();
            response.put("id", usuario.getId());
            response.put("email", usuario.getEmail());
            response.put("nombre", usuario.getNombre());
            response.put("nombreEmpresa", usuario.getNombreEmpresa());
            
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(401).body(Map.of("error", "Credenciales inválidas"));
        }
    }
}
