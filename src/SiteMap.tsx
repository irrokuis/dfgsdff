import L from "leaflet";
import "leaflet.heat";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useState } from "react";
import type { Competitor } from "./api/generated";
import type { LocationSelection } from "./scenario";

const AUCKLAND_CENTER: [number, number] = [-36.8485, 174.7633];
const targetIcon = L.divIcon({ className: "target-marker", html: "", iconSize: [18, 18], iconAnchor: [9, 9] });
function MapClick({ onSelect }: { onSelect: (location: LocationSelection) => void }) { useMapEvents({ click: event => onSelect({ kind: "map", latitude: event.latlng.lat, longitude: event.latlng.lng, displayName: "Map-selected site" }) }); return null; }

function CompetitorHeatmap({ competitors }: { competitors: Competitor[] }) {
  const map = useMap();
  useEffect(() => {
    if (!competitors.length) return undefined;
    const layer = L.heatLayer(
      competitors.map(competitor => [competitor.latitude, competitor.longitude, 1] as L.HeatLatLngTuple),
      { radius: 34, blur: 26, maxZoom: 16, minOpacity: .22, gradient: { .2: "#38BDF8", .45: "#2563EB", .7: "#8B5CF6", 1: "#E11D48" } },
    ).addTo(map);
    return () => { layer.remove(); };
  }, [competitors, map]);
  return null;
}

function clusters(competitors: Competitor[]) {
  const groups = new Map<string, Competitor[]>();
  competitors.forEach(item => { const key = `${item.latitude.toFixed(3)}:${item.longitude.toFixed(3)}`; groups.set(key, [...(groups.get(key) ?? []), item]); });
  return [...groups.values()].map(items => ({ items, latitude: items.reduce((sum, item) => sum + item.latitude, 0) / items.length, longitude: items.reduce((sum, item) => sum + item.longitude, 0) / items.length }));
}

export function SiteMap({ location, competitors = [], onSelect }: { location: LocationSelection; competitors?: Competitor[]; onSelect?: (location: LocationSelection) => void }) {
  const selected = location.kind === "unselected" ? null : [location.latitude, location.longitude] as [number, number];
  const [mapLayer, setMapLayer] = useState<"dots" | "heatmap">("dots");
  return <div className="map-wrapper">
    <MapContainer key={selected?.join(",") ?? "auckland"} center={selected ?? AUCKLAND_CENTER} zoom={selected ? 14 : 12} scrollWheelZoom className="map" aria-label={onSelect ? "Map for choosing the proposed store location" : "Clustered competitor map"}>
      <TileLayer attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'} url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
      {onSelect && <MapClick onSelect={onSelect} />}
      {selected && <><Marker position={selected} icon={targetIcon}><Tooltip>Proposed store location</Tooltip></Marker><Circle center={selected} radius={1500} pathOptions={{ color: "#F97316", weight: 2, fill: false }} /></>}
      {!onSelect && mapLayer === "heatmap" && <CompetitorHeatmap competitors={competitors} />}
      {mapLayer === "dots" && clusters(competitors).map(cluster => <CircleMarker key={`${cluster.latitude}-${cluster.longitude}`} center={[cluster.latitude, cluster.longitude]} radius={Math.min(18, 7 + Math.log2(cluster.items.length))} pathOptions={{ color: "#0284C7", fillColor: "#38BDF8", fillOpacity: .8 }}><Popup><strong>{cluster.items.length} nearby competitors</strong><br />Closest: {cluster.items[0].name} ({Math.round(cluster.items[0].distance_m)} m)</Popup></CircleMarker>)}
    </MapContainer>
    {!onSelect && competitors.length > 0 && <label className="map-layer-switch"><span className="sr-only">Competitor map layer</span><select aria-label="Competitor map layer" value={mapLayer} onChange={event => setMapLayer(event.target.value as "dots" | "heatmap")}><option value="dots">Dots</option><option value="heatmap">Heat map</option></select></label>}
  </div>;
}
