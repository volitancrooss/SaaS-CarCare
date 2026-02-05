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
        
        // 3. Set default role as ADMIN (Empresa) if not present
        if (usuario.getRole() == null || usuario.getRole().isEmpty()) {
            usuario.setRole("ADMIN");
        }
        
        // 4. Guardar usuario
        usuarioRepository.save(usuario);

        return ResponseEntity.ok(Map.of("message", "Usuario registrado correctamente"));
    }

    @PostMapping("/register/conductor")
    public ResponseEntity<?> registerConductor(@RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        String password = payload.get("password");
        String nombre = payload.get("nombre");
        String empresaEmail = payload.get("empresaEmail"); // Email of the company admin to link to

        if (email == null || password == null || nombre == null || empresaEmail == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Todos los campos son obligatorios"));
        }

        if (usuarioRepository.existsByEmail(email)) {
            return ResponseEntity.badRequest().body(Map.of("error", "El email ya está registrado"));
        }

        // Find the company admin
        Optional<Usuario> adminOpt = usuarioRepository.findByEmail(empresaEmail);
        if (adminOpt.isEmpty()) {
             return ResponseEntity.badRequest().body(Map.of("error", "No se encontró ninguna empresa con ese email"));
        }
        Usuario admin = adminOpt.get();

        Usuario conductor = new Usuario();
        conductor.setEmail(email);
        conductor.setPassword(passwordEncoder.encode(password));
        conductor.setNombre(nombre);
        conductor.setRole("CONDUCTOR");
        conductor.setEmpresaId(admin.getId()); // LINK TO ADMIN
        conductor.setNombreEmpresa(admin.getNombreEmpresa()); // Denormalize company name for UI convenience

        usuarioRepository.save(conductor);

        return ResponseEntity.ok(Map.of("message", "Conductor registrado y vinculado correctamente"));
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
            
            // New fields for frontend logic
            response.put("role", usuario.getRole());
            response.put("empresaId", usuario.getEmpresaId()); // Will be null for ADMINs, populated for CONDUCTORs
            
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(401).body(Map.of("error", "Credenciales inválidas"));
        }
    }
}
