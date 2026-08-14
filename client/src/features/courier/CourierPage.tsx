import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { InteractiveRouteMap, type RouteMapLine, type RouteMapMarker } from "../../components/InteractiveRouteMap";
import { NotificationBell } from "../../components/NotificationBell";
import { StateBlock } from "../../components/StateBlock";
import { postJson } from "../../shared/api";
import { useRealtimeResource } from "../../shared/useRealtimeResource";
import type { QueueItem } from "../../shared/types";

type CourierDashboard = {
  online: boolean;
  employeeName: string;
  profile?: EmployeeProfile;
  verificationLogs?: Array<{
    id: string;
    provider: string;
    status: string;
    type: "face" | "identity";
    createdAt: string;
    verifiedAt?: string | null;
  }>;
  vehicleType?: string;
  vehicleLabel: string;
  jobs: QueueItem[];
  verificationText: string;
  verificationStatus: string;
};

type EmployeeProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  age: string | number;
  gender: string;
  homeAddress: string;
  emergencyPhones: string;
  avatarDataUrl?: string;
  vehicleType?: string;
  vehiclePlate?: string;
};

type CourierTab = "home" | "deliveries" | "wallet" | "profile";

type GeoPoint = {
  lat: number;
  lng: number;
};

type MapPoint = {
  x: number;
  y: number;
};

const fallbackPosition: GeoPoint = { lat: 47.91785, lng: 106.93528 };
const tileSize = 256;
const mapViewportCenterY = 195;
const courierOfferTimeoutMs = 10_000;
const activePickupStates = ["ACCEPTED", "ARRIVING_PICKUP", "PICKUP_VERIFICATION"];
const serverConfirmedRouteStates = ["ARRIVING_PICKUP", "PICKUP_VERIFICATION"];
const employeeUiDeployMarker = "employee-work-mode-offer-card-v11";
const employeeProfileImageMaxBytes = 600_000;
const vehicleOptions = [
  { value: "WALK", label: "Явган" },
  { value: "MOPED", label: "Мопед" },
  { value: "CAR", label: "Машин" },
];

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
  deliveriesTab: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442",
  walletTab: "Хэтэвч",
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
  storeOtp: "Дэлгүүрт өгөх баталгаажуулах код",
  customerOtp: "Хүлээн авагчийн баталгаажуулах код",
  verifyPickup: "\u0410\u0447\u0430\u0430 \u0430\u0432\u0430\u0445",
  verifyDropoff: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442 \u0434\u0443\u0443\u0441\u0433\u0430\u0445",
  delivered: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442 \u0430\u043C\u0436\u0438\u043B\u0442\u0442\u0430\u0439",
  otpHint: "Туршилтын код: дэлгүүр 123456, хэрэглэгч 654321",
  home: "\u041D\u04AF\u04AF\u0440",
  history: "\u0422\u04AF\u04AF\u0445",
  control: "\u0425\u044F\u043D\u0430\u043B\u0442",
  profile: "\u041F\u0440\u043E\u0444\u0430\u0439\u043B",
  editProfile: "Профайл засах",
  saveProfile: "Хадгалах",
  cancel: "Болих",
  profileSaved: "Профайл хадгалагдлаа.",
  choosePhoto: "Зураг сонгох",
  firstName: "Нэр",
  lastName: "Овог",
  phoneNumber: "Утас",
  email: "Gmail",
  age: "Нас",
  gender: "Хүйс",
  homeAddress: "Гэрийн хаяг",
  emergencyPhones: "Яаралтай холбогдох",
  vehiclePlate: "Улсын дугаар",
  logout: "\u0413\u0430\u0440\u0430\u0445",
};

function longitudeToTileX(lng: number, zoomLevel: number) {
  return ((lng + 180) / 360) * 2 ** zoomLevel;
}

function latitudeToTileY(lat: number, zoomLevel: number) {
  const latitudeRadians = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2) * 2 ** zoomLevel;
}

function getTileUrl(x: number, y: number, zoomLevel: number) {
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

function midpoint(points: GeoPoint[]) {
  if (!points.length) return fallbackPosition;

  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
}

function createMapProjector(center: GeoPoint, zoomLevel: number) {
  const centerX = longitudeToTileX(center.lng, zoomLevel);
  const centerY = latitudeToTileY(center.lat, zoomLevel);

  return (point: GeoPoint): MapPoint => ({
    x: (longitudeToTileX(point.lng, zoomLevel) - centerX) * tileSize,
    y: (latitudeToTileY(point.lat, zoomLevel) - centerY) * tileSize,
  });
}

function pinStyle(point: MapPoint): CSSProperties {
  return {
    "--pin-x": `calc(50% + ${point.x}px)`,
    "--pin-y": `${mapViewportCenterY + point.y}px`,
  } as CSSProperties;
}

function lineStyle(from: MapPoint, to: MapPoint) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  return {
    "--route-left": `calc(50% + ${from.x}px)`,
    "--route-top": `${mapViewportCenterY + from.y}px`,
    "--route-width": `${Math.sqrt(dx ** 2 + dy ** 2)}px`,
    "--route-angle": `${Math.atan2(dy, dx)}rad`,
  } as CSSProperties;
}

function walkingRouteSegments(from: MapPoint, to: MapPoint) {
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

function profileFromDashboard(data?: CourierDashboard | null): EmployeeProfile {
  const [lastName = "", firstName = ""] = (data?.employeeName ?? "").split(" ");
  return {
    firstName: String(data?.profile?.firstName ?? firstName),
    lastName: String(data?.profile?.lastName ?? lastName),
    phone: String(data?.profile?.phone ?? ""),
    email: String(data?.profile?.email ?? ""),
    age: String(data?.profile?.age ?? ""),
    gender: String(data?.profile?.gender ?? ""),
    homeAddress: String(data?.profile?.homeAddress ?? ""),
    emergencyPhones: String(data?.profile?.emergencyPhones ?? ""),
    avatarDataUrl: data?.profile?.avatarDataUrl ?? "",
    vehicleType: data?.profile?.vehicleType ?? data?.vehicleType ?? "MOPED",
    vehiclePlate: data?.profile?.vehiclePlate ?? "",
  };
}

export function CourierPage({ onLogout }: { onLogout?: () => void }) {
  const dashboard = useRealtimeResource<CourierDashboard>("/dashboard", ["courier.dashboard.refresh", "courier.job.updated"]);
  const refreshDashboard = dashboard.refetch;
  const [activeTab, setActiveTab] = useState<CourierTab>("home");
  const [localOnline, setLocalOnline] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<QueueItem[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState<EmployeeProfile>(() => profileFromDashboard(null));
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<"active" | "completed">("active");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const lastLocationPostRef = useRef<{ point: GeoPoint; sentAt: number } | null>(null);
  const workModeDragStartRef = useRef<number | null>(null);
  const workModeDraggedRef = useRef(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [otpByJob, setOtpByJob] = useState<Record<string, string>>({});
  const [acceptedRouteJobIds, setAcceptedRouteJobIds] = useState<Set<string>>(() => new Set());
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [zoom, setZoom] = useState(13);
  const [offerClock, setOfferClock] = useState(Date.now());
  const isOnline = localOnline ?? dashboard.data?.online ?? false;
  const visibleJobs = (jobs ?? dashboard.data?.jobs ?? []).filter((job) => {
    const remaining = offerRemainingSeconds(job, offerClock);
    return remaining == null || remaining > 0;
  });
  const filteredJobs = visibleJobs.filter((job) => {
    const normalizedSearch = orderSearch.trim().toLowerCase();
    const matchesSearch = !normalizedSearch || `${job.id} ${job.name} ${job.distance}`.toLowerCase().includes(normalizedSearch);
    const matchesFilter =
      (orderFilter === "active" && job.state !== "DELIVERED")
      || (orderFilter === "completed" && job.state === "DELIVERED");

    return matchesSearch && matchesFilter;
  });
  const workVisibleJobs = isOnline ? visibleJobs : [];
  const newJobs = workVisibleJobs.filter((job) => job.state === "OFFERED");
  const deliveringJobs = workVisibleJobs.filter((job) => !["OFFERED", "DELIVERED"].includes(job.state));
  const deliveredJobs = visibleJobs.filter((job) => job.state === "DELIVERED");
  const offerJob = newJobs[0] ?? null;
  const activeMapJob = deliveringJobs[0] ?? null;
  const routeMapJob = activeMapJob
    && (
      acceptedRouteJobIds.has(activeMapJob.id)
      || serverConfirmedRouteStates.includes(activeMapJob.state)
    )
    ? activeMapJob
    : null;
  const pickupPoint = routeMapJob?.routePlan?.pickup ?? offerJob?.routePlan?.pickup;
  const dropoffPoint = routeMapJob?.routePlan?.dropoff ?? offerJob?.routePlan?.dropoff;
  const mapPoints = [position, pickupPoint, dropoffPoint].filter(Boolean) as GeoPoint[];
  const storeDistanceKm = position && pickupPoint ? haversineKm(position, pickupPoint) : null;
  const storeEtaMinutes = storeDistanceKm == null ? null : Math.max(1, Math.round(storeDistanceKm * 13));
  const totalPayoutMnt = visibleJobs.reduce((sum, job) => sum + Number(job.payoutMnt ?? 0), 0);
  const deliveredPayoutMnt = deliveredJobs.reduce((sum, job) => sum + Number(job.payoutMnt ?? 0), 0);
  const averagePayoutMnt = visibleJobs.length ? Math.round(totalPayoutMnt / visibleJobs.length) : 0;
  const pendingPayoutMnt = Math.max(0, totalPayoutMnt - deliveredPayoutMnt);
  const walletHistoryJobs = (deliveredJobs.length ? deliveredJobs : visibleJobs).slice(0, 4);
  const walletWeeklyBars = [42, 62, 36, 78, 56, 94, 24];
  const formatWalletMoney = (value: number) => `₮${value.toLocaleString("mn-MN")}`;
  const tabItems: Array<{ key: CourierTab; label: string; icon: string }> = [
    { key: "home", label: text.home, icon: "\u2302" },
    { key: "deliveries", label: text.deliveriesTab, icon: "\u25F7" },
    { key: "wallet", label: text.walletTab, icon: "$" },
    { key: "profile", label: text.profileTab, icon: "\u25CB" },
  ];
  const mapCenter = midpoint(mapPoints);
  const courierMapMarkers: RouteMapMarker[] = [
    ...(position ? [{ id: "courier", point: position, label: "Миний GPS", kind: "courier" as const }] : []),
    ...(pickupPoint ? [{ id: "pickup", point: pickupPoint, label: text.pickup, kind: "store" as const }] : []),
    ...(dropoffPoint ? [{ id: "dropoff", point: dropoffPoint, label: text.dropoff, kind: "customer" as const }] : []),
  ];
  const courierMapRoutes: RouteMapLine[] = [
    ...(position && pickupPoint ? [{ id: "to-pickup", from: position, to: pickupPoint, kind: "pickup" as const }] : []),
    ...(pickupPoint && dropoffPoint ? [{ id: "to-dropoff", from: pickupPoint, to: dropoffPoint, kind: "dropoff" as const }] : []),
  ];

  useEffect(() => {
    if (!dashboard.error || !isAuthSessionError(dashboard.error)) return;
    onLogout?.();
  }, [dashboard.error, onLogout]);

  useEffect(() => {
    if (!dashboard.data || profileEditing) return;
    setProfileForm(profileFromDashboard(dashboard.data));
  }, [dashboard.data, profileEditing]);

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
    if (!nextOnline) {
      setAcceptedRouteJobIds(new Set());
      setJobs((currentJobs) =>
        (currentJobs ?? visibleJobs).filter((job) => job.state === "DELIVERED"),
      );
    }

    try {
      const nextDashboard = await postJson<CourierDashboard>("/status", { online: nextOnline });
      setLocalOnline(nextDashboard.online);
      setJobs(nextOnline ? nextDashboard.jobs : nextDashboard.jobs.filter((job) => job.state === "DELIVERED"));
      if (!nextOnline) {
        setActiveTab("home");
        setAcceptedRouteJobIds(new Set());
      }
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

  function updateProfileField(field: keyof EmployeeProfile, value: string) {
    setProfileForm((current) => ({ ...current, [field]: value }));
  }

  function readProfilePhoto(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("Profile photo read failed"));
      reader.readAsDataURL(file);
    });
  }

  async function saveProfileData(nextProfile: EmployeeProfile, closeEditor = false) {
    setProfileSaving(true);
    setProfileMessage(null);
    setActionError(null);

    try {
      const nextDashboard = await postJson<CourierDashboard>("/profile", nextProfile);
      setProfileForm(profileFromDashboard(nextDashboard));
      if (closeEditor) setProfileEditing(false);
      setProfileMessage(text.profileSaved);
      await refreshDashboard({ silent: true });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : text.actionError);
    } finally {
      setProfileSaving(false);
    }
  }

  async function changeProfilePhoto(file: File | null) {
    if (!file) return;
    if (file.size > employeeProfileImageMaxBytes) {
      setProfileMessage("Зураг 600KB-аас бага байх хэрэгтэй.");
      return;
    }

    try {
      const avatarDataUrl = await readProfilePhoto(file);
      const nextProfile = { ...profileForm, avatarDataUrl };
      setProfileForm(nextProfile);
      await saveProfileData(nextProfile);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : text.actionError);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveProfileData(profileForm, true);
  }

  return (
    <main className="courier-page role-page" data-employee-ui-build={employeeUiDeployMarker}>
      <section className={`employee-mobile-shell ${sidebarOpen ? "is-menu-open" : ""}`}>
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
              <div className="employee-app-scroll">
              {/*
                <InteractiveRouteMap
                  className="employee-live-map"
                  initialZoom={14}
                  markers={courierMapMarkers}
                  routes={courierMapRoutes}
                  statusLabel={locationError || !position ? (locationError ?? text.locating) : undefined}
                >
                {offerJob && (
                  <article className="courier-map-request-card courier-offer-bar">
                    <div className="courier-offer-head">
                      <span className="courier-offer-icon" aria-hidden="true">▣</span>
                      <div>
                        <strong>Шинэ хүсэлт</strong>
                        <small>{typeof offerRemainingSeconds(offerJob, offerClock) === "number" ? `${offerRemainingSeconds(offerJob, offerClock)} сек` : text.urgent}</small>
                      </div>
                      <b>{offerJob.payoutMnt ?? "0"}₮</b>
                    </div>

                    <div className="courier-offer-route">
                      <p><span aria-hidden="true">{"\u25A0"}</span>{offerJob.pickupAddress ?? offerJob.name}</p>
                      <i aria-hidden="true" />
                      <p><span aria-hidden="true">{"\u25C6"}</span>{offerJob.dropoffAddress ?? text.dropoff}</p>
                    </div>

                    <div className="courier-offer-meta">
                      <span>{offerJob.routePlan?.totalKm ? `${offerJob.routePlan.totalKm} км` : offerJob.distance}</span>
                      <span>Ойролцоогоор {offerJob.routePlan?.etaMinutes ?? 12} мин</span>
                    </div>

                    <div className="courier-offer-actions">
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
                      <span>Дэлгүүр хүртэл шууд зай</span>
                      <span>Ирэх хугацаа {storeEtaMinutes ?? routeMapJob.routePlan?.etaMinutes ?? 1} мин</span>
                      <span>{position ? "Бодит GPS" : text.locating}</span>
                    </div>
                    <div className="employee-route-preview">
                      <strong>Ажилтан → Дэлгүүр чиглэл</strong>
                      <span>{routeMapJob.routePlan?.label ?? "Дэлгүүр рүү хамгийн ойр зам"}</span>
                    </div>
                    {routeMapJob.state === "ACCEPTED" && (
                      <button className="employee-full-action" onClick={() => postJobAction(routeMapJob.id, "arrive-store")} type="button">
                        {text.arrivedStore}
                      </button>
                    )}
                  </article>
                )}
                </InteractiveRouteMap>
              )}

              {false && routeMapJob && activePickupStates.includes(routeMapJob.state) && (
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
                    <span>Дэлгүүр хүртэл шууд зай</span>
                    <span>Ирэх хугацаа {storeEtaMinutes ?? routeMapJob.routePlan?.etaMinutes ?? 1} мин</span>
                    <span>{position ? "Бодит GPS" : text.locating}</span>
                  </div>
                  <div className="employee-route-preview">
                    <strong>Ажилтан → Дэлгүүр чиглэл</strong>
                    <span>{routeMapJob.routePlan?.label ?? "Дэлгүүр рүү хамгийн ойр зам"}</span>
                  </div>
                  {routeMapJob.state === "ACCEPTED" && (
                    <button className="employee-full-action" onClick={() => postJobAction(routeMapJob.id, "arrive-store")} type="button">
                      Хүргэлт авах газар ирлээ
                    </button>
                  )}
                </article>
              )}

              {false && offerJob && (
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
              */}
              {actionError && <p className="courier-rule-note danger">{actionError}</p>}

              {(activeTab === "home" || activeTab === "deliveries") && (
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
                    { key: "active", label: "ИДЭВХТЭЙ", count: newJobs.length + deliveringJobs.length },
                    { key: "completed", label: "ДУУССАН", count: deliveredJobs.length },
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
                      <span>{job.routePlan.totalKm} км · Ирэх хугацаа {job.routePlan.etaMinutes} мин</span>
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
                <section className="employee-wallet-page" aria-label="Миний түрийвч">
                  <header className="employee-wallet-header">
                    <h2>Миний түрийвч</h2>
                    <button aria-label="Тусламж" type="button">?</button>
                  </header>

                  <section className="employee-wallet-balance-card" aria-label="Нийт үлдэгдэл">
                    <div>
                      <span>Нийт үлдэгдэл</span>
                      <strong>{formatWalletMoney(totalPayoutMnt)}</strong>
                    </div>
                    <i aria-hidden="true">$</i>
                  </section>

                  <section className="employee-wallet-breakdown" aria-label="Орлогын задаргаа">
                    <article>
                      <span>Татахад бэлэн</span>
                      <strong>{formatWalletMoney(deliveredPayoutMnt)}</strong>
                      <em style={{ width: `${totalPayoutMnt ? Math.min(100, Math.round((deliveredPayoutMnt / totalPayoutMnt) * 100)) : 0}%` }} />
                    </article>
                    <article>
                      <span>Хүлээгдэж буй</span>
                      <strong>{formatWalletMoney(pendingPayoutMnt)}</strong>
                      <em style={{ width: `${totalPayoutMnt ? Math.min(100, Math.round((pendingPayoutMnt / totalPayoutMnt) * 100)) : 0}%` }} />
                    </article>
                  </section>

                  <button className="employee-wallet-withdraw" type="button">
                    <span aria-hidden="true">$</span>
                    Данс руу татах
                  </button>

                  <section className="employee-wallet-history" aria-label="Орлогын түүх">
                    <div className="employee-wallet-section-title">
                      <h3>Орлогын түүх</h3>
                      <button type="button">Бүгдийг харах</button>
                    </div>
                    <div className="employee-wallet-transactions">
                      {walletHistoryJobs.map((job, index) => (
                        <article key={job.id}>
                          <span aria-hidden="true">▣</span>
                          <div>
                            <strong>#{job.id.slice(-6).toUpperCase()}</strong>
                            <small>{index === 0 ? "Өнөөдөр, 14:20" : "Өнөөдөр, 12:45"}</small>
                          </div>
                          <p>
                            <b>+ {formatWalletMoney(Number(job.payoutMnt ?? averagePayoutMnt))}</b>
                            <small>{job.state === "DELIVERED" ? "Амжилттай" : "Хүлээгдэж буй"}</small>
                          </p>
                        </article>
                      ))}
                      {!walletHistoryJobs.length && <div className="employee-wallet-empty">{text.noJobs}</div>}
                    </div>
                  </section>

                  <section className="employee-wallet-weekly" aria-label="Долоо хоногийн гүйцэтгэл">
                    <h3>Долоо хоногийн гүйцэтгэл</h3>
                    <div className="employee-wallet-bars">
                      {walletWeeklyBars.map((height, index) => (
                        <span key={index} style={{ height: `${height}%` }} />
                      ))}
                    </div>
                    <div className="employee-wallet-days">
                      {["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"].map((day) => (
                        <span key={day}>{day}</span>
                      ))}
                    </div>
                  </section>
                </section>
              )}

              {false && activeTab === "wallet" && (
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
                <section className="employee-profile-page" aria-label={text.profileTab}>
                  <header className="employee-profile-top">
                    <div className="employee-profile-avatar-wrap">
                      <button
                        className="employee-profile-avatar"
                        disabled={profileSaving}
                        onClick={() => profilePhotoInputRef.current?.click()}
                        type="button"
                        aria-label={text.choosePhoto}
                      >
                        {profileForm.avatarDataUrl ? <img alt="" src={profileForm.avatarDataUrl} /> : (dashboard.data.employeeName ?? text.title).slice(0, 1)}
                      </button>
                      <input
                        ref={profilePhotoInputRef}
                        accept="image/*"
                        className="employee-profile-avatar-input"
                        onChange={(event) => {
                          void changeProfilePhoto(event.target.files?.[0] ?? null);
                          event.target.value = "";
                        }}
                        type="file"
                      />
                      <em>{dashboard.data.employeeName}</em>
                      <b>4.9 ★</b>
                    </div>
                    <div>
                      <span>Хүргэлтийн ажилтан</span>
                      <h2>{dashboard.data.employeeName}</h2>
                      <p>{dashboard.data.vehicleLabel}</p>
                    </div>
                    <button className="employee-profile-edit-toggle" onClick={() => setProfileEditing((current) => !current)} type="button">
                      {profileEditing ? text.cancel : text.editProfile}
                    </button>
                  </header>

                  {profileEditing && (
                    <form className="employee-profile-edit-form" onSubmit={saveProfile}>
                      <label className="employee-profile-photo-field">
                        <span>{text.choosePhoto}</span>
                        <input accept="image/*" onChange={(event) => changeProfilePhoto(event.target.files?.[0] ?? null)} type="file" />
                      </label>
                      <div>
                        <label>
                          {text.lastName}
                          <input onChange={(event) => updateProfileField("lastName", event.target.value)} required value={profileForm.lastName} />
                        </label>
                        <label>
                          {text.firstName}
                          <input onChange={(event) => updateProfileField("firstName", event.target.value)} required value={profileForm.firstName} />
                        </label>
                        <label>
                          {text.phoneNumber}
                          <input inputMode="tel" onChange={(event) => updateProfileField("phone", event.target.value)} required value={profileForm.phone} />
                        </label>
                        <label>
                          {text.email}
                          <input onChange={(event) => updateProfileField("email", event.target.value)} required type="email" value={profileForm.email} />
                        </label>
                        <label>
                          {text.age}
                          <input min={18} onChange={(event) => updateProfileField("age", event.target.value)} required type="number" value={profileForm.age} />
                        </label>
                        <label>
                          {text.gender}
                          <select onChange={(event) => updateProfileField("gender", event.target.value)} required value={profileForm.gender}>
                            <option value="">Сонгох</option>
                            <option value="male">Эрэгтэй</option>
                            <option value="female">Эмэгтэй</option>
                            <option value="other">Бусад</option>
                          </select>
                        </label>
                        <label className="employee-profile-wide-field">
                          {text.homeAddress}
                          <input onChange={(event) => updateProfileField("homeAddress", event.target.value)} required value={profileForm.homeAddress} />
                        </label>
                        <label className="employee-profile-wide-field">
                          {text.emergencyPhones}
                          <input onChange={(event) => updateProfileField("emergencyPhones", event.target.value)} required value={profileForm.emergencyPhones} />
                        </label>
                        <label>
                          {text.vehicle}
                          <select onChange={(event) => updateProfileField("vehicleType", event.target.value)} value={profileForm.vehicleType ?? "MOPED"}>
                            {vehicleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label>
                          {text.vehiclePlate}
                          <input onChange={(event) => updateProfileField("vehiclePlate", event.target.value)} placeholder="УБА 0000" value={profileForm.vehiclePlate ?? ""} />
                        </label>
                      </div>
                      {profileMessage && <p className="employee-profile-edit-message">{profileMessage}</p>}
                      <button className="employee-full-action" disabled={profileSaving} type="submit">
                        {profileSaving ? "Түр хүлээнэ үү..." : text.saveProfile}
                      </button>
                    </form>
                  )}

                  <section className="employee-profile-rating-card" aria-label="Үнэлгээ">
                    <div>
                      <span>Дундаж үнэлгээ</span>
                      <strong>4.9</strong>
                      <small>128 үнэлгээ</small>
                    </div>
                    <div className="employee-profile-stars" aria-label="4.9 од">★★★★★</div>
                  </section>

                  <section className="employee-profile-metrics" aria-label="Гүйцэтгэл">
                    <article>
                      <span>Дууссан</span>
                      <strong>{deliveredJobs.length}</strong>
                    </article>
                    <article>
                      <span>Идэвхтэй</span>
                      <strong>{newJobs.length + deliveringJobs.length}</strong>
                    </article>
                    <article>
                      <span>Орлого</span>
                      <strong>{formatWalletMoney(totalPayoutMnt)}</strong>
                    </article>
                  </section>

                  <section className="employee-profile-info" aria-label="Бүртгэлийн мэдээлэл">
                    <div>
                      <span>{text.identity}</span>
                      <strong>{dashboard.data.verificationStatus}</strong>
                    </div>
                    <div>
                      <span>Ажлын төлөв</span>
                      <strong>{isOnline ? text.working : text.offWork}</strong>
                    </div>
                    <p>{dashboard.data.verificationText}</p>
                  </section>

                  <section className="employee-profile-info employee-verification-audit" aria-label="Verification log">
                    {(dashboard.data.verificationLogs ?? []).slice(0, 5).map((log) => (
                      <div key={log.id}>
                        <span>{log.type === "face" ? "Царай" : "Бичиг баримт"}</span>
                        <strong>{log.status}</strong>
                        <small>{log.provider} · {new Date(log.createdAt).toLocaleString("mn-MN")}</small>
                      </div>
                    ))}
                    {!(dashboard.data.verificationLogs ?? []).length && <p>Verification log хоосон байна.</p>}
                  </section>

                  <section className="employee-profile-reviews" aria-label="Сүүлийн үнэлгээ">
                    <div className="employee-profile-section-title">
                      <h3>Сүүлийн үнэлгээ</h3>
                      <button type="button">Бүгд</button>
                    </div>
                    {[
                      { name: "Номин Супермаркет", note: "Түргэн, найдвартай хүргэлт.", score: "5.0" },
                      { name: "Хэрэглэгч", note: "Цагтаа ирсэн.", score: "4.8" },
                    ].map((review) => (
                      <article key={review.name}>
                        <span>{review.name.slice(0, 1)}</span>
                        <div>
                          <strong>{review.name}</strong>
                          <small>{review.note}</small>
                        </div>
                        <b>{review.score} ★</b>
                      </article>
                    ))}
                  </section>

                  {onLogout && <button className="employee-profile-logout" onClick={onLogout} type="button">{text.logout}</button>}
                </section>
              )}

              {false && activeTab === "profile" && (
                <section className="employee-dynamic-panel" aria-label={text.profileTab}>
                  <div className="employee-profile-summary">
                    <span>{(dashboard.data!.employeeName ?? text.title).slice(0, 1)}</span>
                    <div>
                      <strong>{dashboard.data!.employeeName}</strong>
                      <small>{dashboard.data!.vehicleLabel}</small>
                    </div>
                  </div>
                  <div className="employee-stat-grid">
                    <div>
                      <span>{text.identity}</span>
                      <strong>{dashboard.data!.verificationStatus}</strong>
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
                  <p className="employee-profile-note">{dashboard.data!.verificationText}</p>
                  {onLogout && <button className="employee-full-action" onClick={onLogout} type="button">{text.logout}</button>}
                </section>
              )}
              </div>
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
        {sidebarOpen && (
          <div className="employee-menu-layer">
            <button className="employee-drawer-backdrop" onClick={() => setSidebarOpen(false)} type="button" aria-label="Close menu" />
            <aside className="employee-drawer open" aria-hidden={false}>
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
          </div>
        )}
      </section>
    </main>
  );
}
