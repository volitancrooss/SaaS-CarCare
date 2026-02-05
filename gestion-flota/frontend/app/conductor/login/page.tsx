"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import styles from "../../login/login.module.css"; // Reuse existing styles

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const CarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.6-1.1-1-1.9-1H5c-.8 0-1.4.4-1.9 1L1 10l-.6 1c-.6.9-.4 2.1.5 2.6.2.1.5.2.8.2H3v1c0 .6.4 1 1 1h1" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
    </svg>
);

export default function DriverLoginPage() {
    const router = useRouter();
    const [isRegistering, setIsRegistering] = useState(false);
    const [loading, setLoading] = useState(false);

    // Login Data
    const [loginData, setLoginData] = useState({ email: "", password: "" });

    // Register Data
    const [registerData, setRegisterData] = useState({
        nombre: "",
        email: "",
        password: "",
        empresaEmail: "" // Code/Email to link to company
    });

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(loginData)
            });

            let data;
            try {
                data = await res.json();
            } catch (jsonError) {
                console.warn("Non-JSON", jsonError);
                if (!res.ok) {
                    toast.error(`Error servidor (${res.status}). Reinicia el backend.`);
                    setLoading(false);
                    return;
                }
            }

            if (res.ok) {
                // Verify Role
                if (data.role !== 'CONDUCTOR') {
                    toast.error("Esta cuenta no es de conductor. Por favor usa el panel principal.");
                    setLoading(false);
                    return;
                }

                localStorage.setItem("user", JSON.stringify(data));
                toast.success("¡Bienvenido, Conductor!");
                window.dispatchEvent(new Event("storage"));
                router.push("/conductor");
            } else {
                toast.error(data.error || "Error al iniciar sesión");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/auth/register/conductor`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(registerData)
            });

            let data;
            try {
                data = await res.json();
            } catch (e) {
                if (!res.ok) {
                    toast.error(`Backend Error (${res.status}). Try restarting backend.`);
                    setLoading(false);
                    return;
                }
            }

            if (res.ok) {
                toast.success("Cuenta creada. Ahora puedes iniciar sesión.");
                setIsRegistering(false);
                // Pre-fill login email
                setLoginData(prev => ({ ...prev, email: registerData.email }));
            } else {
                toast.error(data.error || "Error al registrarse");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={styles.mainContainer}>
            {/* Visual Panel (Left) - Specific for Drivers */}
            <div className={styles.visualPanel} style={{ background: 'linear-gradient(135deg, #0f172a 0%, #000 100%)' }}>
                <div className={styles.visualContent}>
                    <div className={styles.brandLogo}>
                        <CarIcon />
                        <span>CarCare Driver</span>
                    </div>

                    <div className={styles.quoteBox}>
                        <h1>Tu ruta, optimizada.</h1>
                        <p>Únete a la flota de tu empresa y recibe tus rutas en tiempo real.</p>

                        <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#3bf63b' }}>¿Cómo funciona?</h3>
                            <ul style={{ fontSize: '0.8rem', color: '#94a3b8', paddingLeft: '1.2rem', lineHeight: '1.6' }}>
                                <li>Pide el email de administrador a tu jefe.</li>
                                <li>Regístrate usando ese email para vincularte.</li>
                                <li>¡Recibe rutas al instante!</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Panel (Right) */}
            <div className={styles.formPanel}>
                <div className={styles.formContent}>
                    <div className={styles.header}>
                        <h2 className={styles.title}>{isRegistering ? 'Alta de Conductor' : 'Acceso Conductor'}</h2>
                        <p className={styles.subtitle}>
                            {isRegistering
                                ? "¿Ya tienes cuenta? "
                                : "¿Nuevo en la flota? "}
                            <button
                                onClick={() => setIsRegistering(!isRegistering)}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                {isRegistering ? "Inicia sesión aquí" : "Regístrate aquí"}
                            </button>
                        </p>
                    </div>

                    {!isRegistering ? (
                        /* LOGIN FORM */
                        <form onSubmit={handleLogin} className={styles.form}>
                            <div className={styles.inputGroup}>
                                <label htmlFor="email">Tu Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    placeholder="conductor@flota.com"
                                    value={loginData.email}
                                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label htmlFor="password">Contraseña</label>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    value={loginData.password}
                                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                />
                            </div>
                            <button type="submit" className={styles.submitBtn} disabled={loading}>
                                {loading ? "Cargando..." : "Iniciar Turno"}
                            </button>
                        </form>
                    ) : (
                        /* REGISTER FORM */
                        <form onSubmit={handleRegister} className={styles.form}>
                            <div className={styles.inputGroup}>
                                <label>Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Juan Pérez"
                                    value={registerData.nombre}
                                    onChange={(e) => setRegisterData({ ...registerData, nombre: e.target.value })}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Tu Email</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="juan@flota.com"
                                    value={registerData.email}
                                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    value={registerData.password}
                                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                                />
                            </div>
                            <div className={styles.inputGroup} style={{ borderTop: '1px solid #334155', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                <label style={{ color: '#3bf63b' }}>Email de la Empresa (Administrador)</label>
                                <p style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                    Esto te vinculará a la flota correcta. Pídeselo a tu gestor.
                                </p>
                                <input
                                    type="email"
                                    required
                                    placeholder="admin@empresa.com"
                                    value={registerData.empresaEmail}
                                    onChange={(e) => setRegisterData({ ...registerData, empresaEmail: e.target.value })}
                                    style={{ borderColor: '#3bf63b' }}
                                />
                            </div>
                            <button type="submit" className={styles.submitBtn} disabled={loading}>
                                {loading ? "Registrando..." : "Unirse a la Flota"}
                            </button>
                        </form>
                    )}

                    <div className={styles.footerLink} style={{ marginTop: '2rem' }}>
                        <Link href="/login">
                            ¿Eres Administrador? Accede al Panel de Control
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
