import { type CSSProperties, useEffect, useState } from "react";
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
  review: {
    employeeCode: string;
    identityState: string;
    faceState: string;
  } | null;
};

type StoreTab = "overview" | "orders" | "products" | "reports" | "settings";
type ThemeMode = "night" | "light";
type ProductTone = "success" | "warning" | "danger";

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

const localStoreOrdersKey = "deliverhub-store-orders";
const localStoreProductsKey = "deliverhub-store-products";
const nominLogoUrl = nominStoreProfile.logoUrl;
const fixedNominStorePosition: GeoPoint = { lat: 47.91785, lng: 106.93528 };
const fallbackStorePosition: GeoPoint = fixedNominStorePosition;
const mapTileSize = 256;
const storeMapZoom = 14;
const storeOfferTimeoutMs = 12_000;
const storePreparedLocalBuildMarker = "prepared-local-v2";
const terminalDispatchStatuses = ["REJECTED", "FAILED", "CANCELLED"] as const;

type StoreIdentity = {
  id: string;
  storeName: string;
};

function isForStore(order: StoreOrder, store?: StoreIdentity) {
  if (!store) return true;
  return order.storeId === store.id || order.storeName === store.storeName || (!order.storeId && !order.storeName);
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
  storeName: "\u041D\u043E\u043C\u0438\u043D \u041C\u0430\u0440\u043A\u0435\u0442",
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
};

const tabs: Array<{ key: StoreTab; label: string }> = [
  { key: "overview", label: text.overview },
  { key: "orders", label: text.orders },
  { key: "products", label: text.products },
  { key: "reports", label: text.reports },
  { key: "settings", label: text.settings },
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
  ["Жүүс 1л", "Ундаа", "₮6,800", "juice carton product"],
  ["Кола", "Ундаа", "₮3,500", "cola can product"],
  ["Чипс", "Амттан", "₮5,200", "potato chips bag product"],
  ["Шоколад", "Амттан", "₮4,800", "chocolate bar product"],
  ["Печень", "Амттан", "₮6,100", "cookies package product"],
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
  description: `Номин Маркет - ${category.toLowerCase()} ангиллын бараа.`,
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
  if (status === "PICKUP_VERIFICATION") return "Employee ирсэн - store OTP баталгаажуулна";
  if (status === "PICKED_UP" || status === "IN_TRANSIT") return "Хүргэлтэнд гарсан";
  if (status === "DELIVERED" || status === "COMPLETED") return "Захиалга дууссан";
  if (status === storeOrderStatuses.rejected) return "Татгалзсан";
  return status;
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
  const [dispatchTrackings, setDispatchTrackings] = useState<Record<string, StoreDeliveryTracking>>({});
  const [pickupOtpByAssignment, setPickupOtpByAssignment] = useState<Record<string, string>>({});
  const [dispatchClock, setDispatchClock] = useState(Date.now());
  const refreshDashboard = dashboard.refetch;

  useEffect(() => {
    localStorage.setItem("deliverhub-store-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(localStoreProductsKey, JSON.stringify(products));
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
          statusLabel: "Employee хариу өгөөгүй - дахин хүргэлт дуудаж болно",
        }];
      }));
      return changed ? next : current;
    });
  }, [dispatchClock]);

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

  function trackingFromDispatch(result: StoreDispatchResponse): StoreDeliveryTracking {
    return {
      assignmentId: result.assignmentId,
      status: "OFFERED",
      statusLabel: result.nearestCourier
        ? "Ойрын хүргэлтийн ажилтанд санал илгээгдсэн"
        : "Nearest employee queue-д санал илгээгдсэн",
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
      const isLocalOrder = localOrders.some((order) => order.id === target);
      const isPreparedAction = mappedStatus === storeOrderStatuses.prepared;
      const orderSnapshot = localOrders.find((order) => order.id === target)
        ?? dashboard.data?.orders.find((order) => order.id === target);
      try {
        if ((isLocalOrder || isPreparedAction) && label !== text.callCourier) {
          usedLocalFallback = true;
        } else if (label === text.confirm) {
          await postJson(`/orders/${target}/accept`);
        } else if (label === text.callCourier) {
          const result = await postJson<StoreDispatchResponse>("/dispatch-request", { orderId: target });
          setDispatchTrackings((current) => ({ ...current, [target]: trackingFromDispatch(result) }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const canContinueLocally = label !== text.callCourier && (isPreparedAction || message.startsWith("404:") || message.includes("Захиалга олдсонгүй"));
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
    if (!Number.isFinite(createdAtMs)) return 12;
    return Math.max(0, Math.ceil((createdAtMs + storeOfferTimeoutMs - dispatchClock) / 1000));
  }

  function isDispatchExpired(tracking?: StoreDeliveryTracking | null) {
    if (!tracking) return false;
    if (terminalDispatchStatuses.includes(String(tracking.status) as typeof terminalDispatchStatuses[number])) return true;
    return tracking.status === "OFFERED" && offerRemainingSec(tracking) === 0;
  }

  function currentOfferCourier(tracking?: StoreDeliveryTracking | null) {
    if (tracking?.status !== "OFFERED" || !tracking.courier?.id) return null;

    const nearbyCouriers = tracking.nearbyCouriers ?? [];
    const matchedCourier = nearbyCouriers.find((courier) => courier.employeeId === tracking.courier?.id) ?? null;
    const location = tracking.routePlan?.courier ?? matchedCourier?.location;

    if (!location) return null;

    return {
      employeeId: tracking.courier.id,
      name: matchedCourier?.name ?? tracking.courier?.name ?? "Ойрын employee",
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
    const nearbyCouriers = options.tracking?.nearbyCouriers ?? [];
    const isOfferOnly = options.tracking?.status === "OFFERED";
    const offerCourier = currentOfferCourier(options.tracking);
    const offerRemaining = offerRemainingSec(options.tracking);
    const hasAcceptedRoute = Boolean(route && !isOfferOnly);
    const storePoint = fallbackStorePosition;
    const offerCourierPoint = offerCourier?.location;
    const courierPoint = hasAcceptedRoute ? route?.courier : undefined;
    const dropoffPoint = hasAcceptedRoute ? route?.dropoff : undefined;
    const center = hasAcceptedRoute ? mapCenterFor([storePoint, courierPoint, dropoffPoint]) : mapCenterFor([storePoint, offerCourierPoint]);
    const tiles = getStoreMapTiles(center, storeMapZoom);
    const offerProgressDeg = `${Math.max(0, Math.min(360, ((offerRemaining ?? 12) / 12) * 360))}deg`;
    const courierName = options.tracking?.courier?.name ?? "Ойрын employee";

    return (
      <div className={`store-live-map ${options.className ?? ""}`} aria-label="Дэлгүүрийн газрын зураг">
        <div className="store-live-map-tiles" aria-hidden="true">
          {tiles.map((tile) => (
            <img
              alt=""
              draggable={false}
              key={tile.key}
              src={getMapTileUrl(tile.urlX, tile.urlY, storeMapZoom)}
              style={tile.style}
            />
          ))}
        </div>
        {courierPoint && !isOfferOnly && mapWalkingRouteSegments(courierPoint, storePoint, center, storeMapZoom).map((segment) => (
          <span
            className="store-live-route route-to-courier"
            key={`courier-${segment.key}`}
            style={segment.style}
            aria-hidden="true"
          />
        ))}
        {dropoffPoint && !isOfferOnly && mapWalkingRouteSegments(storePoint, dropoffPoint, center, storeMapZoom).map((segment) => (
          <span
            className="store-live-route route-to-customer"
            key={`customer-${segment.key}`}
            style={segment.style}
            aria-hidden="true"
          />
        ))}
        <i className="store-live-pin store-pin" style={mapPointStyle(storePoint, center, storeMapZoom)} aria-label="Дэлгүүр" />
        {dropoffPoint && <i className="store-live-pin customer-pin" style={mapPointStyle(dropoffPoint, center, storeMapZoom)} aria-label="Хүргэх хаяг" />}
        {courierPoint && <i className="store-live-pin courier-pin" style={mapPointStyle(courierPoint, center, storeMapZoom)} aria-label={courierName} />}
        {isOfferOnly && offerCourierPoint && offerCourier && (
          <i
            className="store-live-offer-courier"
            style={{ ...mapPointStyle(offerCourierPoint, center, storeMapZoom), "--offer-progress": offerProgressDeg } as CSSProperties}
            title={`${offerCourier.employeeId} · ${offerCourier.toPickupKm.toFixed(1)} км`}
          >
            <b>{offerRemaining ?? 12}</b>
            <span>{offerCourier.name}</span>
          </i>
        )}
        {false && nearbyCouriers.slice(0, 8).map((courier, index) => {
          const point = courier.location ?? {
            lat: storePoint.lat + (index % 2 === 0 ? 0.004 : -0.003) * (index + 1),
            lng: storePoint.lng + (index % 3 === 0 ? -0.004 : 0.003) * (index + 1),
          };
          return (
            <i
              aria-label={courier.name}
              className={`store-live-courier ${options.tracking?.courier?.id === courier.employeeId ? "matched" : ""}`}
              key={courier.employeeId}
              style={mapPointStyle(point, center, storeMapZoom)}
              title={`${courier.name} · ${courier.toPickupKm.toFixed(1)} км`}
            >
              {index + 1}
            </i>
          );
        })}
        {false && options.tracking?.status === "OFFERED" && <b className="store-live-scan" style={mapPointStyle(storePoint, center, storeMapZoom)} aria-hidden="true" />}
        <div className="store-live-map-status">
          <strong>{options.statusLabel ?? options.tracking?.statusLabel ?? "Дэлгүүрийн байршил"}</strong>
          <span>
            {options.orderId ? `#${options.orderId} · ` : ""}
            {isOfferOnly ? "Nearest employee queue - ID ба зайгаар эрэмбэлсэн" : "Nomin fixed pickup - Бөхийн Өргөө"}
          </span>
        </div>
      </div>
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
        : "Nearest employee-д санал илгээгдсэн";

    return (
      <section className={`store-dispatch-tracker ${isDelivering ? "is-delivering" : isAccepted ? "is-accepted" : "is-searching"}`}>
        {renderLiveStoreMap({ tracking, orderId: order.id, className: "store-dispatch-map" })}
        <div className="store-dispatch-detail">
          <span>{dispatchStageText}</span>
          {offerCourier && <span>{offerCourier.employeeId} дээр {offerRemaining ?? 12} сек хүлээж байна</span>}
          <h3>{courierName}</h3>
          <p>{tracking.statusLabel}</p>
          <div>
            <b>{toPickupKm.toFixed(1)} км</b>
            <b>{eta} мин</b>
            <b>{tracking.courier?.vehicleType ?? "AUTO"}</b>
          </div>
          {false && nearbyCouriers.length ? (
            <div className="store-nearby-couriers">
              {nearbyCouriers.slice(0, 4).map((courier, index) => (
                <span className={(offerCourier?.employeeId ?? tracking?.courier?.id) === courier.employeeId ? "matched" : ""} key={courier.employeeId}>
                  <i>{index + 1}</i>
                  <strong>{courier.employeeId}</strong>
                  {courier.name}
                  <b>{courier.toPickupKm.toFixed(1)} км · {courier.etaMinutes} мин</b>
                </span>
              ))}
            </div>
          ) : null}
          {needsStoreOtp ? (
            <label className="store-pickup-otp">
              <span>Employee өгсөн 6 оронтой OTP</span>
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

  function renderOrders(orders: StoreOrderView[]) {
    const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0];
    const preparedLabel = "Бэлтгэж дууссан";
    const liveSelectedOrder = selectedOrder ? dashboard.data?.orders.find((order) => order.id === selectedOrder.id) : null;
    const localSelectedTracking = selectedOrder ? dispatchTrackings[selectedOrder.id] : null;
    const liveSelectedTracking = liveSelectedOrder?.deliveryTracking ?? selectedOrder?.deliveryTracking ?? null;
    const selectedTracking = selectedOrder
      ? (isDispatchExpired(localSelectedTracking) ? localSelectedTracking : liveSelectedTracking ?? localSelectedTracking)
      : null;
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
      { key: "PICKED_UP", aliases: ["IN_TRANSIT", "ARRIVING_DROPOFF"], label: "Хүргэлтэнд гарсан" },
      { key: "DELIVERED", aliases: ["COMPLETED"], label: "Захиалга дууссан" },
    ] : [];
    const activeStepIndex = selectedOrder
      ? Math.max(0, workflowSteps.findIndex((step) => step.key === workflowStatus || step.aliases?.includes(String(workflowStatus))))
      : 0;
    const selectedItems = selectedOrder?.items ?? [];
    const selectedAddress = selectedOrder?.addressText || selectedOrder?.district || "Хаяг бүртгэгдээгүй байна";
    const liveStatusForOrder = (order: StoreOrderView) => dashboard.data?.orders.find((item) => item.id === order.id)?.status ?? order.status;
    const trackingForOrder = (order: StoreOrderView) => {
      const localTracking = dispatchTrackings[order.id];
      const liveTracking = dashboard.data?.orders.find((item) => item.id === order.id)?.deliveryTracking ?? order.deliveryTracking ?? null;
      return isDispatchExpired(localTracking) ? localTracking : liveTracking ?? localTracking;
    };
    const canCallCourierForOrder = (order: StoreOrderView) => {
      const status = liveStatusForOrder(order);
      const tracking = trackingForOrder(order);
      const expired = isDispatchExpired(tracking);
      return status === storeOrderStatuses.prepared || (status === storeOrderStatuses.courierCalled && expired);
    };

    return (
      <article className="store-dash-card store-dash-wide">
        <div className="store-dash-card-head">
          <h2>{text.orderBoard}</h2>
          <span>{orders.length}</span>
        </div>
        {selectedOrder && (
          <section className="store-order-focus">
            <div className="store-order-focus-head">
              <div>
                <span>#{selectedOrder.id}</span>
                <h3>{selectedOrder.storeName ?? store?.storeName ?? text.storeName}</h3>
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
              <span>Хүргэлтэнд гаргахын өмнө courier employee хайж хүргэлт дуудна.</span>
            </div>
            <button onClick={() => runAction(text.callCourier, selectedOrder.id)} type="button">{text.callCourier}</button>
            {renderLiveStoreMap({ statusLabel: "Дэлгүүрийн байршил", className: "store-real-ready-map" })}
          </section>
            ) : null}
            {renderDeliveryTracking(selectedOrder, selectedTracking)}
            <div className="store-order-focus-actions">
              {canCallCourier ? (
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
                {liveStatusForOrder(order) === storeOrderStatuses.preparing ? (
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
    const categoryCount = new Set(products.map((product) => product.category)).size;
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
          <article><span>{text.totalProducts}</span><strong>{products.length}</strong><em>+12</em></article>
          <article><span>{text.lowStock}</span><strong>{lowStockCount}</strong><em className="warning">{text.reorderNeeded}</em></article>
          <article><span>{text.totalValue}</span><strong>\u20AE145.2M</strong><em>+8%</em></article>
          <article><span>{text.categories}</span><strong>{categoryCount}</strong><em>+1</em></article>
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
            <h2>{store?.storeName ?? text.storeName}</h2>
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

  function renderSimple(title: string) {
    return (
      <article className="store-dash-card store-dash-wide store-dash-simple">
        <h2>{title}</h2>
        <p>{store?.storeName ?? text.storeName} - {text.open}</p>
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
            <strong>{store?.storeName ?? text.storeName}</strong>
            <span>{text.open}</span>
          </div>
        </div>
        <button className="store-dash-primary" onClick={() => setActiveTab("orders")} type="button">{text.newDelivery}</button>
        <nav aria-label={store?.storeName ?? text.storeName}>
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
          <NotificationBell onNotificationClick={handleNotificationSelect} storeId={store?.id} storeName={store?.storeName} />
        </header>

        <div className="store-dash-canvas">
          <StateBlock loading={dashboard.loading} error={dashboard.error} empty={!dashboard.data}>
            {dashboard.data && (
              <>
                <section className="store-dash-stats">
                  <article><span>{text.todayOrders}</span><strong>{localOrders.length + dashboard.data.orders.length}</strong><em>+12%</em></article>
                  <article><span>{text.revenue}</span><strong>{dashboard.data.activeOrder?.amountMnt ?? "0"} MNT</strong><em>+18%</em></article>
                  <article><span>{text.activeDelivery}</span><strong>{dashboard.data.activeOrder ? "1" : "0"}</strong><em>+5%</em></article>
                  <article><span>{text.stock}</span><strong>{products.length}</strong><em>+4%</em></article>
                </section>

                {notice && <div className="store-dash-notice">{notice}</div>}

                {activeTab === "overview" && renderOverview(dashboard.data)}
                {activeTab === "orders" && renderOrders([...localOrders, ...dashboard.data.orders.filter((order) => !localOrders.some((localOrder) => localOrder.id === order.id))])}
                {activeTab === "products" && renderProducts()}
                {activeTab === "reports" && renderSimple(text.reportTitle)}
                {activeTab === "settings" && renderSimple(text.settingsTitle)}
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
      <button className="store-mobile-fab" onClick={() => setActiveTab("orders")} type="button" aria-label={text.newDelivery}>
        +
      </button>
      <nav className="store-mobile-nav" aria-label={store?.storeName ?? text.storeName}>
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
        <button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")} type="button">
          <span aria-hidden="true">{"\u25CB"}</span>
          {text.profile}
        </button>
      </nav>
    </main>
  );
}
