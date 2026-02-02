# 🚚 EcoFleet: Sistema de Gestión de Flota Intermodular

EcoFleet es una solución integral para la gestión sostenible de flotas de vehículos, desarrollada como proyecto intermodular integrando las competencias de los distintos módulos del ciclo formativo.

## 📚 Integración Modular

A continuación se detalla la implicación de cada módulo en el proyecto, especificando las tecnologías y responsabilidades:

### 1. Sostenibilidad aplicada al sistema productivo (SOJ)
*   **Enfoque:** El eje central del proyecto. Optimización de rutas para reducir huella de carbono.
*   **Funcionalidad:** Cálculo de emisiones CO2 y algoritmos de asignación eficiente.

### 2. Programación de servicios y procesos (PGV)
*   **Responsabilidad:** Desarrollo del Backend y API REST.
*   **Tecnología:** Java 17, Spring Boot 3.2.1.
*   **Implementación:** Gestión de concurrencia, controladores REST y lógica de negocio segura.

### 3. Programación multimedia y dispositivos móviles (PGL)
*   **Responsabilidad:** Desarrollo de aplicación móvil nativa para conductores.
*   **Tecnología:** Android (Java/Kotlin), Gradle.
*   **Implementación:** Interfaz móvil, consumo de API REST para rutas en tiempo real.

### 4. Despliegue de aplicaciones web (DPL)
*   **Responsabilidad:** Infraestructura y puesta en producción.
*   **Tecnología:** Docker, Docker Compose.
*   **Implementación:** Contenedorización de MongoDB y Backend. Configuración de entornos.

### 5. Acceso a datos (AED)
*   **Responsabilidad:** Persistencia de datos.
*   **Tecnología:** MongoDB (NoSQL), Spring Data MongoDB.
*   **Implementación:** Diseño de esquema JSON (Vehículos, Rutas), operaciones CRUD complejas.

### 6. Desarrollo de interfaces (DAD)
*   **Responsabilidad:** Frontend y experiencia de usuario (UX/UI).
*   **Tecnología:** Next.js 16, React 19, Tailwind CSS v4.
*   **Implementación:** Dashboard administrativo moderno, responsive y dinámico.

### 7. Sistema de gestión empresarial (SSG)
*   **Responsabilidad:** Lógica de gestión ERP.
*   **Implementación:** Integración de procesos de negocio (mantenimiento, personal, costes) y automatización.

---

## 🛠️ Estructura Técnica Actual

### Backend (PGV, AED)
*   **Carpeta**: `backend/`
*   **Puerto**: `8080`
*   **Base de Datos**: MongoDB (Dockerizado).
*   **Ejecución**: `mvn spring-boot:run`

### Frontend (DAD, SSG)
*   **Carpeta**: `frontend/`
*   **Puerto**: `3000`
*   **Tecnología**: Next.js, TailwindCSS.
*   **Ejecución**: `npm run dev`

### Móvil (PGL)
*   **Carpeta**: `android/`
*   **Ejecución**: Android Studio.

## 🚀 Guía de Inicio Rápido

### 1. Base de Datos (Docker)
Asegúrate de tener Docker corriendo y ejecuta:
```bash
docker-compose up -d
```

### 2. Backend
```bash
cd backend
./mvnw spring-boot:run
```

### 3. Frontend
```bash
cd frontend
npm run dev
```
