"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import BackgroundMeteors from "@/componentes/BackgroundMeteors";
import styles from "../../page.module.css";
import dynamic from "next/dynamic";
import ChatRuta from "@/componentes/ChatRuta";

// Dynamic import for Map to avoid SSR issues with Leaflet
const MapTracking = dynamic(() => import("@/componentes/MapTracking"), {
    ssr: false,
    loading: () => <div style={{ height: "400px", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>Cargando Mapa...</div>
});

interface Ruta {
    id: string;
    origen: string;
    destino: string;
    distanciaEstimadaKm: number;
    estado: string;
    vehiculoId: string;
    fecha: string;
    latitudOrigen: number;
    longitudOrigen: number;
    latitudDestino: number;
    longitudDestino: number;
    latitudActual: number;
    longitudActual: number;
    desviado: boolean;
}

const API_URL = typeof window !== 'undefined' && window.location.hostname === '10.0.2.2'
    ? ''
    : (process.env.NEXT_PUBLIC_API_URL || "https://saas-carcare-production.up.railway.app");

export default function RutaTracking() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const [ruta, setRuta] = useState<Ruta | null>(null);
    const [loading, setLoading] = useState(true);
    const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
    const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

    // Default coords if none exist (Madrid area as placeholder)
    const defaultOrigin: [number, number] = [40.4168, -3.7038];
    const defaultDest: [number, number] = [41.3851, 2.1734];

    const calcularRutaDinamica = async (currentLat: number, currentLng: number, destLat: number, destLng: number) => {
        try {
            setIsCalculatingRoute(true);
            console.log('[RutaTracking] Calculando ruta dinámica desde:', { currentLat, currentLng }, 'hasta:', { destLat, destLng });

            // Usar OpenRouteService API (gratuita, sin API key para uso básico)
            const url = `https://router.project-osrm.org/route/v1/driving/${currentLng},${currentLat};${destLng},${destLat}?overview=full&geometries=geojson`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                const coordinates = data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
                console.log('[RutaTracking] Ruta calculada con', coordinates.length, 'puntos');
                setRouteCoordinates(coordinates);

                // Calcular distancia y tiempo estimado
                const distance = (data.routes[0].distance / 1000).toFixed(1); // km
                const duration = Math.round(data.routes[0].duration / 60); // minutos
                console.log(`[RutaTracking] Distancia: ${distance} km, Tiempo estimado: ${duration} min`);
            } else {
                console.warn('[RutaTracking] No se pudo calcular la ruta, usando línea directa');
                // Fallback: línea directa
                setRouteCoordinates([[currentLat, currentLng], [destLat, destLng]]);
            }
        } catch (error) {
            console.error('[RutaTracking] Error calculando ruta:', error);
            // Fallback: línea directa
            setRouteCoordinates([[currentLat, currentLng], [destLat, destLng]]);
        } finally {
            setIsCalculatingRoute(false);
        }
    };

    // Función accesible para recargar datos desde fuera del useEffect
    let globalRequest: AbortController | null = null;
    let isMounted = true;
    let simulationInterval: NodeJS.Timeout | null = null;

    const recargarDatos = async () => {
        if (!isMounted) return;
        
        // Cancelar request anterior si existe
        if (globalRequest) {
            globalRequest.abort();
        }
        
        globalRequest = new AbortController();
        
        try {
            const res = await fetch(`${API_URL}/api/rutas/${id}`, {
                signal: globalRequest.signal
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();

            console.log('[RutaTracking] 🚨 DATOS COMPLETOS RECIBIDOS:');
            console.log('- Estado:', data.estado);
            console.log('- Tiene GPS:', !!(data.latitudActual && data.longitudActual));
            console.log('- GPS Origen:', data.latitudOrigen, data.longitudOrigen);
            console.log('- GPS Destino:', data.latitudDestino, data.longitudDestino);
            console.log('- GPS ACTUAL:', data.latitudActual, data.longitudActual);
            console.log('- GPS Actual formateado:', data.latitudActual && data.longitudActual ? 
                `${data.latitudActual.toFixed(4)}, ${data.longitudActual.toFixed(4)}` : 'NULL');
            console.log('- Fecha:', data.fecha);
            console.log('- ID:', data.id);

            // IMPORTANTE: Calcular ruta desde la posición GPS ACTUAL del conductor
            if (data.estado === 'EN_CURSO') {
                if (data.latitudActual && data.longitudActual && data.latitudDestino && data.longitudDestino) {
                    console.log('[RutaTracking] ✅ GPS REAL detectado - Ubicación:', {
                        lat: data.latitudActual.toFixed(4),
                        lng: data.longitudActual.toFixed(4)
                    });
                    console.log('[RutaTracking] Calculando ruta desde posición REAL del conductor');
                    await calcularRutaDinamica(
                        data.latitudActual,  // Desde donde está AHORA el conductor
                        data.longitudActual,
                        data.latitudDestino, // Hasta el destino
                        data.longitudDestino
                    );
                } else {
                    // Si no hay GPS actual, mostrar sin ruta pero en modo de espera
                    console.log('[RutaTracking] ⏳ Esperando GPS REAL del emulador/dispositivo...');
                    setRouteCoordinates([]); // Limpiar ruta anterior
                    
                    // Mostrar toast informativo
                    if (!document.hidden) { // Solo si la pestaña está visible
                        toast.info("📱 Esperando ubicación GPS del dispositivo Android...", {
                            duration: 3000,
                            position: 'top-center'
                        });
                    }
                }
            } else if (data.estado === 'PLANIFICADA' && data.latitudOrigen && data.longitudOrigen && data.latitudDestino && data.longitudDestino) {
                // Si la ruta aún no ha iniciado, mostrar desde el origen planificado
                console.log('[RutaTracking] Ruta planificada - Mostrando ruta desde origen');
                await calcularRutaDinamica(
                    data.latitudOrigen,
                    data.longitudOrigen,
                    data.latitudDestino,
                    data.longitudDestino
                );
            }

            if (isMounted) {
                setRuta(data);
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error('[RutaTracking] Error cargando ruta:', err);
                // No mostrar toast para cada error de red para evitar spam
            }
        } finally {
            if (isMounted) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        let currentRequest: AbortController | null = null;
        let previousState: string | undefined;

        const cargarDatosSafe = async () => {
            if (!isMounted) return;
            
            // Cancelar request anterior si existe
            if (currentRequest) {
                currentRequest.abort();
            }
            
            currentRequest = new AbortController();
            
            try {
                const res = await fetch(`${API_URL}/api/rutas/${id}`, {
                    signal: currentRequest.signal
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const data = await res.json();
                console.log('[RutaTracking] 🚨 DATOS COMPLETOS RECIBIDOS:');
                console.log('- Estado:', data.estado);
                console.log('- Tiene GPS:', !!(data.latitudActual && data.longitudActual));
                console.log('- GPS Origen:', data.latitudOrigen, data.longitudOrigen);
                console.log('- GPS Destino:', data.latitudDestino, data.longitudDestino);
                console.log('- GPS ACTUAL:', data.latitudActual, data.longitudActual);
                console.log('- GPS Actual formateado:', data.latitudActual && data.longitudActual ? 
                    `${data.latitudActual.toFixed(4)}, ${data.longitudActual.toFixed(4)}` : 'NULL');
                console.log('- Fecha:', data.fecha);
                console.log('- ID:', data.id);

                // IMPORTANTE: Calcular ruta desde la posición GPS ACTUAL del conductor
                if (data.estado === 'EN_CURSO') {
                    if (data.latitudActual && data.longitudActual && data.latitudDestino && data.longitudDestino) {
                        console.log('[RutaTracking] ✅ GPS REAL detectado - Ubicación:', {
                            lat: data.latitudActual.toFixed(4),
                            lng: data.longitudActual.toFixed(4)
                        });
                        console.log('[RutaTracking] Calculando ruta desde posición REAL del conductor');
                        await calcularRutaDinamica(
                            data.latitudActual,  // Desde donde está AHORA el conductor
                            data.longitudActual,
                            data.latitudDestino, // Hasta el destino
                            data.longitudDestino
                        );
                    } else {
                        // Si no hay GPS actual, mostrar sin ruta pero en modo de espera
                        console.log('[RutaTracking] ⏳ Esperando GPS REAL del emulador/dispositivo...');
                        setRouteCoordinates([]); // Limpiar ruta anterior
                        
                        // Mostrar toast informativo
                        if (!document.hidden) { // Solo si la pestaña está visible
                            toast.info("📱 Esperando ubicación GPS del dispositivo Android...", {
                                duration: 3000,
                                position: 'top-center'
                            });
                        }
                    }
                } else if (data.estado === 'PLANIFICADA' && data.latitudOrigen && data.longitudOrigen && data.latitudDestino && data.longitudDestino) {
                    // Si la ruta aún no ha iniciado, mostrar desde el origen planificado
                    console.log('[RutaTracking] Ruta planificada - Mostrando ruta desde origen');
                    await calcularRutaDinamica(
                        data.latitudOrigen,
                        data.longitudOrigen,
                        data.latitudDestino,
                        data.longitudDestino
                    );
                }

                if (isMounted) {
                    // Detectar si la ruta recién cambió a EN_CURSO (inició)
                    if (previousState && previousState !== 'EN_CURSO' && data.estado === 'EN_CURSO') {
                        console.log('🚀 ¡RUTA INICIADA! Solicitando GPS inmediato del móvil...');
                        
                        // Solicitar GPS inmediatamente al iniciar
                        if (typeof window !== 'undefined' && (window as any).AndroidTracker) {
                            setTimeout(() => {
                                try {
                                    (window as any).AndroidTracker.requestGPSUpdate(id);
                                    console.log('📱 Solicitud GPS enviada al iniciar ruta');
                                } catch (error) {
                                    console.error('❌ Error enviando solicitud GPS:', error);
                                }
                            }, 500);
                        }
                    }
                    
                    previousState = data.estado;
                    setRuta(data);
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error('[RutaTracking] Error cargando ruta:', err);
                    // No mostrar toast para cada error de red para evitar spam
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        cargarDatosSafe();

        // Actualizar posición GPS y recalcular ruta cada 2 segundos (match con Android)
        // Esto hace que la ruta sea flexible y se adapte al movimiento real del conductor
        const interval = setInterval(() => {
            if (isMounted) {
                const currentState = ruta?.estado;
                if (currentState === 'EN_CURSO') {
                    console.log('[RutaTracking] 📱 Solicitando actualización de GPS del móvil Android...');
                    recargarDatos(); // Esto recalculará la ruta desde la nueva posición
                }
            }
        }, 2000); // Reducido a 2s para match con Android

        return () => {
            clearInterval(interval);
            if (currentRequest) {
                currentRequest.abort();
            }
        };
    }, [id]); // ✅ Solo depende de ID de ruta, no de 'ruta'

    // Cleanup cuando el componente se desmonta
    useEffect(() => {
        return () => {
            isMounted = false;
            if (globalRequest) {
                globalRequest.abort();
            }
            if (simulationInterval) {
                clearInterval(simulationInterval);
            }
        };
    }, []);

    if (loading) return <BackgroundMeteors><div>Cargando...</div></BackgroundMeteors>;
    if (!ruta) return <BackgroundMeteors><div>No encontrada</div></BackgroundMeteors>;

    return (
        <BackgroundMeteors>
            <main style={{ height: "100%", width: "100%", overflowY: "auto", position: "relative", zIndex: 20 }}>
                <div className={styles.container}>
                    <header className={styles.header} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <button
                                onClick={() => router.push("/")}
                                className={styles.navButton}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    width: '40px',
                                    height: '40px',
                                    padding: '0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '12px'
                                }}
                            >
                                ←
                            </button>
                            <div className={styles.title}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.4rem' }}>
                                    <span className={styles.badge} style={{
                                        background: ruta.estado === 'EN_CURSO' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(156, 163, 175, 0.1)',
                                        color: ruta.estado === 'EN_CURSO' ? '#60a5fa' : '#9ca3af',
                                        fontSize: '0.65rem'
                                    }}>
                                        RUTA #{ruta.id?.slice(-6).toUpperCase()}
                                    </span>
                                    
                                    {/* Indicador de estado GPS */}
                                    {ruta.estado === 'EN_CURSO' && (
                                        <span className={styles.badge} style={{
                                            background: (ruta.latitudActual && ruta.longitudActual) ? 
                                                'rgba(34, 197, 94, 0.2)' : 
                                                'rgba(251, 191, 36, 0.2)',
                                            color: (ruta.latitudActual && ruta.longitudActual) ? 
                                                '#22c55e' : '#f59e0b',
                                            fontSize: '0.6rem',
                                            fontWeight: '700'
                                        }}>
                                            {(ruta.latitudActual && ruta.longitudActual) ? 
                                                '📡 GPS ACTIVO' : 
                                                '⏳ ESPERANDO GPS'}
                                        </span>
                                    )}
                                    
                                    <span style={{ color: '#4b5563', fontSize: '0.8rem' }}>•</span>
                                    <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{ruta.fecha}</span>
                                </div>
                                <h1 style={{ fontSize: '2.2rem', fontWeight: '900', letterSpacing: '-0.02em' }}>
                                    {ruta.origen} <span style={{ color: 'var(--accent)', opacity: 0.5 }}>➝</span> {ruta.destino}
                                </h1>
                            </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Vehículo Asignado</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3bf63b' }}></div>
                                <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{ruta.vehiculoId}</span>
                            </div>
                        </div>
                    </header>

                    <div className={styles.rutasContainer} style={{ gridTemplateColumns: '1fr 350px', gap: '2rem', marginTop: '2rem' }}>
                        {/* Map Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className={styles.card} style={{ height: '600px', padding: '0', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                                <MapTracking
                                    origin={[ruta.latitudOrigen, ruta.longitudOrigen]}
                                    destination={[ruta.latitudDestino, ruta.longitudDestino]}
                                    current={[ruta.latitudActual, ruta.longitudActual]}
                                    isDeviated={ruta.desviado}
                                    routeCoordinates={routeCoordinates}
                                />
                            </div>

                                    {/* Botón de Debug para forzar GPS */}
                                    <button
                                        onClick={async () => {
                                            console.log('🚨 FORZANDO COORDENADAS MANUAL (Londres)');
                                            const lat = 51.5074;  // Londres
                                            const lng = -0.1278;
                                            
                                            try {
                                                const response = await fetch(`${API_URL}/api/rutas/${id}`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        latitudActual: lat,
                                                        longitudActual: lng
                                                    })
                                                });
                                                
                                                if (response.ok) {
                                                    console.log(`✅ Coordenadas manuales enviadas: ${lat}, ${lng}`);
                                                    // Recargar datos después de 500ms para asegurar que el backend procese
                                                    setTimeout(() => recargarDatos(), 500);
                                                } else {
                                                    console.error('❌ Backend rechazó coordenadas manuales');
                                                }
                                            } catch (err) {
                                                console.error('❌ Error enviando coordenadas manuales:', err);
                                            }
                                        }}
                                        style={{
                                            padding: '0.8rem 1.2rem',
                                            background: 'rgba(59, 130, 246, 0.2)',
                                            border: '1px solid rgba(59, 130, 246, 0.3)',
                                            borderRadius: '12px',
                                            fontSize: '0.8rem',
                                            color: '#3b82f6',
                                            cursor: 'pointer',
                                            marginBottom: '1rem',
                                            width: '100%'
                                        }}
                                    >
                                        🌍 FORZAR COORDENADAS (Londres)
                                    </button>

                                    <button
                                        onClick={() => {
                                            console.log('🚨 FORZANDO RECARGA MANUAL DE GPS');
                                            if (navigator.geolocation) {
                                                navigator.geolocation.getCurrentPosition(
                                                    async (position) => {
                                                        console.log('📡 GPS BROWSER OBTENIDO:', {
                                                            lat: position.coords.latitude,
                                                            lng: position.coords.longitude,
                                                            accuracy: position.coords.accuracy
                                                        });
                                                        try {
                                                            const response = await fetch(`${API_URL}/api/rutas/${id}`, {
                                                                method: 'PUT',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    latitudActual: position.coords.latitude,
                                                                    longitudActual: position.coords.longitude
                                                                })
                                                            });
                                                            if (response.ok) {
                                                                console.log('✅ GPS del navegador enviado al backend');
                                                                recargarDatos();
                                                            } else {
                                                                console.error('❌ Backend rechazó GPS:', response.status);
                                                            }
                                                        } catch (err) {
                                                            console.error('❌ Error enviando GPS browser:', err);
                                                        }
                                                    },
                                                    (error) => {
                                                        console.error('❌ Error GPS browser:', error.message || error);
                                                        console.error('❌ Error GPS code:', error.code);
                                                        
                                                        // Mostrar mensaje amigable al usuario
                                                        switch(error.code) {
                                                            case error.PERMISSION_DENIED:
                                                                alert('❌ Permiso de GPS denegado. Por favor, permite el acceso a la ubicación en tu navegador.');
                                                                break;
                                                            case error.POSITION_UNAVAILABLE:
                                                                alert('❌ GPS no disponible. Revisa tu conexión GPS.');
                                                                break;
                                                            case error.TIMEOUT:
                                                                alert('❌ Timeout al obtener GPS. Intenta de nuevo.');
                                                                break;
                                                            default:
                                                                alert(`❌ Error GPS: ${error.message || 'Desconocido'}`);
                                                        }
                                                    },
                                                    { 
                                                        enableHighAccuracy: false,  // Cambiado a false para emulador
                                                        timeout: 10000,  // Aumentado timeout
                                                        maximumAge: 60000   // Permite ubicación cacheada
                                                    }
                                                );
                                            }
                                        }}
                                        style={{
                                            padding: '0.8rem 1.2rem',
                                            background: 'rgba(239, 68, 68, 0.2)',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            borderRadius: '12px',
                                            fontSize: '0.8rem',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            marginBottom: '1rem',
                                            width: '100%'
                                        }}
                                    >
                                        🚨 DEBUG: Forzar GPS del Navegador
                                    </button>

                                    <button
                                        onClick={async () => {
                                            console.log('📱 LOCALIZANDO DISPOSITIVO MÓVIL ANDROID...');
                                            toast.loading('📱 Buscando dispositivo móvil...', { id: 'locate-mobile' });
                                            
                                            try {
                                                // Recargar datos actuales para obtener última ubicación del móvil
                                                console.log('🔄 Obteniendo última ubicación conocida del móvil...');
                                                await recargarDatos();
                                                
                                                if (ruta?.latitudActual && ruta?.longitudActual) {
                                                    console.log('📱 Ubicación del móvil encontrada:', {
                                                        lat: ruta.latitudActual,
                                                        lng: ruta.longitudActual
                                                    });
                                                    
                                                    // Centrar el mapa en la ubicación actual del móvil
                                                    setRouteCoordinates([[ruta.latitudActual, ruta.longitudActual]]);
                                                    toast.success('📱 Dispositivo móvil localizado correctamente', { id: 'locate-mobile' });
                                                } else {
                                                    toast.error('❌ No hay ubicación GPS del dispositivo móvil', { id: 'locate-mobile' });
                                                }
                                            } catch (error) {
                                                console.error('❌ Error localizando dispositivo móvil:', error);
                                                toast.error('❌ No se pudo localizar el dispositivo móvil', { id: 'locate-mobile' });
                                            }
                                        }}
                                        style={{
                                            padding: '1rem 1.2rem',
                                            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(59, 130, 246, 0.2))',
                                            border: '1px solid rgba(34, 197, 94, 0.4)',
                                            borderRadius: '12px',
                                            fontSize: '0.9rem',
                                            color: '#22c55e',
                                            cursor: 'pointer',
                                            marginBottom: '1rem',
                                            width: '100%',
                                            fontWeight: '700',
                                            boxShadow: '0 4px 15px rgba(34, 197, 94, 0.2)'
                                        }}
                                    >
                                        📱 LOCALIZAR DISPOSITIVO MÓVIL ANDROID
                                    </button>

                                    <button
                                        onClick={async () => {
                                            console.log('🚀 SOLICITANDO GPS EN TIEMPO REAL DEL MÓVIL...');
                                            toast.loading('📡 Solicitando GPS del dispositivo...', { id: 'request-gps' });
                                            
                                            // Enviar una solicitud directa al móvil para que envíe su ubicación
                                            if (typeof window !== 'undefined' && (window as any).AndroidTracker) {
                                                console.log('📱 Enviando solicitud GPS a Android Tracker...');
                                                try {
                                                    (window as any).AndroidTracker.requestGPSUpdate(id);
                                                    toast.success('📡 Solicitud GPS enviada al dispositivo', { id: 'request-gps' });
                                                    
                                                    // Esperar 2 segundos y recargar datos para obtener la respuesta
                                                    setTimeout(() => {
                                                        recargarDatos();
                                                    }, 2000);
                                                } catch (error) {
                                                    console.error('❌ Error comunicando con Android:', error);
                                                    toast.error('❌ No se pudo comunicar con el dispositivo Android', { id: 'request-gps' });
                                                }
                                            } else {
                                                console.log('⚠️ AndroidTracker no disponible - usando fallback de polling...');
                                                
                                                // Fallback: Intentar forzar una actualización más agresiva
                                                for (let i = 0; i < 5; i++) {
                                                    setTimeout(async () => {
                                                        await recargarDatos();
                                                        console.log(`🔄 Intento ${i + 1} de obtener GPS del móvil...`);
                                                    }, i * 1000);
                                                }
                                                
                                                toast.success('🔄 Iniciando actualización continua de GPS', { id: 'request-gps' });
                                            }
                                        }}
                                        style={{
                                            padding: '1rem 1.2rem',
                                            background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.2), rgba(251, 191, 36, 0.2))',
                                            border: '1px solid rgba(251, 146, 60, 0.4)',
                                            borderRadius: '12px',
                                            fontSize: '0.9rem',
                                            color: '#fb923c',
                                            cursor: 'pointer',
                                            marginBottom: '1rem',
                                            width: '100%',
                                            fontWeight: '700',
                                            boxShadow: '0 4px 15px rgba(251, 146, 60, 0.2)'
                                        }}
                                    >
                                        🚀 SOLICITAR GPS EN TIEMPO REAL
                                    </button>

                                    <button
                                        onClick={async () => {
                                            console.log('🧪 SIMULANDO GPS DESDE ANDROID (PRUEBAS)...');
                                            toast.loading('🧪 Simulando GPS Android...', { id: 'simulate-gps' });
                                            
                                            // Simular coordenadas de Madrid en movimiento
                                            const baseLat = 40.4168;
                                            const baseLng = -3.7038;
                                            const randomOffset = () => (Math.random() - 0.5) * 0.001; // Pequeños movimientos
                                            
                                            const simulatedLat = baseLat + randomOffset();
                                            const simulatedLng = baseLng + randomOffset();
                                            
                                            try {
                                                // Usar el endpoint existente PUT mientras el backend se recompila
                                                const response = await fetch(`${API_URL}/api/rutas/${id}`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        latitudActual: simulatedLat,
                                                        longitudActual: simulatedLng
                                                    })
                                                });
                                                
                                                if (response.ok) {
                                                    console.log('✅ GPS simulado enviado correctamente:', { simulatedLat, simulatedLng });
                                                    toast.success('🧪 GPS Android simulado correctamente', { id: 'simulate-gps' });
                                                    
                                                    // Recargar datos para ver el efecto inmediato
                                                    setTimeout(() => {
                                                        recargarDatos();
                                                    }, 500);
                                                } else {
                                                    throw new Error(`HTTP ${response.status}`);
                                                }
                                            } catch (error) {
                                                console.error('❌ Error simulando GPS Android:', error);
                                                toast.error('❌ Error al simular GPS Android', { id: 'simulate-gps' });
                                            }
                                        }}
                                        style={{
                                            padding: '1rem 1.2rem',
                                            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.2))',
                                            border: '1px solid rgba(168, 85, 247, 0.4)',
                                            borderRadius: '12px',
                                            fontSize: '0.9rem',
                                            color: '#a855f7',
                                            cursor: 'pointer',
                                            marginBottom: '1rem',
                                            width: '100%',
                                            fontWeight: '700',
                                            boxShadow: '0 4px 15px rgba(168, 85, 247, 0.2)'
                                        }}
                                    >
                                        🧪 SIMULAR GPS ANDROID (PRUEBAS)
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (simulationInterval) {
                                                clearInterval(simulationInterval);
                                                simulationInterval = null;
                                                toast.info('🛑 Simulación GPS detenida', { id: 'simulate-continuous' });
                                            } else {
                                                console.log('🚬 INICIANDO SIMULACIÓN CONTINUA DE GPS...');
                                                toast.loading('🚬 Iniciando simulación continua...', { id: 'simulate-continuous' });
                                                
                                                // Base coordinates (Madrid area)
                                                let currentLat = 40.4168;
                                                let currentLng = -3.7038;
                                                
                                                simulationInterval = setInterval(async () => {
                                                    // Simular movimiento gradual
                                                    currentLat += (Math.random() - 0.5) * 0.0005; // Movimiento pequeño
                                                    currentLng += (Math.random() - 0.5) * 0.0005;
                                                    
                                                    try {
                                                        const response = await fetch(`${API_URL}/api/rutas/${id}`, {
                                                            method: 'PUT',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                latitudActual: currentLat,
                                                                longitudActual: currentLng
                                                            })
                                                        });
                                                        
                                                        if (response.ok) {
                                                            console.log(`🚬 GPS simulado continuo: [${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}]`);
                                                            
                                                            // Actualizar también las coordenadas de la ruta
                                                            setRouteCoordinates([[currentLat, currentLng]]);
                                                        }
                                                    } catch (error) {
                                                        console.error('❌ Error en simulación continua:', error);
                                                    }
                                                }, 2000); // Cada 2 segundos como el Android real
                                                
                                                setTimeout(() => {
                                                    toast.success('🚬 Simulación GPS continua iniciada (cada 2s)', { id: 'simulate-continuous' });
                                                }, 500);
                                            }
                                        }}
                                        style={{
                                            padding: '1rem 1.2rem',
                                            background: simulationInterval 
                                                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))'
                                                : 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))',
                                            border: simulationInterval 
                                                ? '1px solid rgba(239, 68, 68, 0.4)'
                                                : '1px solid rgba(34, 197, 94, 0.4)',
                                            borderRadius: '12px',
                                            fontSize: '0.9rem',
                                            color: simulationInterval ? '#ef4444' : '#22c55e',
                                            cursor: 'pointer',
                                            marginBottom: '1rem',
                                            width: '100%',
                                            fontWeight: '700',
                                            boxShadow: simulationInterval 
                                                ? '0 4px 15px rgba(239, 68, 68, 0.2)'
                                                : '0 4px 15px rgba(34, 197, 94, 0.2)',
                                            animation: simulationInterval ? 'pulse 2s infinite' : 'none'
                                        }}
                                    >
                                        {simulationInterval ? '🛑 DETENER SIMULACIÓN GPS' : '🚬 INICIAR SIMULACIÓN CONTINUA'}
                                    </button>

                                    {/* Indicador de estado de ruta */}
                                    {isCalculatingRoute && (
                                        <div style={{
                                            padding: '0.8rem 1.2rem',
                                            background: 'rgba(59, 246, 59, 0.1)',
                                            border: '1px solid rgba(59, 246, 59, 0.3)',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.8rem',
                                            fontSize: '0.85rem',
                                            color: '#3bf63b'
                                        }}>
                                            <div style={{
                                                width: '12px',
                                                height: '12px',
                                                border: '2px solid #3bf63b',
                                                borderTopColor: 'transparent',
                                                borderRadius: '50%',
                                                animation: 'spin 1s linear infinite'
                                            }}></div>
                                            Calculando ruta óptima por calles...
                                        </div>
                                    )}
                                    {routeCoordinates.length > 0 && !isCalculatingRoute && (
                                <div style={{
                                    padding: '0.8rem 1.2rem',
                                    background: 'rgba(59, 246, 59, 0.05)',
                                    border: '1px solid rgba(59, 246, 59, 0.2)',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.8rem',
                                    fontSize: '0.85rem',
                                    color: '#3bf63b'
                                }}>
                                    ✓ Ruta dinámica calculada con {routeCoordinates.length} puntos
                                </div>
                            )}

                            {/* Timeline Horizontal (Simulated) */}
                            <div className={styles.card} style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: '600' }}>PROGRESS TRACKER</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: '700' }}>65% COMPLETE</span>
                                </div>
                                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '65%', background: 'linear-gradient(to right, var(--accent), #3bf63b)', borderRadius: '4px', boxShadow: '0 0 15px var(--accent)' }}></div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.8rem', fontSize: '0.75rem', color: '#4b5563' }}>
                                    <span>SALIDA: {ruta.origen}</span>
                                    <span>LLEGADA ESTIMADA: 45 MIN</span>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar Stats */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className={styles.card} style={{ background: 'linear-gradient(145deg, rgba(30,30,40,0.95), rgba(20,20,25,0.95))' }}>
                                <h3 className={styles.cardTitle} style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    Telemetría Real
                                </h3>

                                {ruta.desviado && (
                                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)', animation: 'pulse 2s infinite' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '800', fontSize: '0.85rem' }}>
                                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            ALERTA DE DESVÍO
                                        </div>
                                        <p style={{ fontSize: '0.75rem', marginTop: '0.4rem', opacity: 0.8 }}>Trayectoria fuera de parámetros.</p>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Velocidad Actual</span>
                                        <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff' }}>85 <span style={{ fontSize: '0.8rem', color: '#4b5563' }}>KM/H</span></span>
                                    </div>

                                    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Distancia Restante</span>
                                        <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff' }}>{(ruta.distanciaEstimadaKm * 0.35).toFixed(1)} <span style={{ fontSize: '0.8rem', color: '#4b5563' }}>KM</span></span>
                                    </div>

                                    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Estado del Canal</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', animation: 'pulse 1s infinite' }}></div>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#4ade80' }}>Conectado</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    <button
                                        className={styles.submitButton}
                                        style={{
                                            height: '54px',
                                            fontSize: '1rem',
                                            backgroundColor: ruta.estado === 'EN_CURSO' ? 'rgba(239, 68, 68, 0.1)' : '#3bf63b',
                                            color: ruta.estado === 'EN_CURSO' ? '#ef4444' : '#000',
                                            border: ruta.estado === 'EN_CURSO' ? '1px solid #ef4444' : 'none',
                                            boxShadow: ruta.estado === 'EN_CURSO' ? 'none' : '0 10px 20px -5px rgba(59, 246, 59, 0.3)'
                                        }}
                                        onClick={async () => {
                                            const nuevoEstado = ruta.estado === 'EN_CURSO' ? 'PLANIFICADA' : 'EN_CURSO';

                                            if (typeof window !== 'undefined' && (window as any).AndroidTracker) {
                                                if (nuevoEstado === 'EN_CURSO') {
                                                    (window as any).AndroidTracker.startTracking(id);
                                                } else {
                                                    (window as any).AndroidTracker.stopTracking();
                                                }
                                            }

                                            await fetch(`${API_URL}/api/rutas/${id}`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ estado: nuevoEstado })
                                            });
                                            setRuta({ ...ruta, estado: nuevoEstado });
                                            toast.info(`Sistema ${nuevoEstado === 'EN_CURSO' ? 'Activado' : 'Desactivado'}`);
                                        }}
                                    >
                                        {ruta.estado === 'EN_CURSO' ? 'DETENER RASTREO' : 'ACTIVAR GPS / INICIAR'}
                                    </button>

                                    <button
                                        className={styles.navButton}
                                        style={{
                                            height: '50px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: '#fff',
                                            borderRadius: '12px',
                                            fontSize: '0.9rem',
                                            fontWeight: '600'
                                        }}
                                        onClick={() => toast.info("Canal de voz abierto con conductor...")}
                                    >
                                        Llamar al Conductor
                                    </button>
                                </div>
                            </div>

                            <div className={styles.card} style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                <h4 style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.8rem' }}>NOTAS DE RUTA</h4>
                                <p style={{ fontSize: '0.8rem', color: '#4b5563', lineHeight: '1.6' }}>
                                    Asegúrese de que el conductor mantenga el dispositivo en un lugar con visibilidad satelital óptima para evitar errores de geolocalización.
                                </p>
                            </div>

                            <ChatRuta rutaId={id as string} rol="ADMIN" />
                        </div>
                    </div>
                </div>
            </main>
        </BackgroundMeteors>
    );
}
