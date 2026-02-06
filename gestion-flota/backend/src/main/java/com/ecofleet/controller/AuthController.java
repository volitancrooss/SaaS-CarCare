package com.ecofleet.controller;

import com.ecofleet.model.Usuario;
import com.ecofleet.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {
    
    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private UsuarioRepository usuarioRepository;

    // Encriptador de contraseñas seguro
    private BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody Usuario usuario) {
        logger.info("═══ INICIO REGISTRO ADMIN ═══");
        logger.info("Email: {}", usuario.getEmail());
        
        // 1. Validar si el email ya existe
        if (usuarioRepository.existsByEmail(usuario.getEmail())) {
            logger.warn("Email ya registrado: {}", usuario.getEmail());
            return ResponseEntity.badRequest().body(Map.of("error", "El email ya está registrado"));
        }

        // 2. Encriptar la contraseña antes de guardar
        usuario.setPassword(passwordEncoder.encode(usuario.getPassword()));
        
        // 3. Set default role as ADMIN (Empresa) if not present
        if (usuario.getRole() == null || usuario.getRole().isEmpty()) {
            usuario.setRole("ADMIN");
        }
        
        // 4. Guardar usuario
        Usuario saved = usuarioRepository.save(usuario);
        logger.info("✓ Admin registrado exitosamente | ID: {}", saved.getId());
        logger.info("═══ FIN REGISTRO ADMIN ═══");

        return ResponseEntity.ok(Map.of(
            "message", "Usuario registrado correctamente",
            "id", saved.getId()
        ));
    }

    @PostMapping("/register/conductor")
    public ResponseEntity<?> registerConductor(@RequestBody Map<String, String> payload) {
        logger.info("═══ INICIO REGISTRO CONDUCTOR ═══");
        logger.info("Payload recibido: {}", payload);
        
        String email = payload.get("email");
        String password = payload.get("password");
        String nombre = payload.get("nombre");
        String empresaEmail = payload.get("empresaEmail"); // Email of the company admin to link to

        // Validación exhaustiva de campos
        if (email == null || email.trim().isEmpty()) {
            logger.error("Error: Email del conductor vacío");
            return ResponseEntity.badRequest().body(Map.of("error", "El email del conductor es obligatorio"));
        }
        if (password == null || password.trim().isEmpty()) {
            logger.error("Error: Contraseña vacía");
            return ResponseEntity.badRequest().body(Map.of("error", "La contraseña es obligatoria"));
        }
        if (password.length() < 6) {
            logger.error("Error: Contraseña muy corta ({})", password.length());
            return ResponseEntity.badRequest().body(Map.of("error", "La contraseña debe tener al menos 6 caracteres"));
        }
        if (nombre == null || nombre.trim().isEmpty()) {
            logger.error("Error: Nombre vacío");
            return ResponseEntity.badRequest().body(Map.of("error", "El nombre es obligatorio"));
        }
        if (empresaEmail == null || empresaEmail.trim().isEmpty()) {
            logger.error("Error: Email de empresa vacío");
            return ResponseEntity.badRequest().body(Map.of("error", "El email de la empresa es obligatorio"));
        }

        logger.info("Validación de campos completada ✓");
        
        // Verificar si el email del conductor ya existe
        if (usuarioRepository.existsByEmail(email.trim())) {
            logger.warn("Email del conductor ya registrado: {}", email);
            return ResponseEntity.badRequest().body(Map.of("error", "El email ya está registrado"));
        }

        logger.info("Email del conductor disponible ✓");

        // Find the company admin
        logger.info("Buscando empresa con email: {}", empresaEmail.trim());
        Optional<Usuario> adminOpt = usuarioRepository.findByEmail(empresaEmail.trim());
        if (adminOpt.isEmpty()) {
            logger.error("Empresa no encontrada con email: {}", empresaEmail);
            return ResponseEntity.badRequest().body(Map.of("error", "No se encontró ninguna empresa con ese email. Verifica el email del administrador."));
        }
        Usuario admin = adminOpt.get();
        
        // Verificar que sea realmente un ADMIN
        if (!"ADMIN".equals(admin.getRole())) {
            logger.error("El usuario {} no es ADMIN, es: {}", empresaEmail, admin.getRole());
            return ResponseEntity.badRequest().body(Map.of("error", "El email proporcionado no corresponde a una cuenta de administrador"));
        }

        logger.info("Empresa encontrada ✓ | ID: {} | Nombre: {}", admin.getId(), admin.getNombreEmpresa());

        // Crear conductor
        Usuario conductor = new Usuario();
        conductor.setEmail(email.trim());
        conductor.setPassword(passwordEncoder.encode(password));
        conductor.setNombre(nombre.trim());
        conductor.setRole("CONDUCTOR");
        conductor.setEmpresaId(admin.getId()); // LINK TO ADMIN
        conductor.setNombreEmpresa(admin.getNombreEmpresa()); // Denormalize company name for UI convenience

        logger.info("Guardando conductor en base de datos...");
        Usuario conductorGuardado = usuarioRepository.save(conductor);
        
        logger.info("✓ CONDUCTOR REGISTRADO EXITOSAMENTE");
        logger.info("ID: {}", conductorGuardado.getId());
        logger.info("Nombre: {}", conductorGuardado.getNombre());
        logger.info("Email: {}", conductorGuardado.getEmail());
        logger.info("EmpresaId: {}", conductorGuardado.getEmpresaId());
        logger.info("═══ FIN REGISTRO CONDUCTOR ═══");

        return ResponseEntity.ok(Map.of(
            "message", "Conductor registrado y vinculado correctamente",
            "conductorId", conductorGuardado.getId(),
            "nombreEmpresa", conductorGuardado.getNombreEmpresa() != null ? conductorGuardado.getNombreEmpresa() : ""
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        logger.info("═══ INICIO LOGIN ═══");
        
        String email = credentials.get("email");
        String password = credentials.get("password");

        logger.info("Intento de login para email: {}", email);

        if (email == null || email.trim().isEmpty() || password == null || password.trim().isEmpty()) {
            logger.error("Error: Email o contraseña vacíos");
            return ResponseEntity.badRequest().body(Map.of("error", "Email y contraseña son obligatorios"));
        }

        // 1. Buscar usuario
        Optional<Usuario> usuarioOpt = usuarioRepository.findByEmail(email.trim());

        if (usuarioOpt.isEmpty()) {
            logger.warn("Usuario no encontrado: {}", email);
            return ResponseEntity.status(401).body(Map.of("error", "Credenciales inválidas"));
        }

        Usuario usuario = usuarioOpt.get();
        logger.info("Usuario encontrado | ID: {} | Nombre: {} | Role: {}", usuario.getId(), usuario.getNombre(), usuario.getRole());

        // 2. Verificar contraseña
        if (passwordEncoder.matches(password, usuario.getPassword())) {
            logger.info("✓ Login exitoso para: {}", email);
            
            // Login exitoso: Devolvemos los datos del usuario (menos la contraseña)
            Map<String, Object> response = new HashMap<>();
            response.put("id", usuario.getId());
            response.put("email", usuario.getEmail());
            response.put("nombre", usuario.getNombre());
            response.put("nombreEmpresa", usuario.getNombreEmpresa());
            
            // New fields for frontend logic
            response.put("role", usuario.getRole());
            response.put("empresaId", usuario.getEmpresaId()); // Will be null for ADMINs, populated for CONDUCTORs
            
            logger.info("Respuesta enviada: {}", response);
            logger.info("═══ FIN LOGIN (EXITOSO) ═══");
            
            return ResponseEntity.ok(response);
        } else {
            logger.warn("Contraseña incorrecta para: {}", email);
            logger.info("═══ FIN LOGIN (FALLIDO) ═══");
            return ResponseEntity.status(401).body(Map.of("error", "Credenciales inválidas"));
        }
    }
}
