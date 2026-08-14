// Shared Mongolian translations + color coding for Order/AssignmentStatus
// enum values, so raw backend codes (PICKUP_VERIFICATION, ARRIVING_DROPOFF,
// ...) never leak untranslated into the store/courier/customer UIs.

export type StatusColor = "gray" | "blue" | "purple" | "amber" | "green" | "red";

const statusLabels: Record<string, string> = {
  DRAFT: "Ноорог",
  PAYMENT_PENDING: "Төлбөр хүлээгдэж байна",
  PAID: "Төлбөр төлөгдсөн",
  CONFIRMED: "Баталгаажсан",
  PREPARING: "Бэлтгэж байна",
  READY_FOR_PICKUP: "Бэлтгэж дууссан",
  COURIER_ASSIGNED: "Хүргэлт дуудсан",
  COURIER_ARRIVING: "Ажилтан ирж байна",
  OFFERED: "Санал илгээгдсэн",
  ACCEPTED: "Хүлээн авсан",
  ARRIVING_PICKUP: "Дэлгүүр рүү явж байна",
  PICKUP_VERIFICATION: "Бараа авах баталгаажуулалт",
  PICKED_UP: "Ачаа авсан",
  IN_TRANSIT: "Хүргэж байна",
  ARRIVING: "Хүргэлтэнд гарсан",
  ARRIVING_DROPOFF: "Хэрэглэгчид ойртож байна",
  DELIVERED: "Хүргэгдсэн",
  CUSTOMER_CONFIRMED: "Хэрэглэгч баталгаажуулсан",
  COMPLETED: "Дууссан",
  REJECTED: "Татгалзсан",
  PAYMENT_FAILED: "Төлбөр амжилтгүй",
  CANCELLED: "Цуцлагдсан",
  PICKUP_REJECTED: "Авахаас татгалзсан",
  DELIVERY_FAILED: "Хүргэлт амжилтгүй",
  RETURN_REQUESTED: "Буцаалт хүссэн",
  FAILED: "Амжилтгүй",
};

const statusColors: Record<string, StatusColor> = {
  DRAFT: "gray",
  PAYMENT_PENDING: "gray",
  PAID: "blue",
  CONFIRMED: "blue",
  PREPARING: "blue",
  READY_FOR_PICKUP: "purple",
  COURIER_ASSIGNED: "purple",
  COURIER_ARRIVING: "purple",
  OFFERED: "purple",
  ACCEPTED: "purple",
  ARRIVING_PICKUP: "purple",
  PICKUP_VERIFICATION: "amber",
  PICKED_UP: "amber",
  IN_TRANSIT: "amber",
  ARRIVING: "amber",
  ARRIVING_DROPOFF: "amber",
  DELIVERED: "green",
  CUSTOMER_CONFIRMED: "green",
  COMPLETED: "green",
  REJECTED: "red",
  PAYMENT_FAILED: "red",
  CANCELLED: "red",
  PICKUP_REJECTED: "red",
  DELIVERY_FAILED: "red",
  RETURN_REQUESTED: "red",
  FAILED: "red",
};

export function translateStatus(status?: string | null): string {
  if (!status) return "Тодорхойгүй";
  return statusLabels[status] ?? status;
}

export function statusColorOf(status?: string | null): StatusColor {
  if (!status) return "gray";
  return statusColors[status] ?? "gray";
}

// Explicit numeric YYYY.MM.DD HH:mm format - locale-dependent
// toLocaleString() output varies by browser/OS and can read ambiguously.
export function formatOrderDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
