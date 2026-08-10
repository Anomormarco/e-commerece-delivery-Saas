import { createElement, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { BrandLogo } from "../../components/BrandLogo";

type AuthMode = "login" | "register";
type PartnerAuthMode = "login" | "register";
type DeliveryType = "bike" | "car" | "foot";
type PaymentMethod = "stripe" | "qpay";
type LandingSection = "home" | "market" | "contact" | "courier" | "partner";

type PublicLandingProps = {
  page?: LandingSection;
  onNavigateHome?: () => void;
  onNavigateMarket?: () => void;
  onNavigateContact?: () => void;
  onNavigateCourier?: () => void;
  onNavigatePartner?: () => void;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  priceMnt: number;
  weightGrams: number;
  stockCount: number;
  description: string;
  imageUrl?: string;
};

type CustomerSession = {
  token: string;
  customer: {
    id: string;
    fullName: string;
    email?: string;
    phone: string;
  };
};

type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

type TrackingResponse = {
  orderNo: string;
  storeName: string;
  district: string;
  statusLabel: string;
  totalMnt: string;
  timeline: Array<{
    state: "done" | "active" | "pending";
    title: string;
    description: string;
    time: string;
  }>;
  courier: {
    name: string;
    vehicle: string;
    etaText: string;
  };
  courierLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: string;
  };
};

type StoreDirectoryItem = {
  id: string;
  name: string;
  description: string;
  address: string;
  coverUrl: string;
  productCount: number;
  orderCount: number;
  categories: string[];
    products: Array<{
    id: string;
    name: string;
    category: string;
    priceMnt: string;
    weightGrams: number;
    imageUrl?: string;
  }>;
};

type StoreDirectoryResponse = {
  items: StoreDirectoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3000/api";
const customerRealtimeUrl = import.meta.env.VITE_CUSTOMER_REALTIME_URL ?? "ws://127.0.0.1:3104/realtime";
const employeePortalUrl = import.meta.env.VITE_EMPLOYEE_PORTAL_URL ?? "http://127.0.0.1:5176";
const storePortalUrl = import.meta.env.VITE_SHOP_APP_URL ?? "http://127.0.0.1:5175";
const tokenStorageKey = "deliverhub-customer-access-token";
const customerStorageKey = "deliverhub-customer-profile";
const wishlistStorageKey = "deliverhub-customer-wishlist";
const storeOrdersStorageKey = "deliverhub-store-orders";
const storeNotificationsStorageKey = "deliverhub-store-notifications";
const storeUsersStorageKey = "deliverhub-store-users";
const storeSessionStorageKey = "deliverhub-store-session";
const storeLocation = { latitude: 47.9186, longitude: 106.9176 };

const storeBrands = [
  {
    match: ["номин", "nomin"],
    logoUrl: "https://www.mongoliansaddle.com/partners/Nomin%20supermarket.JPG",
    initials: "Н",
  },
  {
    match: ["cu"],
    logoUrl: "https://gs-private.sgp1.cdn.digitaloceanspaces.com/web-builder/web-builder_6684f03324960/CU%20logo.png",
    initials: "CU",
  },
  {
    match: ["gs25", "gs 25"],
    logoUrl: "https://gs25.mn/favicon.webp",
    initials: "GS",
  },
  {
    match: ["emart", "e-mart", "еmart"],
    logoUrl: "https://media.licdn.com/dms/image/v2/C4D12AQFOB2KcJkJ3pQ/article-cover_image-shrink_720_1280/article-cover_image-shrink_720_1280/0/1520175340379?e=2147483647&t=iLbGsrLHLE2MD_kZSzXDYG0eXgNFXk0ULh14MFJl9tI&v=beta",
    initials: "e",
  },
];

function storeBrandFor(name: string) {
  const normalizedName = name.toLowerCase();
  return storeBrands.find((brand) => brand.match.some((keyword) => normalizedName.includes(keyword)))
    ?? { logoUrl: "", initials: name.trim().slice(0, 2).toUpperCase() || "DH" };
}

const initialProducts: Product[] = [
  {
    id: "rice-5kg",
    sku: "FD-1002",
    name: "Цагаан будаа 5кг",
    category: "Хүнс",
    priceMnt: 28000,
    weightGrams: 5000,
    stockCount: 45,
    description: "Өдөр тутмын хэрэглээгээ хурдан, найдвартай хүргүүлээрэй.",
  },
  {
    id: "meat-1kg",
    sku: "MT-5541",
    name: "Монгол мах 1кг",
    category: "Мах",
    priceMnt: 18500,
    weightGrams: 1000,
    stockCount: 12,
    description: "Шинэхэн бүтээгдэхүүнээ гэрийн үүдэндээ тав тухтай аваарай.",
  },
  {
    id: "bread",
    sku: "BR-9982",
    name: "Алтан Талх",
    category: "Талх",
    priceMnt: 3200,
    weightGrams: 420,
    stockCount: 30,
    description: "Хэрэгтэй зүйлээ хүлээлгүй захиалж, цаг хэмнээрэй.",
  },
  {
    id: "milk-1l",
    sku: "ML-2011",
    name: "Сүү 1л",
    category: "Сүү",
    priceMnt: 4500,
    weightGrams: 1050,
    stockCount: 0,
    description: "Өглөөний хэрэглээгээ нэг товшоод шууд захиалаарай.",
  },
];

const deliveryOptions: Array<{ id: DeliveryType; label: string; copy: string; base: number; perKm: number; perKg: number; speedKmh: number }> = [
  { id: "bike", label: "Мопед/дугуй", copy: "Хамгийн хурдан сонголт", base: 2500, perKm: 900, perKg: 140, speedKmh: 18 },
  { id: "car", label: "Машин", copy: "Том захиалгад найдвартай", base: 4200, perKm: 1200, perKg: 110, speedKmh: 28 },
  { id: "foot", label: "Явган", copy: "Ойрын хүргэлтэд хэмнэлттэй", base: 1800, perKm: 700, perKg: 180, speedKmh: 4 },
];

const copies = [
  {
    kicker: "ХУРДАН",
    title: "Маркет гэрт тань.",
    body: "",
  },
  {
    kicker: "АМАР",
    title: "Сонгоод захиал.",
    body: "",
  },
  {
    kicker: "ИЛ ТОД",
    title: "Явцаа шууд хар.",
    body: "",
  },
  {
    kicker: "ӨСӨЛТ",
    title: "Бизнесээ өсгө.",
    body: "",
  },
];

function formatMnt(value: number | string) {
  return `₮${Number(value || 0).toLocaleString("mn-MN")}`;
}

function fixMojibake(value: string) {
  if (!/[ÃÐÑÒÓ]/.test(value)) return value;

  try {
    const bytes = Array.from(value, (char) => {
      const code = char.charCodeAt(0);
      return code <= 255 ? `%${code.toString(16).padStart(2, "0")}` : char;
    }).join("");

    return decodeURIComponent(bytes);
  } catch {
    return value;
  }
}

function cleanStoreItem(store: StoreDirectoryItem): StoreDirectoryItem {
  return {
    ...store,
    name: fixMojibake(store.name),
    description: fixMojibake(store.description),
    address: fixMojibake(store.address),
    categories: store.categories.map(fixMojibake),
    products: store.products.map((product) => ({
      ...product,
      name: fixMojibake(product.name),
      category: fixMojibake(product.category),
    })),
  };
}

function isStrongPassword(password: string) {
  return password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function distanceKm(from: GeoLocation, to: GeoLocation) {
  const earthRadiusKm = 6371;
  const dLat = (to.latitude - from.latitude) * Math.PI / 180;
  const dLon = (to.longitude - from.longitude) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(from.latitude * Math.PI / 180) * Math.cos(to.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;

  return Math.max(0.8, Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10);
}

async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Сервертэй холбогдсонгүй. Local API асаалттай эсэхийг шалгана уу.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message ?? "Сервертэй холбогдоход алдаа гарлаа.");
  return payload as T;
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error("Сервертэй холбогдсонгүй. Local API асаалттай эсэхийг шалгана уу.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message ?? "Мэдээлэл татахад алдаа гарлаа.");
  return payload as T;
}

export function PublicLanding({ page = "home", onNavigateHome, onNavigateMarket, onNavigateContact, onNavigateCourier, onNavigatePartner }: PublicLandingProps = {}) {
  const [section, setSection] = useState<LandingSection>(page);
  const [menuHidden, setMenuHidden] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [authForm, setAuthForm] = useState({ fullName: "", email: "", phone: "", login: "", password: "" });
  const [partnerAuthOpen, setPartnerAuthOpen] = useState(false);
  const [partnerAuthMode, setPartnerAuthMode] = useState<PartnerAuthMode>("register");
  const [partnerForm, setPartnerForm] = useState({
    storeName: "",
    ownerName: "",
    username: "",
    password: "",
    confirmPassword: "",
    logoUrl: "",
    address: "",
    phone: "",
    storeType: "",
    searchableFeature: "",
  });
  const [session, setSession] = useState<CustomerSession | null>(() => {
    const token = localStorage.getItem(tokenStorageKey);
    const customer = localStorage.getItem(customerStorageKey);
    return token && customer ? { token, customer: JSON.parse(customer) } : null;
  });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(wishlistStorageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qpay");
  const [stores, setStores] = useState<StoreDirectoryItem[]>([]);
  const [storeSearch, setStoreSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("Бүгд");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("bike");
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [addressText, setAddressText] = useState("");
  const [addressLabel, setAddressLabel] = useState("Одоогийн байршил");
  const [notice, setNotice] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [storesLoading, setStoresLoading] = useState(false);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);

  useEffect(() => {
    setSection(page);
    setMenuHidden(false);
  }, [page]);

  useEffect(() => {
    localStorage.setItem(wishlistStorageKey, JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    if (section === "market" && !session) {
      setAuthMode("login");
      setAuthOpen(true);
    }
  }, [section, session]);

  useEffect(() => {
    if (section !== "home") return;

    if (!document.querySelector('script[data-deliverhub-spline-viewer="true"]')) {
      const viewerScript = document.createElement("script");
      viewerScript.type = "module";
      viewerScript.src = "https://unpkg.com/@splinetool/viewer/build/spline-viewer.js";
      viewerScript.dataset.deliverhubSplineViewer = "true";
      document.body.appendChild(viewerScript);
    }

    const timer = window.setTimeout(() => {
      const wrap = document.getElementById("canvas-wrap");
      if (!wrap || wrap.querySelector("canvas")) return;

      (window as typeof window & { __deliverhubNomadSceneStarted?: boolean }).__deliverhubNomadSceneStarted = false;
      const script = document.createElement("script");
      script.type = "module";
      script.src = `/nomad-scroll-scene.js?v=${Date.now()}`;
      document.body.appendChild(script);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [section]);

  useEffect(() => {
    if (section === "market") {
      setMenuHidden(false);
      return;
    }

    let lastScrollY = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      const hideThreshold = window.innerHeight * 0.25;
      const scrolledDown = currentScrollY > lastScrollY;
      const scrolledUpEnough = currentScrollY < lastScrollY - 6;

      if (scrolledDown && currentScrollY > hideThreshold && !authOpen) {
        setMenuHidden(true);
      } else if (scrolledUpEnough || currentScrollY <= hideThreshold) {
        setMenuHidden(false);
      }

      lastScrollY = currentScrollY;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [authOpen, section]);

  useEffect(() => {
    if (!session?.token) return;
    const token = session.token;
    let closed = false;
    let socket: WebSocket | null = null;

    async function refreshTracking() {
      try {
        const data = await apiGet<TrackingResponse | null>("/customer/orders/current/tracking", token);
        if (!closed) setTracking(data);
      } catch {
        if (!closed) setTracking(null);
      }
    }

    void refreshTracking();
    if (customerRealtimeUrl) {
      socket = new WebSocket(customerRealtimeUrl);
      socket.addEventListener("message", (message) => {
        const payload = JSON.parse(String(message.data)) as { event?: string };
        if (payload.event === "customer.tracking.refresh") void refreshTracking();
      });
    }
    const intervalId = window.setInterval(refreshTracking, 5000);
    return () => {
      closed = true;
      socket?.close();
      window.clearInterval(intervalId);
    };
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token || section !== "market") return;
    const token = session.token;
    let closed = false;

    async function loadStores() {
      setStoresLoading(true);
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "24",
          ...(storeSearch.trim() ? { search: storeSearch.trim() } : {}),
        });
        const result = await apiGet<StoreDirectoryResponse>(`/customer/stores?${params.toString()}`, token);
        if (!closed) {
          setStores(result.items.map(cleanStoreItem));
          setSelectedStoreId((current) => current || result.items[0]?.id || "");
        }
      } catch (error) {
        if (!closed) setNotice(error instanceof Error ? error.message : "Маркетийн жагсаалт татахад алдаа гарлаа.");
      } finally {
        if (!closed) setStoresLoading(false);
      }
    }

    const timer = window.setTimeout(loadStores, 250);
    return () => {
      closed = true;
      window.clearTimeout(timer);
    };
  }, [section, session?.token, storeSearch]);

  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0];
  const filteredStores = useMemo(() => {
    const normalizedSearch = storeSearch.trim().toLowerCase();
    return stores.filter((store) => (
      (storeFilter === "Бүгд" || store.categories.includes(storeFilter))
      && (
        !normalizedSearch
        || store.name.toLowerCase().includes(normalizedSearch)
        || store.address.toLowerCase().includes(normalizedSearch)
        || store.description.toLowerCase().includes(normalizedSearch)
        || store.categories.some((category) => category.toLowerCase().includes(normalizedSearch))
      )
    ));
  }, [storeFilter, storeSearch, stores]);
  const showStoreResults = Boolean(storeSearch.trim()) || storeFilter !== "Бүгд";
  const allMarketProducts = useMemo(() => (
    selectedStore?.products.length
      ? selectedStore.products.map((product) => ({
          id: product.id,
          sku: product.id.slice(-8),
          name: product.name,
          category: product.category,
          priceMnt: Number(product.priceMnt),
          weightGrams: product.weightGrams,
          stockCount: 100,
          description: `${selectedStore.name} маркетийн ${product.category.toLowerCase()} ангиллын бараа.`,
          imageUrl: product.imageUrl ?? "",
        }))
      : initialProducts
  ), [selectedStore]);
  const marketProducts = useMemo(() => {
    const searched = allMarketProducts.filter((product) => (
      !productSearch.trim()
      || product.name.toLowerCase().includes(productSearch.trim().toLowerCase())
      || product.category.toLowerCase().includes(productSearch.trim().toLowerCase())
    ));

    return searched;
  }, [allMarketProducts, productSearch]);

  const selectedItems = useMemo(
    () => allMarketProducts
      .map((product) => ({ ...product, quantity: cart[product.id] ?? 0 }))
      .filter((product) => product.quantity > 0),
    [allMarketProducts, cart],
  );
  const wishlistItems = useMemo(
    () => allMarketProducts.filter((product) => wishlist.includes(product.id)),
    [allMarketProducts, wishlist],
  );
  const subtotal = selectedItems.reduce((sum, product) => sum + product.priceMnt * product.quantity, 0);
  const weightKg = Math.round(selectedItems.reduce((sum, product) => sum + product.weightGrams * product.quantity, 0) / 100) / 10;
  const activeDelivery = deliveryOptions.find((option) => option.id === deliveryType) ?? deliveryOptions[0];
  const customerLocation = location ?? { latitude: 47.9212, longitude: 106.9186 };
  const km = distanceKm(storeLocation, customerLocation);
  const deliveryFee = Math.round(activeDelivery.base + km * activeDelivery.perKm + weightKg * activeDelivery.perKg);
  const etaMinutes = Math.max(12, Math.round((km / activeDelivery.speedKmh) * 60 + 10));
  const storeCategories = useMemo(
    () => ["Бүгд", ...new Set(stores.flatMap((store) => store.categories).filter(Boolean))],
    [stores],
  );
  const addressSuggestions = [
    addressLabel,
    addressText,
    location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : "",
  ].filter(Boolean);

  function openMarket() {
    if (!session) {
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }

    setSection("market");
    setCartOpen(false);
    setWishlistOpen(false);
    onNavigateMarket?.();
  }

  function openContact() {
    setSection("contact");
    setMenuHidden(false);
    setCartOpen(false);
    setWishlistOpen(false);
    onNavigateContact?.();
  }

  function openPartner() {
    setSection("partner");
    setMenuHidden(false);
    setCartOpen(false);
    setWishlistOpen(false);
    onNavigatePartner?.();
  }

  function openCourier() {
    setSection("courier");
    setMenuHidden(false);
    setCartOpen(false);
    setWishlistOpen(false);
    onNavigateCourier?.();
  }

  function updateCart(productId: string, delta: number) {
    setCart((current) => {
      const product = allMarketProducts.find((item) => item.id === productId);
      const maxQuantity = product?.stockCount ?? 0;
      const nextQuantity = Math.min(maxQuantity, Math.max(0, (current[productId] ?? 0) + delta));
      return { ...current, [productId]: nextQuantity };
    });
  }

  function toggleWishlist(productId: string) {
    setWishlist((current) => (
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    ));
  }

  function addWishlistToCart(productId: string) {
    updateCart(productId, 1);
    setCartOpen(true);
    setWishlistOpen(false);
  }

  function appendJsonStorage<T>(key: string, item: T) {
    try {
      const raw = localStorage.getItem(key);
      const current = raw ? (JSON.parse(raw) as T[]) : [];
      localStorage.setItem(key, JSON.stringify([item, ...current]));
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: localStorage.getItem(key) }));
    } catch {
      localStorage.setItem(key, JSON.stringify([item]));
    }
  }

  function checkoutOrder() {
    if (!session) {
      setAuthMode("login");
      setAuthOpen(true);
      setCartOpen(false);
      return;
    }

    if (!selectedItems.length) {
      setNotice("Сагс хоосон байна. Бараагаа сонгоод захиална уу.");
      return;
    }

    if (!addressText.trim() && !location) {
      setNotice("Хүргэлтийн хаяг эсвэл GPS байршлаа оруулна уу.");
      openMarket();
      return;
    }

    const total = subtotal + deliveryFee;
    const orderNo = `DH-${Date.now().toString().slice(-8)}`;
    const paymentLabel = paymentMethod === "stripe" ? "Stripe" : "QPay";
    const district = addressSuggestions.join(" · ") || "Хаяг баталгаажиж байна";
    const storeName = selectedStore?.name ?? "DeliverHub market";
    const storeRecipient = readStoreUsers().find((user) => user.storeName.toLowerCase() === storeName.toLowerCase());
    const storeId = storeRecipient?.id ?? selectedStore?.id ?? "deliverhub-market";
    appendJsonStorage(storeOrdersStorageKey, {
      id: orderNo,
      status: paymentMethod === "stripe" ? "Stripe гүйлгээ амжилттай - дэлгүүр баталгаажуулна" : "QPay төлбөр амжилттай - дэлгүүр баталгаажуулна",
      amountMnt: String(total),
      district,
      storeId,
      storeName,
      paymentMethod: paymentLabel,
      customerName: session.customer.fullName,
      customerPhone: session.customer.phone,
      address: addressText.trim() || district,
      items: selectedItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        amountMnt: item.priceMnt * item.quantity,
      })),
      createdAt: new Date().toISOString(),
    });
    appendJsonStorage(storeNotificationsStorageKey, {
      id: `notif-${orderNo}`,
      title: paymentMethod === "stripe" ? "Stripe гүйлгээ амжилттай" : "Шинэ төлбөртэй захиалга",
      body: `${storeName}: ${paymentLabel}-ээр ${formatMnt(total)} төлөгдсөн шинэ захиалга ирлээ. Хаяг: ${district}`,
      storeId,
      storeName,
      readAt: null,
      createdAt: new Date().toISOString(),
    });
    setTracking({
      orderNo,
      storeName,
      district,
      statusLabel: "Төлбөр амжилттай",
      totalMnt: String(total),
      timeline: [
        {
          state: "done",
          title: `${paymentLabel} төлбөр амжилттай`,
          description: `${formatMnt(total)} төлөгдөж дэлгүүрт notification очлоо.`,
          time: "Одоо",
        },
        {
          state: "active",
          title: "Дэлгүүр баталгаажуулна",
          description: "Барааны үлдэгдэл, бэлтгэлийн хугацааг шалгаж байна.",
          time: `${etaMinutes} мин`,
        },
        {
          state: "pending",
          title: "Courier авах",
          description: "Хүргэлтийн ажилтан assignment авахад realtime location гарна.",
          time: "Дараагийн шат",
        },
      ],
      courier: {
        name: "Courier assignment хүлээгдэж байна",
        vehicle: activeDelivery.label,
        etaText: `${etaMinutes} минутын тооцоололтой`,
      },
    });
    setPaymentSuccess(paymentMethod === "stripe"
      ? "Stripe гүйлгээ амжилттай. Захиалга тухайн дэлгүүрийн notification руу очлоо."
      : "QPay төлбөр амжилттай. Захиалга тухайн дэлгүүрийн notification руу очлоо.");
    window.setTimeout(() => setPaymentSuccess(""), 3600);
    setNotice("Захиалга дэлгүүрийн notification руу илгээгдлээ.");
    setCart({});
    setCartOpen(false);
    setSection("market");
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setNotice("Таны browser location дэмжихгүй байна. Хаягаа текстээр оруулна уу.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(nextLocation);
        setAddressText((current) => current || `Lat ${nextLocation.latitude.toFixed(6)}, Lng ${nextLocation.longitude.toFixed(6)} - орц, давхар, хаалгаа нэмнэ үү`);
        setNotice("Байршил авлаа. Одоо KFC шиг давхар хаягаа текстээр баталгаажуул.");
        setLoading(false);
      },
      () => {
        setNotice("Location зөвшөөрөгдсөнгүй. Хаягаа текстээр оруулаад үргэлжлүүлж болно.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");

    try {
      const password = authForm.password.trim();

      if (authMode === "register") {
        if (!authForm.fullName.trim() || !authForm.phone.trim() || !password) {
          throw new Error("Нэр, утас, нууц үгээ бүрэн оруулна уу.");
        }

        if (authForm.email.trim() && !/^[^\s@]+@gmail\.com$/i.test(authForm.email.trim())) {
          throw new Error("Gmail хаягаа зөв оруулна уу. Жишээ: name@gmail.com");
        }

        if (!/^\+?\d{8,15}$/.test(authForm.phone.replace(/[^\d+]/g, ""))) {
          throw new Error("Утасны дугаараа 8-15 оронтой зөв оруулна уу.");
        }

        if (!isStrongPassword(password)) {
          throw new Error("Нууц үг 8+ тэмдэгттэй, том үсэг, жижиг үсэг, тоо, тусгай тэмдэгттэй байх ёстой.");
        }
      } else if (!authForm.login.trim() || !password) {
        throw new Error("Gmail/утас болон нууц үгээ оруулна уу.");
      }

      const payload = authMode === "login"
        ? await apiPost<CustomerSession>("/customer/auth/login", { login: authForm.login, password })
        : await apiPost<CustomerSession>("/customer/auth/register", {
          fullName: authForm.fullName,
          email: authForm.email,
          phone: authForm.phone,
          password,
        });

      localStorage.setItem(tokenStorageKey, payload.token);
      localStorage.setItem(customerStorageKey, JSON.stringify(payload.customer));
      setSession(payload);
      setAuthOpen(false);
      setProfileOpen(false);
      setNotice("Амжилттай нэвтэрлээ.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Нэвтрэх үед алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }

  function readStoreUsers() {
    try {
      const raw = localStorage.getItem(storeUsersStorageKey);
      return raw ? (JSON.parse(raw) as Array<{ id: string; storeName: string; ownerName: string; username: string; password: string }>) : [];
    } catch {
      return [];
    }
  }

  function submitPartnerAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");

    try {
      const username = partnerForm.username.trim();
      const password = partnerForm.password.trim();
      const users = readStoreUsers();
      const existingUser = users.find((user) => user.username.toLowerCase() === username.toLowerCase());

      if (!username || !password) throw new Error("Нэвтрэх ID/Gmail болон нууц үгээ оруулна уу.");

      if (partnerAuthMode === "login") {
        if (!existingUser) throw new Error("Дэлгүүрийн бүртгэл олдсонгүй.");
        if (existingUser.password !== password) throw new Error("Нууц үг буруу байна.");
        localStorage.setItem(storeSessionStorageKey, existingUser.id);
        window.location.href = storePortalUrl;
        return;
      }

      if (!partnerForm.storeName.trim() || !partnerForm.ownerName.trim() || !partnerForm.address.trim() || !partnerForm.phone.trim() || !partnerForm.storeType.trim() || !partnerForm.searchableFeature.trim()) {
        throw new Error("Дэлгүүрийн нэр, хаяг, утас, төрөл, хайлтын онцлогоо бүрэн бөглөнө үү.");
      }

      if (!/^\+?\d{8,15}$/.test(partnerForm.phone.replace(/[^\d+]/g, ""))) {
        throw new Error("Утасны дугаараа 8-15 оронтой зөв оруулна уу.");
      }

      if (!isStrongPassword(password)) {
        throw new Error("Нууц үг 8+ тэмдэгттэй, том/жижиг үсэг, тоо, тусгай тэмдэгттэй байх ёстой.");
      }

      if (password !== partnerForm.confirmPassword.trim()) {
        throw new Error("Нууц үг таарахгүй байна.");
      }

      if (existingUser) throw new Error("Энэ нэвтрэх ID/Gmail бүртгэлтэй байна.");

      const nextUser = {
        id: crypto.randomUUID(),
        storeName: partnerForm.storeName.trim(),
        ownerName: partnerForm.ownerName.trim(),
        username,
        password,
        logoUrl: partnerForm.logoUrl.trim(),
        address: partnerForm.address.trim(),
        phone: partnerForm.phone.trim(),
        storeType: partnerForm.storeType.trim(),
        searchableFeature: partnerForm.searchableFeature.trim(),
      };

      localStorage.setItem(storeUsersStorageKey, JSON.stringify([...users, nextUser]));
      localStorage.setItem(storeSessionStorageKey, nextUser.id);
      window.location.href = storePortalUrl;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Байгууллагын бүртгэлд алдаа гарлаа.");
    }
  }

  function logout() {
    localStorage.removeItem(tokenStorageKey);
    localStorage.removeItem(customerStorageKey);
    setSession(null);
    setTracking(null);
    setProfileOpen(false);
    setCartOpen(false);
    setWishlistOpen(false);
    setSection("home");
    onNavigateHome?.();
    setNotice("Гарлаа.");
  }

  function closeMarket() {
    setSection("home");
    setCartOpen(false);
    setWishlistOpen(false);
    onNavigateHome?.();
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  return (
    <main className={`nomad-scroll-page ${section === "market" ? "is-market-route" : ""} ${section === "contact" ? "is-contact-route" : ""} ${section === "courier" ? "is-courier-route" : ""}`} id="hero">
      {paymentSuccess ? <div className="landing-payment-success" role="status">{paymentSuccess}</div> : null}
      <nav className={`landing-commerce-nav ${menuHidden ? "is-hidden" : ""}`} aria-label="Landing navigation">
        <a className="landing-commerce-brand" href="/" onClick={(event) => { event.preventDefault(); closeMarket(); }}>
          <BrandLogo showText size={32} />
        </a>
        <a className={section === "home" ? "active" : ""} href="/" onClick={(event) => { event.preventDefault(); closeMarket(); }}>Нүүр</a>
        <button className={section === "market" ? "active" : ""} onClick={openMarket} type="button">Маркет</button>
        <button className={section === "courier" ? "active" : ""} onClick={openCourier} type="button">Хүргэлтийн ажилтан</button>
        <button className={section === "partner" ? "active" : ""} onClick={openPartner} type="button">Байгууллага бүртгэх</button>
        <button className={section === "contact" ? "active" : ""} onClick={openContact} type="button">Холбоо барих</button>
        <div className="landing-nav-actions" aria-label="Хэрэглэгчийн үйлдлүүд">
          <button
            className={cartOpen ? "active" : ""}
            onClick={() => {
              setProfileOpen(false);
              setWishlistOpen(false);
              setCartOpen((open) => !open);
            }}
            type="button"
            aria-expanded={cartOpen}
            aria-label="Сагс"
          >
            <span aria-hidden="true">▣</span>
            {session && selectedItems.length > 0 ? <b>{selectedItems.length}</b> : null}
          </button>
          <button
            className={wishlistOpen ? "active" : ""}
            onClick={() => {
              setProfileOpen(false);
              setCartOpen(false);
              setWishlistOpen((open) => !open);
            }}
            type="button"
            aria-expanded={wishlistOpen}
            aria-label="Wishlist"
          >
            <span aria-hidden="true">♡</span>
            {wishlistItems.length > 0 ? <b>{wishlistItems.length}</b> : null}
          </button>
          <button type="button" aria-label="Миний захиалсан">
            <span aria-hidden="true">≡</span>
            {session && tracking ? <b className="is-notification">1</b> : null}
          </button>
        </div>
        {session ? (
          <div className="landing-profile-menu">
            <button className="landing-profile-button" onClick={() => setProfileOpen((open) => !open)} type="button" aria-label="Профайл">
              <span aria-hidden="true" />
            </button>
            {profileOpen ? (
              <section>
                <strong>{session.customer.fullName}</strong>
                <span>{session.customer.email || session.customer.phone}</span>
                <button onClick={logout} type="button">Гарах</button>
              </section>
            ) : null}
          </div>
        ) : (
          <button className="landing-login-button" onClick={() => setAuthOpen(true)} type="button">Эхлэх</button>
        )}

        {cartOpen ? (
          <section className="landing-cart-popover" aria-label="Сагс">
            <header>
              <div>
                <span>Миний сагс</span>
                <strong>{selectedItems.length ? `${selectedItems.length} бараа` : "Хоосон байна"}</strong>
              </div>
              <button onClick={() => setCartOpen(false)} type="button" aria-label="Сагс хаах">×</button>
            </header>

            {!session ? (
              <div className="landing-cart-empty">
                <strong>Захиалгаа үргэлжлүүлэх үү?</strong>
                <p>DeliverHub-д нэвтэрснээр сагсаа хадгалж, хүргэлтийн явцаа шууд хянах боломжтой.</p>
                <button onClick={() => { setAuthMode("login"); setAuthOpen(true); setCartOpen(false); }} type="button">Үргэлжлүүлэх</button>
              </div>
            ) : selectedItems.length ? (
              <>
                <div className="landing-cart-items">
                  {selectedItems.map((item) => (
                    <article key={item.id}>
                      {"imageUrl" in item && item.imageUrl ? <img alt={item.name} src={item.imageUrl} /> : <span aria-hidden="true">{item.name.slice(0, 1)}</span>}
                      <div>
                        <strong>{item.name}</strong>
                        <small>{formatMnt(item.priceMnt)} · {item.quantity} ш</small>
                      </div>
                      <div className="landing-cart-stepper">
                        <button onClick={() => updateCart(item.id, -1)} type="button" aria-label="Хасах">−</button>
                        <b>{item.quantity}</b>
                        <button onClick={() => updateCart(item.id, 1)} type="button" aria-label="Нэмэх">+</button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="landing-cart-totals">
                  <span><em>Барааны дүн</em><strong>{formatMnt(subtotal)}</strong></span>
                  <span><em>Хүргэлт</em><strong>{formatMnt(deliveryFee)}</strong></span>
                  <span><em>Нийт</em><strong>{formatMnt(subtotal + deliveryFee)}</strong></span>
                </div>

                <div className="landing-payment-methods" aria-label="Төлбөрийн арга">
                  <button className={paymentMethod === "qpay" ? "active" : ""} onClick={() => setPaymentMethod("qpay")} type="button">
                    <span>QR</span>
                    <strong>QPay</strong>
                  </button>
                  <button className={paymentMethod === "stripe" ? "active" : ""} onClick={() => setPaymentMethod("stripe")} type="button">
                    <span>Card</span>
                    <strong>Stripe</strong>
                  </button>
                </div>

                <footer>
                  <button onClick={() => setCart({})} type="button">Цэвэрлэх</button>
                  <button onClick={checkoutOrder} type="button">{paymentMethod === "stripe" ? "Картаар баталгаажуулах" : "QPay-ээр захиалах"}</button>
                </footer>
              </>
            ) : (
              <div className="landing-cart-empty">
                <strong>Өнөөдрийн хэрэгцээгээ эндээс эхлүүл</strong>
                <p>Ойрын маркетуудаас бараагаа сонгоод хурдан хүргэлтээр гэртээ аваарай.</p>
                <button onClick={openMarket} type="button">Захиалж эхлэх</button>
              </div>
            )}
          </section>
        ) : null}

        {wishlistOpen ? (
          <section className="landing-cart-popover landing-wishlist-popover" aria-label="Wishlist">
            <header>
              <div>
                <span>Сонгосон бараа</span>
                <strong>{wishlistItems.length ? `${wishlistItems.length} бараа` : "Хоосон байна"}</strong>
              </div>
              <button onClick={() => setWishlistOpen(false)} type="button" aria-label="Wishlist хаах">×</button>
            </header>
            {wishlistItems.length ? (
              <div className="landing-cart-items">
                {wishlistItems.map((item) => (
                  <article key={item.id}>
                    {item.imageUrl ? <img alt={item.name} src={item.imageUrl} /> : <span aria-hidden="true">{item.name.slice(0, 1)}</span>}
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.category} · {formatMnt(item.priceMnt)}</small>
                    </div>
                    <div className="landing-wishlist-actions">
                      <button onClick={() => addWishlistToCart(item.id)} type="button">+</button>
                      <button onClick={() => toggleWishlist(item.id)} type="button">×</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="landing-cart-empty">
                <strong>Таалагдсан бараагаа хадгалаарай</strong>
                <p>Дараа захиалах бүтээгдэхүүнээ тэмдэглээд, нэг товшоод сагсандаа нэмнэ.</p>
                <button onClick={openMarket} type="button">Сонголт хийх</button>
              </div>
            )}
          </section>
        ) : null}
      </nav>

      {section === "market" ? (
      <div className="landing-shop-panel market-page is-open">
        <header className="market-top-header">
          <div>
            <h2>Маркет таны гарт</h2>
          </div>
          <label>
            <span>⌕</span>
            <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Хэрэгтэй бараагаа хайх..." />
          </label>
        </header>

        <section className="market-layout">
          <aside className="market-sidebar">
            <section className="landing-store-browser">
              <header>
                <input
                  onChange={(event) => setStoreSearch(event.target.value)}
                  placeholder="Таарах маркет, хаяг, төрлөө хайх..."
                  value={storeSearch}
                />
              </header>
              <div className="landing-store-filters">
                {storeCategories.map((category) => (
                  <button className={storeFilter === category ? "active" : ""} key={category} onClick={() => setStoreFilter(category)} type="button">
                    {category}
                  </button>
                ))}
              </div>
              {showStoreResults ? <div className="landing-store-cards" aria-label="Дэлгүүрүүд">
                {storesLoading ? (
                  <p>Дэлгүүрүүд ачаалж байна...</p>
                ) : filteredStores.length ? filteredStores.map((store) => {
                  const brand = storeBrandFor(store.name);
                  return (
                    <button
                      className={selectedStore?.id === store.id ? "active" : ""}
                      key={store.id}
                      onClick={() => {
                        setSelectedStoreId(store.id);
                        setStoreSearch("");
                      }}
                      type="button"
                    >
                      <span className="landing-store-logo">
                        {brand.logoUrl ? <img alt={`${store.name} logo`} src={brand.logoUrl} /> : <b>{brand.initials}</b>}
                      </span>
                      <span className="landing-store-card-copy">
                        <strong>{store.name}</strong>
                        <small>{store.description || store.address}</small>
                        <em>{store.productCount} бараа · {store.orderCount} захиалга</em>
                      </span>
                    </button>
                  );
                }) : (
                  <p>Одоогоор дэлгүүр олдсонгүй.</p>
                )}
              </div> : null}
            </section>
          </aside>

          <section className="market-products">
            <section className="market-address-panel">
              <button onClick={useCurrentLocation} type="button" disabled={loading}>GPS авах</button>
              <label>
                <span>Хаягийн нэр</span>
                <input value={addressLabel} onChange={(event) => setAddressLabel(event.target.value)} placeholder="Гэр, ажил, хотхон..." />
              </label>
              <label>
                <span>Дэлгэрэнгүй хаяг</span>
                <input value={addressText} onChange={(event) => setAddressText(event.target.value)} placeholder="Байр, орц, давхар, тоот..." />
              </label>
              <div className="market-delivery-picker" aria-label="Хүргэлтийн төрөл">
                {deliveryOptions.map((option) => (
                  <button className={deliveryType === option.id ? "active" : ""} key={option.id} onClick={() => setDeliveryType(option.id)} type="button">
                    <strong>{option.label}</strong>
                    <span>{option.copy}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="market-stats-row">
              <article><span>Сонгосон маркет</span><strong>{selectedStore?.name ?? "Сонгоно уу"}</strong><em>Захиалга авч байна</em></article>
              <article><span>Боломжит бараа</span><strong>{marketProducts.length}</strong><em>Шүүлт идэвхтэй</em></article>
              <article><span>Таны сагс</span><strong>{selectedItems.length}</strong><em>{formatMnt(subtotal)}</em></article>
              <article><span>Тооцсон хүргэлт</span><strong>{selectedItems.length ? `${etaMinutes} мин` : "-"}</strong><em>{selectedItems.length ? formatMnt(deliveryFee) : "0 MNT"}</em></article>
            </section>

            <section className="landing-product-grid">
              {marketProducts.map((product) => (
                <article key={product.id}>
                  <button
                    className={`landing-product-wish ${wishlist.includes(product.id) ? "active" : ""}`}
                    onClick={() => toggleWishlist(product.id)}
                    type="button"
                    aria-label={`${product.name} wishlist`}
                  >
                    {wishlist.includes(product.id) ? "♥" : "♡"}
                  </button>
                  {"imageUrl" in product && product.imageUrl ? (
                    <img alt={product.name} src={product.imageUrl} />
                  ) : (
                    <div className="landing-product-image-fallback" aria-hidden="true">
                      <span>{product.name.slice(0, 1)}</span>
                    </div>
                  )}
                  <span>{product.category}</span>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <strong>{formatMnt(product.priceMnt)}</strong>
                  <em className={product.stockCount <= 0 ? "is-empty" : product.stockCount <= 12 ? "is-low" : ""}>
                    Үлдэгдэл: {product.stockCount} ш
                  </em>
                  <div className="landing-product-actions">
                    <button className="landing-product-qty" onClick={() => updateCart(product.id, -1)} type="button">−</button>
                    <b>{cart[product.id] ?? 0}</b>
                    <button className="landing-product-add" onClick={() => updateCart(product.id, 1)} type="button" disabled={product.stockCount <= 0}>
                      {cart[product.id] ? "Нэмэх" : "Сагслах"}
                    </button>
                  </div>
                </article>
              ))}
            </section>

            <section className="market-cart">
        {tracking ? (
          <section className="landing-tracking-card">
            <div>
              <span>Миний захиалга</span>
              <strong>#{tracking.orderNo.slice(-6)}</strong>
            </div>
            <ol>
              {tracking.timeline.map((step) => (
                <li className={step.state} key={step.title}>
                  <i />
                  <div>
                    <strong>{step.title}</strong>
                    <span>{step.description}</span>
                  </div>
                </li>
              ))}
            </ol>
            <div className="landing-courier-live">
              <strong>{tracking.courier.name}</strong>
              <span>{tracking.courier.etaText || "Courier замд гарахад байршил шууд харагдана"}</span>
              <b>
                {tracking.courierLocation
                  ? `${tracking.courierLocation.latitude.toFixed(5)}, ${tracking.courierLocation.longitude.toFixed(5)}`
                  : "Байршил идэвхжихийг хүлээж байна"}
              </b>
            </div>
          </section>
        ) : null}

        {notice ? <p className="landing-commerce-notice">{notice}</p> : null}
            </section>
          </section>
        </section>
      </div>
      ) : null}

      {section === "partner" ? (
        <section className="landing-partner-page" aria-label="Байгууллага бүртгэх">
          <div className="landing-partner-copy">
            <div>
              <span>БИЗНЕСИЙН ТҮНШЛЭЛ</span>
              <h2>Дэлгүүрээ онлайн болго</h2>
              <p>Захиалга, хүргэлт, орлого нэг дор.</p>
            </div>
            <div className="landing-partner-metrics">
              <article><strong>01</strong><small>Хайлтад илүү хурдан гарна.</small></article>
              <article><strong>02</strong><small>Захиалга автоматаар цэгцэрнэ.</small></article>
              <article><strong>03</strong><small>Бүгд нэг dashboard-д.</small></article>
            </div>
          </div>

          <aside className="landing-partner-auth">
            <header>
              <div>
                <span>Түншийн эрх</span>
                <strong>{partnerAuthMode === "login" ? "Борлуулалтаа үргэлжлүүлэх" : "Дэлгүүрээ эхлүүлэх"}</strong>
              </div>
              <div>
                <button className={partnerAuthMode === "login" ? "active" : ""} onClick={() => setPartnerAuthMode("login")} type="button">Нэвтрэх</button>
                <button className={partnerAuthMode === "register" ? "active" : ""} onClick={() => setPartnerAuthMode("register")} type="button">Бүртгүүлэх</button>
              </div>
            </header>
            <form className="landing-partner-form" onSubmit={submitPartnerAuth}>
              {partnerAuthMode === "register" ? (
                <div className="landing-partner-form-grid">
                  <input value={partnerForm.storeName} onChange={(event) => setPartnerForm({ ...partnerForm, storeName: event.target.value })} placeholder="Дэлгүүрийн нэр" />
                  <input value={partnerForm.logoUrl} onChange={(event) => setPartnerForm({ ...partnerForm, logoUrl: event.target.value })} placeholder="Logo URL" />
                  <input value={partnerForm.address} onChange={(event) => setPartnerForm({ ...partnerForm, address: event.target.value })} placeholder="Хаяг" />
                  <input value={partnerForm.phone} onChange={(event) => setPartnerForm({ ...partnerForm, phone: event.target.value })} placeholder="Утасны дугаар" />
                  <input value={partnerForm.storeType} onChange={(event) => setPartnerForm({ ...partnerForm, storeType: event.target.value })} placeholder="Дэлгүүрийн төрөл" />
                  <input value={partnerForm.searchableFeature} onChange={(event) => setPartnerForm({ ...partnerForm, searchableFeature: event.target.value })} placeholder="Хайгдах онцлог" />
                  <input value={partnerForm.ownerName} onChange={(event) => setPartnerForm({ ...partnerForm, ownerName: event.target.value })} placeholder="Хариуцсан хүний нэр" />
                </div>
              ) : null}
              <input value={partnerForm.username} onChange={(event) => setPartnerForm({ ...partnerForm, username: event.target.value })} placeholder="Нэвтрэх ID эсвэл Gmail" />
              <input value={partnerForm.password} onChange={(event) => setPartnerForm({ ...partnerForm, password: event.target.value })} placeholder="Нууц үг" type="password" />
              {partnerAuthMode === "register" ? (
                <input value={partnerForm.confirmPassword} onChange={(event) => setPartnerForm({ ...partnerForm, confirmPassword: event.target.value })} placeholder="Нууц үг давтах" type="password" />
              ) : null}
              <button className="landing-auth-submit" type="submit">
                {partnerAuthMode === "login" ? "Портал руу орох" : "Бизнесээ нэмэх"}
              </button>
              {notice ? <p>{notice}</p> : null}
            </form>
          </aside>
        </section>
      ) : null}

      {partnerAuthOpen ? (
        <div className="landing-auth-modal landing-partner-modal" role="dialog" aria-modal="true">
          <form onSubmit={submitPartnerAuth}>
            <header>
              <h2>{partnerAuthMode === "login" ? "Дэлгүүр нэвтрэх" : "Дэлгүүр бүртгүүлэх"}</h2>
              <button onClick={() => setPartnerAuthOpen(false)} type="button">×</button>
            </header>
            <div className="landing-auth-tabs">
              <button className={partnerAuthMode === "login" ? "active" : ""} onClick={() => setPartnerAuthMode("login")} type="button">Нэвтрэх</button>
              <button className={partnerAuthMode === "register" ? "active" : ""} onClick={() => setPartnerAuthMode("register")} type="button">Бүртгүүлэх</button>
            </div>
            {partnerAuthMode === "register" ? (
              <>
                <input value={partnerForm.storeName} onChange={(event) => setPartnerForm({ ...partnerForm, storeName: event.target.value })} placeholder="Дэлгүүрийн нэр" />
                <input value={partnerForm.logoUrl} onChange={(event) => setPartnerForm({ ...partnerForm, logoUrl: event.target.value })} placeholder="Logo URL" />
                <input value={partnerForm.address} onChange={(event) => setPartnerForm({ ...partnerForm, address: event.target.value })} placeholder="Хаяг" />
                <input value={partnerForm.phone} onChange={(event) => setPartnerForm({ ...partnerForm, phone: event.target.value })} placeholder="Утасны дугаар" />
                <input value={partnerForm.storeType} onChange={(event) => setPartnerForm({ ...partnerForm, storeType: event.target.value })} placeholder="Дэлгүүрийн төрөл" />
                <input value={partnerForm.searchableFeature} onChange={(event) => setPartnerForm({ ...partnerForm, searchableFeature: event.target.value })} placeholder="Filter-ээр хайгдах онцлог" />
                <input value={partnerForm.ownerName} onChange={(event) => setPartnerForm({ ...partnerForm, ownerName: event.target.value })} placeholder="Хариуцсан хүний нэр" />
              </>
            ) : null}
            <input value={partnerForm.username} onChange={(event) => setPartnerForm({ ...partnerForm, username: event.target.value })} placeholder="Нэвтрэх ID эсвэл Gmail" />
            <input value={partnerForm.password} onChange={(event) => setPartnerForm({ ...partnerForm, password: event.target.value })} placeholder="Нууц үг" type="password" />
            {partnerAuthMode === "register" ? (
              <input value={partnerForm.confirmPassword} onChange={(event) => setPartnerForm({ ...partnerForm, confirmPassword: event.target.value })} placeholder="Нууц үг давтах" type="password" />
            ) : null}
            <button className="landing-auth-submit" type="submit">
              {partnerAuthMode === "login" ? "Нэвтрэх" : "Бүртгэл үүсгэх"}
            </button>
            {notice ? <p>{notice}</p> : null}
          </form>
        </div>
      ) : null}

      {authOpen ? (
        <div className="landing-auth-modal" role="dialog" aria-modal="true">
          <form onSubmit={submitAuth}>
            <header>
              <h2>{authMode === "login" ? "Хэрэглэгч нэвтрэх" : "Хэрэглэгч бүртгүүлэх"}</h2>
              <button onClick={() => setAuthOpen(false)} type="button">×</button>
            </header>
            <div className="landing-auth-tabs">
              <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")} type="button">Нэвтрэх</button>
              <button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")} type="button">Бүртгүүлэх</button>
            </div>
            {authMode === "register" ? (
              <>
                <input value={authForm.fullName} onChange={(event) => setAuthForm({ ...authForm, fullName: event.target.value })} placeholder="Нэр" />
                <input value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="Gmail хаяг" />
                <input value={authForm.phone} onChange={(event) => setAuthForm({ ...authForm, phone: event.target.value })} placeholder="Утас" />
              </>
            ) : (
              <input value={authForm.login} onChange={(event) => setAuthForm({ ...authForm, login: event.target.value })} placeholder="Gmail эсвэл утас" />
            )}
            <input value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="Нууц үг" type="password" />
            {authMode === "register" ? (
              <small className="landing-auth-hint">8+ тэмдэгт, том/жижиг үсэг, тоо, тусгай тэмдэгт орно. Жишээ: StrongPass123!</small>
            ) : null}
            <button className="landing-auth-submit" type="submit" disabled={loading}>
              {loading ? "Шалгаж байна..." : authMode === "login" ? "Нэвтрэх" : "Бүртгүүлэх"}
            </button>
            <button className="landing-auth-switch" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")} type="button">
              {authMode === "login" ? "Бүртгүүлэх" : "Нэвтрэх"}
            </button>
            {notice ? <p>{notice}</p> : null}
          </form>
        </div>
      ) : null}

      <div id="progress" />
      <div id="spline-hero">
        {createElement("spline-viewer", {
          "loading-anim-type": "spinner-small-dark",
          url: "https://prod.spline.design/17ec5be6-08d9-461d-aa33-f19f4c6dc35f/scene.splinecode",
        })}
      </div>
      <div id="stage">
        <div id="canvas-wrap" />
      </div>

      {copies.map((copy, index) => (
        <section className="copy" data-i={index} key={copy.kicker}>
          <span>{copy.kicker}</span>
          {index === 0 ? <h1>{copy.title}</h1> : <h2>{copy.title}</h2>}
          {copy.body ? <p>{copy.body}</p> : null}
        </section>
      ))}

      {section === "contact" ? (
      <section className="landing-contact-dashboard" aria-label="Холбоо барих">
        <div className="landing-contact-head">
          <span>САНАЛ АВАХ</span>
          <h2>Борлуулалтаа өсгөе</h2>
        </div>
        <div className="landing-contact-grid">
          <article>
            <span>Имэйл</span>
            <strong>support@deliverhub.mn</strong>
            <p>Бизнесээ холбох зөвлөгөө аваарай.</p>
          </article>
          <article>
            <span>Утас</span>
            <strong>+976 7700 1122</strong>
            <p>Бүртгэл, хүргэлт, marketplace-ийн дэмжлэг.</p>
          </article>
          <form>
            <label>
              <span>Нэр</span>
              <input placeholder="Таны нэр" />
            </label>
            <label>
              <span>Холбогдох дугаар</span>
              <input placeholder="Утас эсвэл Gmail" />
            </label>
            <label>
              <span>Мессеж</span>
              <textarea placeholder="Бизнесээ хэрхэн өсгөх талаар бичээрэй" />
            </label>
            <button type="button">Санал авах</button>
          </form>
        </div>
      </section>
      ) : null}

      {section === "courier" ? (
        <section className="landing-courier-portal" aria-label="Хүргэлтийн ажилтан">
          <header className="landing-courier-portal-head">
            <div>
              <span>COURIER БОЛОХ</span>
              <h2>Courier болж орлого ол</h2>
              <p>Дуудлага, маршрут, төлөв нэг апп дээр.</p>
            </div>
            <div className="landing-courier-auth-links">
              <a href={`${employeePortalUrl}/?mode=login`}>Ажилдаа орох</a>
              <a href={`${employeePortalUrl}/?mode=register`}>Courier болох</a>
            </div>
          </header>
          <div className="landing-courier-portal-grid">
            <article>
              <span>01</span>
              <strong>Илүү олон дуудлага</strong>
              <p>Ойрын захиалгаа сонгоод ажилла.</p>
            </article>
            <article>
              <span>02</span>
              <strong>Итгэл төрүүлэх live төлөв</strong>
              <p>Байршил, ETA ил тод.</p>
            </article>
            <article>
              <span>03</span>
              <strong>Аюулгүй баталгаажуулалт</strong>
              <p>Кодоор баталгаажуулж хүргэнэ.</p>
            </article>
          </div>
          <section className="landing-courier-status-panel">
            <div><span>Өнөөдрийн боломж</span><strong>12</strong><em>дуудлага</em></div>
            <div><span>Идэвхтэй ажил</span><strong>3</strong><em>онлайн</em></div>
            <div><span>Дундаж хүргэлт</span><strong>18 мин</strong><em>хурд</em></div>
            <div><span>Амжилтын түвшин</span><strong>98%</strong><em>итгэл</em></div>
          </section>
        </section>
      ) : null}
    </main>
  );
}

