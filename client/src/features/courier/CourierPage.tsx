import { type CSSProperties, useEffect, useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { NotificationBell } from "../../components/NotificationBell";
import { StateBlock } from "../../components/StateBlock";
import { postJson } from "../../shared/api";
import { useRealtimeResource } from "../../shared/useRealtimeResource";
import type { QueueItem } from "../../shared/types";

type CourierDashboard = {
  online: boolean;
  expectedEarningMnt: string;
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

const fallbackPosition: GeoPoint = { lat: 47.9189, lng: 106.9176 };
const tileSize = 256;

const text = {
  title: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0430\u0436\u0438\u043B\u0442\u0430\u043D",
  startWork: "\u0410\u0436\u0438\u043B \u044D\u0445\u043B\u04AF\u04AF\u043B\u044D\u0445",
  stopWork: "\u0410\u0436\u043B\u0430\u0430\u0441 \u0431\u0443\u0443\u0445",
  confirmStart: "\u0410\u0436\u0438\u043B \u044D\u0445\u043B\u04AF\u04AF\u043B\u044D\u0445 \u04AF\u04AF?",
  confirmStop: "\u0410\u0436\u043B\u0430\u0430\u0441 \u0431\u0443\u0443\u0445 \u04AF\u04AF?",
  earning: "\u0425\u04AF\u043B\u044D\u044D\u0433\u0434\u044D\u0436 \u0431\u0443\u0439 \u043E\u0440\u043B\u043E\u0433\u043E",
  map: "\u041E\u0439\u0440\u043E\u043B\u0446\u043E\u043E\u0445 pickup \u0445\u04AF\u0441\u044D\u043B\u0442\u04AF\u04AF\u0434",
  accept: "\u0410\u0436\u0438\u043B \u0430\u0432\u0430\u0445",
  reject: "\u0422\u0430\u0442\u0433\u0430\u043B\u0437\u0430\u0445",
  vehicle: "\u0422\u04E9\u0440\u04E9\u043B",
  weight: "\u0416\u0438\u043D",
  payout: "\u0425\u04E9\u043B\u0441",
  distance: "\u0437\u0430\u0439\u0442\u0430\u0439",
  otp: "QR + OTP \u0448\u0430\u0430\u0440\u0434\u043B\u0430\u0433\u0430\u0442\u0430\u0439",
  verified: "\u0411\u0430\u0442\u0430\u043B\u0433\u0430\u0430\u0436\u0441\u0430\u043D",
  identity: "\u0411\u0430\u0442\u0430\u043B\u0433\u0430\u0430\u0436\u0443\u0443\u043B\u0430\u043B\u0442\u044B\u043D \u0442\u04E9\u043B\u04E9\u0432",
  noJobs: "\u041E\u0434\u043E\u043E\u0445\u043E\u043D\u0434\u043E\u043E \u043E\u0439\u0440\u043E\u043B\u0446\u043E\u043E \u0445\u04AF\u0441\u044D\u043B\u0442 \u0430\u043B\u0433\u0430.",
  activeDeliveryRule: "\u0418\u0434\u044D\u0432\u0445\u0442\u044D\u0439 \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u0442\u044D\u0439 \u04AF\u0435\u0434 \u0430\u0436\u043B\u0430\u0430\u0441 \u0431\u0443\u0443\u0445 \u0431\u043E\u043B\u043E\u043C\u0436\u0433\u04AF\u0439.",
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
  newRequest: "\u0428\u0438\u043D\u044D \u0445\u04AF\u0441\u044D\u043B\u0442",
  offline: "\u041E\u0444\u0444\u043B\u0430\u0439\u043D",
  online: "\u041E\u043D\u043B\u0430\u0439\u043D",
  approximate: "\u041E\u0439\u0440\u043E\u043B\u0446\u043E\u043E\u0433\u043E\u043E\u0440",
  acceptOrder: "\u0425\u04AF\u043B\u044D\u044D\u043D \u0430\u0432\u0430\u0445",
  details: "\u0414\u044D\u043B\u0433\u044D\u0440\u044D\u043D\u0433\u04AF\u0439",
  locationDenied: "\u0411\u0430\u0439\u0440\u0448\u0438\u043B \u0430\u0432\u0430\u0445 \u044D\u0440\u0445 \u043D\u044D\u044D\u0433\u0434\u044D\u044D\u0433\u04AF\u0439",
  locating: "\u0411\u0430\u0439\u0440\u0448\u0438\u043B \u0442\u043E\u0433\u0442\u043E\u043E\u0436 \u0431\u0430\u0439\u043D\u0430",
  eta: "~12 \u043C\u0438\u043D",
  arrivedStore: "\u0414\u044D\u043B\u0433\u04AF\u04AF\u0440 \u0434\u044D\u044D\u0440 \u0438\u0440\u043B\u044D\u044D",
  storeOtp: "\u0414\u044D\u043B\u0433\u04AF\u04AF\u0440\u0438\u0439\u043D OTP",
  customerOtp: "\u0425\u04AF\u043B\u044D\u044D\u043D \u0430\u0432\u0430\u0433\u0447\u0438\u0439\u043D OTP",
  verifyPickup: "\u0410\u0447\u0430\u0430 \u0430\u0432\u0430\u0445",
  verifyDropoff: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442 \u0434\u0443\u0443\u0441\u0433\u0430\u0445",
  delivered: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442 \u0430\u043C\u0436\u0438\u043B\u0442\u0442\u0430\u0439",
  otpHint: "\u0422\u0443\u0440\u0448\u0438\u043B\u0442\u044B\u043D OTP: \u0434\u044D\u043B\u0433\u04AF\u04AF\u0440 123456, \u0445\u04AF\u043B\u044D\u044D\u043D \u0430\u0432\u0430\u0433\u0447 654321",
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

export function CourierPage({ onLogout }: { onLogout?: () => void }) {
  const dashboard = useRealtimeResource<CourierDashboard>("/dashboard", ["courier.dashboard.refresh", "courier.job.updated"]);
  const [activeTab, setActiveTab] = useState<CourierTab>("map");
  const [localOnline, setLocalOnline] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<QueueItem[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | "new" | "delivering" | "delivered">("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [otpByJob, setOtpByJob] = useState<Record<string, string>>({});
  const [mapMode, setMapMode] = useState<MapMode>("white");
  const [zoom, setZoom] = useState(13);
  const isOnline = localOnline ?? dashboard.data?.online ?? false;
  const visibleJobs = jobs ?? dashboard.data?.jobs ?? [];
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
  const primaryJob = visibleJobs[0] ?? null;
  const hasActiveDelivery = visibleJobs.some((job) => job.state !== "OFFERED");
  const newJobs = visibleJobs.filter((job) => job.state === "OFFERED");
  const deliveringJobs = visibleJobs.filter((job) => !["OFFERED", "DELIVERED"].includes(job.state));
  const deliveredJobs = visibleJobs.filter((job) => job.state === "DELIVERED");
  const totalPayoutMnt = visibleJobs.reduce((sum, job) => sum + Number(job.payoutMnt ?? 0), 0);
  const deliveredPayoutMnt = deliveredJobs.reduce((sum, job) => sum + Number(job.payoutMnt ?? 0), 0);
  const averagePayoutMnt = visibleJobs.length ? Math.round(totalPayoutMnt / visibleJobs.length) : 0;
  const tabItems: Array<{ key: CourierTab; label: string; icon: string }> = [
    { key: "map", label: text.mapTab, icon: "\u25A1" },
    { key: "deliveries", label: text.deliveriesTab, icon: "\u25F7" },
    { key: "wallet", label: text.walletTab, icon: "$" },
    { key: "profile", label: text.profileTab, icon: "\u25CB" },
  ];
  const mapCenter = position ?? fallbackPosition;
  const mapTiles = getVisibleTiles(mapCenter, zoom);

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

  async function toggleOnline() {
    if (isOnline && hasActiveDelivery) return;
    const confirmed = window.confirm(isOnline ? text.confirmStop : text.confirmStart);
    if (!confirmed) return;
    setActionError(null);

    try {
      const nextDashboard = await postJson<CourierDashboard>("/status", { online: !isOnline });
      setLocalOnline(nextDashboard.online);
      setJobs(nextDashboard.jobs);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : text.actionError);
    }
  }

  async function acceptJob(jobId: string) {
    setActionError(null);

    try {
      const acceptedJob = await postJson<QueueItem>(`/jobs/${jobId}/accept`);
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
    <main className="courier-page role-page">
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

        <header className="employee-app-header">
          <button className="employee-menu-button" onClick={() => setSidebarOpen(true)} type="button" aria-label={text.menu}>
            <span />
            <span />
            <span />
          </button>
          <div className="employee-header-brand">
            <BrandLogo showText size={32} />
            <span className="employee-header-subtitle">{dashboard.data?.vehicleLabel ?? text.vehicle}</span>
          </div>
          <button className={`courier-header-toggle ${isOnline ? "online" : ""}`} onClick={toggleOnline} type="button" aria-label={isOnline ? text.stopWork : text.startWork}>
            <span>{text.offline}</span>
            <i aria-hidden="true" />
            <span>{text.online}</span>
          </button>
          <NotificationBell />
          <button className="employee-profile-button" onClick={() => setActiveTab("profile")} type="button" aria-label={text.profileTab}>
            <span aria-hidden="true">{(dashboard.data?.employeeName ?? text.title).slice(0, 1)}</span>
          </button>
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
                <span className="employee-store-pin" aria-label={text.pickup} />
                <span className="employee-drop-pin" aria-label={text.dropoff} />
                <span className={`employee-location-dot ${position ? "is-live" : ""}`} />
                {(locationError || !position) && (
                  <div className="employee-map-status">
                    <strong>{locationError ?? text.locating}</strong>
                  </div>
                )}
                {primaryJob?.state === "OFFERED" && (
                  <article className="courier-map-request-card">
                    <div className="courier-map-request-head">
                      <div>
                        <span>{text.newRequest}</span>
                        <strong>{text.urgent}</strong>
                      </div>
                      <b>{primaryJob.payoutMnt ?? "0"} MNT</b>
                    </div>
                    <div className="courier-map-route">
                      <p><span aria-hidden="true">{"\u25A0"}</span>{primaryJob.name}</p>
                      <i aria-hidden="true" />
                      <p><span aria-hidden="true">{"\u25C6"}</span>17-r khoroo, 12-r bair</p>
                    </div>
                    <div className="courier-map-request-meta">
                      <span>{primaryJob.distance}</span>
                      <span>{text.approximate} {text.eta}</span>
                    </div>
                    <div className="courier-map-request-actions">
                      <button onClick={() => rejectJob(primaryJob.id)} type="button">{text.reject}</button>
                      <button disabled={!isOnline || primaryJob.canAccept === false} onClick={() => acceptJob(primaryJob.id)} type="button">{text.acceptOrder}</button>
                    </div>
                  </article>
                )}
                <div className="employee-map-modes">
                  <button className={mapMode === "dark" ? "active" : ""} onClick={() => setMapMode("dark")} type="button">{text.darkMode}</button>
                  <button className={mapMode === "white" ? "active" : ""} onClick={() => setMapMode("white")} type="button">{text.whiteMode}</button>
                  <button className={mapMode === "satellite" ? "active" : ""} onClick={() => setMapMode("satellite")} type="button">{text.satelliteMode}</button>
                </div>
                </section>
              )}

              <section className="employee-shift-card">
                <div>
                  <span>{text.earning}</span>
                  <strong>{dashboard.data.expectedEarningMnt} MNT</strong>
                </div>
                <button className={isOnline ? "online" : ""} onClick={toggleOnline} type="button">
                  <span>{isOnline ? text.stopWork : text.startWork}</span>
                  <i aria-hidden="true" />
                </button>
              </section>
              {isOnline && hasActiveDelivery && <p className="courier-rule-note">{text.activeDeliveryRule}</p>}
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
                      <strong>{job.name}</strong>
                    </div>
                  </div>
                  <div className="employee-address-row">
                    <i className="dropoff" />
                    <div>
                      <span>{text.dropoff}</span>
                      <strong>17-r khoroo, 12-r bair</strong>
                    </div>
                  </div>
                  <div className="employee-request-meta">
                    <span>{job.distance}</span>
                    <span>{text.eta}</span>
                    <span>{job.weightKg ?? 1} kg</span>
                    <b>{job.requiredVehicleLabel}</b>
                  </div>
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
                        <button className="orange-button" disabled={!isOnline || job.canAccept === false} onClick={() => acceptJob(job.id)} type="button">{text.acceptOrder}</button>
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
                    <strong>{dashboard.data.expectedEarningMnt} MNT</strong>
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
                      <strong>{isOnline ? text.online : text.offline}</strong>
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
