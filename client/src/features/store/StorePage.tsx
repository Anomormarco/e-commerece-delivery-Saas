import { useEffect, useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { NotificationBell } from "../../components/NotificationBell";
import { StateBlock } from "../../components/StateBlock";
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

type ProductItem = {
  name: string;
  sku: string;
  category: string;
  price: string;
  stockCount: number;
  description: string;
};

const localStoreOrdersKey = "deliverhub-store-orders";

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
  receiveProduct: "\u0411\u0430\u0440\u0430\u0430 \u0438\u0440\u043B\u044D\u044D",
  receivedPlusTen: "+10 \u0438\u0440\u043B\u044D\u044D",
  receivedNotice: "\u0431\u0430\u0440\u0430\u0430\u043D\u044B \u04AF\u043B\u0434\u044D\u0433\u0434\u044D\u043B +10 \u043D\u044D\u043C\u044D\u0433\u0434\u043B\u044D\u044D",
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
  confirm: "\u0411\u0430\u0442\u043B\u0430\u0445",
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

const initialProducts: ProductItem[] = [
  { name: "\u0426\u0430\u0433\u0430\u0430\u043D \u0431\u0443\u0434\u0430\u0430 5\u043A\u0433", sku: "FD-1002", category: "\u0425\u04AF\u043D\u0441", price: "\u20AE28,000", stockCount: 45, description: "\u0413\u044D\u0440 \u0431\u04AF\u043B\u0438\u0439\u043D \u04E9\u0434\u04E9\u0440 \u0442\u0443\u0442\u043C\u044B\u043D \u0445\u04AF\u043D\u0441\u043D\u0438\u0439 \u043D\u04E9\u04E9\u0446." },
  { name: "\u041C\u043E\u043D\u0433\u043E\u043B \u043C\u0430\u0445 1\u043A\u0433", sku: "MT-5541", category: "\u041C\u0430\u0445", price: "\u20AE18,500", stockCount: 12, description: "\u0428\u0438\u043D\u044D \u043C\u0430\u0445, \u0445\u04AF\u0439\u0442\u044D\u043D \u0445\u044D\u043B\u0445\u044D\u044D\u0433\u044D\u044D\u0440 \u0445\u04AF\u0440\u0433\u044D\u043D\u044D." },
  { name: "\u0410\u043B\u0442\u0430\u043D \u0422\u0430\u043B\u0445", sku: "BR-9982", category: "\u0422\u0430\u043B\u0445", price: "\u20AE3,200", stockCount: 30, description: "\u04E8\u0434\u04E9\u0440 \u0442\u0443\u0442\u043C\u044B\u043D \u0445\u0443\u0440\u0434\u0430\u043D \u044D\u0440\u0433\u044D\u043B\u0442\u0442\u044D\u0439 \u0431\u0430\u0440\u0430\u0430." },
  { name: "\u0421\u04AF\u04AF 1\u043B", sku: "ML-2011", category: "\u0421\u04AF\u04AF", price: "\u20AE4,500", stockCount: 0, description: "\u04AE\u043B\u0434\u044D\u0433\u0434\u044D\u043B \u0434\u0443\u0443\u0441\u0441\u0430\u043D, \u0434\u0430\u0445\u0438\u043D \u0442\u0430\u0442\u0430\u043D \u0430\u0432\u0430\u043B\u0442 \u0445\u0438\u0439\u043D\u044D." },
];

function productStatus(product: ProductItem): { status: string; stock: string; tone: ProductTone } {
  if (product.stockCount <= 0) return { status: text.out, stock: "0 \u0448", tone: "danger" };
  if (product.stockCount <= 12) return { status: text.reorderNeeded, stock: `${product.stockCount} \u0448`, tone: "warning" };
  return { status: text.available, stock: `${product.stockCount} \u0448`, tone: "success" };
}

function orderLabel(index: number) {
  if (index === 0) return "\u0428\u0438\u043D\u044D";
  if (index === 1) return "\u0411\u044D\u043B\u0442\u0433\u044D\u0436 \u0431\u0430\u0439\u043D\u0430";
  return "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u044D\u0434 \u0433\u0430\u0440\u0441\u0430\u043D";
}

export function StorePage({ onLogout, store }: { onLogout?: () => void; store?: StoreIdentity }) {
  const dashboard = useRealtimeResource<StoreDashboard>("/dashboard", ["store.dashboard.refresh"]);
  const [activeTab, setActiveTab] = useState<StoreTab>("overview");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem("deliverhub-store-theme") === "light" ? "light" : "night"));
  const [notice, setNotice] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [localOrders, setLocalOrders] = useState<StoreOrder[]>(() => readLocalOrders(store));

  useEffect(() => {
    localStorage.setItem("deliverhub-store-theme", themeMode);
  }, [themeMode]);

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

  function runAction(label: string, target: string) {
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

  function receiveProduct(productSku: string) {
    const product = products.find((item) => item.sku === productSku);
    setProducts((currentProducts) =>
      currentProducts.map((item) => (
        item.sku === productSku ? { ...item, stockCount: item.stockCount + 10 } : item
      )),
    );
    if (product) {
      setNotice(`${product.name}: ${text.receivedNotice}`);
      window.setTimeout(() => setNotice(null), 2200);
    }
  }

  function renderOrders(orders: StoreOrder[]) {
    return (
      <article className="store-dash-card store-dash-wide">
        <div className="store-dash-card-head">
          <h2>{text.orderBoard}</h2>
          <span>{orders.length}</span>
        </div>
        <div className="store-dash-order-list">
          {orders.map((order, index) => (
            <section className={index === 0 ? "highlight" : ""} key={order.id}>
              <div>
                <span>#{order.id}</span>
                <em>{orderLabel(index)}</em>
              </div>
              <strong>{order.district}</strong>
              <p>{order.status}</p>
              <b>{order.amountMnt} MNT</b>
              <div>
                {index === 0 ? (
                  <>
                    <button onClick={() => runAction(text.confirm, order.id)} type="button">{text.confirm}</button>
                    <button onClick={() => runAction(text.reject, order.id)} type="button">{text.reject}</button>
                  </>
                ) : (
                  <button onClick={() => runAction(text.callCourier, order.id)} type="button">{text.callCourier}</button>
                )}
              </div>
            </section>
          ))}
        </div>
      </article>
    );
  }

  function renderProducts() {
    const lowStockCount = products.filter((product) => product.stockCount > 0 && product.stockCount <= 12).length;
    const categoryCount = new Set(products.map((product) => product.category)).size;
    const filteredProducts = products.filter((product) => {
      const normalizedSearch = productSearch.trim().toLowerCase();
      return !normalizedSearch || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(normalizedSearch);
    });

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
          {filteredProducts.map((product) => {
            const presentation = productStatus(product);
            return (
            <article className={`store-product-card tone-${presentation.tone}`} key={product.name}>
              <div className="store-product-visual">
                <span>{product.name.slice(0, 1)}</span>
                <div>
                  <button onClick={() => runAction(text.edit, product.name)} type="button" aria-label={text.edit}>{"\u270E"}</button>
                  <button onClick={() => receiveProduct(product.sku)} type="button" aria-label={text.receiveProduct}>{"+"}</button>
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
                <button className="store-product-receive" onClick={() => receiveProduct(product.sku)} type="button">
                  {text.receivedPlusTen}
                </button>
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
            {filteredProducts.map((product) => {
              const presentation = productStatus(product);
              return (
              <article className={`store-mobile-product-item tone-${presentation.tone}`} key={product.sku}>
                <span className="store-mobile-product-thumb" aria-hidden="true">{product.name.slice(0, 1)}</span>
                <div>
                  <strong>{product.name}</strong>
                  <em>SKU: {product.sku}</em>
                  <b>{presentation.status} ({product.stockCount})</b>
                </div>
                <button onClick={() => receiveProduct(product.sku)} type="button" aria-label={text.receiveProduct}>{"+"}</button>
              </article>
              );
            })}
          </div>
        </section>

        <nav className="store-inventory-pagination" aria-label={text.productManagement}>
          <button disabled type="button">{"<"}</button>
          <button className="active" type="button">1</button>
          <button type="button">2</button>
          <button type="button">3</button>
          <span>...</span>
          <button type="button">24</button>
          <button type="button">{">"}</button>
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
    <main className={`store-dash-shell store-theme-${themeMode}`}>
      <aside className="store-dash-sidebar">
        <div className="store-dash-brand">
          <BrandLogo showText size={32} />
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
          <NotificationBell storeId={store?.id} storeName={store?.storeName} />
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
