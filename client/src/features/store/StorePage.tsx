import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";
import { InteractiveRouteMap, type RouteMapLine, type RouteMapMarker } from "../../components/InteractiveRouteMap";
import { NotificationBell, type NotificationItem } from "../../components/NotificationBell";
import { StateBlock } from "../../components/StateBlock";
import { postJson } from "../../shared/api";
import { nominCatalogProducts, nominStoreProfile } from "../../shared/nominCatalog";
import type { StoreOrder } from "../../shared/types";
import { useRealtimeResource } from "../../shared/useRealtimeResource";

type StoreDashboard = {
  orders: StoreOrder[];
  activeOrder: {
    id: string;
    note: string;
    amountMnt: string;
  } | null;
  subscription?: StoreSubscription;
  review: {
    employeeCode: string;
    identityState: string;
    faceState: string;
  } | null;
};

type StoreTab = "overview" | "orders" | "products" | "reports" | "settings" | "payment";
type ThemeMode = "night" | "light";
type ProductTone = "success" | "warning" | "danger";
type QpayBankId = "khanbank" | "xacbank" | "golomt" | "tdbbank" | "statebank" | "most";

type GeoPoint = {
  lat: number;
  lng: number;
};

type ProductItem = {
  name: string;
  sku: string;
  category: string;
  price: string;
  stockCount: number;
  description: string;
  imageUrl: string;
};

type StoreOrderView = StoreOrder & {
  addressText?: string;
  items?: Array<{ name: string; quantity?: string; amountMnt?: string }>;
  orderTime?: string;
  sourceBody?: string;
};

type StoreDeliveryTracking = NonNullable<StoreOrder["deliveryTracking"]>;

type StoreDispatchResponse = {
  assignmentId: string;
  orderId: string;
  nearestCourier: {
    id?: string;
    employeeId?: string;
    name: string;
    vehicleType: string;
    toPickupKm?: number;
    etaMinutes?: number;
  } | null;
  nearbyCouriers?: StoreDeliveryTracking["nearbyCouriers"];
  routePlan?: StoreDeliveryTracking["routePlan"];
  createdAt?: string | null;
  message?: string;
};

type StoreSubscription = {
  active: boolean;
  status: string;
  planName: string;
  amountMnt: number;
  startsAt?: string | null;
  endsAt?: string | null;
};

type StoreSubscriptionPayment = {
  orderNo: string;
  invoiceId: string;
  amountMnt: number;
  qrText?: string;
  qrImage?: string;
  shortUrl?: string;
  urls?: Array<{ name?: string; description?: string; link?: string; logo?: string }>;
  expiresAt?: string;
};

type StoreSubscriptionInvoiceResponse = {
  subscription: StoreSubscription;
  payment: StoreSubscriptionPayment;
};

type StoreSubscriptionCheckResponse = {
  success: boolean;
  status: string;
  message?: string;
  subscription: StoreSubscription;
};

const localStoreOrdersKey = "deliverhub-store-orders";
const localStoreProductsKey = "deliverhub-store-products";
const localStoreProductsVersionKey = "deliverhub-store-products-version";
const localStoreProductsVersion = "nomin-market-card-sync-v7";
const nominLogoUrl = nominStoreProfile.logoUrl;
const fixedNominStorePosition: GeoPoint = { lat: 47.91785, lng: 106.93528 };
const fallbackStorePosition: GeoPoint = fixedNominStorePosition;
const mapTileSize = 256;
const storeMapZoom = 14;
const storeOfferTimeoutMs = 10_000;
const storePreparedLocalBuildMarker = "prepared-local-v2";
const storeSubscriptionAmountMnt = 50_000;
const qpayBankOptions: Array<{ id: QpayBankId; label: string; mark: string; aliases: string[] }> = [
  { id: "khanbank", label: "ХААН Банк", mark: "ХА", aliases: ["khan", "haan", "хаан"] },
  { id: "xacbank", label: "Хас Банк", mark: "ХС", aliases: ["xac", "has", "xas", "хас"] },
  { id: "golomt", label: "Голомт", mark: "Г", aliases: ["golomt", "голомт"] },
  { id: "tdbbank", label: "TDB", mark: "T", aliases: ["tdb", "trade", "development", "худалдаа"] },
  { id: "statebank", label: "Төрийн банк", mark: "ТБ", aliases: ["state", "төрийн", "turiin"] },
  { id: "most", label: "MOST Money", mark: "M", aliases: ["most"] },
];
const terminalDispatchStatuses = ["REJECTED", "FAILED", "CANCELLED"] as const;
const activeDispatchStatuses = ["ACCEPTED", "ARRIVING_PICKUP", "PICKUP_VERIFICATION", "PICKED_UP", "IN_TRANSIT", "ARRIVING_DROPOFF", "DELIVERED"];
const dispatchStatusesBeyondAccepted = ["PICKUP_VERIFICATION", "PICKED_UP", "IN_TRANSIT", "ARRIVING_DROPOFF", "DELIVERED"];

type StoreIdentity = {
  id: string;
  storeName: string;
};

type ManualOrderForm = {
  customerName: string;
  customerPhone: string;
  addressText: string;
  productSku: string;
  feePayer: "store" | "customer";
};

function vehicleLabel(vehicleType?: string | null) {
  if (vehicleType === "WALK") return "Явган хүргэлт";
  if (vehicleType === "MOPED") return "Мопед";
  if (vehicleType === "CAR") return "Машин";
  return "Тээврийн төрөл";
}

function isActiveDispatchStatus(status?: string | null) {
  return activeDispatchStatuses.includes(String(status));
}

function isDispatchStatusBeyondAccepted(status?: string | null) {
  return dispatchStatusesBeyondAccepted.includes(String(status));
}

function formatMnt(value: number | string) {
  return `₮${Number(value || 0).toLocaleString("mn-MN")}`;
}

function moneyValue(value: number | string | undefined) {
  const amount = Number(String(value ?? "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
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
  urls: StoreSubscriptionPayment["urls"] = [],
  bank: { aliases: string[] },
) {
  return urls.find((url) => {
    const text = normalizeQpayBankText([url.name, url.description, url.link].filter(Boolean).join(" "));
    return bank.aliases.some((alias) => text.includes(normalizeQpayBankText(alias)));
  });
}

function trackingStatusLabel(tracking?: StoreDeliveryTracking | null) {
  if (!tracking) return "";
  if (tracking.status === "REJECTED") return "Хүргэлтийн ажилтан хариу өгөөгүй - дахин хүргэлт дуудаж болно";
  if (tracking.status === "OFFERED") return "Ойрын хүргэлтийн ажилтанд санал илгээгдсэн";
  if (tracking.status === "ACCEPTED") return "Хүргэлтийн ажилтан захиалгыг авлаа";
  if (tracking.status === "ARRIVING_PICKUP") return "Хүргэлтийн ажилтан дэлгүүр рүү ирж байна";
  if (tracking.status === "PICKUP_VERIFICATION") return "Хүргэлтийн ажилтан ирсэн - store OTP баталгаажуулна";
  if (tracking.status === "PICKED_UP") return "Захиалга хүргэлтэнд гарлаа";
  if (tracking.status === "IN_TRANSIT") return "Хэрэглэгч рүү хүргэж байна";
  if (tracking.status === "ARRIVING_DROPOFF") return "Хүлээн авагчид ойртож байна";
  if (tracking.status === "DELIVERED") return "Захиалга дууссан";
  return tracking.statusLabel ?? tracking.status;
}

function isForStore(order: StoreOrder, store?: StoreIdentity) {
  if (!store) return true;
  return order.storeId === store.id || displayStoreName(order.storeName) === displayStoreName(store.storeName) || (!order.storeId && !order.storeName);
}

function readLocalOrders(store?: StoreIdentity): StoreOrder[] {
  try {
    const raw = localStorage.getItem(localStoreOrdersKey);
    const orders = raw ? (JSON.parse(raw) as StoreOrder[]) : [];
    return orders.filter((order) => isForStore(order, store));
  } catch {
    return [];
  }
}

function fieldFromNotification(body: string, label: string) {
  const nextLabels = ["Нийт дүн", "Бараа", "Хаяг"].filter((item) => item !== label).join("|");
  const match = body.match(new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\s(?:${nextLabels}):|$)`));
  return match?.[1]?.replace(/\.$/, "").trim() ?? "";
}

function amountFromNotification(body: string) {
  return fieldFromNotification(body, "Нийт дүн").replace(/\s*MNT\.?$/i, "").trim() || "0";
}

function itemsFromNotification(body: string) {
  const rawItems = fieldFromNotification(body, "Бараа");
  if (!rawItems) return [];
  return rawItems.split(",").map((rawItem) => {
    const trimmed = rawItem.trim();
    const quantityMatch = trimmed.match(/\s+x\s*(\d+)$/i);
    return {
      name: trimmed.replace(/\s+x\s*\d+$/i, "").trim(),
      quantity: quantityMatch?.[1],
    };
  }).filter((item) => item.name);
}

function notificationToOrder(item: NotificationItem, store?: StoreIdentity): StoreOrderView {
  const orderIdMatch = `${item.title} ${item.body}`.match(/#([A-Za-z0-9-]+)/);
  const id = orderIdMatch?.[1] ?? `notif-${item.id}`;
  return {
    id,
    status: storeOrderStatuses.paid,
    amountMnt: amountFromNotification(item.body),
    district: fieldFromNotification(item.body, "Хаяг") || "Хаяг хүлээгдэж байна",
    storeId: item.storeId ?? store?.id,
    storeName: item.storeName ?? store?.storeName,
    addressText: fieldFromNotification(item.body, "Хаяг"),
    items: itemsFromNotification(item.body),
    orderTime: item.createdAt,
    sourceBody: item.body,
  };
}

const text = {
  storeName: nominStoreProfile.name,
  open: "\u041D\u044D\u044D\u043B\u0442\u0442\u044D\u0439",
  overview: "\u0421\u0430\u043C\u0431\u0430\u0440",
  orders: "\u0417\u0430\u0445\u0438\u0430\u043B\u0433\u0430",
  products: "\u0411\u0430\u0440\u0430\u0430",
  reports: "\u0422\u0430\u0439\u043B\u0430\u043D",
  settings: "\u0422\u043E\u0445\u0438\u0440\u0433\u043E\u043E",
  newDelivery: "\u0428\u0438\u043D\u044D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442",
  search: "\u0425\u0430\u0439\u0445...",
  nightMode: "Night mode",
  lightMode: "Light mode",
  todayOrders: "\u04E8\u043D\u04E9\u04E9\u0434\u0440\u0438\u0439\u043D \u0437\u0430\u0445\u0438\u0430\u043B\u0433\u0430",
  revenue: "\u041E\u0440\u043B\u043E\u0433\u043E",
  activeDelivery: "\u0418\u0434\u044D\u0432\u0445\u0442\u044D\u0439 \u0445\u04AF\u0440\u0433\u044D\u043B\u0442",
  stock: "\u0411\u0430\u0440\u0430\u0430\u043D\u044B \u043D\u04E9\u04E9\u0446",
  welcome: "\u0422\u0430\u0432\u0442\u0430\u0439 \u043C\u043E\u0440\u0438\u043B",
  welcomeCopy: "\u0417\u0430\u0445\u0438\u0430\u043B\u0433\u0430, \u0431\u0430\u0440\u0430\u0430, pickup \u0431\u043E\u043B\u043E\u043D \u04E9\u043D\u04E9\u04E9\u0434\u0440\u0438\u0439\u043D \u043E\u0440\u043B\u043E\u0433\u044B\u0433 \u043D\u044D\u0433 \u0441\u0430\u043C\u0431\u0430\u0440\u0430\u0430\u0441 \u0445\u044F\u043D\u0430.",
  orderBoard: "\u0417\u0430\u0445\u0438\u0430\u043B\u0433\u044B\u043D \u0441\u0430\u043C\u0431\u0430\u0440",
  productManagement: "\u0411\u0430\u0440\u0430\u0430 \u0443\u0434\u0438\u0440\u0434\u043B\u0430\u0433\u0430",
  addProduct: "\u0411\u0430\u0440\u0430\u0430 \u043D\u044D\u043C\u044D\u0445",
  inventoryTitle: "\u0411\u0430\u0440\u0430\u0430 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B\u043D \u0431\u04AF\u0440\u0442\u0433\u044D\u043B",
  inventoryCopy: "\u0411\u0430\u0440\u0430\u0430\u043D\u044B \u04AF\u043B\u0434\u044D\u0433\u0434\u044D\u043B, \u04AF\u043D\u044D, \u0442\u04E9\u043B\u04E9\u0432 \u0431\u043E\u043B\u043E\u043D \u0430\u043D\u0433\u0438\u043B\u043B\u044B\u0433 \u043D\u044D\u0433 \u0434\u044D\u043B\u0433\u044D\u0446\u044D\u044D\u0441 \u0445\u044F\u043D\u0430.",
  productListTitle: "\u0411\u0430\u0440\u0430\u0430 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B\u043D \u0436\u0430\u0433\u0441\u0430\u0430\u043B\u0442",
  productSearch: "\u0411\u0430\u0440\u0430\u0430 \u0445\u0430\u0439\u0445...",
  filter: "\u0428\u04AF\u04AF\u043B\u0442\u04AF\u04AF\u0440",
  totalProducts: "\u041D\u0438\u0439\u0442 \u0431\u0430\u0440\u0430\u0430",
  lowStock: "\u04AE\u043B\u0434\u044D\u0433\u0434\u044D\u043B \u0431\u0430\u0433\u0430",
  totalValue: "\u041D\u0438\u0439\u0442 \u04AF\u043D\u044D\u043B\u0433\u044D\u044D",
  categories: "\u0410\u043D\u0433\u0438\u043B\u0430\u043B",
  available: "\u0411\u044D\u043B\u044D\u043D \u0431\u0430\u0439\u043D\u0430",
  reorderNeeded: "\u042F\u0430\u0440\u0430\u043B\u0442\u0430\u0439 \u0437\u0430\u0445\u0438\u0430\u043B\u0430\u0445 \u0448\u0430\u0430\u0440\u0434\u043B\u0430\u0433\u0430\u0442\u0430\u0439",
  edit: "\u0417\u0430\u0441\u0430\u0445",
  delete: "\u0423\u0441\u0442\u0433\u0430\u0445",
  page: "\u0425\u0443\u0443\u0434\u0430\u0441",
  confirm: "\u0411\u0430\u0442\u0430\u043B\u0433\u0430\u0430\u0436\u0443\u0443\u043B\u0441\u0430\u043D",
  reject: "\u0422\u0430\u0442\u0433\u0430\u043B\u0437\u0430\u0445",
  callCourier: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442 \u0434\u0443\u0443\u0434\u0430\u0445",
  urgentPending: "\u042F\u0430\u0440\u0430\u043B\u0442\u0430\u0439 \u0445\u04AF\u043B\u044D\u044D\u0433\u0434\u044D\u0436 \u0431\u0443\u0439",
  assign: "\u0425\u0443\u0432\u0430\u0430\u0440\u0438\u043B\u0430\u0445",
  recentDeliveries: "\u0421\u04AF\u04AF\u043B\u0438\u0439\u043D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u04AF\u04AF\u0434",
  home: "\u041D\u04AF\u04AF\u0440",
  profile: "\u041F\u0440\u043E\u0444\u0430\u0439\u043B",
  actionDone: "\u04AE\u0439\u043B\u0434\u044D\u043B \u0430\u043C\u0436\u0438\u043B\u0442\u0442\u0430\u0439",
  product: "\u0411\u0430\u0440\u0430\u0430",
  category: "\u0410\u043D\u0433\u0438\u043B\u0430\u043B",
  price: "\u04AE\u043D\u044D",
  status: "\u0422\u04E9\u043B\u04E9\u0432",
  active: "\u0418\u0434\u044D\u0432\u0445\u0442\u044D\u0439",
  inactive: "\u0418\u0434\u044D\u0432\u0445\u0433\u04AF\u0439",
  out: "\u0414\u0443\u0443\u0441\u0441\u0430\u043D",
  logout: "\u0413\u0430\u0440\u0430\u0445",
  reportTitle: "\u04E8\u043D\u04E9\u04E9\u0434\u0440\u0438\u0439\u043D \u0442\u0430\u0439\u043B\u0430\u043D",
  settingsTitle: "\u0414\u044D\u043B\u0433\u04AF\u04AF\u0440\u0438\u0439\u043D \u0442\u043E\u0445\u0438\u0440\u0433\u043E\u043E",
  payment: "\u0422\u04E9\u043B\u0431\u04E9\u0440",
};

const tabs: Array<{ key: StoreTab; label: string }> = [
  { key: "overview", label: text.overview },
  { key: "orders", label: text.orders },
  { key: "products", label: text.products },
  { key: "reports", label: text.reports },
  { key: "settings", label: text.settings },
  { key: "payment", label: text.payment },
];

const productTemplates = [
  ["Цагаан будаа 5кг", "Хүнс", "₮28,000", "rice bag grocery product"],
  ["Гурил 2кг", "Хүнс", "₮7,200", "flour bag product"],
  ["Сүү 1л", "Сүү", "₮4,500", "milk bottle product"],
  ["Өндөг 10ш", "Хүнс", "₮8,900", "egg carton product"],
  ["Алим 1кг", "Жимс", "₮9,800", "apples grocery product"],
  ["Төмс 2кг", "Ногоо", "₮6,500", "potatoes grocery product"],
  ["Лууван 1кг", "Ногоо", "₮4,900", "carrots grocery product"],
  ["Үхрийн мах 1кг", "Мах", "₮24,500", "beef meat product"],
  ["Тахианы цээж мах", "Мах", "₮18,500", "chicken breast product"],
  ["Бяслаг 200г", "Сүү", "₮12,400", "cheese package product"],
  ["Талх", "Талх", "₮3,200", "bread loaf product"],
  ["Цөцгийн тос", "Сүү", "₮8,700", "butter package product"],
  ["Йогурт", "Сүү", "₮3,900", "yogurt cup product"],
  ["Гоймон", "Хүнс", "₮2,800", "pasta package product"],
  ["Спагетти", "Хүнс", "₮5,600", "spaghetti package product"],
  ["Кетчуп", "Соус", "₮6,200", "ketchup bottle product"],
  ["Майонез", "Соус", "₮7,400", "mayonnaise jar product"],
  ["Наранцэцгийн тос", "Хүнс", "₮12,900", "cooking oil bottle product"],
  ["Элсэн чихэр 1кг", "Хүнс", "₮4,700", "sugar bag product"],
  ["Давс", "Хүнс", "₮1,900", "salt package product"],
  ["Ногоон цай", "Ундаа", "₮6,900", "green tea box product"],
  ["Кофе", "Ундаа", "₮18,900", "coffee bag product"],
  ["Ус 1.5л", "Ундаа", "₮2,200", "water bottle product"],
  ["Minute Maid 1.25л", "Ундаа", "₮5,500", "Minute Maid 1.25L juice bottle product"],
  ["Кола", "Ундаа", "₮3,500", "cola can product"],
  ["Lays chips", "Амттан", "₮8,800", "Lay's Masala chips bag product"],
  ["Maxfun", "Амттан", "₮9,900", "Alpen Gold Max Fun chocolate 160g product"],
  ["Snickers", "Амттан", "₮4,400", "Snickers chocolate bar product"],
  ["Зайрмаг", "Амттан", "₮4,300", "ice cream cup product"],
  ["Салат", "Бэлэн хоол", "₮8,900", "fresh salad bowl product"],
  ["Сэндвич", "Бэлэн хоол", "₮7,900", "sandwich product"],
  ["Кимбап", "Бэлэн хоол", "₮10,500", "kimbap product"],
  ["Рамен", "Бэлэн хоол", "₮5,900", "instant ramen cup product"],
  ["Хөлдөөсөн бууз", "Хөлдөөсөн", "₮16,800", "frozen dumplings product"],
  ["Хөлдөөсөн банш", "Хөлдөөсөн", "₮14,900", "frozen dumplings package product"],
  ["Загас", "Хөлдөөсөн", "₮19,600", "frozen fish product"],
  ["Самар", "Амттан", "₮11,500", "nuts package product"],
  ["Үзэм", "Амттан", "₮7,700", "raisins package product"],
  ["Зөгийн бал", "Хүнс", "₮22,000", "honey jar product"],
  ["Овьёос", "Хүнс", "₮8,400", "oats package product"],
  ["Corn flakes", "Хүнс", "₮13,500", "corn flakes box product"],
  ["Нойтон салфетка", "Ахуй", "₮5,100", "wet wipes package product"],
  ["Ариун цэврийн цаас", "Ахуй", "₮14,200", "toilet paper package product"],
  ["Угаалгын нунтаг", "Ахуй", "₮18,900", "laundry detergent product"],
  ["Аяга таваг угаагч", "Ахуй", "₮8,800", "dishwashing liquid product"],
  ["Шампунь", "Ахуй", "₮12,700", "shampoo bottle product"],
  ["Саван", "Ахуй", "₮3,100", "soap bar product"],
  ["Гар ариутгагч", "Эрүүл мэнд", "₮5,900", "hand sanitizer bottle product"],
  ["Маск 50ш", "Эрүүл мэнд", "₮9,900", "medical mask box product"],
  ["Витамин C", "Эрүүл мэнд", "₮16,500", "vitamin c bottle product"],
] as const;

function productImageUrl(keyword: string) {
  return `https://source.unsplash.com/900x650/?${encodeURIComponent(keyword)}`;
}

const initialProducts: ProductItem[] = productTemplates.map(([name, category, price, keyword], index) => ({
  name,
  sku: `NM-${String(index + 1).padStart(4, "0")}`,
  category,
  price,
  stockCount: index % 17 === 0 ? 0 : 8 + ((index * 7) % 68),
  description: `Номин Супермаркет - ${category.toLowerCase()} ангиллын бараа.`,
  imageUrl: productImageUrl(keyword),
}));

const syncedNominProducts: ProductItem[] = nominCatalogProducts.map((product) => ({
  name: product.name,
  sku: product.sku,
  category: product.category,
  price: `₮${product.priceMnt.toLocaleString("mn-MN")}`,
  stockCount: product.stockCount,
  description: product.description,
  imageUrl: product.imageUrl,
}));

function readSavedProducts(): ProductItem[] {
  try {
    if (localStorage.getItem(localStoreProductsVersionKey) !== localStoreProductsVersion) {
      localStorage.setItem(localStoreProductsKey, JSON.stringify(syncedNominProducts));
      localStorage.setItem(localStoreProductsVersionKey, localStoreProductsVersion);
      return syncedNominProducts;
    }

    const raw = localStorage.getItem(localStoreProductsKey);
    return raw ? (JSON.parse(raw) as ProductItem[]) : syncedNominProducts;
  } catch {
    return syncedNominProducts;
  }
}

function productStatus(product: ProductItem): { status: string; stock: string; tone: ProductTone } {
  if (product.stockCount <= 0) return { status: text.out, stock: "0 \u0448", tone: "danger" };
  if (product.stockCount <= 12) return { status: text.reorderNeeded, stock: `${product.stockCount} \u0448`, tone: "warning" };
  return { status: text.available, stock: `${product.stockCount} \u0448`, tone: "success" };
}

const storeOrderStatuses = {
  paid: "PAID",
  confirmed: "CONFIRMED",
  preparing: "PREPARING",
  prepared: "READY_FOR_PICKUP",
  courierCalled: "COURIER_ASSIGNED",
  rejected: "PAYMENT_FAILED",
};

function storeOrderStatusLabel(status: string) {
  if (status === storeOrderStatuses.paid || status === storeOrderStatuses.confirmed) return "Төлбөр төлөгдсөн - дэлгүүр баталгаажуулна";
  if (status === storeOrderStatuses.preparing) return "Дэлгүүр хүлээж авлаа - бараа бэлтгэж байна";
  if (status === storeOrderStatuses.prepared) return "Бэлтгэж дууслаа - хүргэлт дуудахад бэлэн";
  if (status === storeOrderStatuses.courierCalled) return "Хүргэлт дуудсан - courier assignment хүлээгдэж байна";
  if (status === "COURIER_ARRIVING") return "Хүргэлтийн ажилтан дэлгүүр рүү ирж байна";
  if (status === "PICKUP_VERIFICATION") return "Хүргэлтийн ажилтан ирсэн - store OTP баталгаажуулна";
  if (status === "PICKED_UP" || status === "IN_TRANSIT") return "Хүргэлтэнд гарсан";
  if (status === "DELIVERED" || status === "COMPLETED") return "Захиалга дууссан";
  if (status === storeOrderStatuses.rejected) return "Татгалзсан";
  return status;
}

function displayStoreName(name?: string | null) {
  if (!name || name === "Номин Маркет") return nominStoreProfile.name;
  return name;
}

function orderLabel(index: number) {
  if (index === 0) return "\u0428\u0438\u043D\u044D";
  if (index === 1) return "\u0411\u044D\u043B\u0442\u0433\u044D\u0436 \u0431\u0430\u0439\u043D\u0430";
  return "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u044D\u0434 \u0433\u0430\u0440\u0441\u0430\u043D";
}

function longitudeToTileX(lng: number, zoomLevel: number) {
  return ((lng + 180) / 360) * 2 ** zoomLevel;
}

function latitudeToTileY(lat: number, zoomLevel: number) {
  const latitudeRadians = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2) * 2 ** zoomLevel;
}

function getMapTileUrl(x: number, y: number, zoomLevel: number) {
  return `https://tile.openstreetmap.org/${zoomLevel}/${x}/${y}.png`;
}

function getStoreMapTiles(center: GeoPoint, zoomLevel: number) {
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
          left: `calc(50% + ${(x - centerX) * mapTileSize}px)`,
          top: `calc(50% + ${(y - centerY) * mapTileSize}px)`,
        } as CSSProperties,
      };
    }),
  );
}

function mapPointStyle(point: GeoPoint, center: GeoPoint, zoomLevel: number): CSSProperties {
  const offsetX = (longitudeToTileX(point.lng, zoomLevel) - longitudeToTileX(center.lng, zoomLevel)) * mapTileSize;
  const offsetY = (latitudeToTileY(point.lat, zoomLevel) - latitudeToTileY(center.lat, zoomLevel)) * mapTileSize;
  return {
    left: `calc(50% + ${offsetX}px)`,
    top: `calc(50% + ${offsetY}px)`,
  };
}

function mapRouteStyle(from: GeoPoint, to: GeoPoint, center: GeoPoint, zoomLevel: number): CSSProperties {
  const fromX = (longitudeToTileX(from.lng, zoomLevel) - longitudeToTileX(center.lng, zoomLevel)) * mapTileSize;
  const fromY = (latitudeToTileY(from.lat, zoomLevel) - latitudeToTileY(center.lat, zoomLevel)) * mapTileSize;
  const toX = (longitudeToTileX(to.lng, zoomLevel) - longitudeToTileX(center.lng, zoomLevel)) * mapTileSize;
  const toY = (latitudeToTileY(to.lat, zoomLevel) - latitudeToTileY(center.lat, zoomLevel)) * mapTileSize;
  const dx = toX - fromX;
  const dy = toY - fromY;

  return {
    "--route-left": `calc(50% + ${fromX}px)`,
    "--route-top": `calc(50% + ${fromY}px)`,
    "--route-width": `${Math.sqrt(dx ** 2 + dy ** 2)}px`,
    "--route-angle": `${Math.atan2(dy, dx)}rad`,
  } as CSSProperties;
}

function mapWalkingRouteSegments(from: GeoPoint, to: GeoPoint, center: GeoPoint, zoomLevel: number) {
  const turnA = {
    lat: from.lat + (to.lat - from.lat) * 0.22,
    lng: from.lng,
  };
  const turnB = {
    lat: turnA.lat,
    lng: from.lng + (to.lng - from.lng) * 0.58,
  };
  const turnC = {
    lat: from.lat + (to.lat - from.lat) * 0.72,
    lng: turnB.lng,
  };
  const points = [from, turnA, turnB, turnC, to];

  return points.slice(1).map((point, index) => ({
    key: `${index}-${point.lat.toFixed(5)}-${point.lng.toFixed(5)}`,
    style: mapRouteStyle(points[index], point, center, zoomLevel),
  }));
}

function mapCenterFor(points: Array<GeoPoint | undefined | null>) {
  const usablePoints = points.filter(Boolean) as GeoPoint[];
  if (!usablePoints.length) return fallbackStorePosition;

  return {
    lat: usablePoints.reduce((sum, point) => sum + point.lat, 0) / usablePoints.length,
    lng: usablePoints.reduce((sum, point) => sum + point.lng, 0) / usablePoints.length,
  };
}

export function StorePage({ onLogout, store }: { onLogout?: () => void; store?: StoreIdentity }) {
  const dashboard = useRealtimeResource<StoreDashboard>("/dashboard", ["store.dashboard.refresh"]);
  const [activeTab, setActiveTab] = useState<StoreTab>("overview");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem("deliverhub-store-theme") === "light" ? "light" : "night"));
  const [notice, setNotice] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [products, setProducts] = useState<ProductItem[]>(readSavedProducts);
  const [stockEditor, setStockEditor] = useState<ProductItem | null>(null);
  const [stockDraft, setStockDraft] = useState("0");
  const [localOrders, setLocalOrders] = useState<StoreOrder[]>(() => readLocalOrders(store));
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const [manualOrderForm, setManualOrderForm] = useState<ManualOrderForm>({
    customerName: "",
    customerPhone: "",
    addressText: "",
    productSku: "",
    feePayer: "store",
  });
  const [manualOrderError, setManualOrderError] = useState("");
  const [dispatchTrackings, setDispatchTrackings] = useState<Record<string, StoreDeliveryTracking>>({});
  const [pickupOtpByAssignment, setPickupOtpByAssignment] = useState<Record<string, string>>({});
  const [dispatchClock, setDispatchClock] = useState(Date.now());
  // Ratchet: once an order's workflow step is reached it must never appear to
  // regress on screen, even if a stale/in-flight fetch briefly reports an
  // earlier status. Tracks the highest step index seen per order.
  const maxWorkflowStepRef = useRef<Record<string, number>>({});
  const [selectedSubscriptionBank, setSelectedSubscriptionBank] = useState<QpayBankId>("khanbank");
  const [subscriptionPayment, setSubscriptionPayment] = useState<StoreSubscriptionPayment | null>(null);
  const [subscriptionPaymentOpen, setSubscriptionPaymentOpen] = useState(false);
  const [subscriptionSubmitting, setSubscriptionSubmitting] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState("");
  const refreshDashboard = dashboard.refetch;

  useEffect(() => {
    localStorage.setItem("deliverhub-store-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(localStoreProductsKey, JSON.stringify(products));
    localStorage.setItem(localStoreProductsVersionKey, localStoreProductsVersion);
  }, [products]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setDispatchClock(Date.now());
      void refreshDashboard({ silent: true });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [refreshDashboard]);

  useEffect(() => {
    setDispatchTrackings((current) => {
      let changed = false;
      const next = Object.fromEntries(Object.entries(current).map(([orderId, tracking]) => {
        if (tracking.status !== "OFFERED" || (offerRemainingSec(tracking) ?? 0) > 0) return [orderId, tracking];
        changed = true;
        return [orderId, {
          ...tracking,
          status: "REJECTED",
          statusLabel: "Хүргэлтийн ажилтан хариу өгөөгүй - дахин хүргэлт дуудаж болно",
        }];
      }));
      return changed ? next : current;
    });
  }, [dispatchClock]);

  useEffect(() => {
    const liveOrders = dashboard.data?.orders ?? [];
    if (!liveOrders.length) return;

    setDispatchTrackings((current) => {
      let changed = false;
      const next = { ...current };

      liveOrders.forEach((order) => {
        if (isActiveDispatchStatus(order.deliveryTracking?.status) && next[order.id]) {
          delete next[order.id];
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [dashboard.data?.orders]);

  useEffect(() => {
    setProductPage(1);
  }, [productSearch]);

  useEffect(() => {
    function refreshLocalOrders(event?: Event) {
      if (event instanceof StorageEvent && event.key && event.key !== localStoreOrdersKey) return;
      setLocalOrders(readLocalOrders(store));
    }

    refreshLocalOrders();
    window.addEventListener("storage", refreshLocalOrders);
    window.addEventListener("focus", refreshLocalOrders);
    return () => {
      window.removeEventListener("storage", refreshLocalOrders);
      window.removeEventListener("focus", refreshLocalOrders);
    };
  }, [store?.id, store?.storeName]);

  function openStockEditor(product: ProductItem) {
    setStockEditor(product);
    setStockDraft(String(product.stockCount));
  }

  function saveStockEditor() {
    if (!stockEditor) return;
    const nextStock = Math.max(0, Math.round(Number(stockDraft || 0)));
    setProducts((current) => current.map((product) => (
      product.sku === stockEditor.sku ? { ...product, stockCount: nextStock } : product
    )));
    setNotice(`${stockEditor.name} үлдэгдэл ${nextStock} ш болж хадгалагдлаа.`);
    setStockEditor(null);
  }

  function parseProductPrice(price: string) {
    const numeric = Number(price.replace(/[^\d]/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function openManualOrderForm() {
    setActiveTab("orders");
    setManualOrderOpen(true);
    setManualOrderError("");
    setManualOrderForm((current) => ({
      ...current,
      productSku: current.productSku || products[0]?.sku || "",
    }));
  }

  function createManualOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedProduct = products.find((product) => product.sku === manualOrderForm.productSku);

    if (!manualOrderForm.customerName.trim()) {
      setManualOrderError("Хэрэглэгчийн нэрээ оруулна уу.");
      return;
    }

    if (!manualOrderForm.customerPhone.trim()) {
      setManualOrderError("Хэрэглэгчийн утсаа оруулна уу.");
      return;
    }

    if (!manualOrderForm.addressText.trim()) {
      setManualOrderError("Дэлгэрэнгүй хаягаа оруулна уу.");
      return;
    }

    if (!selectedProduct) {
      setManualOrderError("Бараа сонгоно уу.");
      return;
    }

    const deliveryFee = manualOrderForm.feePayer === "store" ? 0 : 10000;
    const amount = parseProductPrice(selectedProduct.price) + deliveryFee;
    const id = `manual-${Date.now().toString(36)}`;
    const nextOrder: StoreOrderView = {
      id,
      status: storeOrderStatuses.paid,
      amountMnt: String(amount),
      district: manualOrderForm.addressText.trim(),
      storeId: store?.id,
      storeName: displayStoreName(store?.storeName),
      addressText: manualOrderForm.addressText.trim(),
      items: [{ name: selectedProduct.name, quantity: "1", amountMnt: String(parseProductPrice(selectedProduct.price)) }],
      orderTime: new Date().toISOString(),
      sourceBody: `${manualOrderForm.customerName.trim()} · +976 ${manualOrderForm.customerPhone.trim()} · Төлбөр: ${manualOrderForm.feePayer === "store" ? "Дэлгүүр" : "Хэрэглэгч"}`,
    };

    setLocalOrders((current) => {
      const nextOrders = [nextOrder, ...current];
      localStorage.setItem(localStoreOrdersKey, JSON.stringify(nextOrders));
      return nextOrders;
    });
    setSelectedOrderId(id);
    setManualOrderOpen(false);
    setManualOrderError("");
    setManualOrderForm({
      customerName: "",
      customerPhone: "",
      addressText: "",
      productSku: products[0]?.sku || "",
      feePayer: "store",
    });
    setNotice("Гар захиалга үүслээ. Самбар дээр нэмэгдсэн.");
    window.setTimeout(() => setNotice(null), 2200);
  }

  function trackingFromDispatch(result: StoreDispatchResponse): StoreDeliveryTracking {
    return {
      assignmentId: result.assignmentId,
      status: "OFFERED",
      statusLabel: result.nearestCourier
        ? "Ойрын хүргэлтийн ажилтанд санал илгээгдсэн"
        : "Ойрын хүргэлтийн ажилтны queue-д санал илгээгдсэн",
      courier: result.nearestCourier
        ? {
            id: result.nearestCourier.employeeId ?? result.nearestCourier.id ?? result.assignmentId,
            name: result.nearestCourier.name,
            vehicleType: result.nearestCourier.vehicleType,
          }
        : null,
      createdAt: result.createdAt ?? new Date().toISOString(),
      nearbyCouriers: result.nearbyCouriers ?? [],
      routePlan: result.routePlan,
    };
  }

  async function verifyPickupFromStore(orderId: string, assignmentId: string) {
    try {
      await postJson(`/assignments/${assignmentId}/verify-pickup`, { otp: pickupOtpByAssignment[assignmentId] ?? "" });
      setDispatchTrackings((current) => ({
        ...current,
        [orderId]: current[orderId]
          ? {
              ...current[orderId],
              status: "PICKED_UP",
              statusLabel: "Захиалга хүргэлтэнд гарлаа",
            }
          : current[orderId],
      }));
      setNotice("Захиалга хүргэлтэнд гарлаа.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "OTP баталгаажуулахад алдаа гарлаа.");
    }
    window.setTimeout(() => setNotice(null), 2600);
  }

  async function createSubscriptionInvoice() {
    setSubscriptionError("");
    setSubscriptionSubmitting(true);
    setNotice(null);

    try {
      setSubscriptionPaymentOpen(true);
      const result = await postJson<StoreSubscriptionInvoiceResponse>("/subscription/qpay/invoice");
      setSubscriptionPayment(result.payment);
      setNotice("QPay invoice үүслээ. Банкны app-аар эсвэл QR уншуулж төлнө үү.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "QPay invoice үүсгэхэд алдаа гарлаа.";
      setSubscriptionError(message);
      setNotice(message);
    } finally {
      setSubscriptionSubmitting(false);
    }
  }

  async function checkSubscriptionPaymentStatus() {
    if (!subscriptionPayment) return;

    setSubscriptionError("");
    setSubscriptionSubmitting(true);
    setNotice("Төлбөр шалгаж байна...");

    try {
      const result = await postJson<StoreSubscriptionCheckResponse>("/subscription/qpay/check", {
        invoice_id: subscriptionPayment.invoiceId,
      });

      if (result.status !== "PAID") {
        setNotice(result.message ?? "Төлбөр хараахан баталгаажаагүй байна.");
        return;
      }

      setSubscriptionPayment(null);
      setNotice("Үйлчилгээний эрх амжилттай идэвхжлээ.");
      await refreshDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Төлбөр шалгахад алдаа гарлаа.";
      setSubscriptionError(message);
      setNotice(message);
    } finally {
      setSubscriptionSubmitting(false);
    }
  }

  async function runAction(label: string, target: string) {
    const mappedStatus = label === text.confirm
      ? storeOrderStatuses.preparing
      : label === "Бэлтгэж дууссан"
        ? storeOrderStatuses.prepared
        : label === text.callCourier
          ? storeOrderStatuses.courierCalled
          : label === text.reject
            ? storeOrderStatuses.rejected
            : null;

    if (mappedStatus) {
      let usedLocalFallback = false;
      const isPreparedAction = mappedStatus === storeOrderStatuses.prepared;
      // Only orders that actually exist on the server (e.g. surfaced via a notification,
      // or already in the dashboard list) can be advanced through the real workflow.
      // Purely local orders (manual entries not yet persisted) fall back to an
      // optimistic local-only update.
      const isRealOrder = Boolean(dashboard.data?.orders.some((order) => order.id === target));
      const orderSnapshot = localOrders.find((order) => order.id === target)
        ?? dashboard.data?.orders.find((order) => order.id === target);
      try {
        if (!isRealOrder || label === text.reject) {
          usedLocalFallback = true;
        } else if (label === text.confirm) {
          await postJson(`/orders/${target}/accept`);
          void dashboard.refetch({ silent: true });
        } else if (isPreparedAction) {
          await postJson(`/orders/${target}/prepared`);
          void dashboard.refetch({ silent: true });
        } else if (label === text.callCourier) {
          const result = await postJson<StoreDispatchResponse>("/dispatch-request", { orderId: target });
          setDispatchTrackings((current) => ({ ...current, [target]: trackingFromDispatch(result) }));
          void dashboard.refetch({ silent: true });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const canContinueLocally = label !== text.callCourier && !isPreparedAction && label !== text.confirm
          && (message.startsWith("404:") || message.includes("Захиалга олдсонгүй"));
        if (!canContinueLocally) {
          setNotice(error instanceof Error ? error.message : "Захиалгын төлөв шинэчлэхэд алдаа гарлаа.");
          window.setTimeout(() => setNotice(null), 2600);
          return;
        }
        usedLocalFallback = true;
      }

      setLocalOrders((current) => {
        const hasExistingOrder = current.some((order) => order.id === target);
        const nextOrders = hasExistingOrder
          ? current.map((order) => (order.id === target ? { ...order, status: mappedStatus } : order))
          : usedLocalFallback
            ? [{ ...(orderSnapshot ?? { id: target, amountMnt: "0", district: "Захиалгын мэдээлэл шинэчлэгдэж байна" }), status: mappedStatus }, ...current]
            : current;
        localStorage.setItem(localStoreOrdersKey, JSON.stringify(nextOrders));
        return nextOrders;
      });
      setNotice(`${label}: ${target} - ${text.actionDone}`);
      window.setTimeout(() => setNotice(null), 2200);
      return;
    }

    const nextStatus = label === text.confirm
      ? "Дэлгүүр хүлээж авлаа - унаанд тавихад бэлэн"
      : label === text.callCourier
        ? "Унаанд тавилаа - courier assignment хүлээгдэж байна"
        : label === text.reject
          ? "Татгалзсан"
          : null;

    if (nextStatus) {
      setLocalOrders((current) => {
        const nextOrders = current.map((order) => (order.id === target ? { ...order, status: nextStatus } : order));
        localStorage.setItem(localStoreOrdersKey, JSON.stringify(nextOrders));
        return nextOrders;
      });
    }

    setNotice(`${label}: ${target} - ${text.actionDone}`);
    window.setTimeout(() => setNotice(null), 2200);
  }

  function handleNotificationSelect(item: NotificationItem) {
    const order = notificationToOrder(item, store);
    setLocalOrders((current) => {
      const nextOrders = [order, ...current.filter((currentOrder) => currentOrder.id !== order.id)];
      localStorage.setItem(localStoreOrdersKey, JSON.stringify(nextOrders));
      return nextOrders;
    });
    setSelectedOrderId(order.id);
    setActiveTab("orders");
    setNotice("Шинэ захиалга Захиалга цэс рүү орлоо.");
    window.setTimeout(() => setNotice(null), 2200);
  }

  function offerRemainingSec(tracking?: StoreDeliveryTracking | null) {
    if (tracking?.status !== "OFFERED" || !tracking.createdAt) return null;
    const createdAtMs = new Date(tracking.createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) return 10;
    return Math.max(0, Math.ceil((createdAtMs + storeOfferTimeoutMs - dispatchClock) / 1000));
  }

  function isDispatchExpired(tracking?: StoreDeliveryTracking | null) {
    if (!tracking) return false;
    if (terminalDispatchStatuses.includes(String(tracking.status) as typeof terminalDispatchStatuses[number])) return true;
    return tracking.status === "OFFERED" && offerRemainingSec(tracking) === 0;
  }

  function preferredTracking(
    liveTracking?: StoreDeliveryTracking | null,
    localTracking?: StoreDeliveryTracking | null,
  ) {
    if (isActiveDispatchStatus(liveTracking?.status)) return liveTracking;
    if (liveTracking?.status === "OFFERED") return liveTracking;
    return isDispatchExpired(localTracking) ? localTracking : liveTracking ?? localTracking ?? null;
  }

  function currentOfferCourier(tracking?: StoreDeliveryTracking | null) {
    if (tracking?.status !== "OFFERED" || !tracking.courier?.id) return null;

    const nearbyCouriers = tracking.nearbyCouriers ?? [];
    const matchedCourier = nearbyCouriers.find((courier) => courier.employeeId === tracking.courier?.id) ?? null;
    const location = tracking.routePlan?.courier ?? matchedCourier?.location;

    if (!location) return null;

    return {
      employeeId: tracking.courier.id,
      name: matchedCourier?.name ?? tracking.courier?.name ?? "Ойрын хүргэлтийн ажилтан",
      toPickupKm: matchedCourier?.toPickupKm ?? tracking.routePlan?.toPickupKm ?? 0,
      etaMinutes: matchedCourier?.etaMinutes ?? tracking.routePlan?.etaMinutes ?? 0,
      location,
    };
  }

  function renderLiveStoreMap(options: {
    tracking?: StoreDeliveryTracking | null;
    statusLabel?: string;
    orderId?: string;
    className?: string;
  } = {}) {
    const route = options.tracking?.routePlan;
    const isOfferOnly = options.tracking?.status === "OFFERED";
    const offerCourier = currentOfferCourier(options.tracking);
    const offerRemaining = offerRemainingSec(options.tracking);
    const hasAcceptedRoute = Boolean(route && !isOfferOnly);
    const storePoint = fallbackStorePosition;
    const offerCourierPoint = offerCourier?.location;
    const courierPoint = hasAcceptedRoute ? route?.courier : undefined;
    const dropoffPoint = hasAcceptedRoute ? route?.dropoff : undefined;
    const courierName = options.tracking?.courier?.name ?? "Ойрын хүргэлтийн ажилтан";
    const markers: RouteMapMarker[] = [
      { id: "store", point: storePoint, label: "Дэлгүүр", kind: "store" },
      ...(dropoffPoint ? [{ id: "dropoff", point: dropoffPoint, label: "Хүргэх хаяг", kind: "customer" as const }] : []),
      ...(courierPoint ? [{ id: "courier", point: courierPoint, label: courierName, kind: "courier" as const }] : []),
      ...(isOfferOnly && offerCourierPoint && offerCourier ? [{ id: "offer", point: offerCourierPoint, label: offerCourier.name, kind: "offer" as const }] : []),
    ];
    const routes: RouteMapLine[] = [
      ...(courierPoint ? [{ id: "courier-store", from: courierPoint, to: storePoint, kind: "pickup" as const }] : []),
      ...(dropoffPoint ? [{ id: "store-customer", from: storePoint, to: dropoffPoint, kind: "dropoff" as const }] : []),
    ];

    return (
      <InteractiveRouteMap
        className={`store-live-map ${options.className ?? ""}`}
        initialZoom={storeMapZoom}
        markers={markers}
        routes={routes}
        statusLabel={options.statusLabel || trackingStatusLabel(options.tracking) || "Дэлгүүрийн байршил"}
        statusDetail={`${options.orderId ? `#${options.orderId} · ` : ""}${isOfferOnly ? "Ойрын хүргэлтийн ажилтнууд - зайгаар эрэмбэлсэн" : "Nomin тогтмол авах цэг - Бөхийн Өргөө"}`}
      >
        {isOfferOnly && offerCourierPoint && offerCourier && (
          <i
            className="store-live-offer-courier"
            style={{
              "--offer-progress": `${Math.max(0, Math.min(360, ((offerRemaining ?? 10) / 10) * 360))}deg`,
              top: 18,
              right: 18,
              transform: "none",
            } as CSSProperties}
            title={`${offerCourier.name} · ${offerCourier.toPickupKm.toFixed(1)} км`}
          >
            <b>{offerRemaining ?? 10}</b>
            <span>{offerCourier.name}</span>
          </i>
        )}
      </InteractiveRouteMap>
    );
  }

  function renderDeliveryTracking(order: StoreOrderView, tracking?: StoreDeliveryTracking | null) {
    if (!tracking) return null;

    const route = tracking.routePlan;
    const isAccepted = ["ACCEPTED", "ARRIVING_PICKUP", "PICKUP_VERIFICATION"].includes(tracking.status);
    const isDelivering = ["PICKED_UP", "IN_TRANSIT", "ARRIVING_DROPOFF"].includes(tracking.status);
    const needsStoreOtp = tracking.status === "PICKUP_VERIFICATION";
    const offerCourier = currentOfferCourier(tracking);
    const offerRemaining = offerRemainingSec(tracking);
    const courierName = tracking.courier?.name ?? "Ойрын хүргэлтийн ажилтан";
    const eta = route?.etaMinutes ?? tracking.routePlan?.drivingMinutes ?? 0;
    const toPickupKm = route?.toPickupKm ?? 0;
    const nearbyCouriers = tracking.nearbyCouriers ?? [];
    const dispatchStageText = isDelivering
      ? "Хэрэглэгч рүү хүргэж байна"
      : isAccepted
        ? "Хүргэлтийн ажилтан ирж байна"
        : "Ойрын хүргэлтийн ажилтанд санал илгээгдсэн";

    return (
      <section className={`store-dispatch-tracker ${isDelivering ? "is-delivering" : isAccepted ? "is-accepted" : "is-searching"}`}>
        {renderLiveStoreMap({ tracking, orderId: order.id, className: "store-dispatch-map" })}
        <div className="store-dispatch-detail">
          <span>{dispatchStageText}</span>
          {offerCourier && <span>{offerCourier.name} дээр {offerRemaining ?? 10} сек хүлээж байна</span>}
          <h3>{courierName}</h3>
          <p>{trackingStatusLabel(tracking)}</p>
          <div>
            <b>{toPickupKm.toFixed(1)} км</b>
            <b>{eta} мин</b>
            <b>{vehicleLabel(tracking.courier?.vehicleType)}</b>
          </div>
          {tracking.status === "OFFERED" && nearbyCouriers.length ? (
            <div className="store-nearby-couriers">
              {nearbyCouriers.slice(0, 5).map((courier, index) => (
                <span className={(offerCourier?.employeeId ?? tracking?.courier?.id) === courier.employeeId ? "matched" : ""} key={courier.employeeId}>
                  <i>{courier.queueIndex ?? index + 1}</i>
                  <strong>{courier.name}</strong>
                  <b>{courier.toPickupKm.toFixed(1)} км · {courier.etaMinutes} мин</b>
                </span>
              ))}
            </div>
          ) : null}
          {needsStoreOtp ? (
            <label className="store-pickup-otp">
              <span>Хүргэлтийн ажилтны өгсөн 6 оронтой OTP</span>
              <input
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setPickupOtpByAssignment((current) => ({
                  ...current,
                  [tracking.assignmentId]: event.target.value.replace(/\D/g, ""),
                }))}
                placeholder="123456"
                value={pickupOtpByAssignment[tracking.assignmentId] ?? ""}
              />
              <button onClick={() => verifyPickupFromStore(order.id, tracking.assignmentId)} type="button">
                Хүргэлтэнд гаргах
              </button>
            </label>
          ) : null}
        </div>
      </section>
    );
  }

  function renderManualOrderForm() {
    return (
      <section className="store-manual-order-frame" aria-label="Гар захиалга оруулах">
        <header>
          <button onClick={() => setManualOrderOpen(false)} type="button" aria-label="Буцах">‹</button>
          <h2>Гар захиалга оруулах</h2>
          <span aria-hidden="true">
            <img alt="" src={nominLogoUrl} />
          </span>
        </header>
        <form onSubmit={createManualOrder}>
          <section className="store-manual-section">
            <div className="store-manual-section-title">
              <span aria-hidden="true">◎</span>
              <strong>Хэрэглэгчийн мэдээлэл</strong>
            </div>
            <label>
              <span>Хэрэглэгчийн нэр</span>
              <input
                value={manualOrderForm.customerName}
                onChange={(event) => setManualOrderForm({ ...manualOrderForm, customerName: event.target.value })}
                placeholder="Нэр оруулна уу"
              />
            </label>
            <label>
              <span>Хэрэглэгчийн утас</span>
              <div className="store-manual-phone">
                <b>+976</b>
                <input
                  inputMode="tel"
                  value={manualOrderForm.customerPhone}
                  onChange={(event) => setManualOrderForm({ ...manualOrderForm, customerPhone: event.target.value })}
                  placeholder="88******"
                />
              </div>
            </label>
          </section>

          <section className="store-manual-section">
            <div className="store-manual-section-title">
              <span aria-hidden="true">⌖</span>
              <strong>Хүргэлтийн хаяг</strong>
            </div>
            <div className="store-manual-map">
              {renderLiveStoreMap({ statusLabel: "Хаяг сонгох", className: "store-manual-mini-map" })}
              <button type="button">Хаяг сонгох</button>
            </div>
            <label>
              <textarea
                value={manualOrderForm.addressText}
                onChange={(event) => setManualOrderForm({ ...manualOrderForm, addressText: event.target.value })}
                placeholder="Дэлгэрэнгүй хаяг (байр, тоот...)"
                rows={2}
              />
            </label>
          </section>

          <section className="store-manual-section">
            <div className="store-manual-section-title">
              <span aria-hidden="true">▣</span>
              <strong>Бараа ба төлбөр</strong>
            </div>
            <label>
              <span>Бараа сонгох</span>
              <select
                value={manualOrderForm.productSku}
                onChange={(event) => setManualOrderForm({ ...manualOrderForm, productSku: event.target.value })}
              >
                <option value="">Сонгох...</option>
                {products.map((product) => (
                  <option key={product.sku} value={product.sku}>{product.name} · {product.price}</option>
                ))}
              </select>
            </label>
            <div className="store-manual-fee">
              <div>
                <strong>Хүргэлтийн төлбөр</strong>
                <span>Төлбөрийг хэн хариуцах вэ?</span>
              </div>
              <div>
                <button
                  className={manualOrderForm.feePayer === "store" ? "active" : ""}
                  onClick={() => setManualOrderForm({ ...manualOrderForm, feePayer: "store" })}
                  type="button"
                >
                  Дэлгүүр
                </button>
                <button
                  className={manualOrderForm.feePayer === "customer" ? "active" : ""}
                  onClick={() => setManualOrderForm({ ...manualOrderForm, feePayer: "customer" })}
                  type="button"
                >
                  Хэрэглэгч
                </button>
              </div>
            </div>
          </section>

          {manualOrderError ? <p className="store-manual-error" role="alert">{manualOrderError}</p> : null}
          <button className="store-manual-submit" type="submit">
            <span aria-hidden="true">+</span>
            Захиалга үүсгэх
          </button>
        </form>
      </section>
    );
  }

  function renderOrders(orders: StoreOrderView[]) {
    const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0];
    const preparedLabel = "Бэлтгэж дууссан";
    const liveSelectedOrder = selectedOrder ? dashboard.data?.orders.find((order) => order.id === selectedOrder.id) : null;
    const localSelectedTracking = selectedOrder ? dispatchTrackings[selectedOrder.id] : null;
    const liveSelectedTracking = liveSelectedOrder?.deliveryTracking ?? selectedOrder?.deliveryTracking ?? null;
    const selectedTracking = selectedOrder ? preferredTracking(liveSelectedTracking, localSelectedTracking) : null;
    const selectedStatus = liveSelectedOrder?.status ?? selectedOrder?.status;
    const selectedDispatchExpired = isDispatchExpired(selectedTracking);
    const canCallCourier = selectedStatus === storeOrderStatuses.prepared
      || (selectedStatus === storeOrderStatuses.courierCalled && selectedDispatchExpired);
    const workflowStatus = selectedTracking?.status === "PICKED_UP"
      ? "PICKED_UP"
      : selectedTracking?.status === "DELIVERED"
        ? "DELIVERED"
        : selectedTracking?.status === "PICKUP_VERIFICATION"
          ? "PICKUP_VERIFICATION"
          : selectedStatus;
    const workflowSteps = selectedOrder ? [
      { key: storeOrderStatuses.paid, aliases: [storeOrderStatuses.confirmed], label: "Захиалга баталгаажсан" },
      { key: storeOrderStatuses.prepared, aliases: [storeOrderStatuses.courierCalled, "COURIER_ARRIVING", "PICKUP_VERIFICATION"], label: preparedLabel },
      { key: "PICKED_UP", aliases: ["IN_TRANSIT", "ARRIVING_DROPOFF", "ARRIVING"], label: "Хүргэлтэнд гарсан" },
      { key: "DELIVERED", aliases: ["COMPLETED"], label: "Захиалга дууссан" },
    ] : [];
    const computedStepIndex = selectedOrder
      ? Math.max(0, workflowSteps.findIndex((step) => step.key === workflowStatus || step.aliases?.includes(String(workflowStatus))))
      : 0;
    const previousMaxStepIndex = selectedOrder ? maxWorkflowStepRef.current[selectedOrder.id] ?? 0 : 0;
    const activeStepIndex = Math.max(computedStepIndex, previousMaxStepIndex);
    if (selectedOrder && activeStepIndex > previousMaxStepIndex) {
      maxWorkflowStepRef.current[selectedOrder.id] = activeStepIndex;
    }
    const selectedItems = selectedOrder?.items ?? [];
    const selectedAddress = selectedOrder?.addressText || selectedOrder?.district || "Хаяг бүртгэгдээгүй байна";
    const liveStatusForOrder = (order: StoreOrderView) => dashboard.data?.orders.find((item) => item.id === order.id)?.status ?? order.status;
    const trackingForOrder = (order: StoreOrderView) => {
      const localTracking = dispatchTrackings[order.id];
      const liveTracking = dashboard.data?.orders.find((item) => item.id === order.id)?.deliveryTracking ?? order.deliveryTracking ?? null;
      return preferredTracking(liveTracking, localTracking);
    };
    const canCallCourierForOrder = (order: StoreOrderView) => {
      const status = liveStatusForOrder(order);
      const tracking = trackingForOrder(order);
      const expired = isDispatchExpired(tracking);
      return status === storeOrderStatuses.prepared || (status === storeOrderStatuses.courierCalled && expired);
    };
    // Once the assignment is past ACCEPTED (courier arrived at store, picked
    // up, ...), the courier/OTP flow owns the order from here on - the
    // confirm/prepared buttons must never reappear, even if a stale raw
    // order.status briefly says otherwise, or they'd rewrite it backwards.
    const isOrderBeyondDispatch = (order: StoreOrderView) =>
      isDispatchStatusBeyondAccepted(trackingForOrder(order)?.status);
    const selectedBeyondDispatch = isDispatchStatusBeyondAccepted(selectedTracking?.status);

    return (
      <article className={`store-dash-card store-dash-wide ${manualOrderOpen ? "store-manual-order-shell" : ""}`}>
        {manualOrderOpen ? renderManualOrderForm() : null}
        <div className="store-dash-card-head">
          <h2>{text.orderBoard}</h2>
          <span>{orders.length}</span>
        </div>
        {selectedOrder && (
          <section className="store-order-focus">
            <div className="store-order-focus-head">
              <div>
                <span>#{selectedOrder.id}</span>
                <h3>{displayStoreName(selectedOrder.storeName ?? store?.storeName)}</h3>
                <p>{storeOrderStatusLabel(String(selectedStatus))}</p>
              </div>
              <strong>{selectedOrder.amountMnt} MNT</strong>
            </div>
            <div className="store-order-focus-grid">
              <section>
                <span>Хүргэх хаяг</span>
                <p>{selectedAddress}</p>
              </section>
              <section>
                <span>Захиалсан бараа</span>
                {selectedItems.length ? (
                  <ul>
                    {selectedItems.map((item) => (
                      <li key={`${selectedOrder.id}-${item.name}`}>
                        <b>{item.name}</b>
                        {item.quantity && <em>x{item.quantity}</em>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{selectedOrder.sourceBody ?? "Барааны мэдээлэл хүлээгдэж байна."}</p>
                )}
              </section>
              <section>
                <span>Ирсэн цаг</span>
                <p>{selectedOrder.orderTime ? new Date(selectedOrder.orderTime).toLocaleString() : "Одоо"}</p>
              </section>
            </div>
            <div className="store-order-workflow" aria-label="Захиалгын төлөв">
              {workflowSteps.map((step, index) => (
                <span className={index <= activeStepIndex ? "done" : ""} key={step.key}>
                  <i>{index + 1}</i>
                  {step.label}
                </span>
              ))}
            </div>
            {canCallCourier ? (
          <section className="store-dispatch-ready">
            <div>
              <strong>Бэлтгэж дууссан</strong>
              <span>Хүргэлтэнд гаргахын өмнө хүргэлтийн ажилтан хайж хүргэлт дуудна.</span>
            </div>
            <button onClick={() => runAction(text.callCourier, selectedOrder.id)} type="button">{text.callCourier}</button>
            {renderLiveStoreMap({ statusLabel: "Дэлгүүрийн байршил", className: "store-real-ready-map" })}
          </section>
            ) : null}
            {renderDeliveryTracking(selectedOrder, selectedTracking)}
            <div className="store-order-focus-actions">
              {canCallCourier || selectedBeyondDispatch ? (
                null
              ) : selectedStatus === storeOrderStatuses.courierCalled ? (
                <button disabled type="button">Хүргэлт дуудсан</button>
              ) : selectedStatus === storeOrderStatuses.preparing ? (
                <button onClick={() => runAction(preparedLabel, selectedOrder.id)} type="button">{preparedLabel}</button>
              ) : [storeOrderStatuses.paid, storeOrderStatuses.confirmed].includes(String(selectedStatus)) ? (
                <button onClick={() => runAction(preparedLabel, selectedOrder.id)} type="button">{preparedLabel}</button>
              ) : (
                <>
                  <button onClick={() => runAction(text.confirm, selectedOrder.id)} type="button">{text.confirm}</button>
                  <button onClick={() => runAction(text.reject, selectedOrder.id)} type="button">{text.reject}</button>
                </>
              )}
            </div>
          </section>
        )}
        <div className="store-dash-order-list">
          {orders.map((order, index) => (
            <section
              className={order.id === selectedOrder?.id ? "highlight" : ""}
              key={order.id}
              onClick={() => setSelectedOrderId(order.id)}
            >
              <div>
                <span>#{order.id}</span>
                <em>{orderLabel(index)}</em>
              </div>
              <strong>{order.district}</strong>
              <p>{storeOrderStatusLabel(liveStatusForOrder(order))}</p>
              <b>{order.amountMnt} MNT</b>
              <div>
                {isOrderBeyondDispatch(order) ? null : liveStatusForOrder(order) === storeOrderStatuses.preparing ? (
                  <button onClick={() => runAction(preparedLabel, order.id)} type="button">{preparedLabel}</button>
                ) : [storeOrderStatuses.paid, storeOrderStatuses.confirmed].includes(liveStatusForOrder(order)) ? (
                  <button onClick={() => runAction(preparedLabel, order.id)} type="button">{preparedLabel}</button>
                ) : canCallCourierForOrder(order) ? (
                  <button onClick={() => runAction(text.callCourier, order.id)} type="button">{text.callCourier}</button>
                ) : liveStatusForOrder(order) === storeOrderStatuses.courierCalled ? (
                  <button disabled type="button">Хүргэлт дуудсан</button>
                ) : index === 0 ? (
                  <>
                    <button onClick={() => runAction(text.confirm, order.id)} type="button">{text.confirm}</button>
                    <button onClick={() => runAction(text.reject, order.id)} type="button">{text.reject}</button>
                  </>
                ) : (
                  <button onClick={() => runAction(text.confirm, order.id)} type="button">{text.confirm}</button>
                )}
              </div>
            </section>
          ))}
        </div>
      </article>
    );
  }

  function renderProducts() {
    const productsPerPage = 8;
    const lowStockCount = products.filter((product) => product.stockCount > 0 && product.stockCount <= 12).length;
    const inStockCount = products.filter((product) => product.stockCount > 0).length;
    const outOfStockCount = products.filter((product) => product.stockCount <= 0).length;
    const categoryCount = new Set(products.map((product) => product.category)).size;
    const totalInventoryValue = products.reduce((sum, product) => sum + moneyValue(product.price) * product.stockCount, 0);
    const filteredProducts = products.filter((product) => {
      const normalizedSearch = productSearch.trim().toLowerCase();
      return !normalizedSearch || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(normalizedSearch);
    });
    const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage));
    const currentProductPage = Math.min(productPage, totalProductPages);
    const pageStart = (currentProductPage - 1) * productsPerPage;
    const pagedProducts = filteredProducts.slice(pageStart, pageStart + productsPerPage);
    const updateProductStock = (sku: string, delta: number) => {
      setProducts((current) => current.map((product) => (
        product.sku === sku
          ? { ...product, stockCount: Math.max(0, product.stockCount + delta) }
          : product
      )));
    };
    return (
      <section className="store-inventory-experience">
        <div className="store-inventory-head">
          <div>
            <h2>{text.inventoryTitle}</h2>
            <p>{text.inventoryCopy}</p>
          </div>
          <div>
            <button onClick={() => runAction(text.filter, text.productManagement)} type="button">{text.filter}</button>
            <button onClick={() => runAction(text.addProduct, text.productManagement)} type="button">{text.addProduct}</button>
          </div>
        </div>

        <section className="store-inventory-stats">
          <article><span>{text.totalProducts}</span><strong>{products.length}</strong><em>{inStockCount} идэвхтэй</em></article>
          <article><span>{text.lowStock}</span><strong>{lowStockCount}</strong><em className="warning">{text.reorderNeeded}</em></article>
          <article><span>{text.totalValue}</span><strong>{formatMnt(totalInventoryValue)}</strong><em>{outOfStockCount} дууссан</em></article>
          <article><span>{text.categories}</span><strong>{categoryCount}</strong><em>{filteredProducts.length} харагдаж байна</em></article>
        </section>

        <section className="store-product-catalog">
          {pagedProducts.map((product) => {
            const presentation = productStatus(product);
            return (
            <article className={`store-product-card tone-${presentation.tone}`} key={product.name}>
              <div className="store-product-visual">
                <img alt={product.name} src={product.imageUrl} />
                <div>
                  <button onClick={() => openStockEditor(product)} type="button" aria-label={`${product.name} үлдэгдэл засах`}>{"\u270E"}</button>
                  <button onClick={() => runAction(text.delete, product.name)} type="button" aria-label={text.delete}>{"\u232B"}</button>
                </div>
                <b>{presentation.status}</b>
              </div>
              <div className="store-product-body">
                <span>{product.category}</span>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div>
                  <label>
                    {text.price}
                    <strong>{product.price}</strong>
                  </label>
                  <label>
                    {text.stock}
                    <strong>{presentation.stock}</strong>
                  </label>
                </div>
                <div className="store-product-stock-controls" aria-label={`${product.name} үлдэгдэл`}>
                  <button onClick={() => updateProductStock(product.sku, -1)} type="button" disabled={product.stockCount <= 0}>−</button>
                  <strong>{product.stockCount} ш</strong>
                  <button onClick={() => updateProductStock(product.sku, 1)} type="button">+</button>
                </div>
              </div>
            </article>
            );
          })}
        </section>

        <section className="store-mobile-product-list" aria-label={text.productListTitle}>
          <div>
            <h2>{text.productListTitle}</h2>
            <p>{text.totalProducts}: {filteredProducts.length}</p>
          </div>
          <label>
            <span aria-hidden="true">{"\u2315"}</span>
            <input
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder={text.productSearch}
              value={productSearch}
            />
          </label>
          <div>
            {pagedProducts.map((product) => {
              const presentation = productStatus(product);
              return (
              <article className={`store-mobile-product-item tone-${presentation.tone}`} key={product.sku}>
                <span className="store-mobile-product-thumb" aria-hidden="true">
                  <img alt="" src={product.imageUrl} />
                </span>
                <div>
                  <strong>{product.name}</strong>
                  <em>SKU: {product.sku}</em>
                  <b>{presentation.status} ({product.stockCount})</b>
                </div>
              </article>
              );
            })}
          </div>
        </section>

        <nav className="store-inventory-pagination" aria-label={text.productManagement}>
          <button onClick={() => setProductPage((page) => Math.max(1, page - 1))} disabled={currentProductPage <= 1} type="button">{"<"}</button>
          <span>{currentProductPage} / {totalProductPages}</span>
          <button onClick={() => setProductPage((page) => Math.min(totalProductPages, page + 1))} disabled={currentProductPage >= totalProductPages} type="button">{">"}</button>
        </nav>
      </section>
    );
  }

  function renderSubscriptionPayment(data: StoreDashboard) {
    const subscription = data.subscription;
    const selectedBank = qpayBankOptions.find((bank) => bank.id === selectedSubscriptionBank) ?? qpayBankOptions[0];
    const selectedBankLink = subscriptionPayment ? qpayBankLinkFor(subscriptionPayment.urls, selectedBank) : undefined;
    const bankLinks = (subscriptionPayment?.urls ?? []).filter((url) => Boolean(url.link));
    const visibleBankLinks = [
      ...(selectedBankLink ? [selectedBankLink] : []),
      ...bankLinks.filter((url) => url.link !== selectedBankLink?.link),
    ].slice(0, 4);
    const primaryLink = selectedBankLink?.link || subscriptionPayment?.shortUrl || bankLinks[0]?.link || "";
    const qrSrc = qpayQrImageSource(subscriptionPayment?.qrImage);
    const amount = subscriptionPayment?.amountMnt ?? subscription?.amountMnt ?? storeSubscriptionAmountMnt;

    return (
      <section className="store-subscription-gate">
        <div className="store-subscription-copy">
          <span>Үйлчилгээний эрх</span>
          <h1>Store dashboard ашиглахын тулд сарын төлбөрөө төлнө үү</h1>
          <p>Төлбөр баталгаажсаны дараа бараа, захиалга, хүргэлтийн самбар автоматаар нээгдэнэ.</p>
          <div>
            <strong>{formatMnt(amount)}</strong>
            <small>Сарын эрх · {subscription?.status ?? "PAST_DUE"}</small>
          </div>
        </div>

        <button className="store-subscription-open" onClick={() => setSubscriptionPaymentOpen(true)} type="button">
          Төлбөр төлөх
        </button>

        {subscriptionPaymentOpen ? (
        <div className="store-subscription-payment">
          <header>
            <strong>QPay төлбөр</strong>
            <span>{subscriptionPayment ? "INVOICE ҮҮССЭН" : "INVOICE ҮҮСГЭХ"}</span>
          </header>

          <div className="store-subscription-banks" aria-label="Төлөх банк">
            {qpayBankOptions.map((bank) => (
              <button
                className={selectedSubscriptionBank === bank.id ? "active" : ""}
                key={bank.id}
                onClick={() => setSelectedSubscriptionBank(bank.id)}
                type="button"
              >
                <span>{bank.mark}</span>
                <strong>{bank.label}</strong>
              </button>
            ))}
          </div>

          {subscriptionPayment ? (
            <>
              <a
                className={`store-subscription-bank-cta${primaryLink ? "" : " is-disabled"}`}
                href={primaryLink || undefined}
                onClick={(event) => {
                  if (!primaryLink) event.preventDefault();
                }}
                rel="noreferrer"
                target="_blank"
              >
                <span>{selectedBank.mark}</span>
                <strong>{selectedBank.label}-аар төлөх</strong>
                <small>{primaryLink ? "Банкны app нээх" : "Энэ банкны link QPay-аас ирсэнгүй"}</small>
              </a>

              <div className="store-subscription-invoice">
                <div>
                  <span>Invoice</span>
                  <strong>{subscriptionPayment.invoiceId}</strong>
                  <span>Дүн</span>
                  <strong>{formatMnt(amount)}</strong>
                </div>
                <div className={`store-subscription-qr${qrSrc ? "" : " is-empty"}`}>
                  {qrSrc ? <img alt="QPay invoice QR" src={qrSrc} /> : <strong>QR ирсэнгүй</strong>}
                </div>
              </div>

              {visibleBankLinks.length ? (
                <div className="store-subscription-apps" aria-label="QPay банкны апп">
                  {visibleBankLinks.map((url) => (
                    <a href={url.link} key={`${url.name ?? url.description}-${url.link}`} rel="noreferrer" target="_blank">
                      {url.logo ? <img alt="" src={url.logo} /> : null}
                      <span>{url.name || url.description || "Банкны app"}</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {subscriptionError ? <p role="alert">{subscriptionError}</p> : null}
          <button
            className="store-subscription-action"
            disabled={subscriptionSubmitting}
            onClick={subscriptionPayment ? checkSubscriptionPaymentStatus : createSubscriptionInvoice}
            type="button"
          >
            {subscriptionSubmitting ? "Шалгаж байна..." : subscriptionPayment ? "Төлбөр шалгах" : "QPay invoice үүсгэх"}
          </button>
        </div>
        ) : (
          <div className="store-subscription-launch">
            <strong>Эрх идэвхгүй байна</strong>
            <span>Төлбөр төлөх товч дарж QPay invoice үүсгэнэ.</span>
            <button onClick={() => setSubscriptionPaymentOpen(true)} type="button">Төлбөр төлөх</button>
          </div>
        )}
      </section>
    );
  }

  function renderOverview(data: StoreDashboard) {
    const orders = [...localOrders, ...data.orders.filter((order) => !localOrders.some((localOrder) => localOrder.id === order.id))];
    const pendingOrders = orders.filter((order) => order.status !== "DELIVERED").length || orders.length;

    return (
      <section className="store-dash-overview">
        <section className="store-mobile-experience" aria-label={text.recentDeliveries}>
          <div className="store-mobile-urgent">
            <div>
              <span>{text.urgentPending}</span>
              <strong>{pendingOrders} {text.orders}</strong>
            </div>
            <button onClick={() => setActiveTab("orders")} type="button">{text.assign}</button>
          </div>
          <article className="store-dash-card store-mobile-recent">
            <div className="store-dash-card-head">
              <h2>{text.recentDeliveries}</h2>
              <span>{orders.slice(0, 3).length}</span>
            </div>
            <div className="store-mobile-delivery-list">
              {orders.slice(0, 3).map((order, index) => (
                <button key={order.id} onClick={() => runAction(text.callCourier, order.id)} type="button">
                  <span className={`store-mobile-state-dot state-${index}`} aria-hidden="true" />
                  <div>
                    <strong>#{order.id}</strong>
                    <em>{order.district}</em>
                  </div>
                  <b>{orderLabel(index)}</b>
                </button>
              ))}
            </div>
          </article>
        </section>

        <article className="store-dash-welcome">
          <div>
            <span>{text.welcome}</span>
            <h2>{displayStoreName(store?.storeName)}</h2>
            <p>{text.welcomeCopy}</p>
            <button onClick={() => setActiveTab("orders")} type="button">{text.orderBoard}</button>
          </div>
          <div aria-hidden="true" />
        </article>
        <article className="store-dash-card">
          <div className="store-dash-card-head">
            <h2>{text.activeDelivery}</h2>
            <span>{data.activeOrder ? "1" : "0"}</span>
          </div>
          <strong className="store-dash-big">{data.activeOrder?.amountMnt ?? "0"} MNT</strong>
          <p>{data.activeOrder?.note ?? text.orderBoard}</p>
        </article>
      </section>
    );
  }

  function dashboardStats(data: StoreDashboard) {
    const orders = [...localOrders, ...data.orders.filter((order) => !localOrders.some((localOrder) => localOrder.id === order.id))];
    const activeOrders = orders.filter((order) => !["DELIVERED", "COMPLETED", "PAYMENT_FAILED", "REJECTED", "CANCELLED"].includes(String(order.status)));
    const paidOrders = orders.filter((order) => ["PAID", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "COURIER_ASSIGNED"].includes(String(order.status)));
    const activeDeliveries = orders.filter((order) => {
      const tracking = preferredTracking(order.deliveryTracking ?? null, dispatchTrackings[order.id]);
      return Boolean(tracking && isActiveDispatchStatus(tracking.status));
    });
    const revenueMnt = orders.reduce((sum, order) => sum + moneyValue(order.amountMnt), 0);
    const lowStockCount = products.filter((product) => product.stockCount > 0 && product.stockCount <= 12).length;
    const outOfStockCount = products.filter((product) => product.stockCount <= 0).length;

    return {
      orderCount: orders.length,
      orderMeta: `${activeOrders.length} идэвхтэй`,
      revenue: formatMnt(revenueMnt),
      revenueMeta: `${paidOrders.length} төлбөртэй`,
      activeDeliveryCount: activeDeliveries.length,
      activeDeliveryMeta: `${activeOrders.length} захиалга нээлттэй`,
      productCount: products.length,
      productMeta: lowStockCount ? `${lowStockCount} бага үлдэгдэл` : `${outOfStockCount} дууссан`,
    };
  }

  function renderSimple(title: string) {
    return (
      <article className="store-dash-card store-dash-wide store-dash-simple">
        <h2>{title}</h2>
        <p>{displayStoreName(store?.storeName)} - {text.open}</p>
      </article>
    );
  }

  return (
    <main className={`store-dash-shell store-theme-${themeMode}`} data-build={storePreparedLocalBuildMarker}>
      <aside className="store-dash-sidebar">
        <div className="store-dash-brand">
          <span className="store-dash-logo">
            <img alt="" src={nominLogoUrl} />
          </span>
          <div>
            <strong>{displayStoreName(store?.storeName)}</strong>
            <span>{text.open}</span>
          </div>
        </div>
        <button
          className="store-dash-primary"
          onClick={openManualOrderForm}
          type="button"
        >
          {text.newDelivery}
        </button>
        <nav aria-label={displayStoreName(store?.storeName)}>
          {tabs.map((tab) => (
            <button className={activeTab === tab.key ? "active" : ""} key={tab.key} onClick={() => setActiveTab(tab.key)} type="button">
              <span />
              {tab.label}
            </button>
          ))}
        </nav>
        {onLogout && (
          <button className="store-dash-logout" onClick={onLogout} type="button">
            {text.logout}
          </button>
        )}
      </aside>

      <section className="store-dash-main">
        <header className="store-dash-topbar">
          <label>
            <span aria-hidden="true">{"\u2315"}</span>
            <input placeholder={text.search} />
          </label>
          <button
            className={`store-theme-toggle ${themeMode === "light" ? "is-light" : "is-night"}`}
            onClick={() => setThemeMode((mode) => (mode === "night" ? "light" : "night"))}
            type="button"
          >
            <span>{text.nightMode}</span>
            <span>{text.lightMode}</span>
            <i aria-hidden="true" />
          </button>
          <NotificationBell onNotificationClick={handleNotificationSelect} storeId={store?.id} storeName={displayStoreName(store?.storeName)} />
        </header>

        <div className="store-dash-canvas">
          <StateBlock loading={dashboard.loading} error={dashboard.error} empty={!dashboard.data}>
            {dashboard.data && (
              <>
                {notice && <div className="store-dash-notice">{notice}</div>}
                {(() => {
                  const stats = dashboardStats(dashboard.data);
                  return (
                    <section className="store-dash-stats">
                      <article><span>{text.todayOrders}</span><strong>{stats.orderCount}</strong><em>{stats.orderMeta}</em></article>
                      <article><span>{text.revenue}</span><strong>{stats.revenue}</strong><em>{stats.revenueMeta}</em></article>
                      <article><span>{text.activeDelivery}</span><strong>{stats.activeDeliveryCount}</strong><em>{stats.activeDeliveryMeta}</em></article>
                      <article><span>{text.stock}</span><strong>{stats.productCount}</strong><em>{stats.productMeta}</em></article>
                    </section>
                  );
                })()}

                {activeTab === "overview" && renderOverview(dashboard.data)}
                {activeTab === "orders" && renderOrders([...localOrders, ...dashboard.data.orders.filter((order) => !localOrders.some((localOrder) => localOrder.id === order.id))])}
                {activeTab === "products" && renderProducts()}
                {activeTab === "reports" && renderSimple(text.reportTitle)}
                {activeTab === "settings" && renderSimple(text.settingsTitle)}
                {activeTab === "payment" && renderSubscriptionPayment(dashboard.data)}
              </>
            )}
          </StateBlock>
        </div>
      </section>
      {stockEditor ? (
        <section className="store-stock-modal" aria-label="Үлдэгдэл засах" role="dialog">
          <div>
            <header>
              <span>Үлдэгдэл засах</span>
              <button onClick={() => setStockEditor(null)} type="button" aria-label="Хаах">×</button>
            </header>
            <article>
              <img alt="" src={stockEditor.imageUrl} />
              <div>
                <strong>{stockEditor.name}</strong>
                <small>{stockEditor.sku} · {stockEditor.category}</small>
                <b>{stockEditor.price}</b>
              </div>
            </article>
            <div className="store-stock-editor">
              <button onClick={() => setStockDraft((value) => String(Math.max(0, Number(value || 0) - 1)))} type="button">−</button>
              <input
                inputMode="numeric"
                onChange={(event) => setStockDraft(event.target.value.replace(/[^\d]/g, ""))}
                value={stockDraft}
              />
              <button onClick={() => setStockDraft((value) => String(Number(value || 0) + 1))} type="button">+</button>
            </div>
            <footer>
              <button onClick={() => setStockEditor(null)} type="button">Болих</button>
              <button onClick={saveStockEditor} type="button">Хадгалах</button>
            </footer>
          </div>
        </section>
      ) : null}
      <button className="store-mobile-fab" onClick={openManualOrderForm} type="button" aria-label={text.newDelivery}>
        +
      </button>
      <nav className="store-mobile-nav" aria-label={displayStoreName(store?.storeName)}>
        <button className={activeTab === "overview" ? "active" : ""} onClick={() => setActiveTab("overview")} type="button">
          <span aria-hidden="true">{"\u25A1"}</span>
          {text.home}
        </button>
        <button className={activeTab === "orders" ? "active" : ""} onClick={() => setActiveTab("orders")} type="button">
          <span aria-hidden="true">{"\u25A4"}</span>
          {text.orders}
        </button>
        <button className={activeTab === "products" ? "active" : ""} onClick={() => setActiveTab("products")} type="button">
          <span aria-hidden="true">{"\u25C7"}</span>
          {text.products}
        </button>
        <button className={activeTab === "payment" ? "active" : ""} onClick={() => setActiveTab("payment")} type="button">
          <span aria-hidden="true">{"\u25C9"}</span>
          {text.payment}
        </button>
        <button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")} type="button">
          <span aria-hidden="true">{"\u25CB"}</span>
          {text.profile}
        </button>
      </nav>
    </main>
  );
}
