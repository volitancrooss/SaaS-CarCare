"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import BackgroundMeteors from "@/componentes/BackgroundMeteors";
import styles from "../../page.module.css";
import dynamic from "next/dynamic";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function RutaTracking() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const [ruta, setRuta] = useState<Ruta | null>(null);
    const [loading, setLoading] = useState(true);

    // Default coords if none exist (Madrid area as placeholder)
    const defaultOrigin: [number, number] = [40.4168, -3.7038];
    const defaultDest: [number, number] = [41.3851, 2.1734];

    const cargarDatos = async () => {
        try {
            const res = await fetch(`${API_URL}/api/rutas/${id}`);
            if (res.ok) {
                const data = await res.json();

                // Populate with fake coordinates if missing for demo
                if (!data.latitudOrigen) {
                    data.latitudOrigen = 40.4168;
                    data.longitudOrigen = -3.7038;
                    data.latitudDestino = 41.3851;
                    data.longitudDestino = 2.1734;
                    data.latitudActual = 40.4168; // Start at origin
                    data.longitudActual = -3.7038;
                }

                setRuta(data);
            }
        } catch (err) {
            console.error("Error cargando ruta:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();

        // Simular seguimiento en tiempo real
        const interval = setInterval(() => {
            setRuta(prev => {
                if (!prev || prev.estado !== 'EN_CURSO') return prev;

                // Move car slightly towards destination
                const step = 0.05;
                const diffLat = prev.latitudDestino - prev.latitudActual;
                const diffLng = prev.longitudDestino - prev.longitudActual;

                // Artificial deviation chance
                const randomDeviation = Math.random() > 0.95;
                const deviationFactor = randomDeviation ? 0.1 : 0;

                const newLat = prev.latitudActual + (diffLat * step) + (Math.random() - 0.5) * deviationFactor;
                const newLng = prev.longitudActual + (diffLng * step) + (Math.random() - 0.5) * deviationFactor;

                // Check if arrived
                if (Math.abs(diffLat) < 0.01 && Math.abs(diffLng) < 0.01) {
                    toast.success("¡Vehículo ha llegado a su destino!");
                    return { ...prev, latitudActual: prev.latitudDestino, longitudActual: prev.longitudDestino, estado: 'COMPLETADA' };
                }

                return {
                    ...prev,
                    latitudActual: newLat,
                    longitudActual: newLng,
                    desviado: randomDeviation || prev.desviado
                };
            });
        }, 3000);

        return () => clearInterval(interval);
    }, [id]);

    if (loading) return <BackgroundMeteors><div>Cargando...</div></BackgroundMeteors>;
    if (!ruta) return <BackgroundMeteors><div>No encontrada</div></BackgroundMeteors>;

    return (
        <BackgroundMeteors>
            <main style={{ height: "100%", width: "100%", overflowY: "auto", position: "relative", zIndex: 20 }}>
                <div className={styles.container}>
                    <header className={styles.header}>
                        <button onClick={() => router.push("/")} className={styles.navButton} style={{ background: 'rgba(255,255,255,0.1)' }}>
                            ← Volver
                        </button>
                        <div className={styles.title}>
                            <h1 style={{ fontSize: '1.8rem' }}>Rastreo de Ruta: {ruta.origen} ➝ {ruta.destino}</h1>
                            <p className={styles.subtitle}>Vehículo: {ruta.vehiculoId} | Estado: <span style={{ color: ruta.estado === 'EN_CURSO' ? '#3bf63b' : 'white' }}>{ruta.estado}</span></p>
                        </div>
                    </header>

                    <div className={styles.rutasContainer} style={{ gridTemplateColumns: '3fr 1fr' }}>
                        {/* Map Section */}
                        <div className={styles.card} style={{ height: '500px', padding: '0' }}>
                            <MapTracking
                                origin={[ruta.latitudOrigen, ruta.longitudOrigen]}
                                destination={[ruta.latitudDestino, ruta.longitudDestino]}
                                current={[ruta.latitudActual, ruta.longitudActual]}
                                isDeviated={ruta.desviado}
                            />
                        </div>

                        {/* Sidebar Stats */}
                        <div className={styles.card}>
                            <h3 className={styles.cardTitle}>Estado Actual</h3>

                            {ruta.desviado && (
                                <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #ef4444' }}>
                                    <strong>⚠️ ALERTA DE DESVÍO</strong>
                                    <p style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>El dispositivo ha salido de la trayectoria planificada.</p>
                                </div>
                            )}

                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Velocidad (Sim)</span>
                                <span className={styles.statValue}>85 km/h</span>
                            </div>
                            <div className={styles.statRow}>
                                <span className={styles.statLabel}>Dist. Restante</span>
                                <span className={styles.statValue}>{(ruta.distanciaEstimadaKm * 0.4).toFixed(1)} km</span>
                            </div>

                            <div style={{ marginTop: '2rem' }}>
                                <button
                                    className={styles.submitButton}
                                    style={{ backgroundColor: ruta.estado === 'EN_CURSO' ? '#ef4444' : '#3bf63b' }}
                                    onClick={async () => {
                                        const nuevoEstado = ruta.estado === 'EN_CURSO' ? 'PLANIFICADA' : 'EN_CURSO';
                                        await fetch(`${API_URL}/api/rutas/${id}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ estado: nuevoEstado })
                                        });
                                        setRuta({ ...ruta, estado: nuevoEstado });
                                        toast.info(`Ruta ${nuevoEstado === 'EN_CURSO' ? 'Iniciada' : 'Detenida'}`);
                                    }}
                                >
                                    {ruta.estado === 'EN_CURSO' ? 'Detener Tracking' : 'Iniciar Ruta y GPS'}
                                </button>

                                <button
                                    className={styles.submitButton}
                                    style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)' }}
                                    onClick={() => toast.info("Contactando con el conductor...")}
                                >
                                    📞 Llamar Conductor
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </BackgroundMeteors>
    );
}
