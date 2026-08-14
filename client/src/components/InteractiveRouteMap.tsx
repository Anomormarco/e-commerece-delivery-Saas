import { type CSSProperties, type PointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

export type RouteMapPoint = {
  lat: number;
  lng: number;
};

export type RouteMapMarker = {
  id: string;
  point: RouteMapPoint;
  label: string;
  kind: "store" | "courier" | "customer" | "offer";
};

export type RouteMapLine = {
  id: string;
  from: RouteMapPoint;
  to: RouteMapPoint;
  kind?: "pickup" | "dropoff" | "neutral";
};

const tileSize = 256;
const minZoom = 10;
const maxZoom = 18;

function longitudeToTileX(lng: number, zoomLevel: number) {
  return ((lng + 180) / 360) * 2 ** zoomLevel;
}

function latitudeToTileY(lat: number, zoomLevel: number) {
  const latitudeRadians = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2) * 2 ** zoomLevel;
}

function tileXToLongitude(x: number, zoomLevel: number) {
  return (x / 2 ** zoomLevel) * 360 - 180;
}

function tileYToLatitude(y: number, zoomLevel: number) {
  const radians = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** zoomLevel)));
  return (radians * 180) / Math.PI;
}

function mapTileUrl(x: number, y: number, zoomLevel: number) {
  return `https://tile.openstreetmap.org/${zoomLevel}/${x}/${y}.png`;
}

// Coordinates can arrive missing/malformed from a stale or in-flight backend
// response (e.g. right after a status transition, before a fresh route plan
// lands). Without this guard, a single bad lat/lng throws inside render and
// blanks the whole page (no error boundary) - so every point is validated
// and non-finite values are dropped instead of crashing.
function isValidPoint(point: RouteMapPoint | null | undefined): point is RouteMapPoint {
  if (!point) return false;
  return Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));
}

function centerFor(points: RouteMapPoint[]) {
  const usable = points.filter(isValidPoint);
  if (!usable.length) return { lat: 47.91785, lng: 106.93528 };
  return {
    lat: usable.reduce((sum, point) => sum + Number(point.lat), 0) / usable.length,
    lng: usable.reduce((sum, point) => sum + Number(point.lng), 0) / usable.length,
  };
}

function projectPoint(point: RouteMapPoint, center: RouteMapPoint, zoomLevel: number) {
  return {
    x: (longitudeToTileX(Number(point.lng), zoomLevel) - longitudeToTileX(Number(center.lng), zoomLevel)) * tileSize,
    y: (latitudeToTileY(Number(point.lat), zoomLevel) - latitudeToTileY(Number(center.lat), zoomLevel)) * tileSize,
  };
}

function pointStyle(point: RouteMapPoint, center: RouteMapPoint, zoomLevel: number): CSSProperties {
  const projected = projectPoint(point, center, zoomLevel);
  return {
    "--map-x": `calc(50% + ${projected.x}px)`,
    "--map-y": `calc(50% + ${projected.y}px)`,
  } as CSSProperties;
}

function lineStyle(line: RouteMapLine, center: RouteMapPoint, zoomLevel: number): CSSProperties {
  const from = projectPoint(line.from, center, zoomLevel);
  const to = projectPoint(line.to, center, zoomLevel);
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  return {
    "--route-left": `calc(50% + ${from.x}px)`,
    "--route-top": `calc(50% + ${from.y}px)`,
    "--route-width": `${Math.sqrt(dx ** 2 + dy ** 2)}px`,
    "--route-angle": `${Math.atan2(dy, dx)}rad`,
  } as CSSProperties;
}

export function InteractiveRouteMap({
  className = "",
  markers,
  routes = [],
  initialZoom = 14,
  statusLabel,
  statusDetail,
  children,
}: {
  className?: string;
  markers: RouteMapMarker[];
  routes?: RouteMapLine[];
  initialZoom?: number;
  statusLabel?: string;
  statusDetail?: string;
  children?: ReactNode;
}) {
  const safeMarkers = useMemo(() => markers.filter((marker) => isValidPoint(marker.point)), [markers]);
  const safeRoutes = useMemo(() => routes.filter((route) => isValidPoint(route.from) && isValidPoint(route.to)), [routes]);
  const pointsKey = safeMarkers.map((marker) => `${marker.id}:${Number(marker.point.lat).toFixed(6)},${Number(marker.point.lng).toFixed(6)}`).join("|");
  const initialCenter = useMemo(() => centerFor(safeMarkers.map((marker) => marker.point)), [pointsKey]);
  const [center, setCenter] = useState(initialCenter);
  const [zoom, setZoom] = useState(initialZoom);
  const dragRef = useRef<{ x: number; y: number; center: RouteMapPoint } | null>(null);

  useEffect(() => {
    setCenter(initialCenter);
  }, [initialCenter]);

  const tiles = useMemo(() => {
    const centerX = longitudeToTileX(center.lng, zoom);
    const centerY = latitudeToTileY(center.lat, zoom);
    const baseX = Math.floor(centerX);
    const baseY = Math.floor(centerY);
    const offsets = [-2, -1, 0, 1, 2];

    return offsets.flatMap((offsetY) => offsets.map((offsetX) => {
      const x = baseX + offsetX;
      const y = baseY + offsetY;
      return {
        key: `${zoom}-${x}-${y}`,
        x,
        y,
        style: {
          left: `calc(50% + ${(x - centerX) * tileSize}px)`,
          top: `calc(50% + ${(y - centerY) * tileSize}px)`,
        } as CSSProperties,
      };
    }));
  }, [center, zoom]);

  function zoomBy(delta: number) {
    setZoom((current) => Math.min(maxZoom, Math.max(minZoom, current + delta)));
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? -1 : 1);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, center };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    const centerX = longitudeToTileX(drag.center.lng, zoom) - (event.clientX - drag.x) / tileSize;
    const centerY = latitudeToTileY(drag.center.lat, zoom) - (event.clientY - drag.y) / tileSize;
    setCenter({ lat: tileYToLatitude(centerY, zoom), lng: tileXToLongitude(centerX, zoom) });
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  return (
    <div
      className={`interactive-route-map ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div className="interactive-route-map-tiles" aria-hidden="true">
        {tiles.map((tile) => (
          <img alt="" draggable={false} key={tile.key} src={mapTileUrl(tile.x, tile.y, zoom)} style={tile.style} />
        ))}
      </div>
      {safeRoutes.map((route) => (
        <span className={`interactive-route-line route-${route.kind ?? "neutral"}`} key={route.id} style={lineStyle(route, center, zoom)} />
      ))}
      {safeMarkers.map((marker) => (
        <span
          aria-label={marker.label}
          className={`interactive-route-marker marker-${marker.kind}`}
          key={marker.id}
          style={pointStyle(marker.point, center, zoom)}
          title={marker.label}
        >
          {marker.kind === "courier" ? "" : marker.kind === "customer" ? "" : ""}
        </span>
      ))}
      <div className="interactive-route-controls">
        <button onClick={() => zoomBy(1)} type="button" aria-label="Ойртуулах">+</button>
        <button onClick={() => zoomBy(-1)} type="button" aria-label="Холдуулах">-</button>
      </div>
      {(statusLabel || statusDetail) && (
        <div className="interactive-route-status">
          {statusLabel && <strong>{statusLabel}</strong>}
          {statusDetail && <span>{statusDetail}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
