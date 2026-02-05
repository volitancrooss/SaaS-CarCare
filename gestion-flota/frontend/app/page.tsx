"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import styles from "./page.module.css";
import BackgroundMeteors from "@/componentes/BackgroundMeteors";
import LocationInput from "@/componentes/LocationInput";
import dynamic from "next/dynamic";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

interface Vehiculo {
  id: string;
  matricula: string;
  marca: string;
  modelo: string;
  kilometraje: number;
  tipoCombustible: string;
  combustibleActual: number;
  activo: boolean;
}

interface Ruta {
  id?: string;
  origen: string;
  destino: string;
  distanciaEstimadaKm: number;
  estado: string;
  vehiculoId: string;
  fecha: string;
  latitudOrigen?: number;
  longitudOrigen?: number;
  latitudDestino?: number;
  longitudDestino?: number;
  latitudActual?: number;
  longitudActual?: number;
  ultimaActualizacionGPS?: string;
}

// Dynamic import para el mapa de tracking global (evitar SSR)
const MapTrackingGlobal = dynamic(() => import("@/componentes/MapTrackingGlobal"), {
  ssr: false,
  loading: () => (
    <div style={{
      height: "500px",
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "16px",
      color: "#888"
    }}>
      Cargando Mapa de Tracking...
    </div>
  )
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://saas-carcare-production.up.railway.app";

export default function Dashboard() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'flota' | 'nuevo' | 'rutas' | 'estadisticas' | 'tracking'>('flota');
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper para calcular estado de conexión del conductor
  // Si hay GPS activo pero no timestamp, significa que el conductor está online 
  // (el timestamp se añadió después de que ya había datos)
  const getConnectionStatus = (timestamp: string | undefined, hasActiveGPS: boolean = false) => {
    // Si hay GPS activo pero no hay timestamp, consideramos que está online
    if (!timestamp && hasActiveGPS) {
      return { status: 'online' as const, text: 'GPS Activo', color: '#22c55e' };
    }

    if (!timestamp) return { status: 'offline' as const, text: 'Sin señal', color: '#6b7280' };

    const now = new Date();
    const lastUpdate = new Date(timestamp);
    const diffSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);

    if (diffSeconds <= 30) {
      return {
        status: 'online' as const,
        text: diffSeconds < 5 ? 'Ahora' : `Hace ${diffSeconds}s`,
        color: '#22c55e'
      };
    } else if (diffSeconds <= 120) {
      const mins = Math.floor(diffSeconds / 60);
      return {
        status: 'idle' as const,
        text: mins > 0 ? `Hace ${mins}m ${diffSeconds % 60}s` : `Hace ${diffSeconds}s`,
        color: '#f59e0b'
      };
    } else {
      const mins = Math.floor(diffSeconds / 60);
      return {
        status: 'offline' as const,
        text: mins < 60 ? `Hace ${mins} min` : `Hace ${Math.floor(mins / 60)}h`,
        color: '#6b7280'
      };
    }
  };

  const datosGrafico = useMemo(() => {
    const nombresMeses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    const consumoRealPorMes = new Array(12).fill(0);

    // DATOS DE PRUEBA TEMPORALES (eliminar cuando tengas rutas reales)
    const datosPrueba = [
      { mes: 0, distancia: 550 }, // Enero: 250km = 20L
      { mes: 1, distancia: 180 }, // Febrero: 180km = 14.4L  
      { mes: 2, distancia: 320 }, // Marzo: 320km = 25.6L
      { mes: 3, distancia: 150 }, // Abril: 150km = 12L
      { mes: 4, distancia: 980 }, // Mayo: 280km = 22.4L
      { mes: 5, distancia: 200 }, // Junio: 200km = 16L
    ];

    datosPrueba.forEach(dato => {
      const consumoEstimado = (dato.distancia / 100) * 8;
      consumoRealPorMes[dato.mes] += consumoEstimado;
    });

    rutas.forEach(r => {
      if (!r.fecha || r.estado !== 'COMPLETADA') return;
      const d = new Date(r.fecha);
      const mesIndex = d.getMonth();
      const consumoEstimado = (r.distanciaEstimadaKm / 100) * 8;
      consumoRealPorMes[mesIndex] += consumoEstimado;
    });

    // 2. Calcular Predicciones (Media móvil de los últimos 3 meses) y construir array final
    return nombresMeses.map((mes, index) => {
      const consumoReal = Math.round(consumoRealPorMes[index]);

      // Calcular predicción basada en el promedio de hasta 3 meses anteriores
      let suma = 0;
      let conteo = 0;
      for (let i = 1; i <= 3; i++) {
        const idxAnterior = index - i;
        if (idxAnterior >= 0) {
          suma += consumoRealPorMes[idxAnterior];
          conteo++;
        }
      }
      let prediccionCalculada = 0;

      if (conteo > 0) {
        prediccionCalculada = suma / conteo;
      }

      // Proyección inteligente para el mes actual
      const fechaActual = new Date();
      if (index === fechaActual.getMonth()) {
        const diaActual = fechaActual.getDate();
        const diasEnMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0).getDate();
        // Proyectamos el consumo actual al final del mes
        const proyeccion = (consumoReal / Math.max(1, diaActual)) * diasEnMes;
        // Usamos la proyección si es más relevante (ej. sin histórico o proyección alta)
        if (conteo === 0 || proyeccion > prediccionCalculada) {
          prediccionCalculada = proyeccion;
        }
      } else if (conteo === 0) {
        prediccionCalculada = consumoReal || 0;
      }

      return {
        mes,
        consumo: consumoReal,
        prediccion: Math.round(prediccionCalculada)
      };
    });
  }, [rutas]);

  // Buscamos el primer mes con valor 0 (que se asume como el "actual" o pendiente)
  // Si todos tienen datos, usamos el mes del sistema.
  const indexMesCero = datosGrafico.findIndex(d => d.consumo === 0);
  const indexFinal = indexMesCero !== -1 ? indexMesCero : new Date().getMonth();

  const datosMesActual = datosGrafico[indexFinal] || { consumo: 0, prediccion: 0 };

  const prediccionMesActual = datosMesActual.prediccion;
  const ahorroPotencial = Math.round(prediccionMesActual * 0.10);

  const [nuevoVehiculo, setNuevoVehiculo] = useState<Partial<Vehiculo>>({
    marca: '', modelo: '', matricula: '', kilometraje: 0, combustibleActual: 50, activo: true
  });
  const [nuevaRuta, setNuevaRuta] = useState<Partial<Ruta>>({
    origen: '', destino: '', distanciaEstimadaKm: 0, vehiculoId: '', fecha: new Date().toISOString().split('T')[0]
  });

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [resVehiculos, resRutas] = await Promise.all([
        fetch(`${API_URL}/api/vehiculos`),
        fetch(`${API_URL}/api/rutas`)
      ]);

      if (resVehiculos.ok) {
        const dataV = await resVehiculos.json();
        setVehiculos(dataV);
      } else {
        console.error("Error fetching vehicles");
      }

      if (resRutas.ok) {
        const dataR = await resRutas.json();
        setRutas(dataR);
      }
    } catch (err) {
      console.error("Error conectando con el Backend:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();

    // Auto-refresh cada 3 segundos cuando estamos en la pestaña de tracking
    // Esto permite detectar cuando un conductor se desconecta (el timestamp dejará de actualizarse)
    let intervalId: NodeJS.Timeout | null = null;

    if (activeTab === 'tracking') {
      intervalId = setInterval(() => {
        cargarDatos();
      }, 3000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [activeTab]);

  const handleCrearVehiculo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/vehiculos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoVehiculo)
      });
      if (res.ok) {
        toast.success("Vehículo añadido a la flota correctamente");
        setActiveTab('flota');
        cargarDatos();
        setNuevoVehiculo({ marca: '', modelo: '', matricula: '', kilometraje: 0, combustibleActual: 50, activo: true });
      }
    } catch (error) {
      toast.error("Error al crear vehículo");
    }
  };

  const handleCrearRuta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaRuta.vehiculoId) {
      toast.warning("⚠️ Debes asignar un vehículo a la ruta");
      return;
    }
    // Geodoficación Real mediante Nominatim (OpenStreetMap)
    const geocode = async (query: string) => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
      } catch (error) {
        console.error("Error en geocodificación:", error);
      }
      return null;
    };

    toast.promise(
      (async () => {
        let originCoords = { lat: nuevaRuta.latitudOrigen, lng: nuevaRuta.longitudOrigen };
        let destCoords = { lat: nuevaRuta.latitudDestino, lng: nuevaRuta.longitudDestino };

        // Si no se seleccionó sugerencia, buscar manualmente
        if (!originCoords.lat || !originCoords.lng) {
          const res = await geocode(nuevaRuta.origen || "");
          if (res) originCoords = res;
        }
        if (!destCoords.lat || !destCoords.lng) {
          const res = await geocode(nuevaRuta.destino || "");
          if (res) destCoords = res;
        }

        if (!originCoords.lat || !destCoords.lat) {
          throw new Error("No se pudo localizar el origen o el destino. Por favor, selecciona una sugerencia.");
        }

        const res = await fetch(`${API_URL}/api/rutas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...nuevaRuta,
            estado: 'PLANIFICADA',
            latitudOrigen: originCoords.lat,
            longitudOrigen: originCoords.lng,
            latitudDestino: destCoords.lat,
            longitudDestino: destCoords.lng,
            latitudActual: originCoords.lat,
            longitudActual: originCoords.lng
          })
        });

        if (!res.ok) throw new Error("Error al guardar la ruta en el servidor");

        cargarDatos();
        setNuevaRuta({ origen: "", destino: "", distanciaEstimadaKm: 0, fecha: new Date().toISOString().split("T")[0], vehiculoId: "" });
        return res.json();
      })(),
      {
        loading: 'Procesando ubicaciones...',
        success: 'Ruta planificada con éxito con coordenadas precisas',
        error: (err) => `Error: ${err.message}`,
      }
    );
  };

  const handleCambioEstadoRuta = async (ruta: Ruta, nuevoEstado: string) => {
    const rutasPrevias = [...rutas];
    setRutas(prev => prev.map(r => r.id === ruta.id ? { ...r, estado: nuevoEstado } : r));

    try {
      await fetch(`${API_URL}/api/rutas/${ruta.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ruta, estado: nuevoEstado })
      }).catch(e => console.warn("Backend no respondió, usando estado local"));

      toast.success(`Ruta marcada como ${nuevoEstado}`);
    } catch (error) {
      setRutas(rutasPrevias);
      toast.error("Error al actualizar estado");

    }
  };

  const handleEliminarRuta = async (ruta: Ruta) => {
    const rutasPrevias = [...rutas];
    setRutas(prev => prev.filter(r => r.id !== ruta.id));

    try {
      await fetch(`${API_URL}/api/rutas/${ruta.id}`, { method: 'DELETE' }).catch(e => console.warn("Backend no respondió, usando estado local"));
      toast.success("Ruta eliminada correctamente");
    } catch (error) {
      setRutas(rutasPrevias);
      toast.error("Error al eliminar ruta");
    }
  };

  const handleEliminarVehiculo = (id: string) => {
    toast("¿Estás seguro?", {
      description: "Esta acción eliminará el vehículo permanentemente de la flota.",
      action: {
        label: "Eliminar",
        onClick: async () => {
          try {
            const res = await fetch(`${API_URL}/api/vehiculos/${id}`, { method: 'DELETE' });
            if (res.ok) {
              toast.success("Vehículo eliminado correctamente");
              setVehiculos((prev) => prev.filter(v => v.id !== id));
            }
          } catch (error) {
            toast.error("Error al eliminar vehículo");
          }
        }
      },
      cancel: {
        label: "Cancelar",
        onClick: () => console.log("Cancelado"),
      },
    });
  };

  const getFuelColor = (level: number) => {
    if (level > 50) return '#22c55e';
    if (level > 20) return '#eab308';
    return '#ef4444';
  };

  return (
    <BackgroundMeteors>
      <main style={{ height: '100%', width: '100%', overflowY: 'auto', position: 'relative', zIndex: 20, paddingBottom: '100px' }}>
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.title}>
              <h1>./CarCare Tracker</h1>
              <p className={styles.subtitle}>Gestion de Flota de mano de CarCare Tracker para la Organización y Sostenibilidad de la flota de coches de una empresa</p>
            </div>
            <div className={styles.status}>
            </div>
          </header>

          <nav className={styles.nav}>
            <button
              className={`${styles.navButton} ${activeTab === 'flota' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('flota')}
            >
              Flota de coches
            </button>
            <button
              className={`${styles.navButton} ${activeTab === 'rutas' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('rutas')}
            >
              Rutas y Logística
            </button>
            <button
              className={`${styles.navButton} ${activeTab === 'estadisticas' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('estadisticas')}
            >
              Estadísticas
            </button>
            <button
              className={`${styles.navButton} ${activeTab === 'tracking' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('tracking')}
              style={{
                background: activeTab === 'tracking' ? 'linear-gradient(135deg, rgba(59, 246, 59, 0.2), rgba(34, 197, 94, 0.2))' : undefined,
                border: activeTab === 'tracking' ? '1px solid rgba(59, 246, 59, 0.5)' : undefined
              }}
            >
              📍 Tracking en Vivo
            </button>
            <button
              className={`${styles.navButton} ${activeTab === 'nuevo' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('nuevo')}
            >
              + Nuevo Vehículo
            </button>
          </nav>

          {activeTab === 'flota' && (
            <div className={styles.grid}>
              {vehiculos.map((v) => (
                <div
                  key={v.id}
                  className={styles.card}
                  onClick={() => router.push(`/vehiculo/${v.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.cardHeader}>
                    <div>
                      <h2 className={styles.cardTitle}>{v.marca} {v.modelo}</h2>
                      <span className={styles.cardSubtitle}>Matrícula: {v.matricula}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEliminarVehiculo(v.id);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1.2rem' }}
                      title="Eliminar Vehículo"
                    >
                      X
                    </button>
                  </div>

                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Kilometraje total</span>
                    <span className={styles.statValue}>{v.kilometraje.toLocaleString()} km</span>
                  </div>

                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Tipo de combustible</span>
                    <span className={styles.statValue}>{v.tipoCombustible}</span>
                  </div>

                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Combustible</span>
                    <span className={styles.statValue}>{v.combustibleActual} L</span>
                  </div>

                  <div className={styles.fuelBarBg}>
                    <div
                      className={styles.fuelBarFill}
                      style={{
                        width: `${Math.min(v.combustibleActual, 100)}%`,
                        backgroundColor: getFuelColor(v.combustibleActual)
                      }}
                    />
                  </div>
                  <div style={{ marginTop: '1rem' }}>
                    {(() => {
                      const estaOcupado = rutas.some(r => r.vehiculoId === v.id && r.estado !== 'COMPLETADA');
                      return (
                        <span
                          className={styles.badge}
                          style={{
                            backgroundColor: !v.activo ? 'rgba(239, 68, 68, 0.2)' : (estaOcupado ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)'),
                            color: !v.activo ? '#f87171' : (estaOcupado ? '#facc15' : '#03f844'),
                            boxShadow: !v.activo ? 'none' : (estaOcupado ? '0 0 10px rgba(234, 179, 8, 0.2)' : '0 0 10px rgba(34, 197, 94, 0.2)'),
                          }}
                        >
                          {!v.activo ? "TALLER" : (estaOcupado ? "OCUPADO" : "ACTIVO")}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              ))}
              {vehiculos.length === 0 && !loading && <p>No hay vehículos registrados.</p>}
            </div>
          )}

          {activeTab === 'nuevo' && (
            <div className={styles.formContainer}>
              <h2 style={{ marginBottom: '1.5rem' }}>Dar de alta nuevo vehículo</h2>
              <form onSubmit={handleCrearVehiculo}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Marca</label>
                  <input className={styles.input} type="text" placeholder="Ej: Toyota" required
                    value={nuevoVehiculo.marca} onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, marca: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Modelo</label>
                  <input className={styles.input} type="text" placeholder="Ej: Prius" required
                    value={nuevoVehiculo.modelo} onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, modelo: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Matrícula</label>
                  <input className={styles.input} type="text" placeholder="1234-XYZ" required
                    value={nuevoVehiculo.matricula} onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, matricula: e.target.value })} />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <label className={styles.label} style={{ marginBottom: 0 }}>Km Iniciales</label>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{nuevoVehiculo.kilometraje?.toLocaleString()} km</span>
                    </div>
                    <input
                      className={styles.input}
                      type="range"
                      min="0"
                      max="1000000"
                      step="500"
                      style={{ padding: '0.5rem', cursor: 'pointer' }}
                      value={nuevoVehiculo.kilometraje}
                      onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, kilometraje: Number(e.target.value) })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <label className={styles.label} style={{ marginBottom: 0 }}>Combustible</label>
                      <span style={{ fontWeight: 'bold', color: getFuelColor(nuevoVehiculo.combustibleActual || 0) }}>
                        {nuevoVehiculo.combustibleActual}%
                      </span>
                    </div>
                    <input
                      className={styles.input}
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      style={{ padding: '0.5rem', cursor: 'pointer' }}
                      value={nuevoVehiculo.combustibleActual}
                      onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, combustibleActual: Number(e.target.value) })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tipo de combustible</label>
                    <select className={styles.select} required
                      value={nuevoVehiculo.tipoCombustible} onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, tipoCombustible: e.target.value })}>
                      <option value="">Seleccionar Combustible</option>
                      <option value="gasolina">Gasolina</option>
                      <option value="diesel">Diesel</option>
                      <option value="hibrido">Híbrido</option>
                      <option value="electrico">Eléctrico</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className={styles.submitButton}>Guardar Vehículo</button>
              </form>
            </div>
          )}

          {activeTab === 'rutas' && (
            <div className={styles.rutasContainer}>
              <div className={styles.formContainer}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--accent)' }}>Nueva Ruta</h3>
                <form onSubmit={handleCrearRuta}>
                  <LocationInput
                    label="Origen"
                    placeholder="Ej: Madrid, Calle Mayor..."
                    value={nuevaRuta.origen || ""}
                    onChange={(val, coords) => setNuevaRuta({
                      ...nuevaRuta,
                      origen: val,
                      latitudOrigen: coords?.lat,
                      longitudOrigen: coords?.lng
                    })}
                  />

                  <LocationInput
                    label="Destino"
                    placeholder="Ej: Barcelona, Puerto..."
                    value={nuevaRuta.destino || ""}
                    onChange={(val, coords) => setNuevaRuta({
                      ...nuevaRuta,
                      destino: val,
                      latitudDestino: coords?.lat,
                      longitudDestino: coords?.lng
                    })}
                  />
                  <div className={styles.formGroup}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <label className={styles.label} style={{ marginBottom: 0 }}>Distancia Estimada</label>
                      <span style={{ fontWeight: 'bold', color: 'green' }}>{nuevaRuta.distanciaEstimadaKm?.toLocaleString() || 0} km</span>
                    </div>
                    <input
                      className={styles.input}
                      type="range"
                      min="0"
                      max="2000"
                      step="1"
                      style={{ padding: '0.5rem', cursor: 'pointer' }}
                      value={nuevaRuta.distanciaEstimadaKm || 0}
                      onChange={e => setNuevaRuta({ ...nuevaRuta, distanciaEstimadaKm: Number(e.target.value) })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Fecha Salida</label>
                    <input className={styles.input} type="date" required
                      value={nuevaRuta.fecha} onChange={e => setNuevaRuta({ ...nuevaRuta, fecha: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Vehículo Asignado</label>
                    <select className={styles.select} required
                      value={nuevaRuta.vehiculoId} onChange={e => setNuevaRuta({ ...nuevaRuta, vehiculoId: e.target.value })}>
                      <option value="">-- Seleccionar Vehículo --</option>
                      {vehiculos.map(v => (
                        <option key={v.id} value={v.id}>{v.marca} {v.modelo} ({v.matricula})</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className={styles.submitButton}>Planificar Ruta</button>
                </form>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3>Rutas Activas</h3>
                  <button
                    onClick={cargarDatos}
                    className={styles.submitButton}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                    title="Recargar rutas"
                  >
                    🔄 Recargar
                  </button>
                </div>
                <div className={styles.grid}>
                  {rutas.map(r => {
                    const esEnCurso = r.estado === 'EN_CURSO';
                    const esCompletada = r.estado === 'COMPLETADA';

                    return (
                      <div
                        key={r.id}
                        className={styles.card}
                        onClick={() => router.push(`/ruta/${r.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className={styles.cardHeader}>
                          <div>
                            <h2 className={styles.cardTitle}>{r.origen} → {r.destino}</h2>
                            <span className={styles.cardSubtitle}>#{r.id?.slice(-6).toUpperCase()} • {r.fecha}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEliminarRuta(r);
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1.2rem' }}
                            title="Eliminar Ruta"
                          >
                            X
                          </button>
                        </div>

                        <div className={styles.statRow}>
                          <span className={styles.statLabel}>Distancia total</span>
                          <span className={styles.statValue}>{r.distanciaEstimadaKm} km</span>
                        </div>

                        <div className={styles.statRow}>
                          <span className={styles.statLabel}>Vehículo asignado</span>
                          <span className={styles.statValue}>
                            {r.vehiculoId?.length > 10 ? `...${r.vehiculoId.slice(-8)}` : r.vehiculoId}
                          </span>
                        </div>

                        <div className={styles.statRow}>
                          <span className={styles.statLabel}>Estado</span>
                          <span className={styles.statValue}>{r.estado}</span>
                        </div>

                        <div className={styles.fuelBarBg}>
                          <div
                            className={styles.fuelBarFill}
                            style={{
                              width: esCompletada ? '100%' : (esEnCurso ? '60%' : '30%'),
                              backgroundColor: esCompletada ? '#22c55e' : (esEnCurso ? '#06b6d4' : '#6b7280')
                            }}
                          />
                        </div>

                        {esEnCurso && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#3bf63b',
                              boxShadow: '0 0 10px #3bf63b',
                              animation: 'pulse 1.5s infinite'
                            }}></span>
                            <span style={{ fontSize: '0.7rem', color: '#3bf63b', fontWeight: '800', letterSpacing: '0.05em' }}>RASTREO ACTIVO</span>
                          </div>
                        )}

                        <div style={{ marginTop: '1rem' }}>
                          <span
                            className={styles.badge}
                            style={{
                              backgroundColor: esCompletada ? 'rgba(34, 197, 94, 0.2)' : (esEnCurso ? 'rgba(6, 182, 212, 0.2)' : 'rgba(107, 114, 128, 0.2)'),
                              color: esCompletada ? '#4ade80' : (esEnCurso ? '#22d3ee' : '#9ca3af'),
                              boxShadow: esCompletada ? '0 0 10px rgba(34, 197, 94, 0.2)' : (esEnCurso ? '0 0 10px rgba(6, 182, 212, 0.2)' : 'none'),
                            }}
                          >
                            {esCompletada ? "COMPLETADA" : (esEnCurso ? "EN CURSO" : "PLANIFICADA")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {rutas.length === 0 && <p>No hay rutas planificadas.</p>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'estadisticas' && (
            <div className={styles.rutasContainer}>
              <div className={styles.grid} style={{ gridTemplateColumns: '1fr', marginBottom: '2rem' }}>
                <div className={styles.card} style={{ background: 'linear-gradient(145deg, rgba(20,20,25,0.9), rgba(30,30,40,0.8))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 className={styles.cardTitle} style={{ fontSize: '1.5rem', color: '#fff' }}>Tendencias de Consumo</h3>
                    <div className={styles.badge} style={{ backgroundColor: '#eab30833', color: '#f1dfb2ff' }}>
                      Predicción Mes Actual: {prediccionMesActual}L
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={datosGrafico}>
                        <defs>
                          <linearGradient id="colorConsumo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" vertical={false} />
                        <XAxis dataKey="mes" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="consumo"
                          stroke="var(--accent)"
                          fillOpacity={1}
                          fill="url(#colorConsumo)"
                          name="Consumo Real (L)"
                        />
                        <Area
                          type="monotone"
                          dataKey="prediccion"
                          stroke="#82ca9d"
                          fillOpacity={0.1}
                          fill="#82ca9d"
                          name="Predicción (L)"
                          strokeDasharray="5 5"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className={styles.grid}>
                <div className={styles.card}>
                  <h4 className={styles.cardTitle}>Impacto Ambiental</h4>
                  <p className={styles.subtitle} style={{ marginBottom: '1rem' }}>Emisiones de CO2 estimadas para este mes.</p>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>
                    {(prediccionMesActual * 2.3).toFixed(1)} <span style={{ fontSize: '1rem', color: '#888' }}>kg CO2</span>
                  </div>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#888' }}>
                    Basado en factor de emisión promedio de 2.3 kg CO2/L.
                  </p>
                </div>

                <div className={styles.card}>
                  <h4 className={styles.cardTitle}>Oportunidad de Ahorro</h4>
                  <p className={styles.subtitle} style={{ marginBottom: '1rem' }}>Si optimizas rutas este mes.</p>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>
                    {ahorroPotencial} <span style={{ fontSize: '1rem', color: '#888' }}>Litros</span>
                  </div>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#888' }}>
                    Reducción del 10% mediante conducción eficiente y rutas cortas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tracking' && (
            <div className={styles.rutasContainer} style={{ gridTemplateColumns: '1fr' }}>
              <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{
                  padding: '1.5rem',
                  background: 'linear-gradient(135deg, rgba(59, 246, 59, 0.1), rgba(34, 197, 94, 0.05))',
                  borderBottom: '1px solid rgba(59, 246, 59, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>📍</span>
                      Tracking de Conductores en Tiempo Real
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      Visualiza la ubicación GPS de todos los conductores activos de la flota
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: 'rgba(59, 246, 59, 0.1)',
                      borderRadius: '8px',
                      border: '1px solid rgba(59, 246, 59, 0.3)'
                    }}>
                      <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: '#3bf63b',
                        animation: 'pulse 2s infinite'
                      }}></div>
                      <span style={{ fontSize: '0.85rem', color: '#3bf63b', fontWeight: '700' }}>
                        {rutas.filter(r => r.estado === 'EN_CURSO').length} conductores activos
                      </span>
                    </div>
                    <button
                      onClick={cargarDatos}
                      className={styles.submitButton}
                      style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
                    >
                      🔄 Actualizar
                    </button>
                  </div>
                </div>

                <div style={{ height: '550px', position: 'relative' }}>
                  <MapTrackingGlobal
                    rutasActivas={rutas.filter(r => r.estado === 'EN_CURSO' || r.estado === 'PLANIFICADA')}
                    onRutaClick={(rutaId) => router.push(`/ruta/${rutaId}`)}
                  />
                </div>
              </div>

              {/* Lista de rutas activas debajo del mapa */}
              <div style={{ marginTop: '2rem' }}>
                <h4 style={{ marginBottom: '1rem', color: '#9ca3af', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Rutas con Tracking Activo ({rutas.filter(r => r.estado === 'EN_CURSO').length})
                </h4>
                <div className={styles.grid}>
                  {rutas.filter(r => r.estado === 'EN_CURSO').map(ruta => {
                    const hasActiveGPS = !!(ruta.latitudActual && ruta.longitudActual);
                    const connectionStatus = getConnectionStatus(ruta.ultimaActualizacionGPS, hasActiveGPS);

                    return (
                      <div
                        key={ruta.id}
                        className={styles.card}
                        onClick={() => router.push(`/ruta/${ruta.id}`)}
                        style={{
                          cursor: 'pointer',
                          borderLeft: `4px solid ${connectionStatus.color}`,
                          background: 'linear-gradient(145deg, rgba(30,30,40,0.95), rgba(20,20,25,0.95))'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: connectionStatus.color,
                              animation: connectionStatus.status === 'online' ? 'pulse 1.5s infinite' : 'none',
                              boxShadow: connectionStatus.status === 'online' ? `0 0 10px ${connectionStatus.color}` : 'none'
                            }}></div>
                            <span style={{ fontSize: '0.75rem', color: connectionStatus.color, fontWeight: '700' }}>
                              {connectionStatus.status === 'online' ? '🟢 ONLINE' :
                                connectionStatus.status === 'idle' ? '🟡 INACTIVO' : '⚫ OFFLINE'}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#6b7280', fontFamily: 'monospace' }}>
                            #{ruta.id?.slice(-6).toUpperCase()}
                          </span>
                        </div>

                        <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                          {ruta.origen} → {ruta.destino}
                        </h4>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#9ca3af' }}>
                          <span>Vehículo: {ruta.vehiculoId?.slice(-6) || 'N/A'}</span>
                          <span style={{ color: connectionStatus.color, fontWeight: '600' }}>
                            📡 {connectionStatus.text}
                          </span>
                        </div>

                        {ruta.latitudActual && ruta.longitudActual && (
                          <div style={{
                            marginTop: '0.5rem',
                            fontSize: '0.7rem',
                            color: connectionStatus.color,
                            background: `${connectionStatus.color}15`,
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            textAlign: 'center',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span>📍 {ruta.latitudActual.toFixed(4)}, {ruta.longitudActual.toFixed(4)}</span>
                            {ruta.ultimaActualizacionGPS && (
                              <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                                🕐 {new Date(ruta.ultimaActualizacionGPS).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {rutas.filter(r => r.estado === 'EN_CURSO').length === 0 && (
                    <div style={{
                      gridColumn: '1 / -1',
                      textAlign: 'center',
                      padding: '3rem',
                      color: '#6b7280'
                    }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🚗</div>
                      <p>No hay conductores activos en este momento</p>
                      <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        Los conductores aparecerán aquí cuando inicien una ruta
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </BackgroundMeteors>
  );
}
