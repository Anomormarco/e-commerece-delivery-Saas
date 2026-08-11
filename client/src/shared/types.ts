export type RoleRoute = "public" | "admin" | "store" | "courier" | "customer";

export type Metric = {
  label: string;
  value: string;
  note: string;
};

export type QueueItem = {
  id: string;
  state: string;
  name: string;
  distance: string;
  weightKg?: number;
  requiredVehicle?: "WALK" | "MOPED" | "CAR";
  requiredVehicleLabel?: string;
  payoutMnt?: string;
  canAccept?: boolean;
  routePlan?: {
    totalKm: number;
    walkingMinutes: number;
    drivingMinutes: number;
    fastestMode: "WALKING" | "AUTO_ROAD";
    etaMinutes: number;
    label: string;
  };
};

export type StoreOrder = {
  id: string;
  status: string;
  amountMnt: string;
  district: string;
  storeId?: string;
  storeName?: string;
};

export type CustomerTracking = {
  orderNo: string;
  storeName: string;
  district: string;
  statusLabel: string;
  items: Array<{
    label: string;
    amountMnt: string;
  }>;
  totalMnt: string;
  timeline: Array<{
    state: "done" | "active" | "pending";
    icon: string;
    title: string;
    description: string;
    time?: string;
  }>;
  courier: {
    name: string;
    rating: string;
    vehicle: string;
    plate: string;
    etaText: string;
  };
  secretCode: string[];
  maskedPhone: string;
};

export type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};
