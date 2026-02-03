"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import styles from "./page.module.css";
import BackgroundMeteors from "@/componentes/BackgroundMeteors";
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
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function Dashboard() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'flota' | 'nuevo' | 'rutas' | 'estadisticas'>('flota');
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [loading, setLoading] = useState(true);

  const datosGrafico = useMemo(() => {
    const nombresMeses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    const datosManuales: Record<string, number> = {
      "Ene": 50,
      "Feb": 60,
      "Mar": 50,
      "Abr": 200,
      "May": 100,
      "Jun": 150,
      "Jul": 200,
      "Ago": 250,
      "Sep": 300,
      "Oct": 500,
      "Nov": 250,
      "Dic": 0,
    };

    const consumoRealPorMes = new Array(12).fill(0);

    nombresMeses.forEach((mes, index) => {
      if (datosManuales[mes]) consumoRealPorMes[index] += datosManuales[mes];
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
  }, []);

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
    const demoCoords = {
      Madrid: { lat: 40.4168, lng: -3.7038 },
      Barcelona: { lat: 41.3851, lng: 2.1734 },
      Valencia: { lat: 39.4699, lng: -0.3763 },
      Sevilla: { lat: 37.3891, lng: -5.9845 }
    };

    // Helper to get coords or random one near Spain
    const getCoords = (city: string) => {
      const key = Object.keys(demoCoords).find(k => city.toLowerCase().includes(k.toLowerCase())) as keyof typeof demoCoords;
      if (key) return demoCoords[key];
      return { lat: 36 + Math.random() * 7, lng: -9 + Math.random() * 12 };
    };

    const originCoords = getCoords(nuevaRuta.origen || "");
    const destCoords = getCoords(nuevaRuta.destino || "");

    try {
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
      if (res.ok) {
        toast.success("Ruta planificada con éxito");
        cargarDatos();
      }
    } catch (error) {
      toast.error("Error al crear ruta");
    }
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
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Origen</label>
                    <input className={styles.input} type="text" placeholder="Madrid" required
                      value={nuevaRuta.origen} onChange={e => setNuevaRuta({ ...nuevaRuta, origen: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Destino</label>
                    <input className={styles.input} type="text" placeholder="Barcelona" required
                      value={nuevaRuta.destino} onChange={e => setNuevaRuta({ ...nuevaRuta, destino: e.target.value })} />
                  </div>
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
                <h3 style={{ marginBottom: '1rem' }}>Rutas Activas</h3>
                <div className={styles.grid}>
                  {rutas.map(r => (
                    <div
                      key={r.id}
                      className={styles.card}
                      onClick={() => router.push(`/ruta/${r.id}`)}
                      style={{
                        borderLeft: `4px solid ${r.estado === 'COMPLETADA' ? '#22c55e' : 'var(--accent)'}`,
                        cursor: 'pointer'
                      }}
                    >
                      <div className={styles.cardHeader}>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '4px' }}>{r.fecha}</span>
                          <h4 className={styles.cardTitle}>{r.origen} ➝ {r.destino}</h4>
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
                        &nbsp;
                        <select
                          value={r.estado}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleCambioEstadoRuta(r, e.target.value);
                          }}
                          className={styles.badge}
                          style={{
                            background: r.estado === 'COMPLETADA' ? 'rgba(34, 197, 94, 0.2)' : (r.estado === 'EN_CURSO' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(59, 130, 246, 0.2)'),
                            color: r.estado === 'COMPLETADA' ? '#22c55e' : (r.estado === 'EN_CURSO' ? '#facc15' : '#60a5fa'),
                            border: '1px solid rgba(255,255,255,0.1)',
                            cursor: 'pointer',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            outline: 'none'
                          }}
                        >
                          <option value="PLANIFICADA" style={{ color: 'black' }}>PLANIFICADA</option>
                          <option value="EN_CURSO" style={{ color: 'black' }}>EN CURSO</option>
                          <option value="COMPLETADA" style={{ color: 'black' }}>COMPLETADA</option>
                        </select>
                      </div>

                      {r.estado === 'EN_CURSO' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#3bf63b',
                            boxShadow: '0 0 10px #3bf63b',
                            animation: 'pulse 1.5s infinite'
                          }}></span>
                          <span style={{ fontSize: '0.75rem', color: '#3bf63b', fontWeight: 'bold' }}>LIVE TRACKING ACTIVE</span>
                        </div>
                      )}

                      <p className={styles.statLabel}>Distancia: {r.distanciaEstimadaKm} km</p>
                      <small className={styles.statLabel} style={{ display: 'block', marginTop: '0.5rem' }}>
                        ID Vehículo: {r.vehiculoId}
                      </small>
                    </div>
                  ))}
                  {rutas.length === 0 && <p style={{ color: 'var(--secondary)' }}>No hay rutas planificadas.</p>}
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

        </div>
      </main>
    </BackgroundMeteors>
  );
}
