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

function centerFor(points: RouteMapPoint[]) {
  if (!points.length) return { lat: 47.91785, lng: 106.93528 };
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
}

function projectPoint(point: RouteMapPoint, center: RouteMapPoint, zoomLevel: number) {
  return {
    x: (longitudeToTileX(point.lng, zoomLevel) - longitudeToTileX(center.lng, zoomLevel)) * tileSize,
    y: (latitudeToTileY(point.lat, zoomLevel) - latitudeToTileY(center.lat, zoomLevel)) * tileSize,
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
  const pointsKey = markers.map((marker) => `${marker.id}:${marker.point.lat.toFixed(6)},${marker.point.lng.toFixed(6)}`).join("|");
  const initialCenter = useMemo(() => centerFor(markers.map((marker) => marker.point)), [pointsKey]);
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
      {routes.map((route) => (
        <span className={`interactive-route-line route-${route.kind ?? "neutral"}`} key={route.id} style={lineStyle(route, center, zoom)} />
      ))}
      {markers.map((marker) => (
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
