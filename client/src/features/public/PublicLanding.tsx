import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useRef } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { InteractiveRouteMap, type RouteMapLine, type RouteMapMarker } from "../../components/InteractiveRouteMap";
import { nominCatalogProducts, nominStoreProfile } from "../../shared/nominCatalog";
import heroAppleeImage from "../../assets/geed-hero/applee.avif";
import heroIphoneImage from "../../assets/geed-hero/iphone15.avif";
import heroMacbookImage from "../../assets/geed-hero/macbook.jpg";
import heroNoteImage from "../../assets/geed-hero/note.jpg";
import heroPromaxImage from "../../assets/geed-hero/promax.jpg";
import heroWatchImage from "../../assets/geed-hero/watch.avif";

type AuthMode = "login" | "register";
type PartnerAuthMode = "login" | "register";
type DeliveryType = "bike" | "car" | "foot";
type PaymentMethod = "qpay";
type LandingSection = "home" | "market" | "contact" | "courier" | "partner";
type QpayBankId = string;

type QpayPaymentState = {
  orderNo: string;
  invoiceId: string;
  amountMnt: number;
  qrText?: string;
  qrImage?: string;
  shortUrl?: string;
  urls?: Array<{ name?: string; description?: string; link?: string; logo?: string }>;
};

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
    avatarDataUrl?: string;
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

type OrderHistoryItem = {
  orderNo: string;
  storeName: string;
  district: string;
  statusLabel: string;
  totalMnt: string;
  createdAt: string;
  updatedAt: string;
  statusNote: string;
  items: Array<{
    label: string;
    amountMnt: string;
  }>;
};

type OrderHistoryResponse = {
  items: OrderHistoryItem[];
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
    stockCount?: number;
  }>;
};

type StoreDirectoryResponse = {
  items: StoreDirectoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function secureHttpUrl(url: string, fallback: string) {
  if (!import.meta.env.PROD) return url;
  if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) return fallback;
  return url.replace(/^http:\/\//, "https://");
}

function secureRealtimeUrl(url: string, fallback: string) {
  if (!import.meta.env.PROD) return url;
  if (url.startsWith("ws://localhost") || url.startsWith("ws://127.0.0.1")) return fallback;
  return url.replace(/^http:\/\//, "https://").replace(/^ws:\/\//, "wss://");
}

const productionApiBaseUrl = "https://deliverhub-gateway.onrender.com/api";
const productionCustomerRealtimeUrl = "wss://deliverhub-customer-service.onrender.com/realtime";
const productionEmployeePortalUrl = "https://deliverhub-employee.vercel.app";
const productionStorePortalUrl = "https://deliverhub-store.vercel.app";
const apiBaseUrl = secureHttpUrl(import.meta.env.VITE_API_BASE_URL ?? (
  import.meta.env.PROD ? productionApiBaseUrl : "http://127.0.0.1:3000/api"
), productionApiBaseUrl);
const customerRealtimeUrl = secureRealtimeUrl(import.meta.env.VITE_CUSTOMER_REALTIME_URL ?? (
  import.meta.env.PROD ? productionCustomerRealtimeUrl : "ws://127.0.0.1:3104/realtime"
), productionCustomerRealtimeUrl);
const employeePortalUrl = secureHttpUrl(import.meta.env.VITE_EMPLOYEE_PORTAL_URL ?? (
  import.meta.env.PROD ? productionEmployeePortalUrl : "http://127.0.0.1:5176"
), productionEmployeePortalUrl);
const storePortalUrl = secureHttpUrl(import.meta.env.VITE_SHOP_APP_URL ?? (
  import.meta.env.PROD ? productionStorePortalUrl : "http://127.0.0.1:5175"
), productionStorePortalUrl);
const tokenStorageKey = "deliverhub-customer-access-token";
const customerStorageKey = "deliverhub-customer-profile";
const wishlistStorageKey = "deliverhub-customer-wishlist";
const orderSeenStorageKey = "deliverhub-customer-orders-seen";
const storeUsersStorageKey = "deliverhub-store-users";
const storeSessionStorageKey = "deliverhub-store-session";
const storeLocation = { latitude: 47.9186, longitude: 106.9176 };
const marketRowsPerPage = 15;
const marketCardsPerRow = 3;
const qpayLogoUrl = "https://qpay.mn/q/img/brand-logo.png";
const paymentMethods: Array<{ id: PaymentMethod; label: string; mark: string }> = [
  { id: "qpay", label: "QPay", mark: "QP" },
];
const qpayBankOptions: Array<{ id: QpayBankId; label: string; mark: string; aliases: string[]; logoUrl: string }> = [
  { id: "khanbank", label: "Khan Bank", mark: "KH", aliases: ["khan", "haan", "хаан"], logoUrl: "https://qpay.mn/q/img/khanbank.webp" },
  { id: "tdbbank", label: "TDB Online", mark: "TD", aliases: ["tdb", "trade", "development", "худалдаа"], logoUrl: "https://qpay.mn/q/img/tdb.webp" },
  { id: "socialpay", label: "SocialPay", mark: "SP", aliases: ["socialpay", "social pay"], logoUrl: "https://qpay.mn/q/img/socialpay.webp" },
  { id: "statebank", label: "State Bank 3.0", mark: "SB", aliases: ["state", "төрийн", "turiin"], logoUrl: "https://qpay.mn/q/img/statebank.webp" },
  { id: "xacbank", label: "XacBank", mark: "XB", aliases: ["xac", "has", "xas", "хас"], logoUrl: "https://qpay.mn/q/img/xacbank.webp" },
  { id: "capitron", label: "Capitron Bank", mark: "CB", aliases: ["capitron"], logoUrl: "https://qpay.mn/q/img/capitron-bank.webp" },
  { id: "bogdbank", label: "Bogd Bank", mark: "BB", aliases: ["bogd"], logoUrl: "https://qpay.mn/q/img/bogd-bank.webp" },
  { id: "nibank", label: "NIBank", mark: "NI", aliases: ["nibank", "national investment"], logoUrl: "https://qpay.mn/q/img/nibank.webp" },
  { id: "most", label: "MostMoney", mark: "MM", aliases: ["most"], logoUrl: "https://qpay.mn/q/img/most-money.webp" },
  { id: "transbank", label: "Transbank", mark: "TB", aliases: ["transbank"], logoUrl: "https://qpay.mn/q/img/transbank.webp" },
  { id: "mbank", label: "M bank", mark: "MB", aliases: ["m bank", "mbank"], logoUrl: "https://qpay.mn/q/img/mbank.webp" },
  { id: "arigbank", label: "Arig Bank", mark: "AB", aliases: ["arig"], logoUrl: "https://qpay.mn/q/img/arig-bank.webp" },
  { id: "ckbank", label: "Chinggis Khaan", mark: "CK", aliases: ["chinggis", "ckbank"], logoUrl: "https://qpay.mn/q/img/ckbank.webp" },
  { id: "monpay", label: "Monpay", mark: "MP", aliases: ["monpay"], logoUrl: "https://qpay.mn/q/img/monpay.webp" },
  { id: "toki", label: "Toki", mark: "TK", aliases: ["toki"], logoUrl: "https://qpay.mn/q/img/tokipay.webp" },
  { id: "ardapp", label: "Ard App", mark: "AR", aliases: ["ard"], logoUrl: "https://qpay.mn/q/img/ard.webp?v=2" },
  { id: "hipay", label: "Hipay", mark: "HP", aliases: ["hipay"], logoUrl: "https://qpay.mn/q/img/hipay.webp" },
  { id: "happypay", label: "Happy Pay", mark: "HY", aliases: ["happy pay", "happypay"], logoUrl: "https://qpay.mn/q/img/tdbwallet.webp" },
  { id: "sono", label: "Sono", mark: "SN", aliases: ["sono"], logoUrl: "https://qpay.mn/q/img/sono.webp" },
  { id: "payon", label: "PayOn", mark: "PO", aliases: ["payon"], logoUrl: "https://qpay.mn/q/img/payon.webp" },
  { id: "tino", label: "Tino", mark: "TN", aliases: ["tino"], logoUrl: "https://qpay.mn/q/img/tino.webp" },
  { id: "qpaywallet", label: "QPAY wallet", mark: "QP", aliases: ["qpay", "wallet"], logoUrl: "https://qpay.mn/q/img/qpay-wallet.webp" },
];
const productsPerMarketPage = marketRowsPerPage * marketCardsPerRow;
const marketCategoryFilters = ["Бүгд", "Хүнс", "Гэр ахуй", "Хоол захиалга", "Эмийн сан", "Цэцгийн дэлгүүр", "Спорт бараа", "Цахилгаан бараа", "Хувцас", "Гар утас, дагалдах", "Гоо сайхан", "Бусад"] as const;
const groupedMarketCategories: Record<string, string[]> = {
  "Хүнс": ["Хүнс", "Мах", "Талх", "Сүү"],
  "Гэр ахуй": ["Гэр ахуй"],
  "Хоол захиалга": ["24/7 дэлгүүр", "Хоол", "Бэлэн хоол"],
  "Эмийн сан": ["Эмийн сан"],
  "Цэцгийн дэлгүүр": ["Цэцгийн дэлгүүр", "Цэцэг"],
  "Спорт бараа": ["Спорт бараа"],
  "Цахилгаан бараа": ["Цахилгаан бараа"],
  "Хувцас": ["Хувцас"],
  "Гар утас, дагалдах": ["Гар утас", "Таблет", "Дагалдах хэрэгсэл"],
  "Гоо сайхан": ["Гоо сайхан"],
};
const landingHeroImages = [
  heroPromaxImage,
  heroMacbookImage,
  heroWatchImage,
  heroIphoneImage,
  heroNoteImage,
  heroAppleeImage,
];

const landingShowcaseSlides = [
  {
    tag: "ДЭЛГҮҮРТ ЗОРИУЛСАН",
    title: "Бизнесээ цахим болго",
    body: "Дэлгүүрээ DeliverHub платформ дээр бүртгүүлж, бараагаа онлайнаар борлуулж эхэл — захиалга, орлого, нөөцөө нэг dashboard-аас удирдаарай.",
    image: "https://tse4.mm.bing.net/th?q=small%20business%20owner%20managing%20online%20store%20dashboard%20on%20laptop&w=900&h=650&c=7&rs=1&p=0",
  },
  {
    tag: "ХҮРГЭЛТИЙН АЖИЛТАНД ЗОРИУЛСАН",
    title: "Өөрийн цагаараа ажилла",
    body: "Мопед, машин, явган — дуртай хэлбэрээрээ, дуртай цагтаа хүргэлт хийж тогтмол орлого олоорой.",
    image: "https://tse4.mm.bing.net/th?q=delivery%20courier%20riding%20moped%20with%20package%20city%20street&w=900&h=650&c=7&rs=1&p=0",
  },
  {
    tag: "ХЭРЭГЛЭГЧДЭД ЗОРИУЛСАН",
    title: "Цаг хэмнэ, итгэлтэй байгаарай",
    body: "Хамгийн ойрхон байгаа найдвартай хүргэлтээр хүссэн бараагаа түргэн шуурхай гарт хүлээн аваарай.",
    image: "https://tse4.mm.bing.net/th?q=happy%20customer%20receiving%20delivery%20package%20at%20doorstep&w=900&h=650&c=7&rs=1&p=0",
  },
];

const partnerRegisterSteps = ["Дэлгүүр", "Данс & зөвшөөрөл", "Иргэний бичиг баримт", "Царай баталгаажуулалт", "Нэвтрэх мэдээлэл", "Гэрээ"];

const partnerAgreementClauses = [
  "Та энэхүү платформ дээр зөвхөн хууль ёсны, жинхэнэ бараа бүтээгдэхүүн, үнэн зөв мэдээллээр бүртгүүлж байгааг баталгаажуулж байна.",
  "Хуурамч бичиг баримт, зөвшөөрөлгүй бараа, хуулбарласан бренд/загвар (contraband, хуурамч бараа) зарж борлуулсан нь илэрсэн тохиолдолд бүртгэл шууд цуцлагдаж, төлбөрийн эрх түдгэлзэнэ.",
  "Монгол Улсын хууль тогтоомж (Иргэний хууль, Татварын хууль, Хэрэглэгчийн эрхийг хамгаалах тухай хууль зэрэг)-ийг зөрчсөн үйл ажиллагаа явуулсан тохиолдолд Эрүүгийн хуулийн дагуу эрүүгийн хариуцлага хүлээлгэх өргөдөл/мэдээллийг холбогдох байгууллагад шилжүүлж болно.",
  "Хуурамч данс, бусдын нэр/бичиг баримт ашигласан нь тогтоогдвол таны бүх орлого царцаагдаж, хохирогчид нөхөн төлбөр гаргуулах эрх DeliverHub-д хадгалагдана.",
  "Царай баталгаажуулалт болон бичиг баримт нь зөвхөн таны эзэмшигчийн эрхийг баталгаажуулах зорилготой бөгөөд аюулгүй байдлын дагуу хадгалагдана.",
];

function brandLogoDataUrl(label: string, from: string, to: string, accent = "#ffffff") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="14" y1="8" x2="114" y2="120" gradientUnits="userSpaceOnUse"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="128" height="128" rx="28" fill="url(#g)"/><circle cx="98" cy="24" r="30" fill="${accent}" opacity=".16"/><circle cx="28" cy="102" r="24" fill="${accent}" opacity=".12"/><text x="64" y="72" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${label.length > 6 ? 26 : 34}" font-weight="900" fill="${accent}" letter-spacing=".5">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function mMartLogoDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="18" fill="#183db5"/><g transform="translate(21 37)"><path d="M5 0H81C84 0 86 2 86 5V44C86 48 82 50 79 48L64 40C61 39 58 39 55 40L43 46C41 47 39 47 37 46L25 40C22 39 19 39 16 40L7 45C4 47 0 45 0 41V5C0 2 2 0 5 0Z" fill="#ffffff"/><path d="M0 41L18 32C21 30 24 30 27 32L39 38C41 39 43 39 45 38L57 32C60 30 63 30 66 32L86 42V54C86 58 82 60 79 58L64 50C61 49 58 49 55 50L43 56C41 57 39 57 37 56L25 50C22 49 19 49 16 50L7 55C4 57 0 55 0 51Z" fill="#f23778"/><text x="43" y="26" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="#183db5">m&#8226;mart</text></g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const storeBrands = [
  {
    match: ["номин", "nomin"],
    logoUrl: "https://www.mongoliansaddle.com/partners/Nomin%20supermarket.JPG",
  },
  {
    match: ["carrefour", "каррефур"],
    logoUrl: "https://www.google.com/s2/favicons?domain=carrefour.com&sz=128",
  },
  {
    match: ["m mart", "mmart", "м март", "эм март"],
    logoUrl: mMartLogoDataUrl(),
  },
  {
    match: ["good price", "goodprice"],
    logoUrl: "https://www.google.com/s2/favicons?domain=goodprice.mn&sz=128",
  },
  {
    match: ["cu"],
    logoUrl: "https://www.google.com/s2/favicons?domain=cu-mongolia.mn&sz=128",
  },
  {
    match: ["gs25", "gs 25"],
    logoUrl: "https://gs25.mn/favicon.webp",
  },
  {
    match: ["emart", "e-mart", "еmart"],
    logoUrl: "https://www.google.com/s2/favicons?domain=emartmall.mn&sz=128",
  },
  {
    match: ["circle k", "circlek"],
    logoUrl: "https://www.google.com/s2/favicons?domain=circlek.com&sz=128",
  },
  {
    match: ["monos", "монос"],
    logoUrl: "https://www.google.com/s2/favicons?domain=monos.mn&sz=128",
  },
  {
    match: ["emonos", "e-monos"],
    logoUrl: "https://www.google.com/s2/favicons?domain=emonos.mn&sz=128",
  },
  {
    match: ["asia pharma", "азиа фарма"],
    logoUrl: "https://www.google.com/s2/favicons?domain=asiapharma.mn&sz=128",
  },
  {
    match: ["next"],
    logoUrl: "https://www.google.com/s2/favicons?domain=next.mn&sz=128",
  },
  {
    match: ["pc mall", "pcmall"],
    logoUrl: "https://www.google.com/s2/favicons?domain=pcmall.mn&sz=128",
  },
  {
    match: ["bsb"],
    logoUrl: "https://www.google.com/s2/favicons?domain=bsb.mn&sz=128",
  },
  {
    match: ["mobicom", "мобиком"],
    logoUrl: "https://www.google.com/s2/favicons?domain=mobicom.mn&sz=128",
  },
  {
    match: ["unitel", "юнител"],
    logoUrl: "https://www.google.com/s2/favicons?domain=unitel.mn&sz=128",
  },
  {
    match: ["shoppy"],
    logoUrl: "https://www.google.com/s2/favicons?domain=shoppy.mn&sz=128",
  },
  {
    match: ["ikea"],
    logoUrl: "https://www.google.com/s2/favicons?domain=ikea.com&sz=128",
  },
  {
    match: ["jysk"],
    logoUrl: "https://www.google.com/s2/favicons?domain=jysk.com&sz=128",
  },
  {
    match: ["lhamour"],
    logoUrl: "https://www.google.com/s2/favicons?domain=lhamour.com&sz=128",
  },
  {
    match: ["sephora"],
    logoUrl: "https://www.google.com/s2/favicons?domain=sephora.com&sz=128",
  },
  {
    match: ["yves rocher"],
    logoUrl: "https://www.google.com/s2/favicons?domain=yves-rocher.com&sz=128",
  },
];

const storeLogoPalettes: Record<string, { from: string; to: string; icon: string }> = {
  "Хүнс": { from: "#16a34a", to: "#f97316", icon: "M8 15.5C8 11.9 10.4 8.5 12 7C13.6 8.5 16 11.9 16 15.5C16 18 14.2 20 12 20C9.8 20 8 18 8 15.5ZM7 5C9.5 5 11.2 5.8 12 7C12.8 5.8 14.5 5 17 5" },
  "24/7 дэлгүүр": { from: "#2563eb", to: "#14b8a6", icon: "M5 9H19V18.5C19 19.3 18.3 20 17.5 20H6.5C5.7 20 5 19.3 5 18.5V9ZM7 5H17L19 9H5L7 5ZM9 13H15" },
  "Гэр ахуй": { from: "#0f172a", to: "#94a3b8", icon: "M5 11L12 5L19 11V19H14V14H10V19H5V11Z" },
  "Цахилгаан бараа": { from: "#4f46e5", to: "#06b6d4", icon: "M8 4H16V20H8V4ZM10 7H14M11 17H13" },
  "Гар утас": { from: "#111827", to: "#f97316", icon: "M9 4H15C15.8 4 16.5 4.7 16.5 5.5V18.5C16.5 19.3 15.8 20 15 20H9C8.2 20 7.5 19.3 7.5 18.5V5.5C7.5 4.7 8.2 4 9 4ZM11 17.5H13" },
  "Таблет": { from: "#1d4ed8", to: "#38bdf8", icon: "M6.5 5H17.5V19H6.5V5ZM10.5 16.5H13.5" },
  "Дагалдах хэрэгсэл": { from: "#7c3aed", to: "#ec4899", icon: "M8 8V6C8 4.9 8.9 4 10 4H14C15.1 4 16 4.9 16 6V8M7 8H17V20H7V8ZM10 12H14" },
  "Хувцас": { from: "#be123c", to: "#fb7185", icon: "M8 6L10 4H14L16 6L19 8L17 12L15.5 11V20H8.5V11L7 12L5 8L8 6Z" },
  "Эмийн сан": { from: "#dc2626", to: "#22c55e", icon: "M11 6H13V11H18V13H13V18H11V13H6V11H11V6Z" },
  "Цэцгийн дэлгүүр": { from: "#db2777", to: "#facc15", icon: "M12 12C10 9.8 10.7 7.5 12 6.5C13.3 7.5 14 9.8 12 12ZM12 12C9.4 11.3 8 9.4 8.4 7.8C10 7.6 11.7 8.6 12 12ZM12 12C14.6 11.3 16 9.4 15.6 7.8C14 7.6 12.3 8.6 12 12ZM12 12C10 14.2 10.7 16.5 12 17.5C13.3 16.5 14 14.2 12 12ZM12 12L8 20M12 12L16 20" },
  "Гоо сайхан": { from: "#ec4899", to: "#8b5cf6", icon: "M8 19H16L15 10H9L8 19ZM10 10V7C10 5.9 10.9 5 12 5C13.1 5 14 5.9 14 7V10" },
  "Ном, бичиг хэрэг": { from: "#0891b2", to: "#22c55e", icon: "M6 5H11C12.1 5 13 5.9 13 7V19C13 17.9 12.1 17 11 17H6V5ZM13 7C13 5.9 13.9 5 15 5H18V17H15C13.9 17 13 17.9 13 19V7Z" },
  "Спорт бараа": { from: "#ea580c", to: "#0f172a", icon: "M7 8C9.8 5.2 14.2 5.2 17 8C19.8 10.8 19.8 15.2 17 18C14.2 20.8 9.8 20.8 7 18C4.2 15.2 4.2 10.8 7 8ZM7.5 8.5L17 18M16.5 8.5L7 18" },
  "Барилгын дэлгүүр": { from: "#ca8a04", to: "#475569", icon: "M6 18L14.5 9.5L12.5 7.5L15 5L19 9L16.5 11.5L14.5 9.5L6 18ZM5 19H12" },
  "Хүүхдийн бараа": { from: "#f59e0b", to: "#38bdf8", icon: "M8 12C8 9.8 9.8 8 12 8C14.2 8 16 9.8 16 12C16 14.2 14.2 16 12 16C9.8 16 8 14.2 8 12ZM7 7L9 5M17 7L15 5M9 18H15" },
  "Амьтны бараа": { from: "#78350f", to: "#f59e0b", icon: "M8 12C7 11 6 10.2 5 11.1C4.1 12 5 13.4 6.5 13.8C6.8 16.8 9.2 19 12 19C14.8 19 17.2 16.8 17.5 13.8C19 13.4 19.9 12 19 11.1C18 10.2 17 11 16 12M9.5 12H9.6M14.4 12H14.5M10.5 15C11.3 15.6 12.7 15.6 13.5 15" },
};

function storeLogoDataUrl(name: string, category?: string) {
  const palette = storeLogoPalettes[category ?? ""] ?? { from: "#0f172a", to: "#f97316", icon: "M5 9H19V19H5V9ZM7 5H17L19 9H5L7 5ZM9 13H15" };
  const seed = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="10" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.from}"/><stop offset="1" stop-color="${palette.to}"/></linearGradient><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#0f172a" flood-opacity=".22"/></filter></defs><rect width="64" height="64" rx="18" fill="url(#g)"/><circle cx="${18 + (seed % 14)}" cy="${16 + (seed % 10)}" r="18" fill="#fff" opacity=".16"/><path d="${palette.icon}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#s)"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function storeBrandFor(name: string, category?: string) {
  const normalizedName = name.toLowerCase();
  return storeBrands.find((brand) => brand.match.some((keyword) => normalizedName.includes(keyword)))
    ?? { logoUrl: storeLogoDataUrl(name, category) };
}

function productImageFor(product: Pick<Product, "name" | "category" | "imageUrl">) {
  if (product.imageUrl) return product.imageUrl;
  return productPhotoUrl(productImageKeyword(product));
}

function productPhotoUrl(keyword: string) {
  const query = encodeURIComponent(`${keyword} ecommerce product photo isolated`);
  return `https://tse4.mm.bing.net/th?q=${query}&w=900&h=650&c=7&rs=1&p=0`;
}

function productPlaceholderUrl(product: Pick<Product, "name" | "category">) {
  const label = encodeURIComponent(product.name.replace(/\s+/g, " ").trim());
  return `https://placehold.co/900x650/png?text=${label}`;
}

function stableStockCount(seed: string) {
  return Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 17) % 101;
}

function marketCategoryMatches(category: string, filter: string) {
  if (filter === "Бүгд") return true;
  const directMatches = groupedMarketCategories[filter] ?? [];
  if (directMatches.includes(category)) return true;
  if (filter !== "Бусад") return false;

  return !Object.values(groupedMarketCategories).some((categories) => categories.includes(category));
}

function normalizeMarketSearch(value: string) {
  return value.trim().toLocaleLowerCase("mn");
}

function marketFilterForCategory(category: string) {
  return marketCategoryFilters.find((filter) => filter !== "Бүгд" && filter !== "Бусад" && marketCategoryMatches(category, filter)) ?? "Бусад";
}

function primaryMarketFilterForStore(store: StoreDirectoryItem) {
  const primaryCategory = store.categories[0] ?? store.products[0]?.category ?? "";
  return marketFilterForCategory(primaryCategory);
}

function storeMatchesMarketFilter(store: StoreDirectoryItem, filter: string) {
  return filter === "Бүгд" || primaryMarketFilterForStore(store) === filter;
}

function storeMatchesMarketSearch(store: StoreDirectoryItem, search: string) {
  if (!search) return true;
  const searchTokens = search.split(/\s+/).filter(Boolean);
  const brandAliases = storeBrands
    .filter((brand) => brand.match.some((keyword) => normalizeMarketSearch(store.name).includes(normalizeMarketSearch(keyword))))
    .flatMap((brand) => brand.match);
  const searchableText = [
    store.name,
    store.description,
    store.address,
    primaryMarketFilterForStore(store),
    ...brandAliases,
    ...store.categories,
    ...store.products.map((product) => product.category),
    ...store.products.map((product) => product.name),
  ].join(" ");

  const normalizedText = normalizeMarketSearch(searchableText);
  return searchTokens.every((token) => normalizedText.includes(token));
}

const marketTemplates = [
  { category: "Хүнс", stores: ["Номин Супермаркет", "Carrefour", "M Mart", "eMart", "Good Price Market"], products: [["Цагаан будаа", "rice bag"], ["Гурил", "flour"], ["Сүү", "milk bottle"], ["Өндөг", "eggs carton"], ["Алим", "apples"], ["Төмс", "potatoes"], ["Лууван", "carrots"], ["Үхрийн мах", "beef meat"], ["Тахианы мах", "chicken breast"], ["Бяслаг", "cheese"]] },
  { category: "24/7 дэлгүүр", stores: ["CU Mongolia", "GS25 Mongolia", "Circle K", "M Mart Express", "Номин Convenience"], products: [["Сэндвич", "sandwich"], ["Кимбап", "kimbap"], ["Рамен", "instant ramen"], ["Ус", "water bottle"], ["Кола", "cola can"], ["Чипс", "potato chips"], ["Шоколад", "chocolate bar"], ["Зайрмаг", "ice cream"], ["Салат", "fresh salad"], ["Бэлэн хоол", "ready meal"]] },
  { category: "Гэр ахуй", stores: ["IKEA", "JYSK", "Home Plaza", "Номин Home", "Kitchen House"], products: [["Тавагны сет", "dinnerware"], ["Аяга", "mug"], ["Хайруулын таваг", "frying pan"], ["Сав суулга", "cookware"], ["Хутганы сет", "kitchen knife"], ["Алчуур", "towel"], ["Орны даавуу", "bed sheets"], ["Дэр", "pillow"], ["Сагс", "storage basket"], ["Цэвэрлэгээний багц", "cleaning supplies"]] },
  { category: "Цахилгаан бараа", stores: ["Next Electronics", "PC Mall", "BSB Electronics", "Номин Electronics", "Shoppy"], products: [["Чихэвч", "headphones"], ["Speaker", "bluetooth speaker"], ["Phone case", "phone case"], ["Цэнэглэгч", "phone charger"], ["Power bank", "power bank"], ["Keyboard", "keyboard"], ["Mouse", "computer mouse"], ["Web camera", "webcam"], ["Smart watch", "smart watch"], ["Desk lamp", "desk lamp"]] },
  { category: "Гар утас", stores: ["Mobicom Store", "Unitel Store", "iStore Mongolia", "Samsung Store", "Next Mobile"], products: [["iPhone 15", "iphone 15"], ["Samsung Galaxy", "samsung galaxy phone"], ["Android утас", "android smartphone"], ["Дугаарын eSIM", "esim card"], ["Утасны шил", "phone screen protector"], ["Утасны гэр", "phone case"], ["Цэнэглэгч адаптер", "phone charger adapter"], ["USB-C кабель", "usb c cable"], ["Wireless charger", "wireless phone charger"], ["Power bank", "power bank"]] },
  { category: "Таблет", stores: ["Tablet Zone", "iPad Center", "Digital Mall", "Tech Hub", "Smart Store"], products: [["iPad", "ipad tablet"], ["Samsung Tab", "samsung tablet"], ["Android таблет", "android tablet"], ["Tablet keyboard", "tablet keyboard"], ["Tablet pen", "tablet stylus"], ["Tablet case", "tablet case"], ["Дэлгэц хамгаалагч", "tablet screen protector"], ["Цэнэглэгч", "tablet charger"], ["Drawing tablet", "drawing tablet"], ["Kids tablet", "kids tablet"]] },
  { category: "Дагалдах хэрэгсэл", stores: ["Accessory Hub", "Phone Center", "Gadget Corner", "Digital Mall", "Cable House"], products: [["Чихэвч", "earbuds"], ["Bluetooth speaker", "bluetooth speaker"], ["Утасны гэр", "phone case"], ["Дэлгэц хамгаалагч", "screen protector"], ["USB-C кабель", "usb c cable"], ["Power bank", "power bank"], ["Tripod", "phone tripod"], ["Car holder", "phone car holder"], ["Memory card", "memory card"], ["Adapter", "phone adapter"]] },
  { category: "Хувцас", stores: ["Fashion Hub", "Urban Wear", "Kids Fashion", "Daily Outfit", "Style Market"], products: [["Футболк", "t shirt clothing"], ["Цамц", "shirt clothing"], ["Өмд", "pants clothing"], ["Куртик", "jacket clothing"], ["Даашинз", "dress clothing"], ["Пүүз", "sneakers"], ["Малгай", "cap hat"], ["Ороолт", "scarf"], ["Хүүхдийн хувцас", "kids clothes"], ["Спорт хувцас", "sportswear"]] },
  { category: "Эмийн сан", stores: ["Monos", "eMonos", "Asia Pharma", "Аптека 24", "Health Care"], products: [["Витамин C", "vitamin c"], ["Витамин D", "vitamin d"], ["Дархлаа дэмжигч", "supplements"], ["Гар ариутгагч", "hand sanitizer"], ["Маск", "medical mask"], ["Шархны наалт", "bandage"], ["Даралт хэмжигч", "blood pressure monitor"], ["Халуун хэмжигч", "thermometer"], ["Нүдний дусаалга", "eye drops"], ["Омега 3", "omega 3"]] },
  { category: "Цэцгийн дэлгүүр", stores: ["Flower House", "Tsetseg Shop", "Bloom Studio", "Rose Market", "Garden Gift"], products: [["Сарнайн баглаа", "rose bouquet"], ["Лили цэцэг", "lily bouquet"], ["Алтанзул", "tulip bouquet"], ["Орхидей", "orchid flower"], ["Хайрцагтай цэцэг", "flower box"], ["Төрсөн өдрийн баглаа", "birthday flowers"], ["Хуримын баглаа", "wedding bouquet"], ["Тасалгааны ургамал", "indoor plant"], ["Кактус", "cactus plant"], ["Бэлгийн багц", "flower gift set"]] },
  { category: "Гоо сайхан", stores: ["Lhamour", "Sephora", "Yves Rocher", "Beauty Box", "Glow Market"], products: [["Уруулын будаг", "lipstick"], ["Mascara", "mascara"], ["Суурь крем", "foundation makeup"], ["Нүүр цэвэрлэгч", "facial cleanser"], ["Чийгшүүлэгч", "moisturizer"], ["Үнэртэй ус", "perfume"], ["Шампунь", "shampoo"], ["Нүүрний маск", "face mask skincare"], ["Хумсны будаг", "nail polish"], ["Serum", "face serum"]] },
  { category: "Ном, бичиг хэрэг", stores: ["Book Nest", "Аз Хур Ном", "Stationery Pro", "Student Shop", "Paper House"], products: [["Уран зохиолын ном", "novel books"], ["Хүүхдийн ном", "children book"], ["Дэвтэр", "notebook"], ["Бал", "pen"], ["Харандаа", "pencils"], ["Файл хавтас", "file folder"], ["A4 цаас", "printer paper"], ["Marker", "markers"], ["Зургийн дэвтэр", "sketchbook"], ["Календарь", "calendar"]] },
  { category: "Спорт бараа", stores: ["Sport Zone", "Fit Market", "Outdoor Pro", "Bike House", "Active Gear"], products: [["Гүйлтийн пүүз", "running shoes"], ["Иогийн дэвсгэр", "yoga mat"], ["Дамббелл", "dumbbells"], ["Усны сав", "sports water bottle"], ["Хөл бөмбөг", "football ball"], ["Сагсан бөмбөг", "basketball"], ["Дугуйн дуулга", "bike helmet"], ["Спорт цүнх", "gym bag"], ["Майхан", "camping tent"], ["Уулын гутал", "hiking boots"]] },
  { category: "Барилгын дэлгүүр", stores: ["Build Mart", "Barilga Center", "Tool House", "Material Plus", "Home Build"], products: [["Цемент", "cement bag"], ["Будаг", "paint bucket"], ["Плита", "ceramic tile"], ["Шруп", "screws"], ["Алх", "hammer tool"], ["Өрөм", "electric drill"], ["Хэмжигч метр", "measuring tape"], ["Ажлын бээлий", "work gloves"], ["Цавуу", "construction adhesive"], ["Сантехникийн хоолой", "plumbing pipe"]] },
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
    "Гар утас": "smartphone product",
    "Таблет": "tablet product",
    "Дагалдах хэрэгсэл": "phone accessories product",
    "Хувцас": "fashion clothing product",
    "Эмийн сан": "pharmacy product",
    "Цэцгийн дэлгүүр": "flower bouquet",
    "Гоо сайхан": "beauty product",
    "Ном, бичиг хэрэг": "books stationery",
    "Спорт бараа": "sports gear",
    "Барилгын дэлгүүр": "construction hardware store product",
    "Хүүхдийн бараа": "baby product",
    "Амьтны бараа": "pet product",
  };
  return categoryKeywords[product.category] ?? "product";
}

function productImageKeyword(product: Pick<Product, "name" | "category">) {
  const exactName = product.name.replace(/\s+/g, " ").trim();
  const baseKeyword = keywordForProduct(product);
  return `${exactName} ${baseKeyword} ${product.category}`.trim();
}

function productNameVariant(category: string, baseName: string, index: number) {
  const variantsByCategory: Record<string, string[]> = {
    "Хүнс": ["500г", "1кг", "2кг", "5кг", "багц"],
    "24/7 дэлгүүр": ["дан", "комбо", "том", "дунд", "2ш"],
    "Гэр ахуй": ["цагаан", "саарал", "хар", "дунд", "сет"],
    "Цахилгаан бараа": ["хар", "цагаан", "compact", "pro", "type-c"],
    "Гар утас": ["128GB", "256GB", "хар", "цагаан", "pro"],
    "Таблет": ["wifi", "LTE", "64GB", "128GB", "pen-тэй"],
    "Дагалдах хэрэгсэл": ["хар", "цагаан", "type-c", "wireless", "сет"],
    "Хувцас": ["S", "M", "L", "XL", "хар"],
    "Эмийн сан": ["30ш", "60ш", "100мл", "250мл", "багц"],
    "Цэцгийн дэлгүүр": ["жижиг", "дунд", "том", "premium", "бэлгийн"],
    "Гоо сайхан": ["01", "02", "03", "50мл", "100мл"],
    "Ном, бичиг хэрэг": ["A4", "A5", "хатуу хавтастай", "зөөлөн хавтастай", "12ш"],
    "Спорт бараа": ["S", "M", "L", "XL", "багц"],
    "Барилгын дэлгүүр": ["жижиг", "дунд", "том", "5кг", "сет"],
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
      if (isNominStoreName(storeName)) {
        return syncedNominStore({ id, orderCount: 20 + templateIndex * 7 + storeIndex * 3 });
      }

      const products = Array.from({ length: 50 }, (_, index) => {
        const [baseName] = template.products[index % template.products.length];
        const name = cleanProductName(productNameVariant(template.category, baseName, index));
        const imageKeyword = productImageKeyword({ name, category: template.category });
        return {
          id: `${id}-product-${index + 1}`,
          name,
          category: template.category,
          priceMnt: String(1800 + (index + 1) * 420 + templateIndex * 500 + storeIndex * 300),
          weightGrams: 180 + (index % 12) * 150,
          imageUrl: productPhotoUrl(imageKeyword),
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

function marketStorePriority(store: StoreDirectoryItem) {
  const normalizedName = store.name.toLowerCase();
  if (normalizedName === "номин маркет" || normalizedName === "nomin market") return 0;
  if (normalizedName.includes("номин") || normalizedName.includes("nomin")) return 1;
  return 2;
}

function storeKey(store: Pick<StoreDirectoryItem, "name">) {
  return store.name.trim().toLowerCase();
}

function isExcludedMarketStore(name: string) {
  const normalizedName = normalizeMarketSearch(name);
  return [
    "оргил хүнс",
    "orgil huns",
    "fresh mart",
    "minii delguur",
    "миний дэлгүүр",
    "сансар сүлжээ",
    "sansar",
  ].some((keyword) => normalizedName.includes(keyword));
}

function isNominStoreName(name: string) {
  const normalizedName = name.trim().toLowerCase();
  return normalizedName.includes("номин") || normalizedName.includes("nomin");
}

const nominFeaturedProductOrder = [
  "Lays chips",
  "Maxfun",
  "Snickers",
  "Зайрмаг",
  "Кола",
  "Газтай ус",
  "Minute Maid",
  "Кофе",
  "Ногоон цай",
  "Ус",
  "Йогурт",
  "Самар",
  "Үзэм",
  "Зөгийн бал",
  "Сүү",
  "Corn flakes",
];

const nominFeaturedImages = [
  { match: "Maxfun", imageUrl: "https://tse4.mm.bing.net/th?q=Alpen%20Gold%20Max%20Fun%20chocolate%20160g%20product&w=1000&h=650&c=7&rs=1&p=0" },
  { match: "Lays chips", imageUrl: "https://tse4.mm.bing.net/th?q=Lay%27s%20Masala%20chips%20bag%20product&w=1000&h=650&c=7&rs=1&p=0" },
  { match: "Snickers", imageUrl: "https://tse4.mm.bing.net/th?q=Snickers%20chocolate%20bar%20product&w=1000&h=650&c=7&rs=1&p=0" },
  { match: "Зайрмаг", imageUrl: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=1000&q=92" },
  { match: "Кола", imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=1000&q=92" },
  { match: "Газтай ус", imageUrl: "https://tse4.mm.bing.net/th?q=sparkling%20water%20bottle%20product%20photo&w=1000&h=650&c=7&rs=1&p=0" },
  { match: "Minute Maid", imageUrl: "https://tse4.mm.bing.net/th?q=Minute%20Maid%201.25L%20juice%20bottle%20product&w=1000&h=650&c=7&rs=1&p=0" },
  { match: "Кофе", imageUrl: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1000&q=92" },
  { match: "Ногоон цай", imageUrl: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=1000&q=92" },
  { match: "Ус", imageUrl: "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1000&q=92" },
  { match: "Йогурт", imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1000&q=92" },
  { match: "Самар", imageUrl: "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=1000&q=92" },
  { match: "Үзэм", imageUrl: "https://tse4.mm.bing.net/th?q=raisins%20package%20product%20photo&w=1000&h=650&c=7&rs=1&p=0" },
  { match: "Зөгийн бал", imageUrl: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1000&q=92" },
  { match: "Сүү", imageUrl: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=1000&q=92" },
  { match: "Corn flakes", imageUrl: "https://images.unsplash.com/photo-1521483451569-e33803c0330c?auto=format&fit=crop&w=1000&q=92" },
];

function nominProductDisplayRank(product: { name: string; category: string }) {
  const name = cleanProductName(product.name);
  const category = fixMojibake(product.category);
  const nameRank = nominFeaturedProductOrder.findIndex((keyword) => name.toLocaleLowerCase("mn").includes(keyword.toLocaleLowerCase("mn")));
  if (nameRank >= 0) return nameRank;
  const categoryRank = ["Амттан", "Ундаа", "Сүү"].findIndex((keyword) => category.includes(keyword));
  return categoryRank >= 0 ? nominFeaturedProductOrder.length + categoryRank : 100;
}

function nominProductImage(product: { name: string; imageUrl: string }) {
  const name = cleanProductName(product.name);
  return nominFeaturedImages.find((item) => name.includes(item.match))?.imageUrl ?? product.imageUrl;
}

function syncedNominStore(base?: Partial<StoreDirectoryItem>): StoreDirectoryItem {
  const products = [...nominCatalogProducts].sort((first, second) => (
    nominProductDisplayRank(first) - nominProductDisplayRank(second)
    || second.priceMnt - first.priceMnt
  )).map((product) => ({
    id: product.sku,
    name: product.name,
    category: product.category,
    priceMnt: String(product.priceMnt),
    weightGrams: product.weightGrams,
    imageUrl: nominProductImage(product),
    stockCount: product.stockCount,
  }));

  return {
    id: base?.id || nominStoreProfile.id,
    name: nominStoreProfile.name,
    description: nominStoreProfile.description,
    address: nominStoreProfile.address,
    coverUrl: products[0]?.imageUrl ?? "",
    productCount: products.length,
    orderCount: base?.orderCount ?? 0,
    categories: ["Хүнс", ...[...new Set(products.map((product) => product.category))].filter((category) => category !== "Хүнс")],
    products,
  };
}

function fillStoreProducts(store: StoreDirectoryItem, fallback?: StoreDirectoryItem): StoreDirectoryItem {
  if (isNominStoreName(store.name)) {
    return syncedNominStore(store);
  }

  if (!fallback || store.products.length >= 50) {
    return { ...store, productCount: store.products.length };
  }

  const existingIds = new Set(store.products.map((product) => product.id));
  const fillerProducts = fallback.products.filter((product) => !existingIds.has(product.id));
  const products = [...store.products, ...fillerProducts].slice(0, 50);
  return {
    ...store,
    coverUrl: store.coverUrl || fallback.coverUrl || products[0]?.imageUrl || "",
    productCount: products.length,
    products,
  };
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
  { id: "foot", label: "Явган", copy: "Ойрын хүргэлтэд тохиромжтой", base: 3600, perKm: 1400, perKg: 360, speedKmh: 4 },
  { id: "bike", label: "Мопед", copy: "Хамгийн хурдан сонголт", base: 5000, perKm: 1800, perKg: 280, speedKmh: 18 },
  { id: "car", label: "Машин", copy: "Том захиалгад найдвартай", base: 8400, perKm: 2400, perKg: 220, speedKmh: 28 },
];

function formatMnt(value: number | string) {
  return `₮${Number(value || 0).toLocaleString("mn-MN")}`;
}

function qpayQrImageSource(qrImage?: string) {
  const value = qrImage?.trim().replace(/\s/g, "");
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;
  if (value.startsWith("image/") && value.includes("base64,")) return `data:${value}`;
  if (value.startsWith("<svg")) return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(qrImage ?? "")}`;
  if (value.startsWith("PHN2Zy")) return `data:image/svg+xml;base64,${value}`;
  if (value.startsWith("/9j/")) return `data:image/jpeg;base64,${value}`;
  return `data:image/png;base64,${value}`;
}

function normalizeQpayBankText(value?: string) {
  return (value ?? "").toLowerCase().replace(/\s|_|-|\.|банк|bank/g, "");
}

function qpayBankLinkFor(
  urls: QpayPaymentState["urls"] = [],
  bank: { aliases: string[] },
) {
  return urls.find((url) => {
    const text = normalizeQpayBankText([url.name, url.description, url.link].filter(Boolean).join(" "));
    return bank.aliases.some((alias) => text.includes(normalizeQpayBankText(alias)));
  });
}

type LocationSuggestion = {
  id: string;
  label: string;
  detail: string;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  neighbourhood?: string;
  suburb?: string;
  district?: string;
  city?: string;
  town?: string;
  state?: string;
  country?: string;
};

type NominatimPlace = {
  place_id?: number;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  address?: NominatimAddress;
};

function compactAddressName(place: NominatimPlace) {
  const address = place.address ?? {};
  return [
    address.road ?? address.pedestrian ?? address.footway ?? place.name,
    address.neighbourhood ?? address.suburb ?? address.district,
    address.city ?? address.town,
  ].filter(Boolean).join(", ");
}

function locationSuggestionFromPlace(place: NominatimPlace, fallbackId: string): LocationSuggestion | null {
  const label = compactAddressName(place) || place.display_name?.split(",").slice(0, 2).join(", ").trim();
  const detail = place.display_name?.trim() ?? "";
  if (!label && !detail) return null;

  return {
    id: String(place.place_id ?? fallbackId),
    label: label || detail,
    detail,
  };
}

async function fetchLocationSuggestions(location: GeoLocation) {
  const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
  reverseUrl.searchParams.set("format", "jsonv2");
  reverseUrl.searchParams.set("lat", String(location.latitude));
  reverseUrl.searchParams.set("lon", String(location.longitude));
  reverseUrl.searchParams.set("addressdetails", "1");
  reverseUrl.searchParams.set("accept-language", "mn,en");

  const reverseResponse = await fetch(reverseUrl.toString());
  if (!reverseResponse.ok) throw new Error("reverse geocode failed");
  const reversePlace = await reverseResponse.json() as NominatimPlace;
  const reverseSuggestion = locationSuggestionFromPlace(reversePlace, "gps");

  const searchSeed = compactAddressName(reversePlace).split(",")[0]?.trim();
  const searchSuggestions: LocationSuggestion[] = [];

  if (searchSeed) {
    const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
    searchUrl.searchParams.set("format", "jsonv2");
    searchUrl.searchParams.set("q", `${searchSeed}, Ulaanbaatar`);
    searchUrl.searchParams.set("addressdetails", "1");
    searchUrl.searchParams.set("limit", "5");
    searchUrl.searchParams.set("accept-language", "mn,en");
    const delta = 0.018;
    searchUrl.searchParams.set("viewbox", [
      location.longitude - delta,
      location.latitude + delta,
      location.longitude + delta,
      location.latitude - delta,
    ].join(","));
    searchUrl.searchParams.set("bounded", "1");

    const searchResponse = await fetch(searchUrl.toString());
    if (searchResponse.ok) {
      const places = await searchResponse.json() as NominatimPlace[];
      searchSuggestions.push(...places
        .map((place, index) => locationSuggestionFromPlace(place, `nearby-${index}`))
        .filter((suggestion): suggestion is LocationSuggestion => Boolean(suggestion)));
    }
  }

  return [reverseSuggestion, ...searchSuggestions]
    .filter((suggestion): suggestion is LocationSuggestion => Boolean(suggestion))
    .filter((suggestion, index, suggestions) => suggestions.findIndex((item) => item.label === suggestion.label) === index)
    .slice(0, 5);
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
    .replace(/(^|\s)(шинээр нэмэгдсэн|шинээр нэмсэн)(?=\s|$)/gi, " ")
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

function isJwtUsable(token: string | null) {
  if (!token) return false;

  try {
    const [, payload] = token.split(".");
    if (!payload) return false;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof decoded.exp === "number" && decoded.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function clearCustomerSessionStorage() {
  localStorage.removeItem(tokenStorageKey);
  localStorage.removeItem(customerStorageKey);
}

export function PublicLanding({ page = "home", onNavigateHome, onNavigateMarket, onNavigateContact, onNavigateCourier, onNavigatePartner }: PublicLandingProps = {}) {
  const [section, setSection] = useState<LandingSection>(page);
  const [menuHidden, setMenuHidden] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const cartPanelRef = useRef<HTMLElement | null>(null);
  const cartReturnRef = useRef<{ section: LandingSection; scrollY: number }>({ section: page, scrollY: 0 });
  const paymentSuccessTimerRef = useRef<number | null>(null);
  const qpayPanelRef = useRef<HTMLElement | null>(null);
  const customerAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const showcaseRef = useRef<HTMLElement | null>(null);
  const [showcaseProgress, setShowcaseProgress] = useState(0);
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
  const [partnerFormStep, setPartnerFormStep] = useState(0);
  const [partnerVerification, setPartnerVerification] = useState({
    bankId: "" as QpayBankId | "",
    bankAccountNumber: "",
    businessLicenseFile: null as File | null,
    idType: "civil" as "civil" | "passport",
    idFrontFile: null as File | null,
    idBackFile: null as File | null,
    livePhotoDataUrl: "",
  });
  const [partnerCameraActive, setPartnerCameraActive] = useState(false);
  const [partnerCameraError, setPartnerCameraError] = useState("");
  const [partnerAgreementAccepted, setPartnerAgreementAccepted] = useState(false);
  const partnerVideoRef = useRef<HTMLVideoElement | null>(null);
  const partnerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const partnerStreamRef = useRef<MediaStream | null>(null);
  const [session, setSession] = useState<CustomerSession | null>(() => {
    const token = localStorage.getItem(tokenStorageKey);
    const customer = localStorage.getItem(customerStorageKey);
    if (!token || !customer || !isJwtUsable(token)) {
      clearCustomerSessionStorage();
      return null;
    }

    try {
      return { token, customer: JSON.parse(customer) };
    } catch {
      clearCustomerSessionStorage();
      return null;
    }
  });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ fullName: "", email: "", phone: "" });
  const [profileSettings, setProfileSettings] = useState({
    orderUpdates: true,
    promoUpdates: false,
    compactProfile: false,
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
  const [selectedQpayBank, setSelectedQpayBank] = useState<QpayBankId>("khanbank");
  const [qpayAppsOpen, setQpayAppsOpen] = useState(false);
  const [stores, setStores] = useState<StoreDirectoryItem[]>([]);
  const [storeSearch, setStoreSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("Хүнс");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [marketPage, setMarketPage] = useState(1);
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("bike");
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [addressText, setAddressText] = useState("");
  const [addressUnit, setAddressUnit] = useState("");
  const [addressLabel, setAddressLabel] = useState("Одоогийн байршил");
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [notice, setNotice] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [qpayPayment, setQpayPayment] = useState<QpayPaymentState | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [storesLoading, setStoresLoading] = useState(false);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderHistoryTab, setOrderHistoryTab] = useState<"active" | "completed">("active");
  const [seenOrderKey, setSeenOrderKey] = useState(() => localStorage.getItem(orderSeenStorageKey) ?? "");

  useEffect(() => {
    setSection(page);
    setMenuHidden(false);
  }, [page]);

  useEffect(() => {
    if (!partnerAuthOpen) {
      setPartnerFormStep(0);
      setPartnerVerification({
        bankId: "",
        bankAccountNumber: "",
        businessLicenseFile: null,
        idType: "civil",
        idFrontFile: null,
        idBackFile: null,
        livePhotoDataUrl: "",
      });
      setPartnerCameraError("");
      setPartnerAgreementAccepted(false);
      stopPartnerCamera();
    }

    return () => stopPartnerCamera();
  }, [partnerAuthOpen]);

  useEffect(() => {
    if (!session) {
      setProfileEditing(false);
      setProfileDraft({ fullName: "", email: "", phone: "" });
      setCheckoutEmail("");
      setCheckoutPhone("");
      return;
    }

    setProfileDraft({
      fullName: session.customer.fullName,
      email: session.customer.email ?? "",
      phone: session.customer.phone,
    });
    setCheckoutEmail("");
    setCheckoutPhone("");
  }, [session]);

  useEffect(() => {
    if (!session) {
      localStorage.removeItem(wishlistStorageKey);
      return;
    }

    localStorage.setItem(wishlistStorageKey, JSON.stringify(wishlist));
  }, [session, wishlist]);

  useEffect(() => {
    if (session) return;

    setCart({});
    setWishlist([]);
    setTracking(null);
    setOrderHistory([]);
    setSeenOrderKey("");
    setCartOpen(false);
    setWishlistOpen(false);
    setProfileOpen(false);
    setTrackingOpen(false);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const customerKey = `${orderSeenStorageKey}:${session.customer.id}`;
    setSeenOrderKey(localStorage.getItem(customerKey) ?? "");
  }, [session?.customer.id]);

  function changeCustomerAvatar(file: File | null) {
    if (!session || !file) return;

    if (file.size > 600 * 1024) {
      setNotice("Зураг 600KB-аас бага байх хэрэгтэй.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const avatarDataUrl = String(reader.result ?? "");
      if (!avatarDataUrl) return;

      setSession((current) => {
        if (!current) return current;
        const nextSession: CustomerSession = { ...current, customer: { ...current.customer, avatarDataUrl } };
        localStorage.setItem(customerStorageKey, JSON.stringify(nextSession.customer));
        return nextSession;
      });
    };
    reader.readAsDataURL(file);
  }

  function saveCustomerProfile() {
    if (!session) return;

    const nextSession: CustomerSession = {
      ...session,
      customer: {
        ...session.customer,
        fullName: profileDraft.fullName.trim() || session.customer.fullName,
        email: profileDraft.email.trim() || undefined,
        phone: profileDraft.phone.trim() || session.customer.phone,
      },
    };

    setSession(nextSession);
    localStorage.setItem(customerStorageKey, JSON.stringify(nextSession.customer));
    setProfileEditing(false);
    setNotice("Профайл шинэчлэгдлээ.");
  }

  function openProfileOrders() {
    if (!session) return;

    setMenuHidden(false);
    setCartOpen(false);
    setWishlistOpen(false);
    setProfileOpen(false);
    if (latestOrderKey) {
      const customerKey = `${orderSeenStorageKey}:${session.customer.id}`;
      localStorage.setItem(customerKey, latestOrderKey);
      localStorage.setItem(orderSeenStorageKey, latestOrderKey);
      setSeenOrderKey(latestOrderKey);
    }
    setTrackingOpen((open) => !open);
  }

  useEffect(() => {
    if (!cartOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setCheckoutEmail("");
    setCheckoutPhone("");
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
    }, 3000);

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
    let frameId = 0;

    function updateScrollProgress() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        const nextProgress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
        setScrollProgress(Math.min(1, Math.max(0, nextProgress)));
      });
    }

    updateScrollProgress();
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("resize", updateScrollProgress);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("resize", updateScrollProgress);
    };
  }, [section]);

  useEffect(() => {
    if (section !== "home") return undefined;
    let frameId = 0;

    function updateShowcaseProgress() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const node = showcaseRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        const nextProgress = travel > 0 ? -rect.top / travel : 0;
        setShowcaseProgress(Math.min(1, Math.max(0, nextProgress)));
      });
    }

    updateShowcaseProgress();
    window.addEventListener("scroll", updateShowcaseProgress, { passive: true });
    window.addEventListener("resize", updateShowcaseProgress);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateShowcaseProgress);
      window.removeEventListener("resize", updateShowcaseProgress);
    };
  }, [section]);

  useEffect(() => {
    if (!session?.token) return;
    const token = session.token;
    let closed = false;
    let socket: WebSocket | null = null;

    async function refreshOrders() {
      try {
        const [currentOrder, history] = await Promise.all([
          apiGet<TrackingResponse | null>("/customer/orders/current/tracking", token),
          apiGet<OrderHistoryResponse>("/customer/orders/history", token),
        ]);
        if (!closed) {
          setTracking(currentOrder);
          setOrderHistory(history.items ?? []);
        }
      } catch {
        if (!closed) {
          setTracking(null);
          setOrderHistory([]);
        }
      }
    }

    void refreshOrders();
    if (customerRealtimeUrl) {
      socket = new WebSocket(customerRealtimeUrl);
      socket.addEventListener("message", (message) => {
        const payload = JSON.parse(String(message.data)) as { event?: string };
        if (payload.event === "customer.tracking.refresh") void refreshOrders();
      });
    }
    const intervalId = window.setInterval(refreshOrders, 5000);
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
          pageSize: "100",
        });
        const result = await apiGet<StoreDirectoryResponse>(`/customer/stores?${params.toString()}`, token);
        if (!closed) {
          setStores(result.items.map(cleanStoreItem));
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
  }, [section, session?.token]);

  useEffect(() => {
    setMarketPage(1);
  }, [storeFilter, productSearch]);

  const demoMarketStores = useMemo(buildDemoMarketStores, []);
  const marketStoreDirectory = useMemo(() => {
    const fallbackByName = new Map(demoMarketStores.map((store) => [storeKey(store), store]));
    const realStores = stores
      .filter((store) => !isExcludedMarketStore(store.name))
      .map((store) => fillStoreProducts(store, fallbackByName.get(storeKey(store))));
    const realStoreNames = new Set(realStores.map(storeKey));
    const supplementalStores = demoMarketStores.filter((store) => !isExcludedMarketStore(store.name) && !realStoreNames.has(storeKey(store)));
    return [...realStores, ...supplementalStores].sort((first, second) => {
      const priorityCompare = marketStorePriority(first) - marketStorePriority(second);
      if (priorityCompare) return priorityCompare;
      const categoryCompare = (first.categories[0] ?? "").localeCompare(second.categories[0] ?? "", "mn");
      return categoryCompare || first.name.localeCompare(second.name, "mn");
    }).slice(0, 100);
  }, [demoMarketStores, stores]);
  const filteredStores = useMemo(() => {
    const normalizedSearch = normalizeMarketSearch(storeSearch);
    return marketStoreDirectory.filter((store) => (
      (normalizedSearch || storeMatchesMarketFilter(store, storeFilter))
      && storeMatchesMarketSearch(store, normalizedSearch)
    )).sort((first, second) => {
      const priorityCompare = marketStorePriority(first) - marketStorePriority(second);
      if (priorityCompare) return priorityCompare;
      const categoryCompare = (first.categories[0] ?? "").localeCompare(second.categories[0] ?? "", "mn");
      return categoryCompare || first.name.localeCompare(second.name, "mn");
    });
  }, [marketStoreDirectory, storeFilter, storeSearch]);
  const selectedStore = filteredStores.find((store) => store.id === selectedStoreId) ?? filteredStores[0] ?? null;
  const storeProductGroups = useMemo(() => {
    const normalizedProductSearch = productSearch.trim().toLowerCase();
    const activeStores = selectedStore ? [selectedStore] : [];
    return activeStores.map((store) => ({
      store,
      storeIndex: filteredStores.findIndex((item) => item.id === store.id),
      products: store.products.map((product) => ({
          id: product.id,
          sku: product.id.slice(-8),
          name: cleanProductName(product.name),
          category: product.category,
          priceMnt: Number(product.priceMnt),
          weightGrams: product.weightGrams,
          stockCount: product.stockCount ?? stableStockCount(product.id),
          description: `${store.name} - ${product.category.toLowerCase()} ангилал.`,
          imageUrl: product.imageUrl || productPhotoUrl(productImageKeyword(product)),
          storeId: store.id,
          storeName: store.name,
        })).filter((product) => (
          !normalizedProductSearch
          || product.name.toLowerCase().includes(normalizedProductSearch)
          || product.category.toLowerCase().includes(normalizedProductSearch)
          || store.name.toLowerCase().includes(normalizedProductSearch)
        )),
    })).filter((group) => group.products.length > 0);
  }, [filteredStores, productSearch, selectedStore]);
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
    () => (session ? allMarketProducts.filter((product) => wishlist.includes(product.id)) : []),
    [allMarketProducts, session, wishlist],
  );
  const subtotal = selectedItems.reduce((sum, product) => sum + product.priceMnt * product.quantity, 0);
  const cartItemCount = Object.values(cart).reduce((sum, quantity) => sum + Math.max(0, quantity), 0);
  const latestOrderKey = tracking?.orderNo ?? orderHistory[0]?.orderNo ?? "";
  const unseenOrderCount = latestOrderKey && latestOrderKey !== seenOrderKey ? 1 : 0;
  const weightKg = Math.round(selectedItems.reduce((sum, product) => sum + product.weightGrams * product.quantity, 0) / 100) / 10;
  const activeDelivery = deliveryOptions.find((option) => option.id === deliveryType) ?? deliveryOptions[0];
  const customerLocation = location ?? { latitude: 47.9212, longitude: 106.9186 };
  const km = distanceKm(storeLocation, customerLocation);
  const deliveryFee = Math.round(activeDelivery.base + km * activeDelivery.perKm + weightKg * activeDelivery.perKg);
  const etaMinutes = Math.max(12, Math.round((km / activeDelivery.speedKmh) * 60 + 10));
  const qpayMerchantName = selectedItems[0]?.storeName ?? selectedStore?.name ?? "DeliverHub market";
  const qpayQrSrc = qpayQrImageSource(qpayPayment?.qrImage);
  const selectedQpayBankOption = qpayBankOptions.find((bank) => bank.id === selectedQpayBank) ?? qpayBankOptions[0];
  const qpaySelectedBankLink = qpayPayment ? qpayBankLinkFor(qpayPayment.urls, selectedQpayBankOption) : undefined;
  const qpayBankLinks = (qpayPayment?.urls ?? []).filter((url) => Boolean(url.link));
  const qpayVisibleBankLinks = [
    ...(qpaySelectedBankLink ? [qpaySelectedBankLink] : []),
    ...qpayBankLinks.filter((url) => url.link !== qpaySelectedBankLink?.link),
  ].slice(0, 4);
  const qpayPopupBankLinks = [
    ...(qpaySelectedBankLink ? [qpaySelectedBankLink] : []),
    ...qpayBankLinks.filter((url) => url.link !== qpaySelectedBankLink?.link),
  ];
  const qpayDraftKey = [
    paymentMethod,
    selectedItems.map((item) => `${item.id}:${item.quantity}`).join("|"),
    deliveryType,
    addressLabel,
    addressText,
    addressUnit,
    checkoutEmail,
    location ? `${location.latitude}:${location.longitude}` : "",
  ].join("::");
  const storeCategories = useMemo(
    () => [...marketCategoryFilters],
    [],
  );

  useEffect(() => {
    setMarketPage(1);
  }, [productSearch, storeFilter, storeSearch]);

  useEffect(() => {
    setMarketPage((current) => Math.min(current, totalMarketPages));
  }, [totalMarketPages]);

  useEffect(() => {
    if (!qpayPayment) return;
    qpayPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [qpayPayment]);

  useEffect(() => {
    setQpayPayment(null);
  }, [qpayDraftKey]);

  const addressSuggestions = [
    addressLabel,
    addressText,
    addressUnit,
    ...locationSuggestions.map((suggestion) => suggestion.label),
  ].filter(Boolean);

  function chooseLocationSuggestion(suggestion: LocationSuggestion) {
    setAddressLabel(suggestion.label);
    setAddressText(suggestion.detail || suggestion.label);
    setAddressError("");
  }

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
      if (nextQuantity <= 0) {
        const { [productId]: _removed, ...nextCart } = current;
        return nextCart;
      }
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
    setMenuHidden(false);
    setProfileOpen(false);
    setWishlistOpen(false);
  }

  function toggleWishlist(productId: string) {
    if (!session) {
      setAuthMode("login");
      setAuthOpen(true);
      setCartOpen(false);
      setWishlistOpen(false);
      return;
    }

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

  function selectMarketStore(storeId: string) {
    setSelectedStoreId(storeId);
    setCartOpen(false);
    setWishlistOpen(false);
    setProfileOpen(false);
    setQpayPayment(null);
    setCheckoutError("");
  }

  async function checkoutOrder() {
    if (!session) {
      setAuthMode("login");
      setAuthOpen(true);
      setCartOpen(false);
      return;
    }

    setCheckoutError("");

    if (!selectedItems.length) {
      setCheckoutError("Сагс хоосон байна. Бараагаа сонгоод захиална уу.");
      return;
    }

    if (!location) {
      setAddressError("Одоогийн GPS байршлаа заавал авна уу.");
      setCheckoutError("Одоогийн GPS байршлаа заавал авна уу.");
      return;
    }

    if (!addressText.trim()) {
      setAddressError("Дэлгэрэнгүй хаягаа заавал бөглөнө үү.");
      setCheckoutError("Дэлгэрэнгүй хаягаа заавал бөглөнө үү.");
      return;
    }

    const normalizedCheckoutEmail = checkoutEmail.trim();
    if (!/^[^\s@]+@gmail\.com$/i.test(normalizedCheckoutEmail)) {
      setCheckoutError("OTP авах Gmail хаягаа зөв оруулна уу.");
      return;
    }

    const normalizedCheckoutPhone = checkoutPhone.replace(/[^\d+]/g, "").trim();
    if (!/^\+?\d{8,15}$/.test(normalizedCheckoutPhone)) {
      setCheckoutError("Холбоо барих утасны дугаараа зөв оруулна уу.");
      return;
    }

    setAddressError("");
    const paymentLabel = paymentMethods.find((method) => method.id === paymentMethod)?.label ?? "QPay";
    const deliveryAddressText = [addressText.trim(), addressUnit.trim()].filter(Boolean).join(" · ");
    const district = addressSuggestions.join(" · ") || deliveryAddressText;
    const storeName = selectedItems[0]?.storeName ?? selectedStore?.name ?? "DeliverHub market";
    let orderResult: {
      orderNo: string;
      totalMnt: number;
      quote: { deliveryTypeLabel: string };
      payment?: QpayPaymentState & { status?: string; provider?: string };
    };

    try {
      setLoading(true);
      setCheckoutSubmitting(true);
      setNotice("Захиалга баталгаажуулж байна...");
      orderResult = await apiPost<{
        orderNo: string;
        totalMnt: number;
        quote: { deliveryTypeLabel: string };
        payment?: QpayPaymentState & { status?: string; provider?: string };
      }>("/customer/orders", {
        items: selectedItems.map((item) => ({
          id: item.id,
          name: item.name,
          priceMnt: item.priceMnt,
          quantity: item.quantity,
          weightGrams: item.weightGrams,
        })),
        addressText: deliveryAddressText,
        addressLabel,
        contactEmail: normalizedCheckoutEmail,
        contactPhone: normalizedCheckoutPhone,
        location,
        deliveryType,
        paymentMethod: paymentLabel,
      }, session.token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Захиалга үүсгэхэд алдаа гарлаа.";
      setCheckoutError(message);
      setNotice(message);
      if (
        message.includes("нэвтэр")
        || message.includes("хугацаа")
        || message.includes("дууссан")
        || message.includes("Хэрэглэгч олдсонгүй")
        || message.toLowerCase().includes("token")
        || message.toLowerCase().includes("unauthenticated")
      ) {
        clearCustomerSessionStorage();
        setSession(null);
        setAuthMode("login");
        setAuthOpen(true);
      }
      return;
    } finally {
      setLoading(false);
      setCheckoutSubmitting(false);
    }

    if (orderResult.payment?.status === "PENDING" && orderResult.payment.invoiceId) {
      setQpayPayment({
        orderNo: orderResult.orderNo,
        invoiceId: orderResult.payment.invoiceId,
        amountMnt: orderResult.totalMnt,
        qrText: orderResult.payment.qrText,
        qrImage: orderResult.payment.qrImage,
        shortUrl: orderResult.payment.shortUrl,
        urls: orderResult.payment.urls,
      });
      setNotice("QPay invoice үүслээ. QR уншуулаад эсвэл банкны app-аар төлөөд дараа нь шалгана уу.");
      return;
    }

    const nextTracking: TrackingResponse = {
      orderNo: orderResult.orderNo,
      storeName,
      district,
      statusLabel: "Захиалга баталгаажсан",
      totalMnt: String(orderResult.totalMnt),
      timeline: [
        {
          state: "done",
          title: "Захиалга баталгаажсан",
          description: `${paymentLabel} төлбөр баталгаажиж дэлгүүр рүү захиалга илгээгдлээ.`,
          time: "Одоо",
        },
        {
          state: "active",
          title: "Бэлтгэж дууссан",
          description: "Дэлгүүр барааг шалгаж бэлтгэж дуусмагц энэ шат идэвхжинэ.",
          time: `${etaMinutes} мин`,
        },
        {
          state: "pending",
          title: "Хүргэлтэнд гарсан",
          description: "Дэлгүүрийн баталгаажуулах код зөв болсны дараа хүргэлтийн ажилтны газрын зураг бодит хугацаанд харагдана.",
          time: "Дараагийн шат",
        },
        {
          state: "pending",
          title: "Захиалга дууссан",
          description: "Хэрэглэгч хүлээн авсны дараа захиалга хаагдана.",
          time: "Сүүлийн шат",
        },
      ],
      courier: {
        name: "Хүргэлтийн ажилтан оноогдохыг хүлээж байна",
        vehicle: orderResult.quote.deliveryTypeLabel,
        etaText: `${etaMinutes} минутын тооцоололтой`,
      },
    };
    setCheckoutError("");
    setTracking(nextTracking);
    setOrderHistory((current) => [
      {
        orderNo: nextTracking.orderNo,
        storeName: nextTracking.storeName,
        district: nextTracking.district,
        statusLabel: nextTracking.statusLabel,
        totalMnt: nextTracking.totalMnt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        statusNote: "Захиалга баталгаажсан",
        items: selectedItems.map((item) => ({
          label: `${item.name} x${item.quantity}`,
          amountMnt: String(item.priceMnt * item.quantity),
        })),
      },
      ...current.filter((item) => item.orderNo !== nextTracking.orderNo),
    ].slice(0, 10));
    if (paymentSuccessTimerRef.current) window.clearTimeout(paymentSuccessTimerRef.current);
    setPaymentSuccess("Захиалга амжилттай хийгдлээ");
    paymentSuccessTimerRef.current = window.setTimeout(() => {
      setPaymentSuccess("");
      paymentSuccessTimerRef.current = null;
    }, 3000);
    setNotice("");
    setCart({});
    setCartOpen(false);
    setWishlistOpen(false);
    setProfileOpen(false);
    setTrackingOpen(false);
    setSeenOrderKey(nextTracking.orderNo);
    localStorage.setItem(orderSeenStorageKey, nextTracking.orderNo);
    localStorage.setItem(`${orderSeenStorageKey}:${session.customer.id}`, nextTracking.orderNo);
    setSection("market");
    setMenuHidden(false);
  }

  async function checkQpayPaymentStatus() {
    if (!session || !qpayPayment) return;

    setCheckoutError("");
    setCheckoutSubmitting(true);
    setNotice("QPay төлбөр шалгаж байна...");

    try {
      const result = await apiPost<{ success: boolean; status: string; message?: string; orderNo?: string }>("/customer/payments/qpay/check", {
        invoice_id: qpayPayment.invoiceId,
      }, session.token);

      if (result.status !== "PAID") {
        setNotice(result.message ?? "Төлбөр хараахан баталгаажаагүй байна.");
        return;
      }

      if (paymentSuccessTimerRef.current) window.clearTimeout(paymentSuccessTimerRef.current);
      setPaymentSuccess("Захиалга амжилттай боллоо");
      paymentSuccessTimerRef.current = window.setTimeout(() => {
        setPaymentSuccess("");
        paymentSuccessTimerRef.current = null;
      }, 3000);
      setNotice("");
      setQpayPayment(null);
      setCart({});
      setCartOpen(false);
      setWishlistOpen(false);
      setProfileOpen(false);
      setTrackingOpen(false);
      setSeenOrderKey(result.orderNo ?? qpayPayment.orderNo);
      localStorage.setItem(orderSeenStorageKey, result.orderNo ?? qpayPayment.orderNo);
      localStorage.setItem(`${orderSeenStorageKey}:${session.customer.id}`, result.orderNo ?? qpayPayment.orderNo);
      setSection("market");
      setMenuHidden(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "QPay төлбөр шалгахад алдаа гарлаа.";
      setCheckoutError(message);
      setNotice(message);
    } finally {
      setCheckoutSubmitting(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setNotice("Таны browser location дэмжихгүй байна. Хаягаа текстээр оруулна уу.");
      return;
    }

    setLoading(true);
    setAddressLookupLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(nextLocation);
        setAddressError("");
        try {
          const suggestions = await fetchLocationSuggestions(nextLocation);
          setLocationSuggestions(suggestions);
          if (suggestions[0]) {
            chooseLocationSuggestion(suggestions[0]);
            setNotice("Байршлын ойролцоох хаягийг оллоо. Буруу бол доорх сонголтоос сонгоод, байр/тоотоо нэмээрэй.");
          } else {
            setNotice("GPS авлаа. Хаягийн нэр олдсонгүй, хаягаа гараар оруулаад байр/тоотоо нэмээрэй.");
          }
        } catch {
          setLocationSuggestions([]);
          setNotice("GPS авлаа. Хаягийн нэр татахад алдаа гарлаа, хаягаа гараар оруулаад байр/тоотоо нэмээрэй.");
        } finally {
          setAddressLookupLoading(false);
          setLoading(false);
        }
      },
      () => {
        setAddressError("GPS зөвшөөрөгдсөнгүй. Хүргэлт хийхийн тулд одоогийн байршлаа заавал зөвшөөрнө үү.");
        setAddressLookupLoading(false);
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

  function stopPartnerCamera() {
    partnerStreamRef.current?.getTracks().forEach((track) => track.stop());
    partnerStreamRef.current = null;
    setPartnerCameraActive(false);
  }

  async function startPartnerCamera() {
    setPartnerCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      partnerStreamRef.current = stream;
      if (partnerVideoRef.current) {
        partnerVideoRef.current.srcObject = stream;
        await partnerVideoRef.current.play().catch(() => {});
      }
      setPartnerCameraActive(true);
    } catch {
      setPartnerCameraError("Камерт хандах эрх олгогдоогүй байна. Зөвшөөрөл олгоод дахин оролдоно уу.");
    }
  }

  function capturePartnerPhoto() {
    const video = partnerVideoRef.current;
    const canvas = partnerCanvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    canvas.width = 480;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * 480) || 360;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPartnerVerification((verification) => ({ ...verification, livePhotoDataUrl: dataUrl }));
    stopPartnerCamera();
  }

  function retakePartnerPhoto() {
    setPartnerVerification((verification) => ({ ...verification, livePhotoDataUrl: "" }));
    startPartnerCamera();
  }

  function switchPartnerAuthMode(mode: PartnerAuthMode) {
    setPartnerAuthMode(mode);
    setPartnerFormStep(0);
    setNotice("");
  }

  const partnerBankAccountDigits = partnerVerification.bankAccountNumber.replace(/\D/g, "");
  const partnerStepValid = [
    Boolean(partnerForm.storeName.trim() && partnerForm.ownerName.trim() && partnerForm.address.trim() && partnerForm.phone.trim() && partnerForm.storeType.trim() && partnerForm.searchableFeature.trim()),
    Boolean(partnerVerification.bankId && partnerBankAccountDigits.length >= 8 && partnerVerification.businessLicenseFile),
    Boolean(partnerVerification.idFrontFile && partnerVerification.idBackFile),
    Boolean(partnerVerification.livePhotoDataUrl),
    Boolean(partnerForm.username.trim() && partnerForm.password.trim() && partnerForm.confirmPassword.trim()),
    partnerAgreementAccepted,
  ];

  function goPartnerStep(direction: 1 | -1) {
    setNotice("");
    if (direction === 1 && !partnerStepValid[partnerFormStep]) {
      setNotice("Энэ алхмын мэдээллийг бүрэн бөглөж, баримтуудаа хавсаргана уу.");
      return;
    }
    setPartnerFormStep((step) => Math.min(partnerRegisterSteps.length - 1, Math.max(0, step + direction)));
  }

  function submitPartnerAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");

    if (partnerAuthMode === "register" && partnerFormStep < partnerRegisterSteps.length - 1) {
      goPartnerStep(1);
      return;
    }

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

      if (!partnerVerification.bankId || partnerBankAccountDigits.length < 8) {
        throw new Error("Дансны банк болон дугаараа зөв бөглөнө үү.");
      }

      if (!partnerVerification.businessLicenseFile) {
        throw new Error("Үйл ажиллагаа явуулж буй зөвшөөрлийн бичгээ хавсаргана уу.");
      }

      if (!partnerVerification.idFrontFile || !partnerVerification.idBackFile) {
        throw new Error("Иргэний үнэмлэх/паспортын урд ба ард талын зургийг хоёуланг нь хавсаргана уу.");
      }

      if (!partnerVerification.livePhotoDataUrl) {
        throw new Error("Царайгаа камераар бодит цагт баталгаажуулна уу.");
      }

      if (!partnerAgreementAccepted) {
        throw new Error("Гэрээний нөхцөлийг зөвшөөрч тэмдэглэнэ үү.");
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
        bankId: partnerVerification.bankId,
        bankAccountNumber: partnerBankAccountDigits,
        businessLicenseFileName: partnerVerification.businessLicenseFile.name,
        idType: partnerVerification.idType,
        idFrontFileName: partnerVerification.idFrontFile.name,
        idBackFileName: partnerVerification.idBackFile.name,
        livePhotoDataUrl: partnerVerification.livePhotoDataUrl,
        agreementAcceptedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
      };

      localStorage.setItem(storeUsersStorageKey, JSON.stringify([...users, nextUser]));
      localStorage.setItem(storeSessionStorageKey, nextUser.id);
      window.location.href = storePortalUrl;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Байгууллагын бүртгэлд алдаа гарлаа.");
    }
  }

  function logout() {
    clearCustomerSessionStorage();
    setSession(null);
    setTracking(null);
    setProfileOpen(false);
    setCartOpen(false);
    setWishlistOpen(false);
    setTrackingOpen(false);
    setSection("home");
    onNavigateHome?.();
    setNotice("Гарлаа.");
  }

  function closeMarket() {
    setSection("home");
    setCartOpen(false);
    setWishlistOpen(false);
    setTrackingOpen(false);
    onNavigateHome?.();
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function isCompletedOrder(statusText: string) {
    const normalized = statusText.toLowerCase();
    return normalized.includes("дуус") || normalized.includes("хүргэгд") || normalized.includes("delivered") || normalized.includes("completed");
  }

  function orderIconFor(order: OrderHistoryItem) {
    const text = `${order.storeName} ${order.items.map((item) => item.label).join(" ")}`.toLowerCase();
    if (text.includes("pizza") || text.includes("пицц")) return "🍕";
    if (text.includes("market") || text.includes("маркет") || text.includes("супер")) return "🛒";
    if (text.includes("food") || text.includes("хоол") || text.includes("restaurant")) return "🍽";
    return "📦";
  }

  function renderTrackingCard() {
    const currentHistory = orderHistory.find((item) => item.orderNo === tracking?.orderNo);
    const currentOrder: OrderHistoryItem | null = tracking
      ? {
        orderNo: tracking.orderNo,
        storeName: tracking.storeName,
        district: tracking.district,
        statusLabel: tracking.statusLabel,
        totalMnt: tracking.totalMnt,
        createdAt: currentHistory?.createdAt ?? new Date().toISOString(),
        updatedAt: currentHistory?.updatedAt ?? new Date().toISOString(),
        statusNote: tracking.courier.etaText || "Захиалгын явц шинэчлэгдэж байна",
        items: currentHistory?.items ?? [],
      }
      : null;
    const orderMap = new Map<string, OrderHistoryItem>();
    if (currentOrder) orderMap.set(currentOrder.orderNo, currentOrder);
    orderHistory.forEach((order) => orderMap.set(order.orderNo, order));
    const allOrders = Array.from(orderMap.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const query = orderSearch.trim().toLowerCase();
    const searchedOrders = allOrders.filter((order) => {
      if (!query) return true;
      return [
        order.orderNo,
        order.storeName,
        order.statusLabel,
        order.statusNote,
        order.district,
        ...order.items.map((item) => item.label),
      ].join(" ").toLowerCase().includes(query);
    });
    const activeOrders = searchedOrders.filter((order) => !isCompletedOrder(order.statusLabel));
    const completedOrders = searchedOrders.filter((order) => isCompletedOrder(order.statusLabel));
    const visibleOrders = orderHistoryTab === "active" ? activeOrders : completedOrders;
    const trackingStorePoint = { lat: storeLocation.latitude, lng: storeLocation.longitude };
    const trackingCustomerPoint = { lat: customerLocation.latitude, lng: customerLocation.longitude };
    const trackingCourierPoint = tracking?.courierLocation
      ? { lat: tracking.courierLocation.latitude, lng: tracking.courierLocation.longitude }
      : null;
    const trackingMarkers: RouteMapMarker[] = [
      { id: "store", point: trackingStorePoint, label: tracking?.storeName ?? "Дэлгүүр", kind: "store" },
      { id: "customer", point: trackingCustomerPoint, label: "Хүргэх хаяг", kind: "customer" },
      ...(trackingCourierPoint ? [{ id: "courier", point: trackingCourierPoint, label: tracking?.courier.name ?? "Хүргэлтийн ажилтан", kind: "courier" as const }] : []),
    ];
    const trackingRoutes: RouteMapLine[] = [
      ...(trackingCourierPoint ? [{ id: "courier-store", from: trackingCourierPoint, to: trackingStorePoint, kind: "pickup" as const }] : []),
      { id: "store-customer", from: trackingStorePoint, to: trackingCustomerPoint, kind: "dropoff" as const },
    ];

    if (!allOrders.length) {
      return (
        <section className="landing-orders-page is-empty">
          <header>
            <div>
              <span>Миний захиалга</span>
              <h2>Одоогоор идэвхтэй захиалга алга</h2>
            </div>
            <button onClick={() => setTrackingOpen(false)} type="button">Хаах</button>
          </header>
          <p>Маркетээс бараа сонгоод төлбөр төлөхөд захиалгын явц, дэлгүүр, өдөр цаг энд бүртгэгдэнэ.</p>
        </section>
      );
    }

    return (
      <section className="landing-orders-page">
        <header>
          <div>
            <span>DeliverHub</span>
            <h2>Захиалгын түүх</h2>
          </div>
          <button onClick={() => setTrackingOpen(false)} type="button">Хаах</button>
        </header>

        <label className="landing-order-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={orderSearch}
            onChange={(event) => setOrderSearch(event.target.value)}
            placeholder="Захиалга хайх..."
          />
        </label>

        <nav className="landing-order-tabs" aria-label="Захиалгын төлөв">
          <button className={orderHistoryTab === "active" ? "active" : ""} onClick={() => setOrderHistoryTab("active")} type="button">
            Идэвхтэй <span>{activeOrders.length}</span>
          </button>
          <button className={orderHistoryTab === "completed" ? "active" : ""} onClick={() => setOrderHistoryTab("completed")} type="button">
            Дууссан <span>{completedOrders.length}</span>
          </button>
        </nav>

        <InteractiveRouteMap
          className="customer-track-map"
          initialZoom={14}
          markers={trackingMarkers}
          routes={trackingRoutes}
          statusLabel={tracking?.statusLabel ?? "Захиалгын байршил"}
          statusDetail={tracking?.courier.etaText ?? "Дэлгүүр, хүргэлтийн ажилтан, хүргэх хаяг"}
        />

        <section className="landing-order-history">
          {visibleOrders.slice(0, 12).map((order) => (
            <article className="landing-order-history-card" key={order.orderNo}>
              <div className="landing-order-card-head">
                <span className="landing-order-store-icon" aria-hidden="true">{orderIconFor(order)}</span>
                <div>
                  <strong>{order.storeName}</strong>
                  <small>#{order.orderNo.slice(-6)} · {new Date(order.createdAt).toLocaleString("mn-MN")}</small>
                </div>
                <b>{order.statusLabel}</b>
              </div>
              <p>{order.items.length ? order.items.map((item) => item.label).join(", ") : order.statusNote}</p>
              <div className="landing-order-card-foot">
                <strong>{formatMnt(Number(order.totalMnt))}</strong>
                <button type="button">{isCompletedOrder(order.statusLabel) ? "Дахин захиалах" : "Дэлгэрэнгүй"}</button>
              </div>
            </article>
          ))}
          {!visibleOrders.length ? <p className="landing-order-empty">Энэ хэсэгт тохирох захиалга алга.</p> : null}
        </section>
      </section>
    );
  }

  const showcaseActiveIndex = Math.min(
    landingShowcaseSlides.length - 1,
    Math.floor(showcaseProgress * landingShowcaseSlides.length),
  );

  return (
    <main className={`nomad-scroll-page ${section === "market" ? "is-market-route" : ""} ${section === "contact" ? "is-contact-route" : ""} ${section === "courier" ? "is-courier-route" : ""} ${section === "partner" ? "is-partner-route" : ""} ${cartOpen ? "is-cart-open" : ""}`} id="hero">
      <div
        className="landing-scroll-progress-bar"
        style={{ "--nav-scroll-progress": scrollProgress } as CSSProperties}
        aria-hidden="true"
      />
      {paymentSuccess ? <div className="landing-payment-success" role="status">{paymentSuccess}</div> : null}
      <nav
        className={`landing-commerce-nav ${menuHidden && !cartOpen ? "is-hidden" : ""}`}
        style={{ "--nav-scroll-progress": scrollProgress } as CSSProperties}
        aria-label="Landing navigation"
      >
        <a className="landing-commerce-brand" href="/" onClick={(event) => { event.preventDefault(); closeMarket(); }}>
          <BrandLogo showText size={32} />
        </a>
        <a className={section === "home" ? "active" : ""} href="/" onClick={(event) => { event.preventDefault(); closeMarket(); }}>Нүүр</a>
        <button className={section === "market" ? "active" : ""} onClick={openMarket} type="button">Маркет</button>
        <button className={section === "courier" ? "active" : ""} onClick={openCourier} type="button">Хүргэлтийн ажилтан</button>
        <button className={`landing-partner-nav ${section === "partner" ? "active" : ""}`} onClick={openPartner} type="button">Бизнесийн түншлэл</button>
        <button className={section === "contact" ? "active" : ""} onClick={openContact} type="button">Холбоо барих</button>
        <div className="landing-nav-actions" aria-label="Хэрэглэгчийн үйлдлүүд">
          <button
            className={cartOpen ? "active" : ""}
            onClick={() => {
              setMenuHidden(false);
              setProfileOpen(false);
              setWishlistOpen(false);
              setCartOpen((open) => {
                if (!open) {
                  cartReturnRef.current = { section, scrollY: window.scrollY };
                }
                return !open;
              });
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
            {cartItemCount > 0 ? <b>{cartItemCount}</b> : null}
          </button>
          <button
            className={wishlistOpen ? "active" : ""}
            onClick={() => {
              if (!session) {
                setAuthMode("login");
                setAuthOpen(true);
                setCartOpen(false);
                setWishlistOpen(false);
                return;
              }

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
            {session && wishlistItems.length > 0 ? <b>{wishlistItems.length}</b> : null}
          </button>
        </div>
        {session ? (
          <div className="landing-profile-menu">
            <button className="landing-profile-button" onClick={() => setProfileOpen((open) => !open)} type="button" aria-label="Профайл">
              {session.customer.avatarDataUrl ? (
                <img alt="" src={session.customer.avatarDataUrl} />
              ) : (
                <span aria-hidden="true">{session.customer.fullName.slice(0, 1).toUpperCase()}</span>
              )}
            </button>
            {profileOpen ? (
              <section className={`landing-profile-panel ${profileSettings.compactProfile ? "is-compact" : ""}`}>
                <div className="landing-profile-head">
                  <button
                    className="landing-profile-avatar"
                    onClick={() => customerAvatarInputRef.current?.click()}
                    type="button"
                    aria-label="Профайл зураг солих"
                  >
                    {session.customer.avatarDataUrl ? (
                      <img alt="" src={session.customer.avatarDataUrl} />
                    ) : (
                      session.customer.fullName.slice(0, 1).toUpperCase()
                    )}
                  </button>
                  <input
                    accept="image/*"
                    className="landing-profile-avatar-input"
                    onChange={(event) => {
                      changeCustomerAvatar(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                    ref={customerAvatarInputRef}
                    type="file"
                  />
                  <div>
                    <strong>{session.customer.fullName}</strong>
                    <span>{session.customer.email || session.customer.phone}</span>
                  </div>
                </div>

                <button className="landing-profile-order-link" onClick={openProfileOrders} type="button">
                  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                    <path d="M4.5 7.4L12 3.5L19.5 7.4V16.6L12 20.5L4.5 16.6V7.4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                    <path d="M4.8 7.7L12 11.5L19.2 7.7M12 11.5V20.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                  <span>Миний захиалсан</span>
                  {unseenOrderCount ? <b aria-label="Шинэ захиалга">{unseenOrderCount}</b> : null}
                </button>

                <div className="landing-profile-edit">
                  <div className="landing-profile-subhead">
                    <span>Профайл</span>
                    <button
                      onClick={() => setProfileEditing((editing) => !editing)}
                      type="button"
                    >
                      {profileEditing ? "Хаах" : "Засах"}
                    </button>
                  </div>
                  {profileEditing ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        saveCustomerProfile();
                      }}
                    >
                      <label>
                        <span>Нэр</span>
                        <input
                          onChange={(event) => setProfileDraft((draft) => ({ ...draft, fullName: event.target.value }))}
                          value={profileDraft.fullName}
                        />
                      </label>
                      <label>
                        <span>Имэйл</span>
                        <input
                          onChange={(event) => setProfileDraft((draft) => ({ ...draft, email: event.target.value }))}
                          type="email"
                          value={profileDraft.email}
                        />
                      </label>
                      <label>
                        <span>Утас</span>
                        <input
                          onChange={(event) => setProfileDraft((draft) => ({ ...draft, phone: event.target.value }))}
                          value={profileDraft.phone}
                        />
                      </label>
                      <div className="landing-profile-form-actions">
                        <button type="submit">Хадгалах</button>
                        <button
                          onClick={() => {
                            setProfileDraft({
                              fullName: session.customer.fullName,
                              email: session.customer.email ?? "",
                              phone: session.customer.phone,
                            });
                            setProfileEditing(false);
                          }}
                          type="button"
                        >
                          Болих
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>

                <div className="landing-profile-settings">
                  <div className="landing-profile-subhead">
                    <span>Settings</span>
                  </div>
                  <label className="landing-profile-toggle">
                    <input
                      checked={profileSettings.orderUpdates}
                      onChange={(event) => setProfileSettings((settings) => ({ ...settings, orderUpdates: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>Захиалгын мэдэгдэл</span>
                  </label>
                  <label className="landing-profile-toggle">
                    <input
                      checked={profileSettings.promoUpdates}
                      onChange={(event) => setProfileSettings((settings) => ({ ...settings, promoUpdates: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>Урамшууллын мэдээ</span>
                  </label>
                  <label className="landing-profile-toggle">
                    <input
                      checked={profileSettings.compactProfile}
                      onChange={(event) => setProfileSettings((settings) => ({ ...settings, compactProfile: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>Компакт харагдац</span>
                  </label>
                </div>

                <div className="landing-profile-signout">
                  <button className="landing-profile-logout" onClick={logout} type="button">
                    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                      <path d="M9.5 5H6.8C5.8 5 5 5.8 5 6.8V17.2C5 18.2 5.8 19 6.8 19H9.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                      <path d="M13 8L17 12L13 16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      <path d="M17 12H9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                    </svg>
                    <span>
                      <strong>Гарах</strong>
                      <small>Аккаунтаас гарах</small>
                    </span>
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <button className="landing-login-button" onClick={() => setAuthOpen(true)} type="button">Нэвтрэх</button>
        )}
      </nav>

      {trackingOpen ? (
        <aside className="landing-order-popover" aria-label="Миний захиалсан захиалга">
          {renderTrackingCard()}
        </aside>
      ) : null}

      {cartOpen ? (
        <div className="landing-cart-backdrop" aria-hidden="true" onClick={() => setCartOpen(false)} />
      ) : null}

      {cartOpen ? (
        <section className="landing-cart-popover" aria-label="Сагс" aria-modal="true" ref={cartPanelRef} role="dialog" tabIndex={-1}>
            <header>
              <div>
                <strong>Таны сагс</strong>
              </div>
              <button onClick={() => setCartOpen(false)} type="button" aria-label="Сагс хаах">×</button>
            </header>

            {selectedItems.length ? (
              <>
                <div className="landing-cart-checkout">
                  <div className="landing-checkout-form">
                    <h1>Захиалгаа баталгаажуулах</h1>
                    <section className="landing-checkout-steps" aria-label="Хүргэлтийн төрөл">
                      {deliveryOptions.map((option, index) => (
                        <button
                          className={deliveryType === option.id ? "active" : ""}
                          key={option.id}
                          onClick={() => setDeliveryType(option.id)}
                          type="button"
                        >
                          <span>{index + 1}</span>
                          <strong>{option.label}</strong>
                        </button>
                      ))}
                    </section>

                    <h2>Холбоо барих мэдээлэл</h2>
                    <section className="landing-checkout-contact" aria-label="И-мэйл">
                      <strong>И-мэйл хаяг</strong>
                      <input
                        autoComplete="new-password"
                        inputMode="email"
                        name="deliverhub-contact-otp-target"
                        placeholder="name@gmail.com"
                        type="text"
                        value={checkoutEmail}
                        onChange={(event) => {
                          setCheckoutEmail(event.target.value);
                          if (checkoutError.includes("Gmail")) setCheckoutError("");
                        }}
                      />
                      <strong>Утасны дугаар</strong>
                      <input
                        autoComplete="new-password"
                        inputMode="tel"
                        name="deliverhub-contact-call-target"
                        placeholder="99112233"
                        type="text"
                        value={checkoutPhone}
                        onChange={(event) => {
                          setCheckoutPhone(event.target.value);
                          if (checkoutError.includes("утас")) setCheckoutError("");
                        }}
                      />
                    </section>

                    <h2>Хүргэлтийн хаяг</h2>
                    <section className={`landing-checkout-address ${addressError ? "has-error" : ""}`} aria-label="Хүргэлтийн хаяг">
                      <div>
                        <strong>GPS байршил</strong>
                        <button onClick={useCurrentLocation} type="button" disabled={loading}>
                          {location ? "GPS шинэчлэх" : "Одоогийн байршил авах"}
                        </button>
                      </div>
                      <span>
                        {location
                          ? addressLabel || "GPS байршил авсан"
                          : "GPS байршил аваагүй байна"}
                      </span>
                      {addressLookupLoading ? (
                        <div className="landing-address-loading" role="status">
                          <span aria-hidden="true" />
                          <strong>Таны байршлыг тогтоож байна</strong>
                        </div>
                      ) : null}
                      {!addressLookupLoading ? (
                        <>
                          <label>
                            Дэлгэрэнгүй хаяг
                            <input
                              value={addressText}
                              onChange={(event) => {
                                setAddressText(event.target.value);
                                if (event.target.value.trim()) setAddressError("");
                              }}
                              placeholder="Дүүрэг, хороо, гудамж"
                            />
                          </label>
                          <label>
                            Байр, орц, тоот
                            <input
                              value={addressUnit}
                              onChange={(event) => setAddressUnit(event.target.value)}
                              placeholder="12-р байр, 3-р орц, 45 тоот"
                            />
                          </label>
                        </>
                      ) : null}
                      {addressError ? <p role="alert">{addressError}</p> : null}
                    </section>

                    {paymentMethod === "qpay" && qpayPayment ? (
                      <section className={`landing-qpay-panel${qpayPayment ? " is-ready" : ""}`} aria-label="QPay төлбөр" ref={qpayPanelRef}>
                        <h2>Төлбөр</h2>
                        <button className="landing-qpay-popup-trigger" onClick={() => setQpayAppsOpen(true)} type="button">
                          <span className="landing-qpay-logo-mark">
                            <img alt="QPay" src={qpayLogoUrl} />
                          </span>
                          <strong>{selectedQpayBankOption.label}-аар төлөх</strong>
                          <small>Банкны app-ууд popup дотор</small>
                        </button>
                        <div className="landing-qpay-body">
                          <div className="landing-qpay-meta">
                            <span>Invoice</span>
                            <strong>{qpayPayment.invoiceId}</strong>
                            <span>Merchant</span>
                            <strong>{qpayMerchantName}</strong>
                          </div>
                          <div className={`landing-qpay-qr${qpayQrSrc ? "" : " is-empty"}`}>
                            {qpayQrSrc ? (
                              <img alt="QPay invoice QR" src={qpayQrSrc} />
                            ) : (
                              <strong>QR ирсэнгүй</strong>
                            )}
                          </div>
                        </div>
                        {qpayVisibleBankLinks.length ? (
                          <button className="landing-qpay-more-apps" onClick={() => setQpayAppsOpen(true)} type="button">
                            Бусад банкны app харах
                          </button>
                        ) : null}
                        {qpayAppsOpen ? (
                          <div className="landing-qpay-popup" role="dialog" aria-modal="true" aria-label="QPay банкны апп сонгох">
                            <div className="landing-qpay-popup-card">
                              <header>
                                <span className="landing-qpay-popup-brand">
                                  <img alt="QPay" src={qpayLogoUrl} />
                                  <strong>QPay банк сонгох</strong>
                                </span>
                                <button onClick={() => setQpayAppsOpen(false)} type="button" aria-label="Хаах">×</button>
                              </header>
                              <div className="landing-qpay-bank-picker" aria-label="Төлөх банк">
                                {qpayBankOptions.map((bank) => (
                                  <button
                                    className={selectedQpayBank === bank.id ? "active" : ""}
                                    key={bank.id}
                                    onClick={() => setSelectedQpayBank(bank.id)}
                                    type="button"
                                  >
                                    <span>
                                      <img
                                        alt=""
                                        onError={(event) => {
                                          event.currentTarget.style.display = "none";
                                        }}
                                        src={bank.logoUrl}
                                      />
                                      <b>{bank.mark}</b>
                                    </span>
                                    <strong>{bank.label}</strong>
                                  </button>
                                ))}
                              </div>
                              {qpayPayment ? (
                                <div className="landing-qpay-apps" aria-label="QPay банкны апп">
                                  {qpayPopupBankLinks.map((url) => (
                                    <a href={url.link} key={`${url.name ?? url.description}-${url.link}`} rel="noreferrer" target="_blank">
                                      {url.logo ? <img alt="" src={url.logo} /> : null}
                                      <span>{url.name || url.description || "Банкны app"}</span>
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    {checkoutError ? <p className="landing-checkout-error" role="alert">{checkoutError}</p> : null}
                    <footer className="landing-checkout-form-footer">
                      <button className="landing-checkout-submit" onClick={qpayPayment ? checkQpayPaymentStatus : checkoutOrder} type="button" disabled={checkoutSubmitting}>
                        <span>{checkoutSubmitting ? "Шалгаж байна..." : qpayPayment ? "Төлбөр шалгах" : "Төлбөр төлөх"}</span>
                      </button>
                      <button className="landing-checkout-cancel" onClick={() => setCart({})} type="button">Буцах</button>
                    </footer>
                  </div>

                  <aside className="landing-checkout-summary">
                    <h2>Захиалгын нэгтгэл</h2>
                    <div className="landing-checkout-summary-items">
                      {selectedItems.map((item) => (
                        <article key={item.id}>
                          <img alt={item.name} src={productImageFor(item)} />
                          <div>
                            <strong>{item.name}</strong>
                            <small>{formatMnt(item.priceMnt)}</small>
                          </div>
                          <div className="landing-cart-stepper">
                            <button onClick={() => updateCart(item.id, -1)} type="button" aria-label="Хасах">−</button>
                            <b>{item.quantity}</b>
                            <button onClick={() => updateCart(item.id, 1)} type="button" aria-label="Нэмэх">+</button>
                          </div>
                          <button className="landing-cart-remove" onClick={() => updateCart(item.id, -item.quantity)} type="button">Устгах</button>
                        </article>
                      ))}
                    </div>
                    <div className="landing-cart-totals">
                      <span><em>Нийт бүтээгдэхүүний үнэ</em><strong>{formatMnt(subtotal)}</strong></span>
                      <span><em>Хүргэлт</em><strong>{formatMnt(deliveryFee)}</strong></span>
                      <span><em>Хөнгөлөлт</em><strong>-{formatMnt(0)}</strong></span>
                      <span><em>Нийт дүн</em><strong>{formatMnt(subtotal + deliveryFee)}</strong></span>
                    </div>
                    <div className="landing-checkout-trust">
                      <div>
                        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                          <path d="M12 3L19 6V11C19 15.4 16 19.2 12 21C8 19.2 5 15.4 5 11V6L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
                          <path d="M9 12L11.2 14.2L15.5 9.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                        </svg>
                        <strong>Найдвартай төлбөр</strong>
                      </div>
                      <div>
                        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                          <path d="M3 7H14V16H3V7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
                          <path d="M14 10H17.5L20 13V16H14V10Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
                          <circle cx="7" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.4" />
                          <circle cx="17" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                        <strong>Хурдан хүргэлт</strong>
                      </div>
                      <div>
                        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                          <path d="M4 13V11C4 6.6 7.6 3 12 3C16.4 3 20 6.6 20 11V13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
                          <path d="M4 13V17C4 18.1 4.9 19 6 19H7V13H4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
                          <path d="M20 13V17C20 18.1 19.1 19 18 19H17V13H20Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
                          <path d="M17 19V20C17 20.6 16.6 21 16 21H12.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
                        </svg>
                        <strong>24/7 Дэмжлэг</strong>
                      </div>
                    </div>
                  </aside>
                </div>
              </>
            ) : !session ? (
              <div className="landing-cart-empty">
                <strong>Захиалгаа үргэлжлүүлэх үү?</strong>
                <p>DeliverHub-д нэвтэрснээр сагсаа хадгалж, хүргэлтийн явцаа шууд хянах боломжтой.</p>
                <button onClick={() => { setAuthMode("login"); setAuthOpen(true); setCartOpen(false); }} type="button">Үргэлжлүүлэх</button>
              </div>
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

      {section === "market" ? (
      <div className="landing-shop-panel market-page is-open">
        <header className="market-top-header">
          <div>
            <h2>Маркет таны гарт</h2>
          </div>
        </header>

        <section className="market-layout">
          <aside className="market-sidebar">
            <section className="landing-store-filters" aria-label="Маркетийн төрөл">
              {storeCategories.map((category) => (
                <button className={storeFilter === category ? "active" : ""} key={category} onClick={() => setStoreFilter(category)} type="button">
                  {category}
                </button>
              ))}
            </section>
          </aside>
          <section className="market-products">
            <section className="market-filtered-store-section">
              <label className="market-store-search">
                <span>⌕</span>
                <input
                  onChange={(event) => setStoreSearch(event.target.value)}
                  placeholder="Төрөл эсвэл нэрээр хайх..."
                  value={storeSearch}
                />
              </label>
              <div className="landing-store-cards">
                {filteredStores.map((store) => {
                  const brand = storeBrandFor(store.name, store.categories[0]);
                  const isActive = selectedStore?.id === store.id;
                  return (
                    <button className={isActive ? "active" : ""} key={store.id} onClick={() => selectMarketStore(store.id)} type="button">
                      <span className="landing-store-logo">
                        <img alt={`${store.name} logo`} src={brand.logoUrl} />
                      </span>
                      <span className="landing-store-card-copy">
                        <strong>{store.name}</strong>
                        <small>{store.productCount} бүтээгдэхүүн · {store.categories.join(", ")}</small>
                      </span>
                    </button>
                  );
                })}
                {!filteredStores.length ? <p>Энэ төрөлд тохирох дэлгүүр олдсонгүй.</p> : null}
              </div>
            </section>
            <section className="market-store-feed">
              {!selectedStore ? (
                <p className="market-empty">Дээрээс төрөл сонгоод, дэлгүүрийн card дээр дарахад бараанууд нь энд гарна.</p>
              ) : pagedStoreProductGroups.length ? pagedStoreProductGroups.map(({ store, products }) => {
                const brand = storeBrandFor(store.name, store.categories[0]);
                return (
                  <section className="market-store-section" key={store.id}>
                    <header>
                      <span className="landing-store-logo">
                        <img alt={`${store.name} logo`} src={brand.logoUrl} />
                      </span>
                      <div>
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
                            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                              <path d="M6 4.8C6 3.8 6.8 3 7.8 3H16.2C17.2 3 18 3.8 18 4.8V20L12 16.6L6 20V4.8Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
                            </svg>
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
                            <div className="landing-product-stepper" aria-label={`${product.name} тоо ширхэг`}>
                              <button className="landing-product-qty" onClick={() => updateProductQuantity(product.id, -1)} type="button">−</button>
                              <b>{productQuantities[product.id] ?? 1}</b>
                              <button className="landing-product-qty" onClick={() => updateProductQuantity(product.id, 1)} type="button" disabled={product.stockCount <= 0}>+</button>
                            </div>
                            <button
                              className="landing-product-add"
                              onClick={() => addSelectedQuantityToCart(product.id)}
                              type="button"
                              disabled={product.stockCount <= 0}
                              aria-label={`${product.name} сагсанд нэмэх`}
                              title="Сагсанд нэмэх"
                            >
                              <span>Сагсанд хийх</span>
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              }) : (
                <p className="market-empty">Энэ дэлгүүрээс тохирох бараа олдсонгүй.</p>
              )}
            </section>

            {selectedStore ? <nav className="market-pagination" aria-label="Маркетийн хуудас">
              <button onClick={() => setMarketPage((pageNumber) => Math.max(1, pageNumber - 1))} type="button" disabled={marketPage <= 1}>
                Өмнөх
              </button>
              <span>{marketPage} / {totalMarketPages}</span>
              <button onClick={() => setMarketPage((pageNumber) => Math.min(totalMarketPages, pageNumber + 1))} type="button" disabled={marketPage >= totalMarketPages}>
                Дараах
              </button>
            </nav> : null}

            {notice ? (
              <section className="market-cart">
                <p className="landing-commerce-notice">{notice}</p>
              </section>
            ) : null}
          </section>
        </section>
      </div>
      ) : null}

      {section === "partner" ? (
        <section className="landing-partner-page" aria-label="БИЗНЕСИЙН ТҮНШЛЭЛ">
          <section className="landing-partner-hero">
            <div className="landing-partner-copy">
              <span>БИЗНЕСИЙН ТҮНШЛЭЛ</span>
              <h2>Хамтдаа өсөж, хамтдаа хөгжие</h2>
              <p>Бидэнтэй хамтран ажилласнаар бизнесээ онлайн зах зээлтэй холбож, маркетинг, захиалга, хүргэлтээ нэг системээр удирдаарай.</p>
            </div>
            <figure className="landing-partner-hero-media">
              <img
                alt="DeliverHub бизнесийн түншлэл"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeMl8v56Q7tiTZfWvoddNJIHDAdhGwpfxnLDxt8hPY51Qulv8xUnK94UlogvX0LQuUXZa3FU4xFBgFfu-FLtArPNGlwJh388E_iLRPwVf_y6jirUQ15_S7gAyhtYlbcBw3FpmOgbNa_KbKPbAjFLxMs_fKY7i_YK-S4TFwr1Zn1JEK8EwnTv--7crgrPLFR8Txzl3fDRmfvSWtHdkb9C44ypVUgfajYhStasK2zBAnZixndjekogRK"
              />
            </figure>
          </section>

          <section className="landing-partner-feature-section" aria-label="Түншлэлийн давуу тал">
            <header>
              <h3>Яагаад бидэнтэй нэгдэх вэ?</h3>
              <p>Өсөлт, маркетинг, найдвартай логистикийг нэг платформоос.</p>
            </header>
            <div className="landing-partner-feature-grid">
              <article>
                <span className="landing-partner-feature-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="img">
                    <path d="M4.8 10.7h14.4" />
                    <path d="M6.8 20.2h10.4a2 2 0 0 0 2-2V9.4a2 2 0 0 0-2-2H6.8a2 2 0 0 0-2 2v8.8a2 2 0 0 0 2 2Z" />
                    <path d="M8.4 7.4V5.8a2 2 0 0 1 2-2h3.2a2 2 0 0 1 2 2v1.6" />
                    <path d="M12 13.1v2.8" />
                    <path d="M10.6 14.5h2.8" />
                  </svg>
                </span>
                <strong>Бизнесээ өргөжүүл</strong>
                <p>Өдөр бүр шинэ хэрэглэгчидтэй холбогдож, борлуулалтын сувгаа нэмэгдүүл.</p>
              </article>
              <article>
                <span className="landing-partner-feature-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="img">
                    <path d="M4.6 18.6 9.2 14l3 3 6.9-7" />
                    <path d="M15.3 10.1h3.8v3.8" />
                    <path d="M5 5.4h14" />
                    <path d="M5 9h6.4" />
                    <path d="M5 12.6h3" />
                  </svg>
                </span>
                <strong>Маркетингаа сайжруул</strong>
                <p>Ангилал, хайлт, урамшуулал, хэрэглэгчийн өгөгдөл дээр суурилсан өсөлт.</p>
              </article>
              <article>
                <span className="landing-partner-feature-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="img">
                    <path d="M5 17.7 19 5" />
                    <path d="M12.5 5H19v6.5" />
                    <path d="M6.5 19.5h10.9a2.1 2.1 0 0 0 2.1-2.1V15" />
                    <path d="M4.5 7.2v10.2a2.1 2.1 0 0 0 2.1 2.1" />
                  </svg>
                </span>
                <strong>Найдвартай логистик</strong>
                <p>Realtime хяналттай хүргэлтээр бүтээгдэхүүнээ хурдан, ил тод хүргэнэ.</p>
              </article>
            </div>
          </section>

          <section className="landing-partner-bento" aria-label="Бизнесийн төрөл">
            <header>
              <h3>Бүх төрлийн бизнест зориулав</h3>
            </header>
            <div className="landing-partner-bento-grid">
              <article className="is-wide">
                <div>
                  <strong>Ресторан &amp; кофе шоп</strong>
                  <p>Хоолны салбарын онцлогт тохирсон хурдан, найдвартай хүргэлт. Дулаан барих тусгай цүнх, шуурхай үйлчилгээ.</p>
                  <ul>
                    <li>15-30 минутын хүргэлт</li>
                    <li>Чанарын хяналт</li>
                  </ul>
                </div>
                <img
                  alt="Ресторан түншлэл"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDeOugPoZ703w1WUKA_OvSzg9TTaFtbj56foic_yhb0HO0ar2xQO3BWhn7ZIYiBJFZr-IIuU9rM3bSvIo75Jkat3inFCAHXmSdPNCZ2V-0Ibb9Np_AGeDyIeOpVuEcCRuLJ8vsYNQN_ws3R_XdkJcUU1QnAS27rAfJNsaMonVzFGBBvvAKkUeE7mwW2ox2cOZOe4cpWPzsV2eWR2gfEbJL0Q9Smgl9HOVy0si2avNpk4K92r5NEeIh_"
                />
              </article>
              <article>
                <strong>Жижиглэн худалдаа</strong>
                <p>Дэлгүүрийн бараагаа онлайнаар борлуулж, өдөрт нь хүргэх боломж.</p>
                <img
                  alt="Жижиглэн худалдаа"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzSzkMmwrKneN-EbUsCTdqbwJAfEH2OoPqOjC7u3hCS7oujoKV7n1--5BfHKgvXunTZrjz_a66pAdeph_sQdPFusDpvrzuja_mOnAhy-GC8yEN5syP5hc8h5jWdVrss084NJbxDvyQCYyyP1NJ6_AXUBCstUF-vW8zKPmFF_VzHTWFfQ1cUQTlikA1l4k5Vese8q1xkFVJUT8vZGKd1t3LPUnBcBvUC33MehYC2bbRJFeUXM1anij_"
                />
              </article>
            </div>
          </section>

          <section className="landing-partner-contact" id="partner-contact" aria-label="Түнш болох">
            <div>
              <h3>Хамтын ажиллагаагаа эхлүүлье</h3>
              <p>Дэлгүүрээ бүртгүүлээд захиалга, хүргэлт, орлогоо нэг dashboard дээр удирдаарай.</p>
              <button
                className="landing-partner-cta"
                onClick={() => {
                  setPartnerAuthMode("register");
                  setPartnerAuthOpen(true);
                }}
                type="button"
              >
                Бүртгэл үүсгэх
              </button>
            </div>
          </section>

          <footer className="landing-partner-footer">
            <span>Бизнесийн түншлэлийн нэгдсэн баг</span>
            <nav>
              <a href="#partner-contact">Түншийн дэмжлэг</a>
              <a href="#partner-contact">Холбоо барих</a>
            </nav>
          </footer>
        </section>
      ) : null}

      {partnerAuthOpen ? (
        <div className="landing-auth-modal landing-partner-modal" role="dialog" aria-modal="true">
          <form className={partnerAuthMode === "register" ? "is-wizard" : ""} onSubmit={submitPartnerAuth}>
            <header>
              <h2>{partnerAuthMode === "login" ? "Дэлгүүр нэвтрэх" : "Дэлгүүр бүртгүүлэх"}</h2>
              <button onClick={() => setPartnerAuthOpen(false)} type="button">×</button>
            </header>
            <div className="landing-auth-tabs">
              <button className={partnerAuthMode === "login" ? "active" : ""} onClick={() => switchPartnerAuthMode("login")} type="button">Нэвтрэх</button>
              <button className={partnerAuthMode === "register" ? "active" : ""} onClick={() => switchPartnerAuthMode("register")} type="button">Бүртгүүлэх</button>
            </div>

            {partnerAuthMode === "register" ? (
              <>
                <div className="landing-partner-steps">
                  {partnerRegisterSteps.map((label, index) => (
                    <div className={`landing-partner-step ${index === partnerFormStep ? "is-active" : index < partnerFormStep ? "is-done" : ""}`} key={label}>
                      <b>{index < partnerFormStep ? "✓" : index + 1}</b>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                {partnerFormStep === 0 ? (
                  <div className="landing-partner-step-body">
                    <div className="landing-partner-field-grid">
                      <input value={partnerForm.storeName} onChange={(event) => setPartnerForm({ ...partnerForm, storeName: event.target.value })} placeholder="Дэлгүүрийн нэр" />
                      <input value={partnerForm.ownerName} onChange={(event) => setPartnerForm({ ...partnerForm, ownerName: event.target.value })} placeholder="Хариуцсан хүний нэр" />
                      <input value={partnerForm.phone} onChange={(event) => setPartnerForm({ ...partnerForm, phone: event.target.value })} placeholder="Утасны дугаар" />
                      <input value={partnerForm.storeType} onChange={(event) => setPartnerForm({ ...partnerForm, storeType: event.target.value })} placeholder="Дэлгүүрийн төрөл" />
                      <input value={partnerForm.searchableFeature} onChange={(event) => setPartnerForm({ ...partnerForm, searchableFeature: event.target.value })} placeholder="Filter-ээр хайгдах онцлог" />
                      <input value={partnerForm.logoUrl} onChange={(event) => setPartnerForm({ ...partnerForm, logoUrl: event.target.value })} placeholder="Logo URL (заавал биш)" />
                    </div>
                    <input value={partnerForm.address} onChange={(event) => setPartnerForm({ ...partnerForm, address: event.target.value })} placeholder="Дэлгүүрийн хаяг" />
                  </div>
                ) : null}

                {partnerFormStep === 1 ? (
                  <div className="landing-partner-step-body">
                    <p className="landing-partner-step-hint">Захиалгын орлогоо хүлээн авах данс болон бизнесийн зөвшөөрлийн бичгээ баталгаажуулна уу.</p>
                    <div className="landing-partner-field-grid">
                      <select value={partnerVerification.bankId} onChange={(event) => setPartnerVerification({ ...partnerVerification, bankId: event.target.value })}>
                        <option value="">Дансны банк сонгох</option>
                        {qpayBankOptions.map((bank) => (
                          <option key={bank.id} value={bank.id}>{bank.label}</option>
                        ))}
                      </select>
                      <input
                        inputMode="numeric"
                        onChange={(event) => setPartnerVerification({ ...partnerVerification, bankAccountNumber: event.target.value })}
                        placeholder="Дансны дугаар"
                        value={partnerVerification.bankAccountNumber}
                      />
                    </div>
                    <label className="landing-partner-upload">
                      <input
                        accept="image/*,application/pdf"
                        onChange={(event) => setPartnerVerification({ ...partnerVerification, businessLicenseFile: event.target.files?.[0] ?? null })}
                        type="file"
                      />
                      <span>📄</span>
                      <div>
                        <strong>Үйл ажиллагаа явуулж буй зөвшөөрлийн бичиг</strong>
                        <small>{partnerVerification.businessLicenseFile?.name ?? "Файл хавсаргах (зураг эсвэл PDF)"}</small>
                      </div>
                    </label>
                  </div>
                ) : null}

                {partnerFormStep === 2 ? (
                  <div className="landing-partner-step-body">
                    <p className="landing-partner-step-hint">Иргэний үнэмлэх эсвэл гадаад паспортын урд, ард хоёр талыг тод харагдахуйц зургаар хавсаргана уу.</p>
                    <div className="landing-auth-tabs landing-partner-id-type">
                      <button className={partnerVerification.idType === "civil" ? "active" : ""} onClick={() => setPartnerVerification({ ...partnerVerification, idType: "civil" })} type="button">Иргэний үнэмлэх</button>
                      <button className={partnerVerification.idType === "passport" ? "active" : ""} onClick={() => setPartnerVerification({ ...partnerVerification, idType: "passport" })} type="button">Гадаад паспорт</button>
                    </div>
                    <div className="landing-partner-field-grid">
                      <label className="landing-partner-upload">
                        <input
                          accept="image/*"
                          onChange={(event) => setPartnerVerification({ ...partnerVerification, idFrontFile: event.target.files?.[0] ?? null })}
                          type="file"
                        />
                        <span>🪪</span>
                        <div>
                          <strong>Урд тал</strong>
                          <small>{partnerVerification.idFrontFile?.name ?? "Файл хавсаргах"}</small>
                        </div>
                      </label>
                      <label className="landing-partner-upload">
                        <input
                          accept="image/*"
                          onChange={(event) => setPartnerVerification({ ...partnerVerification, idBackFile: event.target.files?.[0] ?? null })}
                          type="file"
                        />
                        <span>🪪</span>
                        <div>
                          <strong>Ард тал</strong>
                          <small>{partnerVerification.idBackFile?.name ?? "Файл хавсаргах"}</small>
                        </div>
                      </label>
                    </div>
                  </div>
                ) : null}

                {partnerFormStep === 3 ? (
                  <div className="landing-partner-step-body">
                    <p className="landing-partner-step-hint">Царайгаа тод гэрэлтэй газар камерын өмнө байрлуулж, бодит цагт зураг аваарай.</p>
                    <div className="landing-partner-camera-preview">
                      {partnerVerification.livePhotoDataUrl ? (
                        <img alt="Баталгаажуулах зураг" src={partnerVerification.livePhotoDataUrl} />
                      ) : (
                        <video autoPlay muted playsInline ref={partnerVideoRef} />
                      )}
                      {!partnerVerification.livePhotoDataUrl && !partnerCameraActive ? (
                        <button className="landing-partner-camera-cta" onClick={startPartnerCamera} type="button">Камер асаах</button>
                      ) : null}
                    </div>
                    <canvas className="landing-partner-camera-canvas" ref={partnerCanvasRef} />
                    <div className="landing-partner-camera-actions">
                      {partnerCameraActive && !partnerVerification.livePhotoDataUrl ? (
                        <button onClick={capturePartnerPhoto} type="button">Зураг авах</button>
                      ) : null}
                      {partnerVerification.livePhotoDataUrl ? (
                        <button onClick={retakePartnerPhoto} type="button">Дахин авах</button>
                      ) : null}
                    </div>
                    {partnerCameraError ? <small className="landing-partner-camera-error">{partnerCameraError}</small> : null}
                  </div>
                ) : null}

                {partnerFormStep === 4 ? (
                  <div className="landing-partner-step-body">
                    <input value={partnerForm.username} onChange={(event) => setPartnerForm({ ...partnerForm, username: event.target.value })} placeholder="Нэвтрэх ID эсвэл Gmail" />
                    <input value={partnerForm.password} onChange={(event) => setPartnerForm({ ...partnerForm, password: event.target.value })} placeholder="Нууц үг" type="password" />
                    <input value={partnerForm.confirmPassword} onChange={(event) => setPartnerForm({ ...partnerForm, confirmPassword: event.target.value })} placeholder="Нууц үг давтах" type="password" />
                    <small className="landing-auth-hint">8+ тэмдэгт, том/жижиг үсэг, тоо, тусгай тэмдэгт орно.</small>
                  </div>
                ) : null}

                {partnerFormStep === 5 ? (
                  <div className="landing-partner-step-body">
                    <p className="landing-partner-step-hint">Бүртгэлээ баталгаажуулахын өмнө дараах гэрээний нөхцөлийг анхааралтай уншина уу.</p>
                    <div className="landing-partner-agreement">
                      <ol>
                        {partnerAgreementClauses.map((clause) => (
                          <li key={clause}>{clause}</li>
                        ))}
                      </ol>
                    </div>
                    <label className="landing-partner-agreement-check">
                      <input
                        checked={partnerAgreementAccepted}
                        onChange={(event) => setPartnerAgreementAccepted(event.target.checked)}
                        type="checkbox"
                      />
                      <span>Дээрх гэрээний нөхцөл, хариуцлагыг бүрэн ойлгож, зөвшөөрч байна.</span>
                    </label>
                  </div>
                ) : null}

                <div className="landing-partner-step-actions">
                  {partnerFormStep > 0 ? (
                    <button onClick={() => goPartnerStep(-1)} type="button">Буцах</button>
                  ) : <span />}
                  {partnerFormStep < partnerRegisterSteps.length - 1 ? (
                    <button className="landing-auth-submit" onClick={() => goPartnerStep(1)} type="button">Үргэлжлүүлэх</button>
                  ) : (
                    <button className="landing-auth-submit" type="submit">Бизнесээ нэмэх</button>
                  )}
                </div>
              </>
            ) : (
              <>
                <input value={partnerForm.username} onChange={(event) => setPartnerForm({ ...partnerForm, username: event.target.value })} placeholder="Нэвтрэх ID эсвэл Gmail" />
                <input value={partnerForm.password} onChange={(event) => setPartnerForm({ ...partnerForm, password: event.target.value })} placeholder="Нууц үг" type="password" />
                <button className="landing-auth-submit" type="submit">Нэвтрэх</button>
              </>
            )}
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
          <span>Хүссэнээ захиалаад, хүргүүлээд аваарай</span>
        </div>
      </section>

      {section === "home" ? (
        <section
          className="landing-showcase"
          aria-label="DeliverHub платформын танилцуулга"
          ref={showcaseRef}
          style={{
            "--showcase-progress": showcaseProgress,
            "--slide-count": landingShowcaseSlides.length,
          } as CSSProperties}
        >
          <div className="landing-showcase-sticky">
            <div className="landing-showcase-model" aria-hidden="true">
              <div className="landing-showcase-ring" />
              <div className="landing-showcase-hero">
                <img alt="" src={heroPromaxImage} />
              </div>
              {landingShowcaseSlides.map((slide, index) => {
                const angle = (index / landingShowcaseSlides.length) * Math.PI * 2 - Math.PI / 2;
                return (
                  <div
                    className={`landing-showcase-card ${index === showcaseActiveIndex ? "is-active" : ""}`}
                    key={slide.title}
                    style={{
                      "--card-index": index,
                      "--fly-x": Math.cos(angle).toFixed(3),
                      "--fly-y": Math.sin(angle).toFixed(3),
                    } as CSSProperties}
                  >
                    <img alt="" src={slide.image} />
                  </div>
                );
              })}
            </div>

            <div className="landing-showcase-copy">
              {landingShowcaseSlides.map((slide, index) => (
                <div
                  className={`landing-showcase-line ${index === showcaseActiveIndex ? "is-active" : index < showcaseActiveIndex ? "is-passed" : ""}`}
                  key={slide.title}
                >
                  <span>{slide.tag}</span>
                  <h2>{slide.title}</h2>
                  <p>{slide.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-showcase-progress" aria-hidden="true">
            {landingShowcaseSlides.map((slide, index) => (
              <i className={index <= showcaseActiveIndex ? "is-active" : ""} key={slide.title} />
            ))}
          </div>
        </section>
      ) : null}

      {section === "contact" ? (
      <section className="landing-contact-dashboard" aria-label="Холбоо барих">
        <div className="landing-contact-head">
          <span>САНАЛ АВАХ</span>
          <h2>Борлуулалтаа өсгөе</h2>
        </div>
        <div className="landing-contact-grid">
          <article>
            <span>Имэйл</span>
            <strong>deliverhub2025@gmail.com</strong>
            <p>Бизнесээ холбох зөвлөгөө аваарай.</p>
          </article>
          <article>
            <span>Утас</span>
            <strong>+976 85356114</strong>
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
        <section className="landing-courier-portal landing-courier-intro" aria-label="Хүргэлтийн ажилтан">
          <section className="landing-courier-hero">
            <div className="landing-courier-copy">
              <h2>Чөлөөт хүргэлтийн <b>нэгдсэн платформ</b></h2>
              <p>Дэлгүүрүүдээс ирэх дуудлагыг ойр байршлаар хүлээн авч, өөрийн цагтаа ажиллан тогтмол орлого олох боломж.</p>
            </div>
            <figure className="landing-courier-visual">
              <img
                alt="Мэргэжлийн хүргэлтийн ажилтан"
                src="https://lh3.googleusercontent.com/aida/AP1WRLtQ86oz2ChSOpdKFlao4LIojwBqcs6bCWDITTBxvZ5-nPTuZ4EJ-vASSUXTHIg53N7Y-HGvGMteuNcJurQKFndgbgOSQK2BYKhjC54XTHQqWbExMlsVKxBGLkpusJmqHBqgrv25vij5jmGezInrR3FMaktUauhfVb7TcoMfJDO8WuZBAKag9cpYpZsUNZ7A6I8IUKjctMMyPCZXxbjxKjtRCaTbrRZTtcahHmkGaSkLVUCkZ1Mb37S-KLM"
              />
            </figure>
          </section>

          <section className="landing-courier-feature-block" aria-label="Давуу тал">
            <header>
              <h3>Яагаад DeliverHub гэж?</h3>
              <p>Бизнесээ өргөжүүлэхэд шаардлагатай логистикийн цогц шийдлийг нэг дороос.</p>
            </header>
            <div className="landing-courier-portal-grid">
              <article>
                <span>◎</span>
                <strong>Баталгаажсан ажилтнууд</strong>
                <p>Манай сүлжээний хүргэлтийн ажилтнууд аюулгүй байдлын бүрэн шалгалтад хамрагдсан.</p>
              </article>
              <article>
                <span>⌖</span>
                <strong>Бодит хяналт</strong>
                <p>Захиалга хаана явааг болон хүргэлтийн явцыг гар утаснаасаа хянах боломжтой.</p>
              </article>
              <article>
                <span>▣</span>
                <strong>Хялбар тооцоо</strong>
                <p>Хүргэлтийн төлбөр болон тооцоо хийх процессийг системээр автоматжуулсан.</p>
              </article>
              <article>
                <span>▱</span>
                <strong>Уян хатан тариф</strong>
                <p>Зай, жин болон яаралтай байдлаас хамаарсан хамгийн оновчтой тарифын систем.</p>
              </article>
            </div>
          </section>

          <section className="landing-courier-benefit">
            <figure>
              <img
                alt="Хүргэлтийн ажилтан"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDuJPn7sNDlDQ73xuuppuazlThVfnB9-HvhkUHiSdKGUp980PZa1Yhva3DO8QLuAIf92Z2wWM0LrPlftAyg7je7yhhmLXIXMsannM_ueAO3FMEHJy9mNIcyC48TLS0dtOzcBPjmoSUNKltekvHCS8a4Zr88fyiyEg38F1ggnvKm-TCXjz_q6082J9Do71v0vaaYf6sh8ETYLd18c1fQseXjEeER0fxf-QNXhu1QMhTEvy5V-9FjHfh2IxI5UJ6QLNnsfBV00UdMxiw"
              />
            </figure>
            <div>
              <h3>Мэргэжлийн хүргэлт,<br /> <b>Чөлөөт цагаараа орлого олох</b></h3>
              <p>DeliverHub-д нэгдсэнээр та чанартай цүнхтэй, ухаалаг системээр ажлаа хянан, найдвартай орлого олох бүрэн боломжтой болно.</p>
              <ul>
                <li><span>◎</span><div><b>Хүссэн үедээ ажилла</b><small>Өдрийн боломжит цагтаа та хүргэлтийн ажил хийж, орлого нэмэгдүүлэх бүрэн боломжтой.</small></div></li>
                <li><span>↗</span><div><b>Шууд дэмжлэг</b><small>Хүргэлтийн үед тулгарсан аливаа асуудалд 24/7 цагийн шуурхай тусламж үзүүлнэ.</small></div></li>
                <li><span>▣</span><div><b>Тогтмол орлого</b><small>Хийсэн хүргэлтээсээ тогтмол түрийвч бүрт нь баталгаатай хянагдана.</small></div></li>
              </ul>
            </div>
          </section>

          <footer className="landing-courier-footer">
            <strong>Хүргэлтийн асуудлаа<br /> өнөөдөр шийд.</strong>
            <span>Хэдхэн минутын дотор бүртгүүлээд эхний захиалгаа илгээж эхлээрэй.</span>
            <nav className="landing-courier-auth-links" aria-label="Хүргэлтийн ажилтан нэвтрэх">
              <a href={`${employeePortalUrl}/?mode=login`}>Нэвтрэх</a>
              <a href={`${employeePortalUrl}/?mode=register`}>Бүртгүүлэх</a>
            </nav>
          </footer>

          <footer className="landing-courier-site-footer">
            <span>© 2026. Бүх эрх хуулиар хамгаалагдсан.</span>
            <nav aria-label="DeliverHub холбоосууд">
              <a href="#stores">Нууцлалын бодлого</a>
              <a href="#stores">Үйлчилгээний нөхцөл</a>
              <a href="#stores">API баримт бичиг</a>
              <a href="#contact">Тусламж</a>
            </nav>
          </footer>
        </section>
      ) : null}
    </main>
  );
}
