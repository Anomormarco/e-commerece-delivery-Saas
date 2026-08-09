export function maskPhone(phone) {
  return phone?.replace(/(\d{4})$/, "****") ?? "";
}

export function formatTrackingTime(date) {
  return date.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
}
