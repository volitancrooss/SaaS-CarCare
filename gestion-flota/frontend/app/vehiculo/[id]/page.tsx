"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import BackgroundMeteors from "@/componentes/BackgroundMeteors";
import styles from "../../page.module.css";

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

interface Taller {
  nombre: string;
  direccion: string;
  telefono: string;
}

interface Repuesto {
  nombre: string;
  cantidad: number;
  costoUnitario: number;
}

interface Mantenimiento {
  id?: string;
  vehiculoId: string;
  tipo: string;
  descripcion: string;
  fecha: string;
  kilometrajeRealizado: number;
  costo: number;
  taller: Taller;
  repuestos: Repuesto[];
  observaciones: string;
  proximoMantenimiento?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function VehiculoDetalle({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [nuevoMantenimiento, setNuevoMantenimiento] = useState<Partial<Mantenimiento>>({
    tipo: "PREVENTIVO",
    descripcion: "",
    fecha: new Date().toISOString().split("T")[0],
    kilometrajeRealizado: 0,
    costo: 0,
    taller: { nombre: "", direccion: "", telefono: "" },
    repuestos: [],
    observaciones: "",
    proximoMantenimiento: 0,
  });

  useEffect(() => {
    cargarDatos();
  }, [params.id]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [resVehiculo, resMantenimientos] = await Promise.all([
        fetch(`${API_URL}/api/vehiculos/${params.id}`),
        fetch(`${API_URL}/api/mantenimientos/vehiculo/${params.id}`),
      ]);

      if (resVehiculo.ok) {
        const data = await resVehiculo.json();
        setVehiculo(data);
      }

      if (resMantenimientos.ok) {
        const data = await resMantenimientos.json();
        setMantenimientos(data);
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
      toast.error("Error al cargar los datos del vehículo");
    } finally {
      setLoading(false);
    }
  };

  const handleCrearMantenimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/mantenimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nuevoMantenimiento, vehiculoId: params.id }),
      });
      if (res.ok) {
        toast.success("Mantenimiento registrado correctamente");
        setMostrarFormulario(false);
        cargarDatos();
        setNuevoMantenimiento({
          tipo: "PREVENTIVO",
          descripcion: "",
          fecha: new Date().toISOString().split("T")[0],
          kilometrajeRealizado: 0,
          costo: 0,
          taller: { nombre: "", direccion: "", telefono: "" },
          repuestos: [],
          observaciones: "",
          proximoMantenimiento: 0,
        });
      }
    } catch (error) {
      toast.error("Error al registrar mantenimiento");
    }
  };

  const handleEliminarMantenimiento = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/mantenimientos/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Mantenimiento eliminado");
        cargarDatos();
      }
    } catch (error) {
      toast.error("Error al eliminar mantenimiento");
    }
  };

  const agregarRepuesto = () => {
    setNuevoMantenimiento({
      ...nuevoMantenimiento,
      repuestos: [
        ...(nuevoMantenimiento.repuestos || []),
        { nombre: "", cantidad: 1, costoUnitario: 0 },
      ],
    });
  };

  const actualizarRepuesto = (index: number, campo: string, valor: any) => {
    const repuestosActualizados = [...(nuevoMantenimiento.repuestos || [])];
    repuestosActualizados[index] = { ...repuestosActualizados[index], [campo]: valor };
    setNuevoMantenimiento({ ...nuevoMantenimiento, repuestos: repuestosActualizados });
  };

  const eliminarRepuesto = (index: number) => {
    const repuestosActualizados = nuevoMantenimiento.repuestos?.filter((_, i) => i !== index);
    setNuevoMantenimiento({ ...nuevoMantenimiento, repuestos: repuestosActualizados });
  };

  const costoTotal = mantenimientos.reduce((sum, m) => sum + (m.costo || 0), 0);

  if (loading) {
    return (
      <BackgroundMeteors>
        <div style={{ padding: "2rem", color: "white" }}>Cargando...</div>
      </BackgroundMeteors>
    );
  }

  if (!vehiculo) {
    return (
      <BackgroundMeteors>
        <div style={{ padding: "2rem", color: "white" }}>Vehículo no encontrado</div>
      </BackgroundMeteors>
    );
  }

  return (
    <BackgroundMeteors>
      <main style={{ height: "100%", width: "100%", overflowY: "auto", position: "relative", zIndex: 20, paddingBottom: "100px" }}>
        <div className={styles.container}>
          <header className={styles.header}>
            <button
              onClick={() => router.push("/")}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                color: "white",
                cursor: "pointer",
                marginBottom: "1rem",
              }}
            >
              ← Volver al Dashboard
            </button>
            <div className={styles.title}>
              <h1>
                {vehiculo.marca} {vehiculo.modelo}
              </h1>
              <p className={styles.subtitle}>Matrícula: {vehiculo.matricula}</p>
            </div>
          </header>

          {/* Info del Vehículo */}
          <div className={styles.card} style={{ marginBottom: "2rem" }}>
            <h3 className={styles.cardTitle}>Información del Vehículo</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Kilometraje</span>
                <span className={styles.statValue}>{vehiculo.kilometraje?.toLocaleString()} km</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Combustible</span>
                <span className={styles.statValue}>{vehiculo.tipoCombustible}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Estado</span>
                <span className={styles.statValue}>{vehiculo.activo ? "Activo" : "En Taller"}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Gasto Total</span>
                <span className={styles.statValue} style={{ color: "#ef4444" }}>
                  {costoTotal.toFixed(2)} €
                </span>
              </div>
            </div>
          </div>

          {/* Botón Nuevo Mantenimiento */}
          <div style={{ marginBottom: "2rem" }}>
            <button
              onClick={() => setMostrarFormulario(!mostrarFormulario)}
              className={styles.submitButton}
              style={{ width: "auto" }}
            >
              {mostrarFormulario ? "Cancelar" : "+ Nuevo Mantenimiento"}
            </button>
          </div>

          {/* Formulario Nuevo Mantenimiento */}
          {mostrarFormulario && (
            <div className={styles.formContainer} style={{ marginBottom: "2rem" }}>
              <h3 style={{ marginBottom: "1rem" }}>Registrar Mantenimiento</h3>
              <form onSubmit={handleCrearMantenimiento}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tipo</label>
                    <select
                      className={styles.select}
                      value={nuevoMantenimiento.tipo}
                      onChange={(e) => setNuevoMantenimiento({ ...nuevoMantenimiento, tipo: e.target.value })}
                      required
                    >
                      <option value="PREVENTIVO">Preventivo</option>
                      <option value="CORRECTIVO">Correctivo</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Fecha</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={nuevoMantenimiento.fecha}
                      onChange={(e) => setNuevoMantenimiento({ ...nuevoMantenimiento, fecha: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Descripción</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Ej: Cambio de aceite y filtros"
                    value={nuevoMantenimiento.descripcion}
                    onChange={(e) => setNuevoMantenimiento({ ...nuevoMantenimiento, descripcion: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Kilometraje</label>
                    <input
                      className={styles.input}
                      type="number"
                      value={nuevoMantenimiento.kilometrajeRealizado}
                      onChange={(e) => setNuevoMantenimiento({ ...nuevoMantenimiento, kilometrajeRealizado: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Costo Total (€)</label>
                    <input
                      className={styles.input}
                      type="number"
                      step="0.01"
                      value={nuevoMantenimiento.costo}
                      onChange={(e) => setNuevoMantenimiento({ ...nuevoMantenimiento, costo: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <h4 style={{ marginTop: "1.5rem", marginBottom: "1rem", color: "var(--accent)" }}>Taller</h4>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nombre</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="Taller Mecánico S.L."
                      value={nuevoMantenimiento.taller?.nombre}
                      onChange={(e) =>
                        setNuevoMantenimiento({
                          ...nuevoMantenimiento,
                          taller: { ...nuevoMantenimiento.taller!, nombre: e.target.value },
                        })
                      }
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Dirección</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="Calle Principal 123"
                      value={nuevoMantenimiento.taller?.direccion}
                      onChange={(e) =>
                        setNuevoMantenimiento({
                          ...nuevoMantenimiento,
                          taller: { ...nuevoMantenimiento.taller!, direccion: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Teléfono</label>
                    <input
                      className={styles.input}
                      type="tel"
                      placeholder="123456789"
                      value={nuevoMantenimiento.taller?.telefono}
                      onChange={(e) =>
                        setNuevoMantenimiento({
                          ...nuevoMantenimiento,
                          taller: { ...nuevoMantenimiento.taller!, telefono: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <h4 style={{ marginTop: "1.5rem", marginBottom: "1rem", color: "var(--accent)" }}>Repuestos</h4>
                {nuevoMantenimiento.repuestos?.map((rep, index) => (
                  <div key={index} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "end" }}>
                    <div className={styles.formGroup} style={{ flex: 2 }}>
                      <label className={styles.label}>Nombre</label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="Filtro de aceite"
                        value={rep.nombre}
                        onChange={(e) => actualizarRepuesto(index, "nombre", e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup} style={{ flex: 1 }}>
                      <label className={styles.label}>Cantidad</label>
                      <input
                        className={styles.input}
                        type="number"
                        value={rep.cantidad}
                        onChange={(e) => actualizarRepuesto(index, "cantidad", Number(e.target.value))}
                      />
                    </div>
                    <div className={styles.formGroup} style={{ flex: 1 }}>
                      <label className={styles.label}>Costo (€)</label>
                      <input
                        className={styles.input}
                        type="number"
                        step="0.01"
                        value={rep.costoUnitario}
                        onChange={(e) => actualizarRepuesto(index, "costoUnitario", Number(e.target.value))}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarRepuesto(index)}
                      style={{
                        background: "#ef4444",
                        border: "none",
                        padding: "0.5rem 1rem",
                        borderRadius: "6px",
                        color: "white",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={agregarRepuesto}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    color: "white",
                    cursor: "pointer",
                    marginTop: "0.5rem",
                  }}
                >
                  + Agregar Repuesto
                </button>

                <div className={styles.formGroup} style={{ marginTop: "1.5rem" }}>
                  <label className={styles.label}>Observaciones</label>
                  <textarea
                    className={styles.input}
                    rows={3}
                    placeholder="Notas adicionales..."
                    value={nuevoMantenimiento.observaciones}
                    onChange={(e) => setNuevoMantenimiento({ ...nuevoMantenimiento, observaciones: e.target.value })}
                  />
                </div>

                <button type="submit" className={styles.submitButton} style={{ marginTop: "1rem" }}>
                  Guardar Mantenimiento
                </button>
              </form>
            </div>
          )}

          {/* Historial de Mantenimientos */}
          <h2 style={{ marginBottom: "1rem" }}>Historial de Mantenimientos</h2>
          <div className={styles.grid}>
            {mantenimientos.map((m) => (
              <div
                key={m.id}
                className={styles.card}
                style={{ borderLeft: `4px solid ${m.tipo === "PREVENTIVO" ? "#22c55e" : "#f59e0b"}` }}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.badge} style={{ backgroundColor: m.tipo === "PREVENTIVO" ? "rgba(34, 197, 94, 0.2)" : "rgba(245, 158, 11, 0.2)", color: m.tipo === "PREVENTIVO" ? "#22c55e" : "#f59e0b" }}>
                      {m.tipo}
                    </span>
                    <h4 className={styles.cardTitle} style={{ marginTop: "0.5rem" }}>
                      {m.descripcion}
                    </h4>
                    <span style={{ fontSize: "0.8rem", color: "#888" }}>{m.fecha}</span>
                  </div>
                  <button
                    onClick={() => m.id && handleEliminarMantenimiento(m.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "1.2rem" }}
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Kilometraje</span>
                  <span className={styles.statValue}>{m.kilometrajeRealizado?.toLocaleString()} km</span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Costo</span>
                  <span className={styles.statValue} style={{ color: "#ef4444" }}>
                    {m.costo?.toFixed(2)} €
                  </span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Taller</span>
                  <span className={styles.statValue}>{m.taller?.nombre || "N/A"}</span>
                </div>

                {m.repuestos && m.repuestos.length > 0 && (
                  <div style={{ marginTop: "1rem" }}>
                    <strong style={{ fontSize: "0.9rem", color: "var(--accent)" }}>Repuestos:</strong>
                    <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem", fontSize: "0.85rem", color: "#ccc" }}>
                      {m.repuestos.map((rep, index) => (
                        <li key={index}>
                          {rep.nombre} (x{rep.cantidad}) - {rep.costoUnitario?.toFixed(2)} €
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.observaciones && (
                  <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#aaa", fontStyle: "italic" }}>
                    Observaciones: {m.observaciones}
                  </p>
                )}
              </div>
            ))}
            {mantenimientos.length === 0 && (
              <p style={{ color: "var(--secondary)" }}>No hay mantenimientos registrados para este vehículo.</p>
            )}
          </div>
        </div>
      </main>
    </BackgroundMeteors>
  );
}
