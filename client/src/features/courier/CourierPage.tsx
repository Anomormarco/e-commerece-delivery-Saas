import { type CSSProperties, useEffect, useRef, useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { NotificationBell } from "../../components/NotificationBell";
import { StateBlock } from "../../components/StateBlock";
import { postJson } from "../../shared/api";
import { useRealtimeResource } from "../../shared/useRealtimeResource";
import type { QueueItem } from "../../shared/types";

type CourierDashboard = {
  online: boolean;
  employeeName: string;
  vehicleLabel: string;
  jobs: QueueItem[];
  verificationText: string;
  verificationStatus: string;
};

type MapMode = "dark" | "white" | "satellite";
type CourierTab = "map" | "deliveries" | "wallet" | "profile";

type GeoPoint = {
  lat: number;
  lng: number;
};

const fallbackPosition: GeoPoint = { lat: 47.91785, lng: 106.93528 };
const tileSize = 256;
const courierOfferTimeoutMs = 12_000;
const activePickupStates = ["ACCEPTED", "ARRIVING_PICKUP", "PICKUP_VERIFICATION"];
const employeeUiDeployMarker = "employee-work-mode-offer-card-v11";

function isAuthSessionError(message?: string | null) {
  const normalized = String(message ?? "").toLowerCase();
  return normalized.includes("token")
    || normalized.includes("expired")
    || normalized.includes("unauthenticated")
    || normalized.includes("нэвтрэх")
    || normalized.includes("хугацаа");
}

const text = {
  title: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0430\u0436\u0438\u043B\u0442\u0430\u043D",
  startWork: "\u0410\u0436\u0438\u043B \u044D\u0445\u043B\u04AF\u04AF\u043B\u044D\u0445",
  stopWork: "\u0410\u0436\u043B\u0430\u0430\u0441 \u0431\u0443\u0443\u0445",
  working: "\u0410\u0436\u0438\u043B\u043B\u0430\u0436 \u0431\u0430\u0439\u043D\u0430",
  offWork: "\u0410\u0436\u043B\u0430\u0430\u0441 \u0431\u0443\u0443\u0441\u0430\u043D",
  confirmStart: "\u0410\u0436\u0438\u043B \u044D\u0445\u043B\u04AF\u04AF\u043B\u044D\u0445 \u04AF\u04AF?",
  confirmStop: "\u0410\u0436\u043B\u0430\u0430\u0441 \u0431\u0443\u0443\u0445 \u04AF\u04AF?",
  map: "\u041E\u0439\u0440\u043E\u043B\u0446\u043E\u043E\u0445 pickup \u0445\u04AF\u0441\u044D\u043B\u0442\u04AF\u04AF\u0434",
  accept: "\u0410\u0436\u0438\u043B \u0430\u0432\u0430\u0445",
  reject: "\u0410\u043B\u0433\u0430\u0441\u0430\u0445",
  vehicle: "\u0422\u04E9\u0440\u04E9\u043B",
  weight: "\u0416\u0438\u043D",
  payout: "\u0425\u04E9\u043B\u0441",
  distance: "\u0437\u0430\u0439\u0442\u0430\u0439",
  otp: "QR + OTP \u0448\u0430\u0430\u0440\u0434\u043B\u0430\u0433\u0430\u0442\u0430\u0439",
  verified: "\u0411\u0430\u0442\u0430\u043B\u0433\u0430\u0430\u0436\u0441\u0430\u043D",
  identity: "\u0411\u0430\u0442\u0430\u043B\u0433\u0430\u0430\u0436\u0443\u0443\u043B\u0430\u043B\u0442\u044B\u043D \u0442\u04E9\u043B\u04E9\u0432",
  noJobs: "\u041E\u0434\u043E\u043E\u0445\u043E\u043D\u0434\u043E\u043E \u043E\u0439\u0440\u043E\u043B\u0446\u043E\u043E \u0445\u04AF\u0441\u044D\u043B\u0442 \u0430\u043B\u0433\u0430.",
  actionError: "\u04AE\u0439\u043B\u0434\u044D\u043B \u0430\u043C\u0436\u0441\u0430\u043D\u0433\u04AF\u0439.",
  menu: "\u0426\u044D\u0441",
  mapTab: "\u0413\u0430\u0437\u0440\u044B\u043D \u0437\u0443\u0440\u0430\u0433",
  deliveriesTab: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442",
  walletTab: "\u041E\u0440\u043B\u043E\u0433\u043E",
  profileTab: "\u041F\u0440\u043E\u0444\u0430\u0439\u043B",
  pickup: "\u0410\u0432\u0430\u0445 \u0433\u0430\u0437\u0430\u0440",
  dropoff: "\u0425\u04AF\u0440\u0433\u044D\u0445 \u0433\u0430\u0437\u0430\u0440",
  incoming: "\u0428\u0438\u043D\u044D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0445\u04AF\u0441\u044D\u043B\u0442",
  myOrders: "\u041C\u0438\u043D\u0438\u0439 \u0437\u0430\u0445\u0438\u0430\u043B\u0433\u0443\u0443\u0434",
  searchOrders: "\u0417\u0430\u0445\u0438\u0430\u043B\u0433\u044B\u043D \u0434\u0443\u0433\u0430\u0430\u0440, \u043D\u044D\u0440, \u0445\u0430\u044F\u0433\u0430\u0430\u0440 \u0445\u0430\u0439\u0445...",
  allOrders: "\u0411\u04AF\u0433\u0434",
  newOrders: "\u0428\u0438\u043D\u044D",
  deliveringOrders: "\u0425\u04AF\u0440\u0433\u044D\u0433\u0434\u044D\u0436 \u0431\u0443\u0439",
  deliveredOrders: "\u0425\u04AF\u0440\u0433\u044D\u0433\u0434\u0441\u044D\u043D",
  urgent: "\u042F\u0430\u0440\u0430\u043B\u0442\u0430\u0439",
  newRequest: "\u0428\u0438\u043D\u044D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0445\u04AF\u0441\u044D\u043B\u0442",
  approximate: "\u041E\u0439\u0440\u043E\u043B\u0446\u043E\u043E\u0433\u043E\u043E\u0440",
  acceptOrder: "\u0425\u04AF\u043B\u044D\u044D\u043D \u0430\u0432\u0430\u0445",
  details: "\u0414\u044D\u043B\u0433\u044D\u0440\u044D\u043D\u0433\u04AF\u0439",
  locationDenied: "\u0411\u0430\u0439\u0440\u0448\u0438\u043B \u0430\u0432\u0430\u0445 \u044D\u0440\u0445 \u043D\u044D\u044D\u0433\u0434\u044D\u044D\u0433\u04AF\u0439",
  locating: "\u0411\u0430\u0439\u0440\u0448\u0438\u043B \u0442\u043E\u0433\u0442\u043E\u043E\u0436 \u0431\u0430\u0439\u043D\u0430",
  eta: "~12 \u043C\u0438\u043D",
  arrivedStore: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442 \u0430\u0432\u0430\u0445\u0430\u0434 \u0431\u044D\u043B\u044D\u043D",
  storeOtp: "Store owner-д өгөх OTP",
  customerOtp: "\u0425\u04AF\u043B\u044D\u044D\u043D \u0430\u0432\u0430\u0433\u0447\u0438\u0439\u043D OTP",
  verifyPickup: "\u0410\u0447\u0430\u0430 \u0430\u0432\u0430\u0445",
  verifyDropoff: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442 \u0434\u0443\u0443\u0441\u0433\u0430\u0445",
  delivered: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442 \u0430\u043C\u0436\u0438\u043B\u0442\u0442\u0430\u0439",
  otpHint: "Туршилтын OTP: store owner 123456, хэрэглэгч 654321",
  darkMode: "\u0425\u0430\u0440\u0430\u043D\u0445\u0443\u0439",
  whiteMode: "\u0426\u0430\u0439\u0432\u0430\u0440",
  satelliteMode: "\u0425\u0438\u0439\u043C\u044D\u043B \u0434\u0430\u0433\u0443\u0443\u043B",
  home: "\u041D\u04AF\u04AF\u0440",
  history: "\u0422\u04AF\u04AF\u0445",
  control: "\u0425\u044F\u043D\u0430\u043B\u0442",
  profile: "\u041F\u0440\u043E\u0444\u0430\u0439\u043B",
  logout: "\u0413\u0430\u0440\u0430\u0445",
};

function longitudeToTileX(lng: number, zoomLevel: number) {
  return ((lng + 180) / 360) * 2 ** zoomLevel;
}

function latitudeToTileY(lat: number, zoomLevel: number) {
  const latitudeRadians = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2) * 2 ** zoomLevel;
}

function getTileUrl(mapMode: MapMode, x: number, y: number, zoomLevel: number) {
  if (mapMode === "dark") {
    return `https://a.basemaps.cartocdn.com/dark_all/${zoomLevel}/${x}/${y}.png`;
  }

  if (mapMode === "satellite") {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoomLevel}/${y}/${x}`;
  }

  return `https://tile.openstreetmap.org/${zoomLevel}/${x}/${y}.png`;
}

function getVisibleTiles(center: GeoPoint, zoomLevel: number) {
  const centerX = longitudeToTileX(center.lng, zoomLevel);
  const centerY = latitudeToTileY(center.lat, zoomLevel);
  const baseX = Math.floor(centerX);
  const baseY = Math.floor(centerY);

  return [-1, 0, 1].flatMap((offsetY) =>
    [-1, 0, 1].map((offsetX) => {
      const x = baseX + offsetX;
      const y = baseY + offsetY;

      return {
        key: `${zoomLevel}-${x}-${y}`,
        urlX: x,
        urlY: y,
        style: {
          left: `${384 + (x - centerX) * tileSize}px`,
          top: `${195 + (y - centerY) * tileSize}px`,
        } as CSSProperties,
      };
    }),
  );
}

function haversineKm(from: GeoPoint, to: GeoPoint) {
  const earthKm = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function midpoint(points: GeoPoint[]) {
  if (!points.length) return fallbackPosition;

  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
}

function createMapProjector(points: GeoPoint[]) {
  const usablePoints = points.length ? points : [fallbackPosition];
  const lats = usablePoints.map((point) => point.lat);
  const lngs = usablePoints.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.02);
  const lngSpan = Math.max(maxLng - minLng, 0.02);

  return (point: GeoPoint) => ({
    x: clamp(12 + ((point.lng - minLng) / lngSpan) * 76, 12, 88),
    y: clamp(88 - ((point.lat - minLat) / latSpan) * 76, 12, 88),
  });
}

function lineStyle(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  return {
    "--route-left": `${from.x}%`,
    "--route-top": `${from.y}%`,
    "--route-width": `${Math.sqrt(dx ** 2 + dy ** 2)}%`,
    "--route-angle": `${Math.atan2(dy, dx)}rad`,
  } as CSSProperties;
}

function walkingRouteSegments(from: { x: number; y: number }, to: { x: number; y: number }) {
  const midX = from.x + (to.x - from.x) * 0.52;
  const midY = from.y + (to.y - from.y) * 0.48;
  const turnA = { x: midX, y: from.y + (midY - from.y) * 0.35 };
  const turnB = { x: midX, y: midY };
  const turnC = { x: to.x - (to.x - midX) * 0.2, y: midY };
  const points = [from, turnA, turnB, turnC, to];

  return points.slice(1).map((point, index) => ({
    key: `${index}-${point.x.toFixed(2)}-${point.y.toFixed(2)}`,
    style: lineStyle(points[index], point),
  }));
}

function offerRemainingSeconds(job: QueueItem, now: number) {
  if (job.state !== "OFFERED") return null;
  const createdAtMs = job.createdAt ? new Date(job.createdAt).getTime() : NaN;

  if (Number.isFinite(createdAtMs)) {
    return Math.max(0, Math.ceil((createdAtMs + courierOfferTimeoutMs - now) / 1000));
  }

  return typeof job.offerExpiresInSec === "number" ? Math.max(0, job.offerExpiresInSec) : 12;
}

export function CourierPage({ onLogout }: { onLogout?: () => void }) {
  const dashboard = useRealtimeResource<CourierDashboard>("/dashboard", ["courier.dashboard.refresh", "courier.job.updated"]);
  const refreshDashboard = dashboard.refetch;
  const [activeTab, setActiveTab] = useState<CourierTab>("map");
  const [localOnline, setLocalOnline] = useState<boolean | null>(true);
  const [jobs, setJobs] = useState<QueueItem[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | "new" | "delivering" | "delivered">("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const lastLocationPostRef = useRef<{ point: GeoPoint; sentAt: number } | null>(null);
  const workModeDragStartRef = useRef<number | null>(null);
  const workModeDraggedRef = useRef(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [otpByJob, setOtpByJob] = useState<Record<string, string>>({});
  const [acceptedRouteJobIds, setAcceptedRouteJobIds] = useState<Set<string>>(() => new Set());
  const [mapMode, setMapMode] = useState<MapMode>("white");
  const [zoom, setZoom] = useState(13);
  const [offerClock, setOfferClock] = useState(Date.now());
  const isOnline = localOnline ?? dashboard.data?.online ?? true;
  const visibleJobs = (jobs ?? dashboard.data?.jobs ?? []).filter((job) => {
    const remaining = offerRemainingSeconds(job, offerClock);
    return remaining == null || remaining > 0;
  });
  const filteredJobs = visibleJobs.filter((job) => {
    const normalizedSearch = orderSearch.trim().toLowerCase();
    const matchesSearch = !normalizedSearch || `${job.id} ${job.name} ${job.distance}`.toLowerCase().includes(normalizedSearch);
    const matchesFilter =
      orderFilter === "all"
      || (orderFilter === "new" && job.state === "OFFERED")
      || (orderFilter === "delivering" && !["OFFERED", "DELIVERED"].includes(job.state))
      || (orderFilter === "delivered" && job.state === "DELIVERED");

    return matchesSearch && matchesFilter;
  });
  const newJobs = visibleJobs.filter((job) => job.state === "OFFERED");
  const deliveringJobs = visibleJobs.filter((job) => !["OFFERED", "DELIVERED"].includes(job.state));
  const deliveredJobs = visibleJobs.filter((job) => job.state === "DELIVERED");
  const offerJob = newJobs[0] ?? null;
  const activeMapJob = deliveringJobs[0] ?? null;
  const routeMapJob = activeMapJob && (acceptedRouteJobIds.has(activeMapJob.id) || activePickupStates.includes(activeMapJob.state)) ? activeMapJob : null;
  const pickupPoint = routeMapJob?.routePlan?.pickup;
  const dropoffPoint = routeMapJob?.routePlan?.dropoff;
  const courierPoint = position ?? fallbackPosition;
  const mapPoints = [courierPoint, pickupPoint, dropoffPoint].filter(Boolean) as GeoPoint[];
  const projectMapPoint = createMapProjector(mapPoints);
  const courierMapPoint = projectMapPoint(courierPoint);
  const pickupMapPoint = pickupPoint ? projectMapPoint(pickupPoint) : { x: 24, y: 74 };
  const dropoffMapPoint = dropoffPoint ? projectMapPoint(dropoffPoint) : { x: 78, y: 32 };
  const storeDistanceKm = pickupPoint ? haversineKm(courierPoint, pickupPoint) : null;
  const storeEtaMinutes = storeDistanceKm == null ? null : Math.max(1, Math.round(storeDistanceKm * 13));
  const totalPayoutMnt = visibleJobs.reduce((sum, job) => sum + Number(job.payoutMnt ?? 0), 0);
  const deliveredPayoutMnt = deliveredJobs.reduce((sum, job) => sum + Number(job.payoutMnt ?? 0), 0);
  const averagePayoutMnt = visibleJobs.length ? Math.round(totalPayoutMnt / visibleJobs.length) : 0;
  const tabItems: Array<{ key: CourierTab; label: string; icon: string }> = [
    { key: "map", label: text.mapTab, icon: "\u25A1" },
    { key: "deliveries", label: text.deliveriesTab, icon: "\u25F7" },
    { key: "wallet", label: text.walletTab, icon: "$" },
    { key: "profile", label: text.profileTab, icon: "\u25CB" },
  ];
  const mapCenter = midpoint(mapPoints);
  const mapTiles = getVisibleTiles(mapCenter, zoom);

  useEffect(() => {
    if (!dashboard.error || !isAuthSessionError(dashboard.error)) return;
    onLogout?.();
  }, [dashboard.error, onLogout]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshDashboard({ silent: true });
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [refreshDashboard]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setOfferClock(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationError(text.locationDenied);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (nextPosition) => {
        setLocationError(null);
        setPosition({
          lat: nextPosition.coords.latitude,
          lng: nextPosition.coords.longitude,
        });
      },
      () => setLocationError(text.locationDenied),
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 12000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!isOnline || !position) return;

    const lastLocation = lastLocationPostRef.current;
    const now = Date.now();
    const movedKm = lastLocation ? haversineKm(lastLocation.point, position) : Number.POSITIVE_INFINITY;
    if (lastLocation && now - lastLocation.sentAt < 5000 && movedKm < 0.03) return;

    lastLocationPostRef.current = { point: position, sentAt: now };
    postJson("/location", {
      lat: position.lat,
      lng: position.lng,
    }).catch(() => {});
  }, [isOnline, position]);

  async function setWorkMode(nextOnline: boolean) {
    if (nextOnline === isOnline) return;

    const confirmed = window.confirm(nextOnline ? text.confirmStart : text.confirmStop);
    if (!confirmed) return;
    setActionError(null);

    try {
      const nextDashboard = await postJson<CourierDashboard>("/status", { online: nextOnline });
      setLocalOnline(nextDashboard.online);
      setJobs(nextDashboard.jobs);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : text.actionError);
    }
  }

  function beginWorkModeDrag(clientX: number) {
    workModeDragStartRef.current = clientX;
    workModeDraggedRef.current = false;
  }

  function finishWorkModeDrag(clientX: number) {
    const startX = workModeDragStartRef.current;
    workModeDragStartRef.current = null;
    if (startX == null) return;

    const deltaX = clientX - startX;
    if (Math.abs(deltaX) < 22) return;

    workModeDraggedRef.current = true;
    void setWorkMode(deltaX > 0);
  }

  function toggleWorkMode() {
    if (workModeDraggedRef.current) {
      workModeDraggedRef.current = false;
      return;
    }

    void setWorkMode(!isOnline);
  }

  async function acceptJob(jobId: string) {
    setActionError(null);

    try {
      const acceptedJob = await postJson<QueueItem>(`/jobs/${jobId}/accept`);
      setAcceptedRouteJobIds((currentIds) => new Set(currentIds).add(acceptedJob.id));
      setLocalOnline(true);
      setJobs((currentJobs) =>
        (currentJobs ?? visibleJobs).map((job) => (job.id === acceptedJob.id ? acceptedJob : job)),
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : text.actionError);
    }
  }

  function updateJob(nextJob: QueueItem) {
    setJobs((currentJobs) =>
      (currentJobs ?? visibleJobs).map((job) => (job.id === nextJob.id ? nextJob : job)),
    );
  }

  async function postJobAction(jobId: string, path: string, body?: unknown) {
    setActionError(null);

    try {
      const nextJob = await postJson<QueueItem>(`/jobs/${jobId}/${path}`, body);
      updateJob(nextJob);
      setOtpByJob((current) => ({ ...current, [jobId]: "" }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : text.actionError);
    }
  }

  async function rejectJob(jobId: string) {
    setActionError(null);

    try {
      const nextDashboard = await postJson<CourierDashboard>(`/jobs/${jobId}/reject`);
      setLocalOnline(nextDashboard.online);
      setJobs(nextDashboard.jobs);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : text.actionError);
    }
  }

  return (
    <main className="courier-page role-page" data-employee-ui-build={employeeUiDeployMarker}>
      <section className="employee-mobile-shell">
        <aside className={`employee-drawer ${sidebarOpen ? "open" : ""}`} aria-hidden={!sidebarOpen}>
          <div className="employee-drawer-brand">
            <BrandLogo showText size={32} />
            <span className="employee-drawer-subtitle">{dashboard.data?.employeeName ?? text.title}</span>
          </div>
          {tabItems.map((item) => (
            <button
              className={activeTab === item.key ? "active" : ""}
              key={item.key}
              onClick={() => {
                setActiveTab(item.key);
                setSidebarOpen(false);
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
          {onLogout && <button onClick={onLogout} type="button">{text.logout}</button>}
        </aside>
        {sidebarOpen && <button className="employee-drawer-backdrop" onClick={() => setSidebarOpen(false)} type="button" aria-label="Close menu" />}

        <header className="employee-app-header" data-header-version="work-mode-v7">
          <button className="employee-menu-button" onClick={() => setSidebarOpen(true)} type="button" aria-label={text.menu}>
            <span />
            <span />
            <span />
          </button>
          <button className="employee-header-profile" onClick={() => setActiveTab("profile")} type="button" aria-label={text.profile}>
            <span aria-hidden="true">{(dashboard.data?.employeeName ?? text.title).slice(0, 1)}</span>
            <div>
              <strong>{dashboard.data?.employeeName ?? text.title}</strong>
              <small>{dashboard.data?.vehicleLabel ?? text.vehicle}</small>
            </div>
          </button>
          <div className="employee-header-actions">
            <button
              aria-label={isOnline ? text.stopWork : text.startWork}
              aria-pressed={isOnline}
              className={`courier-work-mode ${isOnline ? "is-working" : "is-off-work"}`}
              onClick={toggleWorkMode}
              onPointerCancel={() => {
                workModeDragStartRef.current = null;
                workModeDraggedRef.current = false;
              }}
              onPointerDown={(event) => beginWorkModeDrag(event.clientX)}
              onPointerUp={(event) => finishWorkModeDrag(event.clientX)}
              type="button"
            >
              <span aria-hidden="true" className="courier-work-mode-track" />
              <span aria-hidden="true" className="courier-work-mode-labels">
                <span>{text.stopWork}</span>
                <span>{text.startWork}</span>
              </span>
              <span className="courier-work-mode-thumb">{isOnline ? text.stopWork : text.startWork}</span>
            </button>
            <NotificationBell className="employee-header-notifications" />
          </div>
        </header>
        <StateBlock loading={dashboard.loading} error={dashboard.error} empty={!dashboard.data}>
          {dashboard.data && (
            <>
              {activeTab === "map" && (
                <section className={`employee-live-map map-mode-${mapMode}`} style={{ "--employee-map-zoom": zoom } as CSSProperties}>
                <div className="employee-map-tiles" aria-label={text.mapTab}>
                  {mapTiles.map((tile) => (
                    <img
                      alt=""
                      draggable={false}
                      key={tile.key}
                      src={getTileUrl(mapMode, tile.urlX, tile.urlY, zoom)}
                      style={tile.style}
                    />
                  ))}
                </div>
                <div className="employee-map-zoom">
                  <button onClick={() => setZoom((current) => Math.min(current + 1, 18))} type="button" aria-label="Zoom in">+</button>
                  <button onClick={() => setZoom((current) => Math.max(current - 1, 10))} type="button" aria-label="Zoom out">-</button>
                </div>
                {routeMapJob && pickupPoint && walkingRouteSegments(courierMapPoint, pickupMapPoint).map((segment) => (
                  <span className="employee-direct-route employee-route-pickup" key={`pickup-${segment.key}`} style={segment.style} />
                ))}
                {routeMapJob && pickupPoint && dropoffPoint && walkingRouteSegments(pickupMapPoint, dropoffMapPoint).map((segment) => (
                  <span className="employee-direct-route employee-route-dropoff" key={`dropoff-${segment.key}`} style={segment.style} />
                ))}
                {routeMapJob && pickupPoint && (
                  <span
                    className="employee-store-pin"
                    style={{ "--pin-x": `${pickupMapPoint.x}%`, "--pin-y": `${pickupMapPoint.y}%` } as CSSProperties}
                    aria-label={text.pickup}
                  />
                )}
                {routeMapJob && dropoffPoint && (
                  <span
                    className="employee-drop-pin"
                    style={{ "--pin-x": `${dropoffMapPoint.x}%`, "--pin-y": `${dropoffMapPoint.y}%` } as CSSProperties}
                    aria-label={text.dropoff}
                  />
                )}
                <span
                  className={`employee-location-dot ${position ? "is-live" : ""}`}
                  style={{ "--pin-x": `${courierMapPoint.x}%`, "--pin-y": `${courierMapPoint.y}%` } as CSSProperties}
                />
                {(locationError || !position) && (
                  <div className="employee-map-status">
                    <strong>{locationError ?? text.locating}</strong>
                  </div>
                )}
                {offerJob && (
                  <article className="courier-map-request-card">
                    <div className="courier-map-request-head">
                      <div>
                        <span>{text.newRequest}</span>
                        <strong>{typeof offerRemainingSeconds(offerJob, offerClock) === "number" ? `${offerRemainingSeconds(offerJob, offerClock)}s` : text.urgent}</strong>
                      </div>
                      <b>{offerJob.payoutMnt ?? "0"} MNT</b>
                    </div>
                    <div className="courier-map-route">
                      <p><span aria-hidden="true">{"\u25A0"}</span>{offerJob.pickupAddress ?? offerJob.name}</p>
                      <i aria-hidden="true" />
                      <p><span aria-hidden="true">{"\u25C6"}</span>{offerJob.dropoffAddress ?? text.dropoff}</p>
                    </div>
                    <div className="courier-map-request-meta">
                      <span>{offerJob.distance}</span>
                      <span>{text.approximate} {text.eta}</span>
                      {typeof offerRemainingSeconds(offerJob, offerClock) === "number" && <span>{offerRemainingSeconds(offerJob, offerClock)}s</span>}
                    </div>
                    {offerJob.routePlan && (
                      <div className="employee-route-preview">
                        <strong>{offerJob.routePlan?.label}</strong>
                        <span>{offerJob.routePlan?.totalKm} км · ETA {offerJob.routePlan?.etaMinutes} мин</span>
                        <small>Явган {offerJob.routePlan?.walkingMinutes} мин / Авто зам {offerJob.routePlan?.drivingMinutes} мин</small>
                      </div>
                    )}
                    <div className="courier-map-request-actions">
                      <button onClick={() => rejectJob(offerJob.id)} type="button">{text.reject}</button>
                      <button disabled={offerJob.canAccept === false} onClick={() => acceptJob(offerJob.id)} type="button">{text.acceptOrder}</button>
                    </div>
                  </article>
                )}
                {routeMapJob && activePickupStates.includes(routeMapJob.state) && (
                  <article className="courier-map-request-card is-active-route">
                    <div className="courier-map-request-head">
                      <div>
                        <span>{text.pickup}</span>
                        <strong>{routeMapJob.pickupAddress ?? routeMapJob.name}</strong>
                      </div>
                      <b>{storeDistanceKm == null ? routeMapJob.distance : `${storeDistanceKm.toFixed(2)} км`}</b>
                    </div>
                    <div className="courier-map-request-meta">
                      <span>Store хүртэл шууд зай</span>
                      <span>ETA {storeEtaMinutes ?? routeMapJob.routePlan?.etaMinutes ?? 1} мин</span>
                      <span>{position ? "Live GPS" : text.locating}</span>
                    </div>
                    <div className="employee-route-preview">
                      <strong>Employee → Store route realtime</strong>
                      <span>{routeMapJob.routePlan?.label ?? "Store руу хамгийн ойр зам"}</span>
                    </div>
                    {routeMapJob.state === "ACCEPTED" && (
                      <button className="employee-full-action" onClick={() => postJobAction(routeMapJob.id, "arrive-store")} type="button">
                        {text.arrivedStore}
                      </button>
                    )}
                  </article>
                )}
                <div className="employee-map-modes">
                  <button className={mapMode === "dark" ? "active" : ""} onClick={() => setMapMode("dark")} type="button">{text.darkMode}</button>
                  <button className={mapMode === "white" ? "active" : ""} onClick={() => setMapMode("white")} type="button">{text.whiteMode}</button>
                  <button className={mapMode === "satellite" ? "active" : ""} onClick={() => setMapMode("satellite")} type="button">{text.satelliteMode}</button>
                </div>
                </section>
              )}

              {activeTab === "map" && routeMapJob && activePickupStates.includes(routeMapJob.state) && (
                <article className="employee-map-offer-card employee-map-route-card">
                  <div className="courier-map-request-head">
                    <div>
                      <span>{text.pickup}</span>
                      <strong>{routeMapJob.pickupAddress ?? routeMapJob.name}</strong>
                    </div>
                    <b>{storeDistanceKm == null ? routeMapJob.distance : `${storeDistanceKm.toFixed(2)} км`}</b>
                  </div>
                  <div className="employee-route-contact">
                    <span>{routeMapJob.pickupAddress ?? routeMapJob.name}</span>
                    {routeMapJob.customerPhone && <a href={`tel:${routeMapJob.customerPhone}`}>{routeMapJob.customerPhone}</a>}
                  </div>
                  <div className="courier-map-request-meta">
                    <span>Store хүртэл шууд зай</span>
                    <span>ETA {storeEtaMinutes ?? routeMapJob.routePlan?.etaMinutes ?? 1} мин</span>
                    <span>{position ? "Live GPS" : text.locating}</span>
                  </div>
                  <div className="employee-route-preview">
                    <strong>Employee → Store route realtime</strong>
                    <span>{routeMapJob.routePlan?.label ?? "Store руу хамгийн ойр зам"}</span>
                  </div>
                  {routeMapJob.state === "ACCEPTED" && (
                    <button className="employee-full-action" onClick={() => postJobAction(routeMapJob.id, "arrive-store")} type="button">
                      Хүргэлт авах газар ирлээ
                    </button>
                  )}
                </article>
              )}

              {false && activeTab === "map" && offerJob && (
                <article className="employee-map-offer-card">
                  <div className="courier-map-request-head">
                    <div>
                      <span>{text.newRequest}</span>
                      <strong>{typeof offerRemainingSeconds(offerJob, offerClock) === "number" ? `${offerRemainingSeconds(offerJob, offerClock)}s` : text.urgent}</strong>
                    </div>
                    <b>{offerJob.payoutMnt ?? "0"} MNT</b>
                  </div>
                  <div className="courier-map-route">
                    <p><span aria-hidden="true">{"\u25A0"}</span>{offerJob.pickupAddress ?? offerJob.name}</p>
                    <i aria-hidden="true" />
                    <p><span aria-hidden="true">{"\u25C6"}</span>{offerJob.dropoffAddress ?? text.dropoff}</p>
                  </div>
                  <div className="courier-map-request-meta">
                    <span>{offerJob.distance}</span>
                    <span>{text.approximate} {text.eta}</span>
                    {typeof offerRemainingSeconds(offerJob, offerClock) === "number" && <span>{offerRemainingSeconds(offerJob, offerClock)}s</span>}
                  </div>
                  <div className="courier-map-request-actions">
                    <button onClick={() => rejectJob(offerJob.id)} type="button">{text.reject}</button>
                    <button disabled={offerJob.canAccept === false} onClick={() => acceptJob(offerJob.id)} type="button">{text.acceptOrder}</button>
                  </div>
                </article>
              )}
              {actionError && <p className="courier-rule-note danger">{actionError}</p>}

              {activeTab === "deliveries" && (
                <>
              <section className="courier-order-experience" aria-label={text.myOrders}>
                <div className="courier-order-search">
                  <h2>{text.myOrders}</h2>
                  <label>
                    <span aria-hidden="true">{"\u2315"}</span>
                    <input
                      onChange={(event) => setOrderSearch(event.target.value)}
                      placeholder={text.searchOrders}
                      value={orderSearch}
                    />
                  </label>
                </div>
                <div className="courier-order-filters">
                  {[
                    { key: "all", label: text.allOrders, count: visibleJobs.length },
                    { key: "new", label: text.newOrders, count: newJobs.length },
                    { key: "delivering", label: text.deliveringOrders, count: deliveringJobs.length },
                    { key: "delivered", label: text.deliveredOrders, count: deliveredJobs.length },
                  ].map((filter) => (
                    <button
                      className={orderFilter === filter.key ? "active" : ""}
                      key={filter.key}
                      onClick={() => setOrderFilter(filter.key as typeof orderFilter)}
                      type="button"
                    >
                      {filter.label}{filter.count ? ` (${filter.count})` : ""}
                    </button>
                  ))}
                </div>
              </section>

              {filteredJobs.map((job, index) => (
                <article className="employee-request-card" key={job.id}>
                  <div className="employee-request-title">
                    <span>{job.state === "OFFERED" && index === 0 ? text.urgent : text.incoming}</span>
                    <strong>{job.payoutMnt ?? "0"} MNT</strong>
                  </div>
                  <div className="employee-address-row">
                    <i className="pickup" />
                    <div>
                      <span>{text.pickup}</span>
                      <strong>{job.pickupAddress ?? job.name}</strong>
                    </div>
                  </div>
                  <div className="employee-address-row">
                    <i className="dropoff" />
                    <div>
                      <span>{text.dropoff}</span>
                      <strong>{job.dropoffAddress ?? text.dropoff}</strong>
                    </div>
                  </div>
                  <div className="employee-request-meta">
                    <span>{job.distance}</span>
                    <span>{text.eta}</span>
                    <span>{job.weightKg ?? 1} kg</span>
                    {typeof offerRemainingSeconds(job, offerClock) === "number" && <span>{offerRemainingSeconds(job, offerClock)}s</span>}
                    <b>{job.requiredVehicleLabel}</b>
                  </div>
                  {job.routePlan && (
                    <div className="employee-route-preview">
                      <strong>{job.routePlan.label}</strong>
                      <span>{job.routePlan.totalKm} км · ETA {job.routePlan.etaMinutes} мин</span>
                      <small>Явган {job.routePlan.walkingMinutes} мин / Авто зам {job.routePlan.drivingMinutes} мин</small>
                    </div>
                  )}
                  {job.state === "ACCEPTED" && (
                    <button className="employee-full-action" onClick={() => postJobAction(job.id, "arrive-store")} type="button">
                      {text.arrivedStore}
                    </button>
                  )}
                  {job.state === "PICKUP_VERIFICATION" && (
                    <div className="employee-otp-panel">
                      <label>
                        {text.storeOtp}
                        <input
                          inputMode="numeric"
                          maxLength={6}
                          onChange={(event) => setOtpByJob((current) => ({ ...current, [job.id]: event.target.value.replace(/\D/g, "") }))}
                          placeholder="123456"
                          value={otpByJob[job.id] ?? ""}
                        />
                      </label>
                      <button onClick={() => postJobAction(job.id, "verify-pickup", { otp: otpByJob[job.id] })} type="button">
                        {text.verifyPickup}
                      </button>
                    </div>
                  )}
                  {["PICKED_UP", "IN_TRANSIT", "ARRIVING_DROPOFF"].includes(job.state) && (
                    <div className="employee-otp-panel">
                      <label>
                        {text.customerOtp}
                        <input
                          inputMode="numeric"
                          maxLength={6}
                          onChange={(event) => setOtpByJob((current) => ({ ...current, [job.id]: event.target.value.replace(/\D/g, "") }))}
                          placeholder="654321"
                          value={otpByJob[job.id] ?? ""}
                        />
                      </label>
                      <button onClick={() => postJobAction(job.id, "verify-dropoff", { otp: otpByJob[job.id] })} type="button">
                        {text.verifyDropoff}
                      </button>
                    </div>
                  )}
                  {job.state === "DELIVERED" && <div className="employee-delivered-note">{text.delivered}</div>}
                  <small className="employee-otp-hint">{text.otpHint}</small>
                  <div className="courier-actions">
                    {job.state === "OFFERED" ? (
                      <>
                        <button className="light-button" onClick={() => rejectJob(job.id)} type="button">{text.reject}</button>
                        <button className="orange-button" disabled={job.canAccept === false} onClick={() => acceptJob(job.id)} type="button">{text.acceptOrder}</button>
                      </>
                    ) : (
                      <span className="employee-status-chip">{job.state}</span>
                    )}
                  </div>
                </article>
              ))}
                </>
              )}

              {activeTab === "wallet" && (
                <section className="employee-dynamic-panel" aria-label={text.walletTab}>
                  <div className="employee-panel-title">
                    <span>{text.walletTab}</span>
                    <strong>{totalPayoutMnt} MNT</strong>
                  </div>
                  <div className="employee-stat-grid">
                    <div>
                      <span>Нийт боломжит</span>
                      <strong>{totalPayoutMnt} MNT</strong>
                    </div>
                    <div>
                      <span>Дууссан хүргэлт</span>
                      <strong>{deliveredPayoutMnt} MNT</strong>
                    </div>
                    <div>
                      <span>Дундаж хөлс</span>
                      <strong>{averagePayoutMnt} MNT</strong>
                    </div>
                    <div>
                      <span>Хүлээгдэж буй</span>
                      <strong>{deliveringJobs.length + newJobs.length}</strong>
                    </div>
                  </div>
                  <div className="employee-wallet-list">
                    {visibleJobs.map((job) => (
                      <div key={job.id}>
                        <span>{job.name}</span>
                        <strong>{job.payoutMnt ?? "0"} MNT</strong>
                        <small>{job.state}</small>
                      </div>
                    ))}
                    {!visibleJobs.length && <p>{text.noJobs}</p>}
                  </div>
                </section>
              )}

              {activeTab === "profile" && (
                <section className="employee-dynamic-panel" aria-label={text.profileTab}>
                  <div className="employee-profile-summary">
                    <span>{(dashboard.data.employeeName ?? text.title).slice(0, 1)}</span>
                    <div>
                      <strong>{dashboard.data.employeeName}</strong>
                      <small>{dashboard.data.vehicleLabel}</small>
                    </div>
                  </div>
                  <div className="employee-stat-grid">
                    <div>
                      <span>{text.identity}</span>
                      <strong>{dashboard.data.verificationStatus}</strong>
                    </div>
                    <div>
                      <span>Ажлын төлөв</span>
                      <strong>{isOnline ? text.working : text.offWork}</strong>
                    </div>
                    <div>
                      <span>{text.deliveriesTab}</span>
                      <strong>{visibleJobs.length}</strong>
                    </div>
                    <div>
                      <span>{text.deliveredOrders}</span>
                      <strong>{deliveredJobs.length}</strong>
                    </div>
                  </div>
                  <p className="employee-profile-note">{dashboard.data.verificationText}</p>
                  {onLogout && <button className="employee-full-action" onClick={onLogout} type="button">{text.logout}</button>}
                </section>
              )}
              <nav className="courier-bottom-nav" aria-label={text.title}>
                {tabItems.map((item) => (
                  <button
                    className={activeTab === item.key ? "active" : ""}
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    type="button"
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </nav>
            </>
          )}
        </StateBlock>
      </section>
    </main>
  );
}
