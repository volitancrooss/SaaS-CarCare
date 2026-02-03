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
                if (!data.latitudOrigen) {
                    toast.error("Esta ruta no tiene coordenadas válidas. Intenta crear una nueva.");
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
                                />
                            </div>

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
