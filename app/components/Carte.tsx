"use client";
import { MapContainer, TileLayer, WMSTileLayer, GeoJSON, CircleMarker, Tooltip } from "react-leaflet";
import type { Vente } from "@/lib/sources/dvf";

export default function Carte({
  lon,
  lat,
  parcelle,
  ventes,
}: {
  lon: number;
  lat: number;
  parcelle?: GeoJSON.Geometry | null;
  ventes?: Vente[];
}) {
  return (
    <div className="carte-map">
      <MapContainer center={[lat, lon]} zoom={18} maxZoom={20} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer attribution="© OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={20} />
        <WMSTileLayer
          url="https://data.geopf.fr/wms-r/wms"
          params={{ layers: "CADASTRALPARCELS.PARCELLAIRE_EXPRESS", format: "image/png", transparent: true, version: "1.3.0" } as never}
          opacity={0.8}
          maxZoom={20}
        />
        {parcelle && <GeoJSON key={JSON.stringify(parcelle).slice(0, 80)} data={parcelle as GeoJSON.GeoJsonObject} style={{ color: "#b7791f", weight: 3, fillOpacity: 0.25 }} />}
        {ventes?.map((v) =>
          v.lat != null && v.lon != null ? (
            <CircleMarker key={v.id} center={[v.lat, v.lon]} radius={6} pathOptions={{ color: "#2f5d9b", fillOpacity: 0.7 }}>
              <Tooltip>
                {v.date} · {Math.round(v.surface)} m² · {Math.round(v.prix).toLocaleString("fr-FR")} € ({Math.round(v.prixM2).toLocaleString("fr-FR")} €/m²)
              </Tooltip>
            </CircleMarker>
          ) : null,
        )}
      </MapContainer>
    </div>
  );
}
