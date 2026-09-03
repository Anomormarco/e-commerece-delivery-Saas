import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { NotificationBell } from "../../components/NotificationBell";
import { StateBlock } from "../../components/StateBlock";
import type { Metric, QueueItem } from "../../shared/types";
import { postJson } from "../../shared/api";
import { useRealtimeResource } from "../../shared/useRealtimeResource";

type AdminDashboard = {
  metrics: Metric[];
  verificationQueue: QueueItem[];
  stores: AdminStoreRow[];
  employees: AdminEmployeeRow[];
  alerts: string[];
};

type AdminSubscription = {
  paid: boolean;
  status: string;
  statusLabel: string;
  planName: string;
  amountMnt: string;
  startsAt: string | null;
  endsAt: string | null;
  daysLeft: number | null;
};

type AdminStoreRow = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  status: string;
  statusLabel: string;
  tenantId?: string;
  tenantName: string;
  tenantStatus: string;
  address?: string;
  productCount: number;
  orderCount: number;
  createdAt?: string | null;
  subscription: AdminSubscription;
};

type AdminEmployeeRow = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  statusLabel: string;
  createdAt?: string | null;
  roles: Array<{ code: string; name: string }>;
  tenantName?: string;
  tenantRole?: string;
  courier?: {
    vehicleType: string;
    vehiclePlate: string;
    online: boolean;
    rating: number | null;
    verificationStatus: string;
  } | null;
};

type AdminUser = {
  id: string;
  username: string;
  fullName: string;
  role: string;
};

type SectionKey = "overview" | "stores" | "employees" | "access" | "reports" | "settings" | "support";
type ThemeMode = "night" | "light";

type AdminPageProps = {
  user: AdminUser;
  onUserChange: (user: AdminUser) => void;
  onLogout: () => Promise<void> | void;
};

const text = {
  brand: "DeliverHub",
  brandAdmin: "DeliverHub \u0410\u0434\u043C\u0438\u043D",
  control: "\u041B\u043E\u0433\u0438\u0441\u0442\u0438\u043A\u0438\u0439\u043D \u0445\u044F\u043D\u0430\u043B\u0442",
  newDelivery: "\u0428\u0438\u043D\u044D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442",
  search: "\u0425\u0430\u0439\u0445...",
  notification: "\u041C\u044D\u0434\u044D\u0433\u0434\u044D\u043B",
  profile: "\u041F\u0440\u043E\u0444\u0430\u0439\u043B",
  logout: "\u0413\u0430\u0440\u0430\u0445",
  profileInfo: "\u0425\u0443\u0432\u0438\u0439\u043D \u043C\u044D\u0434\u044D\u044D\u043B\u044D\u043B",
  fullName: "\u0411\u04AF\u0442\u044D\u043D \u043D\u044D\u0440",
  username: "\u041D\u044D\u0432\u0442\u0440\u044D\u0445 \u043D\u044D\u0440",
  role: "\u04AE\u04AF\u0440\u044D\u0433",
  save: "\u0425\u0430\u0434\u0433\u0430\u043B\u0430\u0445",
  close: "\u0425\u0430\u0430\u0445",
  nightMode: "Night mode",
  lightMode: "Light mode",
  title: "\u041F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u044B\u043D \u0443\u0434\u0438\u0440\u0434\u043B\u0430\u0433\u0430",
  subtitle: "\u0414\u044D\u043B\u0433\u04AF\u04AF\u0440, \u0431\u04AF\u0440\u0442\u0433\u044D\u043B\u0442\u044D\u0439 \u0430\u0436\u0438\u043B\u0442\u0430\u043D, \u044D\u0440\u0445 \u0431\u043E\u043B\u043E\u043D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0445\u044F\u043D\u0430\u043B\u0442",
  stores: "\u0414\u044D\u043B\u0433\u04AF\u04AF\u0440\u04AF\u04AF\u0434",
  orders: "\u0417\u0430\u0445\u0438\u0430\u043B\u0433\u0430",
  employees: "\u0411\u04AF\u0440\u0442\u0433\u044D\u043B\u0442\u044D\u0439 \u0430\u0436\u0438\u043B\u0442\u043D\u0443\u0443\u0434",
  access: "\u042D\u0440\u0445\u0438\u0439\u043D \u0442\u04E9\u043B\u04E9\u0432",
  delivery: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442",
  reports: "\u0422\u0430\u0439\u043B\u0430\u043D",
  overview: "\u0422\u043E\u0439\u043C",
  dispatchMap: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u043D\u044D\u0433\u0434\u0441\u044D\u043D \u0433\u0430\u0437\u0440\u044B\u043D \u0437\u0443\u0440\u0430\u0433",
  activeDeliveries: "\u0418\u0434\u044D\u0432\u0445\u0442\u044D\u0439 \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u04AF\u04AF\u0434",
  waitingOrders: "\u0445\u04AF\u043B\u044D\u044D\u0433\u0434\u044D\u0436 \u0431\u0430\u0439\u043D\u0430",
  dispatchAll: "\u0411\u04AF\u0433\u0434",
  urgent: "\u042F\u0430\u0440\u0430\u043B\u0442\u0430\u0439",
  overdue: "\u0425\u043E\u0446\u0440\u043E\u0433\u0434\u0441\u043E\u043D",
  onlineActive: "\u041E\u043D\u043B\u0430\u0439\u043D / \u0418\u0434\u044D\u0432\u0445\u0442\u044D\u0439",
  offlineBreak: "\u041E\u0444\u0444\u043B\u0430\u0439\u043D / \u0417\u0430\u0432\u0441\u0430\u0440\u043B\u0430\u0433\u0430",
  urgentOrder: "\u042F\u0430\u0440\u0430\u043B\u0442\u0430\u0439 \u0437\u0430\u0445\u0438\u0430\u043B\u0433\u0430",
  legend: "\u0422\u04E9\u043B\u04E9\u0432",
  assignCourier: "\u041E\u043D\u043E\u043E\u0445",
  unassigned: "\u0425\u0443\u0432\u0430\u0430\u0440\u0438\u043B\u0430\u0433\u0434\u0430\u0430\u0433\u04AF\u0439",
  waitingTime: "\u0425\u04AF\u043B\u044D\u044D\u0433\u0434\u044D\u0436 \u0431\u0443\u0439 \u0445\u0443\u0433\u0430\u0446\u0430\u0430",
  minutes: "\u043C\u0438\u043D",
  cyclist: "\u0423\u043D\u0430\u0434\u0430\u0433 \u0434\u0443\u0433\u0443\u0439",
  revenue: "\u04E8\u043D\u04E9\u04E9\u0434\u0440\u0438\u0439\u043D \u043E\u0440\u043B\u043E\u0433\u043E",
  usersToday: "\u04E8\u043D\u04E9\u04E9\u0434\u0440\u0438\u0439\u043D \u0445\u044D\u0440\u044D\u0433\u043B\u044D\u0433\u0447",
  newClients: "\u0428\u0438\u043D\u044D \u0445\u0430\u0440\u0438\u043B\u0446\u0430\u0433\u0447",
  totalSales: "\u041D\u0438\u0439\u0442 \u0431\u043E\u0440\u043B\u0443\u0443\u043B\u0430\u043B\u0442",
  welcomeBack: "\u0422\u0430\u0432\u0442\u0430\u0439 \u043C\u043E\u0440\u0438\u043B",
  welcomeCopy: "\u04E8\u043D\u04E9\u04E9\u0434\u0440\u0438\u0439\u043D \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u044B\u043D \u0445\u044F\u043D\u0430\u043B\u0442, \u0445\u04AF\u0440\u0433\u044D\u043B\u0442 \u0431\u043E\u043B\u043E\u043D \u044D\u0440\u0445\u0438\u0439\u043D \u0442\u04E9\u043B\u04E9\u0432 \u0431\u044D\u043B\u044D\u043D \u0431\u0430\u0439\u043D\u0430.",
  quickRecord: "\u0425\u0443\u0440\u0434\u0430\u043D \u0431\u04AF\u0440\u0442\u0433\u044D\u043B",
  satisfaction: "\u0421\u044D\u0442\u0433\u044D\u043B \u0445\u0430\u043D\u0430\u043C\u0436",
  allProjects: "\u0411\u04AF\u0445 \u0442\u04E9\u0441\u043B\u0438\u0439\u043D \u0434\u04AF\u043D",
  referral: "\u0423\u0440\u0438\u043B\u0433\u044B\u043D \u0445\u044F\u043D\u0430\u043B\u0442",
  invited: "\u0423\u0440\u044C\u0441\u0430\u043D",
  bonus: "\u0423\u0440\u0430\u043C\u0448\u0443\u0443\u043B\u0430\u043B",
  safety: "\u041D\u0430\u0439\u0434\u0432\u0430\u0440",
  salesOverview: "\u0411\u043E\u0440\u043B\u0443\u0443\u043B\u0430\u043B\u0442\u044B\u043D \u0442\u043E\u0439\u043C",
  settings: "\u0422\u043E\u0445\u0438\u0440\u0433\u043E\u043E",
  support: "\u0422\u0443\u0441\u043B\u0430\u043C\u0436",
  urgentPending: "\u042F\u0430\u0440\u0430\u043B\u0442\u0430\u0439 \u0445\u04AF\u043B\u044D\u044D\u0433\u0434\u044D\u0436 \u0431\u0443\u0439",
  assign: "\u0425\u0443\u0432\u0430\u0430\u0440\u0438\u043B\u0430\u0445",
  recentDeliveries: "\u0421\u04AF\u04AF\u043B\u0438\u0439\u043D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u04AF\u04AF\u0434",
  delivered: "\u0425\u04AF\u0440\u0433\u044D\u0441\u044D\u043D",
  inTransit: "\u0417\u0430\u043C\u0434 \u044F\u0432\u0430\u0430",
  deliveringOrders: "\u0425\u04AF\u0440\u0433\u044D\u0433\u0434\u044D\u0436 \u0431\u0443\u0439",
  delayed: "\u0421\u0430\u0430\u0442\u0441\u0430\u043D",
  mobileHome: "\u041D\u04AF\u04AF\u0440",
  mobileOrders: "\u0417\u0430\u0445\u0438\u0430\u043B\u0433\u0430",
  mobileDeliveries: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442",
  activeThree: "3 \u0438\u0434\u044D\u0432\u0445\u0442\u044D\u0439",
  activeTwo: "2 \u0431\u04AF\u0440\u0442\u0433\u044D\u043B\u0442\u044D\u0439",
  name: "\u041D\u044D\u0440",
  status: "\u0422\u04E9\u043B\u04E9\u0432",
  roleColumn: "\u04AE\u04AF\u0440\u044D\u0433",
  actions: "\u04AE\u0439\u043B\u0434\u044D\u043B",
  active: "\u0418\u0434\u044D\u0432\u0445\u0442\u044D\u0439",
  pending: "\u0425\u04AF\u043B\u044D\u044D\u0433\u0434\u044D\u0436 \u0431\u0443\u0439",
  edit: "\u0417\u0430\u0441\u0430\u0445",
  delete: "\u0423\u0441\u0442\u0433\u0430\u0445",
  invoice: "\u041D\u044D\u0445\u044D\u043C\u0436\u043B\u044D\u0445",
  extend: "\u0421\u0443\u043D\u0433\u0430\u0445",
  wait: "\u0422\u04AF\u0440 \u0445\u04AF\u043B\u044D\u044D\u043D\u044D \u04AF\u04AF...",
  optional: "\u0437\u0430\u0430\u0432\u0430\u043B \u0431\u0438\u0448",
  newStore: "\u0428\u0438\u043D\u044D \u0434\u044D\u043B\u0433\u04AF\u04AF\u0440",
  newEmployee: "\u0428\u0438\u043D\u044D \u0430\u0436\u0438\u043B\u0442\u0430\u043D",
  subscription: "\u0422\u04E9\u043B\u0431\u04E9\u0440",
  paid: "\u0422\u04E9\u043B\u0441\u04E9\u043D",
  unpaid: "\u0422\u04E9\u043B\u0431\u04E9\u0440\u0433\u04AF\u0439",
  daysLeft: "\u04E9\u0434\u04E9\u0440 \u04AF\u043B\u0434\u0441\u044D\u043D",
  phoneLabel: "\u0423\u0442\u0430\u0441",
  emailLabel: "\u0418\u043C\u044D\u0439\u043B",
  vehicle: "\u0422\u044D\u044D\u0432\u044D\u0440",
  tenantLabel: "\u0422\u0435\u043D\u0430\u043D\u0442",
  createdLabel: "\u04AE\u04AF\u0441\u0433\u044D\u0441\u044D\u043D",
  cancel: "\u0426\u0443\u0446\u043B\u0430\u0445",
  create: "\u04AE\u04AF\u0441\u0433\u044D\u0445",
  months: "\u0421\u0430\u0440",
  extendMonths: "\u0425\u044D\u0434\u044D\u043D \u0441\u0430\u0440\u0430\u0430\u0440 \u0441\u0443\u043D\u0433\u0430\u0445 \u0432\u044D?",
  storeName2: "\u0414\u044D\u043B\u0433\u04AF\u04AF\u0440\u0438\u0439\u043D \u043D\u044D\u0440",
  owner: "\u042D\u0437\u044D\u043C\u0448\u0438\u0433\u0447",
  descriptionLabel: "\u0422\u0430\u0439\u043B\u0431\u0430\u0440",
  roleLabel: "\u04AE\u04AF\u0440\u044D\u0433",
  passwordLabel: "\u041D\u0443\u0443\u0446 \u04AF\u0433",
  activeStatus: "\u0418\u0434\u044D\u0432\u0445\u0442\u044D\u0439",
  suspendedStatus: "\u0422\u04AF\u0434\u0433\u044D\u043B\u0437\u04AF\u04AF\u043B\u0441\u044D\u043D",
  deletedStatus: "\u0423\u0441\u0442\u0433\u0430\u0441\u0430\u043D",
  hardDelete: "\u0411\u04AF\u0440\u043C\u04E9\u0441\u04E9\u043D \u0443\u0441\u0442\u0433\u0430\u0445",
  activateAll: "\u0411\u04AF\u0433\u0434\u0438\u0439\u0433 \u0442\u04E9\u043B\u0431\u04E9\u0440\u0442\u044D\u0439 \u0431\u043E\u043B\u0433\u043E\u0445",
  activateAllDays: "\u0425\u044D\u0434\u044D\u043D \u04E9\u0434\u0440\u0438\u0439\u043D \u044D\u0440\u0445\u0442\u044D\u0439 \u0431\u043E\u043B\u0433\u043E\u0445 \u0432\u044D?",
  daysWord: "\u04E9\u0434\u04E9\u0440",
  seniorCourier: "\u0410\u0445\u043B\u0430\u0445 \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0430\u0436\u0438\u043B\u0442\u0430\u043D",
  dispatcher: "\u0414\u0438\u0441\u043F\u0435\u0442\u0447\u0435\u0440",
  actionDone: "\u04AE\u0439\u043B\u0434\u044D\u043B \u0430\u043C\u0436\u0438\u043B\u0442\u0442\u0430\u0439",
  profileSaved: "\u0425\u0443\u0432\u0438\u0439\u043D \u043C\u044D\u0434\u044D\u044D\u043B\u044D\u043B \u0445\u0430\u0434\u0433\u0430\u043B\u0430\u0433\u0434\u043B\u0430\u0430",
  profileSaveFailed: "\u0425\u0443\u0432\u0438\u0439\u043D \u043C\u044D\u0434\u044D\u044D\u043B\u044D\u043B \u0445\u0430\u0434\u0433\u0430\u043B\u0430\u0445\u0430\u0434 \u0430\u043B\u0434\u0430\u0430 \u0433\u0430\u0440\u043B\u0430\u0430",
  privacy: "\u041D\u0443\u0443\u0446\u043B\u0430\u043B\u044B\u043D \u0431\u043E\u0434\u043B\u043E\u0433\u043E",
  terms: "\u04AE\u0439\u043B\u0447\u0438\u043B\u0433\u044D\u044D\u043D\u0438\u0439 \u043D\u04E9\u0445\u0446\u04E9\u043B",
  apiDocs: "\u0425\u04E9\u0433\u0436\u04AF\u04AF\u043B\u044D\u0433\u0447\u0438\u0439\u043D \u0431\u0430\u0440\u0438\u043C\u0442",
  contact: "\u0422\u0443\u0441\u043B\u0430\u043C\u0436\u0442\u0430\u0439 \u0445\u043E\u043B\u0431\u043E\u0433\u0434\u043E\u0445",
  copyright: "\u00A9 2026 DeliverHub Logistics Inc. \u0411\u04AF\u0445 \u044D\u0440\u0445 \u0445\u0443\u0443\u043B\u0438\u0430\u0440 \u0445\u0430\u043C\u0433\u0430\u0430\u043B\u0430\u0433\u0434\u0441\u0430\u043D.",
};

const navItems: Array<{ key: SectionKey; label: string }> = [
  { key: "overview", label: text.overview },
  { key: "stores", label: text.stores },
  { key: "employees", label: text.employees },
  { key: "access", label: text.access },
  { key: "reports", label: text.reports },
];

const fallbackEmployees = [
  { name: "\u0411\u0430\u0442-\u042D\u0440\u0434\u044D\u043D\u044D", role: text.seniorCourier },
  { name: "\u0410\u043B\u0442-\u0423\u043D\u0434\u0440\u0430\u043B", role: text.dispatcher },
];

const accessRows = [
  { name: "\u0421\u0430\u043D\u0441\u0430\u0440", status: text.active, tone: "success" },
  { name: "\u041D\u043E\u043C\u0438\u043D", status: text.active, tone: "success" },
  { name: "CU", status: "\u0418\u0434\u044D\u0432\u0445\u0433\u04AF\u0439", tone: "danger" },
];

function metricValue(metrics: Metric[], label: string, fallback: string) {
  return metrics.find((metric) => metric.label === label)?.value ?? fallback;
}

function metricNumber(metrics: Metric[], label: string, fallback = 0) {
  const rawValue = metricValue(metrics, label, String(fallback)).replace(/[^\d.-]/g, "");
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

function routeFromHash(): SectionKey {
  const value = window.location.hash.replace("#admin/", "") as SectionKey;
  return navItems.some((item) => item.key === value) || value === "settings" || value === "support" ? value : "overview";
}

function deliveryStateText(state: string, index: number) {
  if (state === "DELIVERED") return text.delivered;
  if (state === "DELAYED" || state === "FAILED") return text.delayed;
  if (index === 0) return text.pending;
  return text.inTransit;
}

function statusTone(status: string) {
  if (status === "ACTIVE" || status === text.active) return "success";
  if (status === "DELETED" || status === "SUSPENDED" || status === "CANCELLED") return "danger";
  return "warning";
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

const employeeRoleOptions = [
  { code: "DELIVERY_EMPLOYEE", label: "Хүргэлтийн ажилтан" },
  { code: "STORE_ADMIN", label: "Дэлгүүрийн админ" },
  { code: "SHOP_ADMIN", label: "Shop админ" },
  { code: "PLATFORM_ADMIN", label: "Платформ админ" },
];
const employeeStatusOptions = ["ACTIVE", "SUSPENDED", "INVITED", "DELETED"];
const vehicleOptions = ["WALK", "MOPED", "CAR"];

function ModalField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="admin-modal-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AdminModalShell({
  title,
  error,
  busy,
  submitLabel,
  onClose,
  onSubmit,
  children,
  danger,
}: {
  title: string;
  error: string | null;
  busy: boolean;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  children: ReactNode;
  danger?: ReactNode;
}) {
  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <form className="admin-modal" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <strong>{title}</strong>
          <button type="button" onClick={onClose} aria-label={text.close}>
            {"×"}
          </button>
        </header>
        <div className="admin-modal-body">{children}</div>
        {error && <p className="admin-modal-error">{error}</p>}
        <footer>
          {danger}
          <span className="admin-modal-spacer" />
          <button type="button" className="admin-modal-cancel" onClick={onClose}>
            {text.cancel}
          </button>
          <button type="submit" className="admin-modal-submit" disabled={busy}>
            {busy ? text.wait : submitLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}

function StoreFormModal({
  mode,
  row,
  busy,
  error,
  onClose,
  onSubmit,
  onHardDelete,
}: {
  mode: "create" | "edit";
  row?: AdminStoreRow;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  onHardDelete?: () => void;
}) {
  const [name, setName] = useState(row?.name ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [months, setMonths] = useState(6);
  const [ownerName, setOwnerName] = useState("");
  const [ownerLogin, setOwnerLogin] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "edit") {
      onSubmit({ name: name.trim(), description: description.trim() });
      return;
    }
    const isEmail = ownerLogin.includes("@");
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      subscriptionMonths: months,
      ownerName: ownerName.trim() || undefined,
      ownerEmail: isEmail ? ownerLogin.trim() : undefined,
      ownerPhone: isEmail ? undefined : ownerLogin.trim() || undefined,
      ownerPassword: ownerPassword || undefined,
    });
  }

  return (
    <AdminModalShell
      title={mode === "create" ? text.newStore : `${text.edit}: ${row?.name ?? ""}`}
      error={error}
      busy={busy}
      submitLabel={mode === "create" ? text.create : text.save}
      onClose={onClose}
      onSubmit={submit}
      danger={
        mode === "edit" && onHardDelete ? (
          <button type="button" className="admin-modal-danger" onClick={onHardDelete}>
            {text.hardDelete}
          </button>
        ) : null
      }
    >
      <ModalField label={text.storeName2}>
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </ModalField>
      <ModalField label={text.descriptionLabel}>
        <input value={description} onChange={(event) => setDescription(event.target.value)} />
      </ModalField>
      {mode === "create" && (
        <>
          <ModalField label={`${text.subscription} (${text.months})`}>
            <input
              type="number"
              min={0}
              max={60}
              value={months}
              onChange={(event) => setMonths(Math.max(0, Number(event.target.value) || 0))}
            />
          </ModalField>
          <p className="admin-modal-hint">{`${text.storeName2} — ${text.owner} · ${text.optional}`}</p>
          <ModalField label={text.owner}>
            <input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} />
          </ModalField>
          <ModalField label={`${text.emailLabel} / ${text.phoneLabel}`}>
            <input value={ownerLogin} onChange={(event) => setOwnerLogin(event.target.value)} />
          </ModalField>
          <ModalField label={text.passwordLabel}>
            <input type="password" value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} />
          </ModalField>
        </>
      )}
    </AdminModalShell>
  );
}

function EmployeeFormModal({
  mode,
  row,
  busy,
  error,
  onClose,
  onSubmit,
  onHardDelete,
}: {
  mode: "create" | "edit";
  row?: AdminEmployeeRow;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  onHardDelete?: () => void;
}) {
  const [fullName, setFullName] = useState(row?.name ?? "");
  const [email, setEmail] = useState(row?.email ?? "");
  const [phone, setPhone] = useState(row?.phone ?? "");
  const [password, setPassword] = useState("");
  const [roleCode, setRoleCode] = useState(row?.roles?.[0]?.code ?? "DELIVERY_EMPLOYEE");
  const [status, setStatus] = useState(row?.status ?? "ACTIVE");
  const [vehicleType, setVehicleType] = useState(row?.courier?.vehicleType || "WALK");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "edit") {
      onSubmit({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        status,
        ...(row?.courier ? { vehicleType } : {}),
      });
      return;
    }
    onSubmit({
      fullName: fullName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      password,
      roleCode,
      vehicleType,
    });
  }

  return (
    <AdminModalShell
      title={mode === "create" ? text.newEmployee : `${text.edit}: ${row?.name ?? ""}`}
      error={error}
      busy={busy}
      submitLabel={mode === "create" ? text.create : text.save}
      onClose={onClose}
      onSubmit={submit}
      danger={
        mode === "edit" && onHardDelete ? (
          <button type="button" className="admin-modal-danger" onClick={onHardDelete}>
            {text.hardDelete}
          </button>
        ) : null
      }
    >
      <ModalField label={text.fullName}>
        <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
      </ModalField>
      <ModalField label={text.emailLabel}>
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </ModalField>
      <ModalField label={text.phoneLabel}>
        <input value={phone} onChange={(event) => setPhone(event.target.value)} />
      </ModalField>
      {mode === "create" && (
        <>
          <ModalField label={text.passwordLabel}>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          </ModalField>
          <ModalField label={text.roleLabel}>
            <select value={roleCode} onChange={(event) => setRoleCode(event.target.value)}>
              {employeeRoleOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </ModalField>
        </>
      )}
      {mode === "edit" && (
        <ModalField label={text.status}>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {employeeStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </ModalField>
      )}
      {(roleCode === "DELIVERY_EMPLOYEE" || row?.courier) && (
        <ModalField label={text.vehicle}>
          <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value)}>
            {vehicleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </ModalField>
      )}
    </AdminModalShell>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("mn-MN");
}

export function AdminPage({ user, onLogout, onUserChange }: AdminPageProps) {
  const dashboard = useRealtimeResource<AdminDashboard>("/dashboard", ["admin.dashboard.refresh"]);
  const [activeSection, setActiveSection] = useState<SectionKey>(() => routeFromHash());
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem("deliverhub-admin-theme") === "light" ? "light" : "night"));
  const [dispatchFilter, setDispatchFilter] = useState<"all" | "urgent" | "overdue">("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(user.fullName);
  const [profileUsername, setProfileUsername] = useState(user.username);

  useEffect(() => {
    const syncRoute = () => setActiveSection(routeFromHash());
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    localStorage.setItem("deliverhub-admin-theme", themeMode);
  }, [themeMode]);

  const pageTitle = useMemo(() => {
    return [...navItems, { key: "settings" as const, label: text.settings }, { key: "support" as const, label: text.support }].find(
      (item) => item.key === activeSection,
    )?.label;
  }, [activeSection]);

  function goTo(section: SectionKey) {
    window.location.hash = `admin/${section}`;
    setActiveSection(section);
  }

  function runAction(label: string, target: string) {
    setNotice(`${label}: ${target} - ${text.actionDone}`);
  }

  const [storeModal, setStoreModal] = useState<{ mode: "create" | "edit"; row?: AdminStoreRow } | null>(null);
  const [employeeModal, setEmployeeModal] = useState<{ mode: "create" | "edit"; row?: AdminEmployeeRow } | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  async function submitStore(payload: Record<string, unknown>) {
    if (!storeModal) return;
    setModalBusy(true);
    setModalError(null);
    try {
      if (storeModal.mode === "edit" && storeModal.row) {
        await postJson(`/stores/${storeModal.row.id}`, payload);
      } else {
        await postJson("/stores", payload);
      }
      await dashboard.refetch();
      setStoreModal(null);
      setNotice(text.actionDone);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : text.profileSaveFailed);
    } finally {
      setModalBusy(false);
    }
  }

  async function submitEmployee(payload: Record<string, unknown>) {
    if (!employeeModal) return;
    setModalBusy(true);
    setModalError(null);
    try {
      if (employeeModal.mode === "edit" && employeeModal.row) {
        await postJson(`/employees/${employeeModal.row.id}`, payload);
      } else {
        await postJson("/employees", payload);
      }
      await dashboard.refetch();
      setEmployeeModal(null);
      setNotice(text.actionDone);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : text.profileSaveFailed);
    } finally {
      setModalBusy(false);
    }
  }

  async function toggleStoreActive(store: AdminStoreRow) {
    try {
      await postJson(`/stores/${store.id}`, { isActive: store.status !== "ACTIVE" });
      await dashboard.refetch();
      setNotice(text.actionDone);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text.profileSaveFailed);
    }
  }

  async function activateAllStores() {
    const raw = window.prompt(text.activateAllDays, "300");
    if (raw === null) return;
    const days = Math.max(1, Math.min(3650, Number(raw) || 300));
    if (!window.confirm(`${text.activateAll} — ${days} ${text.daysWord}?`)) return;
    try {
      const result = await postJson<{ activated: number }>("/stores/activate-all", { days });
      await dashboard.refetch();
      setNotice(`${text.activateAll}: ${result.activated} - ${text.actionDone}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text.profileSaveFailed);
    }
  }

  async function extendStore(store: AdminStoreRow) {
    const raw = window.prompt(text.extendMonths, "6");
    if (raw === null) return;
    const months = Math.max(1, Math.min(60, Number(raw) || 1));
    try {
      await postJson(`/stores/${store.id}/subscription`, { months });
      await dashboard.refetch();
      setNotice(`${text.extend}: ${months} ${text.months} - ${text.actionDone}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text.profileSaveFailed);
    }
  }

  async function removeStore(store: AdminStoreRow, hard = false) {
    const question = hard
      ? `${store.name}: ${text.hardDelete}?`
      : `${store.name} дэлгүүрийг идэвхгүй болгох уу?`;
    if (!window.confirm(question)) return;
    try {
      await postJson(`/stores/${store.id}/delete`, hard ? { hard: true } : {});
      await dashboard.refetch();
      setStoreModal(null);
      setNotice(`${text.delete}: ${store.name} - ${text.actionDone}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text.profileSaveFailed);
    }
  }

  async function removeEmployee(employee: AdminEmployeeRow, hard = false) {
    const question = hard
      ? `${employee.name}: ${text.hardDelete}?`
      : `${employee.name} ажилтныг идэвхгүй болгох уу?`;
    if (!window.confirm(question)) return;
    try {
      await postJson(`/employees/${employee.id}/delete`, hard ? { hard: true } : {});
      await dashboard.refetch();
      setEmployeeModal(null);
      setNotice(`${text.delete}: ${employee.name} - ${text.actionDone}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text.profileSaveFailed);
    }
  }

  async function saveProfile() {
    try {
      const result = await postJson<{ user: AdminUser }>("/auth/profile", {
        fullName: profileName,
        username: profileUsername,
      });
      onUserChange(result.user);
      setProfileName(result.user.fullName);
      setProfileUsername(result.user.username);
      setProfileOpen(false);
      setNotice(text.profileSaved);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text.profileSaveFailed);
    }
  }

  function renderOverview(data: AdminDashboard) {
    const metrics = data.metrics;
    const recentDeliveries = data.verificationQueue.slice(0, 3);
    const pendingCount = data.verificationQueue.length || Number(metricValue(metrics, "Active deliveries", "0"));
    const storeRows = data.stores ?? [];
    const employeeRows = data.employees ?? [];
    const revenueMnt = metricNumber(metrics, "Revenue");
    const activeDeliveries = metricNumber(metrics, "Active deliveries", data.verificationQueue.length);
    const activeStores = storeRows.filter((store) => store.status === "ACTIVE" || store.tenantStatus === "ACTIVE").length;
    const activeEmployees = employeeRows.filter((employee) => employee.status === "ACTIVE").length;
    const totalStoreOrders = storeRows.reduce((sum, store) => sum + Number(store.orderCount || 0), 0);

    return (
      <section className="dashboard-overview">
        <div className="dashboard-stats">
          <article className="platform-kpi">
            <span>{text.revenue}</span>
            <strong>{revenueMnt.toLocaleString("mn-MN")} MNT</strong>
            <em>{totalStoreOrders.toLocaleString("mn-MN")} захиалга</em>
          </article>
          <article className="platform-kpi">
            <span>{text.usersToday}</span>
            <strong>{metricValue(metrics, "Tenant", String(storeRows.length))}</strong>
            <em>{activeStores}/{storeRows.length} идэвхтэй</em>
          </article>
          <article className="platform-kpi">
            <span>{text.newClients}</span>
            <strong>{employeeRows.length}</strong>
            <em className={activeEmployees === employeeRows.length ? "" : "danger"}>{activeEmployees} идэвхтэй</em>
          </article>
          <article className="platform-kpi">
            <span>{text.totalSales}</span>
            <strong>{activeDeliveries}</strong>
            <em>{data.verificationQueue.length} хүлээгдэж байна</em>
          </article>
        </div>

        {false && <section className="admin-mobile-experience" aria-label={text.recentDeliveries}>
          <div className="admin-mobile-urgent">
            <div>
              <span>{text.urgentPending}</span>
              <strong>{pendingCount} {text.orders}</strong>
            </div>
            <button onClick={() => goTo("stores")} type="button">{text.stores}</button>
          </div>

          <article className="platform-card admin-mobile-recent">
            <div className="platform-card-head">
              <h2>{text.recentDeliveries}</h2>
              <span>{recentDeliveries.length}</span>
            </div>
            <div className="admin-mobile-delivery-list">
              {(recentDeliveries.length ? recentDeliveries : fallbackEmployees.map((employee, index) => ({
                id: `ORD-${index + 891}`,
                name: employee.name,
                state: index === 2 ? "DELAYED" : index === 0 ? "DELIVERED" : "IN_TRANSIT",
                distance: "Улаанбаатар",
              }))).map((item, index) => (
                <button key={item.id} onClick={() => runAction(text.assign, item.id)} type="button">
                  <span className={`admin-mobile-state-dot state-${index}`} aria-hidden="true" />
                  <div>
                    <strong>{item.id}</strong>
                    <em>{item.name || item.distance}</em>
                  </div>
                  <b>{deliveryStateText(item.state, index)}</b>
                </button>
              ))}
            </div>
          </article>
        </section>}

        <div className="dashboard-feature-grid">
          <article className="dashboard-welcome">
            <div>
              <span>{text.welcomeBack}</span>
              <h2>{profileName || user.fullName}</h2>
              <p>{text.welcomeCopy}</p>
              <button onClick={() => goTo("stores")} type="button">{text.stores}</button>
            </div>
            <div className="dashboard-layer-art" aria-hidden="true">
              <span />
              <span />
            </div>
          </article>

          <article className="dashboard-ring-card">
            <h2>{text.satisfaction}</h2>
            <p>{text.allProjects}</p>
            <div className="dashboard-ring">
              <strong>93%</strong>
            </div>
          </article>

          <article className="dashboard-referral">
            <div>
              <h2>{text.referral}</h2>
              <p>{text.allProjects}</p>
            </div>
            <div className="dashboard-referral-body">
              <div>
                <span>{text.invited}</span>
                <strong>145</strong>
              </div>
              <div>
                <span>{text.bonus}</span>
                <strong>1,465</strong>
              </div>
              <div className="dashboard-score">
                <span>{text.safety}</span>
                <strong>9.3</strong>
              </div>
            </div>
          </article>
        </div>

        <article className="platform-card dashboard-wide-card">
          <div className="platform-card-head">
            <h2>{text.salesOverview}</h2>
            <span>2026</span>
          </div>
          <div className="dashboard-bars" aria-hidden="true">
            <span style={{ height: "42%" }} />
            <span style={{ height: "64%" }} />
            <span style={{ height: "52%" }} />
            <span style={{ height: "78%" }} />
            <span style={{ height: "60%" }} />
            <span style={{ height: "86%" }} />
          </div>
        </article>
      </section>
    );
  }

  function renderStores(storeRows: AdminStoreRow[]) {
    const paidCount = storeRows.filter((store) => store.subscription?.paid).length;
    return (
      <article className="platform-card">
        <div className="platform-card-head">
          <h2>{text.stores}</h2>
          <div className="admin-card-head-actions">
            <span>
              {paidCount}/{storeRows.length} {text.paid}
            </span>
            <button className="admin-add-button admin-add-button-ghost" type="button" onClick={activateAllStores}>
              {text.activateAll}
            </button>
            <button className="admin-add-button" type="button" onClick={() => setStoreModal({ mode: "create" })}>
              + {text.newStore}
            </button>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table>
          <thead>
            <tr>
              <th>{text.name}</th>
              <th>{text.status}</th>
              <th>{text.subscription}</th>
              <th>Бараа / Захиалга</th>
              <th>{text.createdLabel}</th>
              <th>{text.actions}</th>
            </tr>
          </thead>
          <tbody>
            {storeRows.map((store) => (
              <tr key={store.id}>
                <td>
                  <div>
                    <strong>{store.name}</strong>
                    <span>{store.address || store.tenantName || store.tenantStatus}</span>
                  </div>
                </td>
                <td>
                  <button
                    className={`admin-pill admin-pill-button ${statusTone(store.status)}`}
                    type="button"
                    onClick={() => toggleStoreActive(store)}
                    title={text.status}
                  >
                    {store.statusLabel}
                  </button>
                </td>
                <td>
                  <span className={`admin-pill ${store.subscription?.paid ? "success" : "danger"}`}>
                    {store.subscription?.paid ? text.paid : text.unpaid}
                  </span>
                  <div className="admin-subrow">
                    {store.subscription?.endsAt ? formatDate(store.subscription.endsAt) : "—"}
                    {store.subscription?.daysLeft != null ? ` · ${store.subscription.daysLeft} ${text.daysLeft}` : ""}
                  </div>
                </td>
                <td>
                  {store.productCount} / {store.orderCount}
                </td>
                <td>{formatDate(store.createdAt)}</td>
                <td>
                  <div className="admin-row-actions">
                  <button onClick={() => setStoreModal({ mode: "edit", row: store })} type="button" aria-label={text.edit}>
                    {"\u270E"}
                  </button>
                  <button onClick={() => extendStore(store)} type="button" aria-label={text.extend} title={text.extend}>
                    {"\u21BB"}
                  </button>
                  <button onClick={() => removeStore(store)} type="button" aria-label={text.delete}>
                    {"\u232B"}
                  </button>
                  </div>
                </td>
              </tr>
            ))}
            {!storeRows.length && (
              <tr>
                <td colSpan={6}>Бүртгэлтэй дэлгүүр алга байна.</td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </article>
    );
  }

  function renderEmployees(employeeRows: AdminEmployeeRow[]) {
    return (
      <article className="platform-card">
        <div className="platform-card-head">
          <h2>{text.employees}</h2>
          <div className="admin-card-head-actions">
            <span>{employeeRows.length}</span>
            <button className="admin-add-button" type="button" onClick={() => setEmployeeModal({ mode: "create" })}>
              + {text.newEmployee}
            </button>
          </div>
        </div>
        <div className="admin-table-scroll">
        <table>
          <thead>
            <tr>
              <th>{text.name}</th>
              <th>{text.roleColumn}</th>
              <th>{text.phoneLabel}</th>
              <th>{text.vehicle}</th>
              <th>{text.status}</th>
              <th>{text.createdLabel}</th>
              <th>{text.actions}</th>
            </tr>
          </thead>
          <tbody>
            {employeeRows.map((employee) => (
              <tr key={employee.id}>
                <td>
                  <div className="platform-person">
                    <span>
                      <UserIcon />
                    </span>
                    <div>
                      <strong>{employee.name}</strong>
                      <small>{employee.email || employee.phone}</small>
                    </div>
                  </div>
                </td>
                <td>
                  {employee.roles.map((role) => role.name || role.code).join(", ") || "—"}
                  {employee.tenantName ? <div className="admin-subrow">{employee.tenantName}</div> : null}
                </td>
                <td>{employee.phone || "—"}</td>
                <td>
                  {employee.courier ? `${employee.courier.vehicleType || "—"}${employee.courier.online ? " · online" : ""}` : "—"}
                </td>
                <td>
                  <span className={`admin-pill ${statusTone(employee.status)}`}>{employee.statusLabel}</span>
                </td>
                <td>{formatDate(employee.createdAt)}</td>
                <td>
                  <div className="admin-row-actions">
                  <button onClick={() => setEmployeeModal({ mode: "edit", row: employee })} type="button" aria-label={text.edit}>
                    {"\u270E"}
                  </button>
                  <button onClick={() => removeEmployee(employee)} type="button" aria-label={text.delete}>
                    {"\u232B"}
                  </button>
                  </div>
                </td>
              </tr>
            ))}
            {!employeeRows.length && (
              <tr>
                <td colSpan={7}>Бүртгэлтэй ажилтан алга байна.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </article>
    );
  }

  function renderAccess() {
    return (
      <article className="platform-card platform-wide-card">
        <div className="platform-card-head">
          <h2>{text.access}</h2>
          <span>{text.activeThree}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>{text.name}</th>
              <th>{text.status}</th>
            </tr>
          </thead>
          <tbody>
            {accessRows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>
                  <span className={`admin-pill ${row.tone}`}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    );
  }

  function renderSimpleSection(label: string) {
    return (
      <article className="platform-card platform-empty-section">
        <div className="platform-card-head">
          <h2>{label}</h2>
          <span>{text.active}</span>
        </div>
        <p>{label}</p>
      </article>
    );
  }

  function renderDispatch(data: AdminDashboard) {
    const fallbackDeliveries: QueueItem[] = [
      { id: "ORD-8921", name: "\u0421\u04AF\u0445\u0431\u0430\u0430\u0442\u0430\u0440 \u0434\u04AF\u04AF\u0440\u044D\u0433, 1-\u0440 \u0445\u043E\u0440\u043E\u043E", state: "URGENT", distance: "15" },
      { id: "ORD-8915", name: "\u0411\u0430\u044F\u043D\u0433\u043E\u043B \u0434\u04AF\u04AF\u0440\u044D\u0433, 3-\u0440 \u0445\u043E\u0440\u043E\u043E", state: "IN_TRANSIT", distance: "C014" },
      { id: "ORD-8924", name: "\u0425\u0430\u043D-\u0423\u0443\u043B \u0434\u04AF\u04AF\u0440\u044D\u0433, 15-\u0440 \u0445\u043E\u0440\u043E\u043E", state: "PENDING", distance: "4kg" },
    ];
    const deliveries = data.verificationQueue.length ? data.verificationQueue : fallbackDeliveries;
    const filteredDeliveries = deliveries.filter((delivery, index) => {
      if (dispatchFilter === "urgent") return delivery.state === "URGENT" || index === 0;
      if (dispatchFilter === "overdue") return delivery.state === "DELAYED" || delivery.state === "FAILED";
      return true;
    });

    return (
      <section className="admin-dispatch">
        <article className="admin-dispatch-map platform-card">
          <div className="admin-map-grid" aria-hidden="true">
            <span className="route route-a" />
            <span className="route route-b" />
            <span className="map-pin courier online">C-014</span>
            <span className="map-pin courier offline">C-082</span>
            <span className="map-pin order urgent">!</span>
            <span className="map-pin order standard" />
          </div>
          <div className="admin-map-controls">
            <div>
              <button type="button" aria-label="+">+</button>
              <button type="button" aria-label="-">-</button>
            </div>
            <section>
              <strong>{text.legend}</strong>
              <span><i className="online" />{text.onlineActive}</span>
              <span><i className="offline" />{text.offlineBreak}</span>
              <span><i className="urgent" />{text.urgentOrder}</span>
            </section>
          </div>
        </article>

        <aside className="admin-dispatch-panel platform-card">
          <div className="platform-card-head">
            <div>
              <h2>{text.activeDeliveries}</h2>
              <p>{deliveries.length} {text.orders} {text.waitingOrders}</p>
            </div>
          </div>
          <div className="admin-dispatch-filters">
            {[
              { key: "all", label: text.dispatchAll, count: deliveries.length },
              { key: "urgent", label: text.urgent, count: deliveries.filter((delivery, index) => delivery.state === "URGENT" || index === 0).length },
              { key: "overdue", label: text.overdue, count: deliveries.filter((delivery) => delivery.state === "DELAYED" || delivery.state === "FAILED").length },
            ].map((filter) => (
              <button
                className={dispatchFilter === filter.key ? "active" : ""}
                key={filter.key}
                onClick={() => setDispatchFilter(filter.key as typeof dispatchFilter)}
                type="button"
              >
                {filter.label}{filter.count ? ` (${filter.count})` : ""}
              </button>
            ))}
          </div>
          <div className="admin-dispatch-list">
            {filteredDeliveries.map((delivery, index) => {
              const isUrgent = delivery.state === "URGENT" || index === 0;
              const isTransit = delivery.state === "IN_TRANSIT" || index === 1;
              return (
                <article className={isUrgent ? "urgent" : ""} key={delivery.id}>
                  <div>
                    <span className={isUrgent ? "urgent" : isTransit ? "moving" : ""}>
                      {isUrgent ? text.urgent : isTransit ? text.deliveringOrders : text.pending}
                    </span>
                    <em>ID: #{delivery.id}</em>
                  </div>
                  <strong>{delivery.name}</strong>
                  <p>{isUrgent ? `${text.waitingTime}: ${delivery.distance || "15"} ${text.minutes}` : isTransit ? "C014 - Бат-Эрдэнэ" : "Том оврын хайрцаг"}</p>
                  <footer>
                    <small>{isTransit ? `${text.seniorCourier} (${text.cyclist})` : text.unassigned}</small>
                    <button onClick={() => runAction(text.assignCourier, delivery.id)} type="button">
                      {isTransit ? "\u22EF" : text.assignCourier}
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        </aside>
      </section>
    );
  }

  function renderSection(metrics: Metric[]) {
    if (activeSection === "overview" && dashboard.data) return renderOverview(dashboard.data);
    if (activeSection === "stores") return <section className="platform-grid platform-grid-full">{renderStores(dashboard.data?.stores ?? [])}</section>;
    if (activeSection === "employees") return <section className="platform-grid platform-grid-full">{renderEmployees(dashboard.data?.employees ?? [])}</section>;
    if (activeSection === "access") return <section className="platform-grid platform-grid-full">{renderAccess()}</section>;
    if (activeSection === "reports") return renderSimpleSection(text.reports);
    if (activeSection === "settings") return renderSimpleSection(text.settings);
    return renderSimpleSection(text.support);
  }

  return (
    <main className={`platform-console theme-${themeMode}`}>
      <aside className="platform-sidebar">
        <div className="platform-brand">
          <BrandLogo size={32} showText />
          <div>
            <strong>Админ</strong>
          </div>
        </div>
        <nav aria-label={text.brandAdmin}>
          {navItems.map((item) => (
            <button className={activeSection === item.key ? "active" : ""} key={item.key} onClick={() => goTo(item.key)} type="button">
              <span className="platform-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="platform-sidebar-bottom">
          <button className={activeSection === "settings" ? "active" : ""} onClick={() => goTo("settings")} type="button">
            <span className="platform-nav-label">{text.settings}</span>
          </button>
          <button className={activeSection === "support" ? "active" : ""} onClick={() => goTo("support")} type="button">
            <span className="platform-nav-label">{text.support}</span>
          </button>
          <button className="platform-logout-button" onClick={onLogout} type="button">
            <span className="platform-nav-label">{text.logout}</span>
          </button>
        </div>
      </aside>

      <section className="platform-main">
        <header className="platform-topbar">
          <label>
            <span aria-hidden="true">{"\u2315"}</span>
            <input placeholder={text.search} />
          </label>
          <div>
            <button
              aria-label={themeMode === "night" ? text.lightMode : text.nightMode}
              className={`platform-theme-toggle ${themeMode === "light" ? "is-light" : "is-night"}`}
              onClick={() => setThemeMode((mode) => (mode === "night" ? "light" : "night"))}
              type="button"
            >
              <span>{text.nightMode}</span>
              <span>{text.lightMode}</span>
              <i aria-hidden="true" />
            </button>
            <NotificationBell />
            <button className="platform-icon-button platform-profile-button" aria-label={text.profile} onClick={() => setProfileOpen((open) => !open)} type="button">
              <UserIcon />
            </button>
            {profileOpen && (
              <div className="platform-profile-panel">
                <div>
                  <strong>{text.profileInfo}</strong>
                  <button aria-label={text.close} onClick={() => setProfileOpen(false)} type="button">
                    {"\u00D7"}
                  </button>
                </div>
                <label>
                  {text.fullName}
                  <input onChange={(event) => setProfileName(event.target.value)} value={profileName} />
                </label>
                <label>
                  {text.username}
                  <input onChange={(event) => setProfileUsername(event.target.value)} value={profileUsername} />
                </label>
                <label>
                  {text.role}
                  <input readOnly value={user.role} />
                </label>
                <button className="platform-profile-save" onClick={saveProfile} type="button">
                  {text.save}
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="platform-canvas">
          <div className="platform-heading">
            <div>
              <h1>{pageTitle ?? text.title}</h1>
            </div>
            <strong>{metricValue(dashboard.data?.metrics ?? [], "Tenant", "0")}</strong>
          </div>

          {notice && <div className="platform-notice">{notice}</div>}

          <StateBlock loading={dashboard.loading} error={dashboard.error} empty={!dashboard.data}>
            {dashboard.data && renderSection(dashboard.data.metrics)}
          </StateBlock>
        </div>

        {storeModal && (
          <StoreFormModal
            mode={storeModal.mode}
            row={storeModal.row}
            busy={modalBusy}
            error={modalError}
            onClose={() => setStoreModal(null)}
            onSubmit={submitStore}
            onHardDelete={storeModal.row ? () => removeStore(storeModal.row as AdminStoreRow, true) : undefined}
          />
        )}
        {employeeModal && (
          <EmployeeFormModal
            mode={employeeModal.mode}
            row={employeeModal.row}
            busy={modalBusy}
            error={modalError}
            onClose={() => setEmployeeModal(null)}
            onSubmit={submitEmployee}
            onHardDelete={employeeModal.row ? () => removeEmployee(employeeModal.row as AdminEmployeeRow, true) : undefined}
          />
        )}
      </section>
      <nav className="platform-mobile-nav" aria-label={text.brandAdmin}>
        <button className={activeSection === "overview" ? "active" : ""} onClick={() => goTo("overview")} type="button">
          <span aria-hidden="true">{"\u25A1"}</span>
          {text.mobileHome}
        </button>
        <button className={activeSection === "stores" ? "active" : ""} onClick={() => goTo("stores")} type="button">
          <span aria-hidden="true">{"\u25A4"}</span>
          {text.mobileOrders}
        </button>
        <button className={activeSection === "settings" ? "active" : ""} onClick={() => goTo("settings")} type="button">
          <span aria-hidden="true">{"\u25CB"}</span>
          {text.profile}
        </button>
      </nav>
    </main>
  );
}
