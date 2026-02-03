"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

// Fix for default marker icons in Leaflet with Next.js
const DefaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const CarIcon = L.divIcon({
    html: `<div style="background-color: #3bf63b; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,255,0,0.5);"></div>`,
    className: "custom-car-icon",
    iconSize: [20, 20],
});

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lng], map.getZoom());
    }, [lat, lng]);
    return null;
}

interface MapTrackingProps {
    origin: [number, number];
    destination: [number, number];
    current: [number, number];
    isDeviated?: boolean;
}

export default function MapTracking({ origin, destination, current, isDeviated }: MapTrackingProps) {
    return (
        <MapContainer
            center={current}
            zoom={13}
            style={{ height: "100%", width: "100%", borderRadius: "12px", border: "2px solid rgba(255,255,255,0.1)" }}
            attributionControl={false}
        >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            {/* Starting point */}
            <Marker position={origin}>
                <Popup>Origen</Popup>
            </Marker>

            {/* Destination point */}
            <Marker position={destination}>
                <Popup>Destino</Popup>
            </Marker>

            {/* Current location (The car) */}
            <Marker position={current} icon={CarIcon}>
                <Popup>
                    {isDeviated ? "⚠️ ¡DESVIADO DEL CAMINO!" : "Vehículo en ruta"}
                </Popup>
            </Marker>

            {/* Route Line */}
            <Polyline
                positions={[origin, destination]}
                color={isDeviated ? "#ef4444" : "#3bf63b"}
                weight={5}
                opacity={0.6}
                dashArray={isDeviated ? "10, 10" : ""}
            />

            <RecenterMap lat={current[0]} lng={current[1]} />
        </MapContainer>
    );
}
