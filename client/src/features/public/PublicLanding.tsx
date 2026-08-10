import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRef } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import heroAppleeImage from "../../assets/geed-hero/applee.avif";
import heroIphoneImage from "../../assets/geed-hero/iphone15.avif";
import heroMacbookImage from "../../assets/geed-hero/macbook.jpg";
import heroNoteImage from "../../assets/geed-hero/note.jpg";
import heroPromaxImage from "../../assets/geed-hero/promax.jpg";
import heroWatchImage from "../../assets/geed-hero/watch.avif";

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
  storeId?: string;
  storeName?: string;
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
const marketRowsPerPage = 15;
const marketCardsPerRow = 3;
const productsPerMarketPage = marketRowsPerPage * marketCardsPerRow;
const landingHeroImages = [
  heroPromaxImage,
  heroMacbookImage,
  heroWatchImage,
  heroIphoneImage,
  heroNoteImage,
  heroAppleeImage,
];

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

function productImageFor(product: Pick<Product, "name" | "category" | "imageUrl">) {
  if (product.imageUrl) return product.imageUrl;
  return productPhotoUrl(keywordForProduct(product));
}

function productPhotoUrl(keyword: string) {
  const query = encodeURIComponent(`${keyword} product photo`);
  return `https://tse4.mm.bing.net/th?q=${query}&w=900&h=650&c=7&rs=1&p=0`;
}

function productPlaceholderUrl(product: Pick<Product, "name" | "category">) {
  const label = encodeURIComponent(product.name.replace(/\s+/g, " ").trim());
  return `https://placehold.co/900x650/png?text=${label}`;
}

function stableStockCount(seed: string) {
  return Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 17) % 101;
}

const marketTemplates = [
  { category: "Хүнс", stores: ["Номин Супермаркет", "Fresh Mart", "Good Price Market", "Оргил Хүнс", "Minii Delguur"], products: [["Цагаан будаа", "rice bag"], ["Гурил", "flour"], ["Сүү", "milk bottle"], ["Өндөг", "eggs carton"], ["Алим", "apples"], ["Төмс", "potatoes"], ["Лууван", "carrots"], ["Үхрийн мах", "beef meat"], ["Тахианы мах", "chicken breast"], ["Бяслаг", "cheese"]] },
  { category: "24/7 дэлгүүр", stores: ["CU Mongolia", "GS25 Mongolia", "Quick Stop", "City Express", "Night Mart"], products: [["Сэндвич", "sandwich"], ["Кимбап", "kimbap"], ["Рамен", "instant ramen"], ["Ус", "water bottle"], ["Кола", "cola can"], ["Чипс", "potato chips"], ["Шоколад", "chocolate bar"], ["Зайрмаг", "ice cream"], ["Салат", "fresh salad"], ["Бэлэн хоол", "ready meal"]] },
  { category: "Гэр ахуй", stores: ["Home Plaza", "Ger Ahuin Tuv", "Cozy Home", "Kitchen House", "Houseware Hub"], products: [["Тавагны сет", "dinnerware"], ["Аяга", "mug"], ["Хайруулын таваг", "frying pan"], ["Сав суулга", "cookware"], ["Хутганы сет", "kitchen knife"], ["Алчуур", "towel"], ["Орны даавуу", "bed sheets"], ["Дэр", "pillow"], ["Сагс", "storage basket"], ["Цэвэрлэгээний багц", "cleaning supplies"]] },
  { category: "Цахилгаан бараа", stores: ["Tech Hub", "Digital Mall", "Phone Center", "Smart Store", "Electro Shop"], products: [["Чихэвч", "headphones"], ["Speaker", "bluetooth speaker"], ["Phone case", "phone case"], ["Цэнэглэгч", "phone charger"], ["Power bank", "power bank"], ["Keyboard", "keyboard"], ["Mouse", "computer mouse"], ["Web camera", "webcam"], ["Smart watch", "smart watch"], ["Desk lamp", "desk lamp"]] },
  { category: "Эмийн сан", stores: ["Pharma Plus", "Monos Express", "Health Care", "Vitamin House", "Apteka 24"], products: [["Витамин C", "vitamin c"], ["Витамин D", "vitamin d"], ["Дархлаа дэмжигч", "supplements"], ["Гар ариутгагч", "hand sanitizer"], ["Маск", "medical mask"], ["Шархны наалт", "bandage"], ["Даралт хэмжигч", "blood pressure monitor"], ["Халуун хэмжигч", "thermometer"], ["Нүдний дусаалга", "eye drops"], ["Омега 3", "omega 3"]] },
  { category: "Гоо сайхан", stores: ["Beauty Box", "Glow Market", "Skin Lab", "Cosmo Shop", "Makeup Studio"], products: [["Уруулын будаг", "lipstick"], ["Mascara", "mascara"], ["Суурь крем", "foundation makeup"], ["Нүүр цэвэрлэгч", "facial cleanser"], ["Чийгшүүлэгч", "moisturizer"], ["Үнэртэй ус", "perfume"], ["Шампунь", "shampoo"], ["Нүүрний маск", "face mask skincare"], ["Хумсны будаг", "nail polish"], ["Serum", "face serum"]] },
  { category: "Ном, бичиг хэрэг", stores: ["Book Nest", "Аз Хур Ном", "Stationery Pro", "Student Shop", "Paper House"], products: [["Уран зохиолын ном", "novel books"], ["Хүүхдийн ном", "children book"], ["Дэвтэр", "notebook"], ["Бал", "pen"], ["Харандаа", "pencils"], ["Файл хавтас", "file folder"], ["A4 цаас", "printer paper"], ["Marker", "markers"], ["Зургийн дэвтэр", "sketchbook"], ["Календарь", "calendar"]] },
  { category: "Спорт бараа", stores: ["Sport Zone", "Fit Market", "Outdoor Pro", "Bike House", "Active Gear"], products: [["Гүйлтийн пүүз", "running shoes"], ["Иогийн дэвсгэр", "yoga mat"], ["Дамббелл", "dumbbells"], ["Усны сав", "sports water bottle"], ["Хөл бөмбөг", "football ball"], ["Сагсан бөмбөг", "basketball"], ["Дугуйн дуулга", "bike helmet"], ["Спорт цүнх", "gym bag"], ["Майхан", "camping tent"], ["Уулын гутал", "hiking boots"]] },
  { category: "Хүүхдийн бараа", stores: ["Baby World", "Kids Planet", "Toy Land", "Little Star", "Mother Care"], products: [["Живх", "diapers"], ["Baby wipes", "baby wipes"], ["Угж", "baby bottle"], ["Хүүхдийн тоглоом", "baby toys"], ["Puzzle", "kids puzzle"], ["Lego set", "building blocks"], ["Хүүхдийн хувцас", "baby clothes"], ["Тэрэг", "baby stroller"], ["Зөөлөн тоглоом", "plush toy"], ["Сүүн тэжээл", "baby formula"]] },
  { category: "Амьтны бараа", stores: ["Pet Care", "Happy Pet", "Dog & Cat", "Pet Food Market", "Animal House"], products: [["Нохойн хоол", "dog food"], ["Муурын хоол", "cat food"], ["Амьтны тоглоом", "pet toys"], ["Оосор", "dog leash"], ["Муурын элс", "cat litter"], ["Амьтны шампунь", "pet shampoo"], ["Үүр", "pet bed"], ["Аквариум", "aquarium"], ["Загасны хоол", "fish food"], ["Тэжээлийн аяга", "pet bowl"]] },
];

function keywordForProduct(product: Pick<Product, "name" | "category">) {
  const searchable = `${product.name} ${product.category}`.toLowerCase();
  const matchedProduct = marketTemplates
    .flatMap((template) => template.products)
    .find(([baseName, keyword]) => searchable.includes(baseName.toLowerCase()) || searchable.includes(keyword.toLowerCase()));
  if (matchedProduct) return matchedProduct[1];

  const categoryKeywords: Record<string, string> = {
    "Хүнс": "grocery product",
    "24/7 дэлгүүр": "convenience store food",
    "Гэр ахуй": "household product",
    "Цахилгаан бараа": "electronics product",
    "Эмийн сан": "pharmacy product",
    "Гоо сайхан": "beauty product",
    "Ном, бичиг хэрэг": "books stationery",
    "Спорт бараа": "sports gear",
    "Хүүхдийн бараа": "baby product",
    "Амьтны бараа": "pet product",
  };
  return categoryKeywords[product.category] ?? "product";
}

function productNameVariant(category: string, baseName: string, index: number) {
  const variantsByCategory: Record<string, string[]> = {
    "Хүнс": ["500г", "1кг", "2кг", "5кг", "багц"],
    "24/7 дэлгүүр": ["дан", "комбо", "том", "дунд", "2ш"],
    "Гэр ахуй": ["цагаан", "саарал", "хар", "дунд", "сет"],
    "Цахилгаан бараа": ["хар", "цагаан", "compact", "pro", "type-c"],
    "Эмийн сан": ["30ш", "60ш", "100мл", "250мл", "багц"],
    "Гоо сайхан": ["01", "02", "03", "50мл", "100мл"],
    "Ном, бичиг хэрэг": ["A4", "A5", "хатуу хавтастай", "зөөлөн хавтастай", "12ш"],
    "Спорт бараа": ["S", "M", "L", "XL", "багц"],
    "Хүүхдийн бараа": ["0-6 сар", "6-12 сар", "1-2 нас", "3-5 нас", "багц"],
    "Амьтны бараа": ["жижиг", "дунд", "том", "1кг", "3кг"],
  };
  const variants = variantsByCategory[category] ?? ["дан", "дунд", "том", "2ш", "сет"];
  return `${baseName} ${variants[Math.floor(index / 10) % variants.length]}`.trim();
}

function buildDemoMarketStores(): StoreDirectoryItem[] {
  return marketTemplates.flatMap((template, templateIndex) =>
    template.stores.map((storeName, storeIndex) => {
      const id = `demo-${templateIndex + 1}-${storeIndex + 1}`;
      const products = Array.from({ length: 50 }, (_, index) => {
        const [baseName, keyword] = template.products[index % template.products.length];
        const name = cleanProductName(productNameVariant(template.category, baseName, index));
        return {
          id: `${id}-product-${index + 1}`,
          name,
          category: template.category,
          priceMnt: String(1800 + (index + 1) * 420 + templateIndex * 500 + storeIndex * 300),
          weightGrams: 180 + (index % 12) * 150,
          imageUrl: productPhotoUrl(keyword),
        };
      });

      return {
        id,
        name: storeName,
        description: template.category,
        address: `Улаанбаатар, ${["Сүхбаатар", "Баянзүрх", "Хан-Уул", "Баянгол", "Чингэлтэй"][storeIndex]} дүүрэг`,
        coverUrl: products[0]?.imageUrl ?? "",
        productCount: products.length,
        orderCount: 20 + templateIndex * 7 + storeIndex * 3,
        categories: [template.category],
        products,
      };
    }),
  );
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
    description: "Хэрэгтэй бараагаа хурдан, найдвартай хүргүүлээрэй.",
  },
  {
    id: "meat-1kg",
    sku: "MT-5541",
    name: "Монгол мах 1кг",
    category: "Мах",
    priceMnt: 18500,
    weightGrams: 1000,
    stockCount: 12,
    description: "Чанартай бүтээгдэхүүнээ гэрийн үүдэндээ тав тухтай аваарай.",
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
  { id: "foot", label: "Явган", copy: "Ойрын хүргэлтэд тохиромжтой", base: 1800, perKm: 700, perKg: 180, speedKmh: 4 },
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

function cleanProductName(value: string) {
  return fixMojibake(value)
    .replace(/\b(premium)\b/gi, "")
    .replace(/(^|\s)(премиум)(?=\s|$)/gi, " ")
    .replace(/(^|\s)(гэр бүлийн|өдөр тутмын|өдрийн|органик|хэмнэлттэй)(?=\s|$)/gi, " ")
    .replace(/\s+(шинэ|шинэхэн|shine|new)$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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
      name: cleanProductName(product.name),
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
  const cartPanelRef = useRef<HTMLElement | null>(null);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [heroImageIndex, setHeroImageIndex] = useState(0);
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
  const [marketPage, setMarketPage] = useState(1);
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
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
    if (!cartOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => cartPanelRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [cartOpen]);

  useEffect(() => {
    if (section === "market" && !session) {
      setAuthMode("login");
      setAuthOpen(true);
    }
  }, [section, session]);

  useEffect(() => {
    if (section !== "home") return undefined;

    const intervalId = window.setInterval(() => {
      setHeroImageIndex((current) => (current + 1) % landingHeroImages.length);
    }, 4000);

    return () => window.clearInterval(intervalId);
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
          pageSize: "50",
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

  const demoMarketStores = useMemo(buildDemoMarketStores, []);
  const marketStoreDirectory = useMemo(() => {
    const realStoreNames = new Set(stores.map((store) => store.name.toLowerCase()));
    const supplementalStores = demoMarketStores.filter((store) => !realStoreNames.has(store.name.toLowerCase()));
    return stores.length >= 50 ? stores : [...stores, ...supplementalStores].slice(0, 50);
  }, [demoMarketStores, stores]);
  const selectedStore = marketStoreDirectory.find((store) => store.id === selectedStoreId) ?? marketStoreDirectory[0];
  const filteredStores = useMemo(() => {
    const normalizedSearch = storeSearch.trim().toLowerCase();
    return marketStoreDirectory.filter((store) => (
      (storeFilter === "Бүгд" || store.categories.includes(storeFilter))
      && (
        !normalizedSearch
        || store.name.toLowerCase().includes(normalizedSearch)
        || store.address.toLowerCase().includes(normalizedSearch)
        || store.description.toLowerCase().includes(normalizedSearch)
        || store.categories.some((category) => category.toLowerCase().includes(normalizedSearch))
      )
    )).sort((first, second) => {
      const categoryCompare = (first.categories[0] ?? "").localeCompare(second.categories[0] ?? "", "mn");
      return categoryCompare || first.name.localeCompare(second.name, "mn");
    });
  }, [marketStoreDirectory, storeFilter, storeSearch]);
  const storeProductGroups = useMemo(() => {
    const normalizedProductSearch = productSearch.trim().toLowerCase();
    return filteredStores.map((store, storeIndex) => ({
      store,
      storeIndex,
      products: store.products.map((product) => ({
          id: product.id,
          sku: product.id.slice(-8),
          name: cleanProductName(product.name),
          category: product.category,
          priceMnt: Number(product.priceMnt),
          weightGrams: product.weightGrams,
          stockCount: stableStockCount(product.id),
          description: `${store.name} - ${product.category.toLowerCase()} ангилал.`,
          imageUrl: productPhotoUrl(keywordForProduct(product)),
          storeId: store.id,
          storeName: store.name,
        })).filter((product) => (
          !normalizedProductSearch
          || product.name.toLowerCase().includes(normalizedProductSearch)
          || product.category.toLowerCase().includes(normalizedProductSearch)
          || store.name.toLowerCase().includes(normalizedProductSearch)
        )),
    })).filter((group) => group.products.length > 0);
  }, [filteredStores, productSearch]);
  const marketProductRows = useMemo(
    () => storeProductGroups.flatMap((group) => group.products.map((product) => ({
      product,
      store: group.store,
      storeIndex: group.storeIndex,
    }))),
    [storeProductGroups],
  );
  const totalMarketPages = Math.max(1, Math.ceil(marketProductRows.length / productsPerMarketPage));
  const pagedStoreProductGroups = useMemo(() => {
    const pageRows = marketProductRows.slice((marketPage - 1) * productsPerMarketPage, marketPage * productsPerMarketPage);
    return pageRows.reduce<Array<{ store: StoreDirectoryItem; storeIndex: number; products: Product[] }>>((groups, row) => {
      const existingGroup = groups.find((group) => group.store.id === row.store.id);
      if (existingGroup) {
        existingGroup.products.push(row.product);
        return groups;
      }
      return [...groups, { store: row.store, storeIndex: row.storeIndex, products: [row.product] }];
    }, []);
  }, [marketPage, marketProductRows]);
  const allMarketProducts = useMemo(
    () => (storeProductGroups.length ? storeProductGroups.flatMap((group) => group.products) : initialProducts),
    [storeProductGroups],
  );
  const marketProducts = allMarketProducts;

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
  const cartItemCount = selectedItems.reduce((sum, product) => sum + product.quantity, 0);
  const weightKg = Math.round(selectedItems.reduce((sum, product) => sum + product.weightGrams * product.quantity, 0) / 100) / 10;
  const activeDelivery = deliveryOptions.find((option) => option.id === deliveryType) ?? deliveryOptions[0];
  const customerLocation = location ?? { latitude: 47.9212, longitude: 106.9186 };
  const km = distanceKm(storeLocation, customerLocation);
  const deliveryFee = Math.round(activeDelivery.base + km * activeDelivery.perKm + weightKg * activeDelivery.perKg);
  const etaMinutes = Math.max(12, Math.round((km / activeDelivery.speedKmh) * 60 + 10));
  const storeCategories = useMemo(
    () => ["Бүгд", ...new Set(marketStoreDirectory.flatMap((store) => store.categories).filter(Boolean))],
    [marketStoreDirectory],
  );

  useEffect(() => {
    setMarketPage(1);
  }, [productSearch, storeFilter, storeSearch]);

  useEffect(() => {
    setMarketPage((current) => Math.min(current, totalMarketPages));
  }, [totalMarketPages]);
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

  function updateProductQuantity(productId: string, delta: number) {
    setProductQuantities((current) => {
      const product = allMarketProducts.find((item) => item.id === productId);
      const maxQuantity = product?.stockCount ?? 1;
      const nextQuantity = Math.min(maxQuantity, Math.max(1, (current[productId] ?? 1) + delta));
      return { ...current, [productId]: nextQuantity };
    });
  }

  function addSelectedQuantityToCart(productId: string) {
    setCart((current) => {
      const product = allMarketProducts.find((item) => item.id === productId);
      const maxQuantity = product?.stockCount ?? 0;
      const selectedQuantity = productQuantities[productId] ?? 1;
      const nextQuantity = Math.min(maxQuantity, (current[productId] ?? 0) + selectedQuantity);
      return { ...current, [productId]: nextQuantity };
    });
    setWishlistOpen(false);
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
    const storeName = selectedItems[0]?.storeName ?? selectedStore?.name ?? "DeliverHub market";
    const storeRecipient = readStoreUsers().find((user) => user.storeName.toLowerCase() === storeName.toLowerCase());
    const storeId = storeRecipient?.id ?? selectedItems[0]?.storeId ?? selectedStore?.id ?? "deliverhub-market";
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
      title: paymentMethod === "stripe" ? "Stripe гүйлгээ амжилттай" : "Төлбөртэй захиалга",
      body: `${storeName}: ${paymentLabel}-ээр ${formatMnt(total)} төлөгдсөн захиалга ирлээ. Хаяг: ${district}`,
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
            <svg aria-hidden="true" className="landing-nav-icon" fill="none" viewBox="0 0 24 24">
              <path d="M3 4H5L7.2 14.2C7.39 15.07 8.16 15.69 9.05 15.69H17.8C18.64 15.69 19.38 15.14 19.62 14.33L21 9.5H8.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              <circle cx="9.5" cy="19" fill="currentColor" r="1.4" />
              <circle cx="17.5" cy="19" fill="currentColor" r="1.4" />
            </svg>
            {session && cartItemCount > 0 ? <b>{cartItemCount}</b> : null}
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
            <svg aria-hidden="true" className="landing-nav-icon" fill="none" viewBox="0 0 24 24">
              <path d="M6 4.8C6 3.8 6.8 3 7.8 3H16.2C17.2 3 18 3.8 18 4.8V20L12 16.6L6 20V4.8Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
            {wishlistItems.length > 0 ? <b>{wishlistItems.length}</b> : null}
          </button>
          <button type="button" aria-label="Миний захиалсан">
            <svg aria-hidden="true" className="landing-nav-icon" fill="none" viewBox="0 0 24 24">
              <path d="M12 12C14.4853 12 16.5 9.98528 16.5 7.5C16.5 5.01472 14.4853 3 12 3C9.51472 3 7.5 5.01472 7.5 7.5C7.5 9.98528 9.51472 12 12 12Z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M4 20C4.8 16.9 7.72 15 12 15C16.28 15 19.2 16.9 20 20" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
            </svg>
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
          <div className="landing-cart-backdrop" aria-hidden="true" onClick={() => setCartOpen(false)} />
        ) : null}

        {cartOpen ? (
          <section className="landing-cart-popover" aria-label="Сагс" aria-modal="true" ref={cartPanelRef} role="dialog" tabIndex={-1}>
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
                      <img alt={item.name} src={productImageFor(item)} />
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
                    <img alt={item.name} src={productImageFor(item)} />
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

            <section className="market-store-feed">
              {pagedStoreProductGroups.length ? pagedStoreProductGroups.map(({ store, storeIndex, products }) => {
                const brand = storeBrandFor(store.name);
                const displayIndex = storeIndex + 1;
                return (
                  <section className="market-store-section" key={store.id}>
                    <header>
                      <span className="landing-store-logo">
                        {brand.logoUrl ? <img alt={`${store.name} logo`} src={brand.logoUrl} /> : <b>{brand.initials}</b>}
                      </span>
                      <div>
                        <span>#{String(displayIndex).padStart(2, "0")} · {store.categories.join(", ")}</span>
                        <strong>{store.name}</strong>
                        <small>{store.address}</small>
                      </div>
                    </header>
                    <div className="landing-product-grid">
                      {products.map((product) => (
                        <article key={product.id}>
                          <button
                            className={`landing-product-wish ${wishlist.includes(product.id) ? "active" : ""}`}
                            onClick={() => toggleWishlist(product.id)}
                            type="button"
                            aria-label={`${product.name} wishlist`}
                          >
                            {wishlist.includes(product.id) ? "♥" : "♡"}
                          </button>
                          <img
                            alt={product.name}
                            src={productImageFor(product)}
                            onError={(event) => {
                              event.currentTarget.src = productPlaceholderUrl(product);
                            }}
                          />
                          <span>{product.category}</span>
                          <h3>{product.name}</h3>
                          <strong>{formatMnt(product.priceMnt)}</strong>
                          <em className={product.stockCount <= 0 ? "is-empty" : product.stockCount <= 12 ? "is-low" : ""}>
                            Үлдэгдэл: {product.stockCount} ш
                          </em>
                          <div className="landing-product-actions">
                            <button className="landing-product-qty" onClick={() => updateProductQuantity(product.id, -1)} type="button">−</button>
                            <b>{productQuantities[product.id] ?? 1}</b>
                            <button className="landing-product-qty" onClick={() => updateProductQuantity(product.id, 1)} type="button" disabled={product.stockCount <= 0}>+</button>
                            <button
                              className="landing-product-add"
                              onClick={() => addSelectedQuantityToCart(product.id)}
                              type="button"
                              disabled={product.stockCount <= 0}
                              aria-label={`${product.name} сагсанд нэмэх`}
                              title="Сагсанд нэмэх"
                            >
                              <span>Сагслах</span>
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              }) : (
                <p className="market-empty">Одоогоор тохирох дэлгүүр олдсонгүй.</p>
              )}
            </section>

            <nav className="market-pagination" aria-label="Маркетийн хуудас">
              <button onClick={() => setMarketPage((pageNumber) => Math.max(1, pageNumber - 1))} type="button" disabled={marketPage <= 1}>
                Өмнөх
              </button>
              <span>{marketPage} / {totalMarketPages}</span>
              <button onClick={() => setMarketPage((pageNumber) => Math.min(totalMarketPages, pageNumber + 1))} type="button" disabled={marketPage >= totalMarketPages}>
                Дараах
              </button>
            </nav>

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

      <section className="landing-hero-slider" aria-label="DeliverHub танилцуулга">
        {landingHeroImages.map((image, index) => (
          <div className={`landing-hero-slide ${index === heroImageIndex ? "active" : ""}`} key={image}>
            <img alt="" src={image} />
          </div>
        ))}
        <div className="landing-hero-shade" />
        <div className="landing-hero-copy">
          <h1>Монголын албан ёсны цахим худалдаа, чөлөөт хүргэлтийн нэгдсэн платформ</h1>
        </div>
        <div className="landing-hero-footer-text">
          <span>Хүссэнээ захиалаад гэртээ хүргүүл</span>
        </div>
      </section>

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

