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
  pickupAddress?: string;
  dropoffAddress?: string;
  customerPhone?: string | null;
  distance: string;
  weightKg?: number;
  requiredVehicle?: "WALK" | "MOPED" | "CAR";
  requiredVehicleLabel?: string;
  payoutMnt?: string;
  canAccept?: boolean;
  offerExpiresInSec?: number | null;
  createdAt?: string | null;
  routePlan?: {
    pickup?: { lat: number; lng: number };
    dropoff?: { lat: number; lng: number };
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
  deliveryTracking?: {
    assignmentId: string;
    status: string;
    statusLabel: string;
    courier: {
      id: string;
      name: string;
      vehicleType: string;
    } | null;
    nearbyCouriers?: Array<{
      employeeId: string;
      name: string;
      vehicleType: string;
      toPickupKm: number;
      etaMinutes: number;
      location?: { lat: number; lng: number };
    }>;
    acceptedAt?: string | null;
    createdAt?: string | null;
    routePlan?: {
      pickup: { lat: number; lng: number };
      dropoff: { lat: number; lng: number };
      courier: { lat: number; lng: number };
      toPickupKm: number;
      totalKm: number;
      walkingMinutes: number;
      drivingMinutes: number;
      fastestMode: "WALKING" | "AUTO_ROAD";
      etaMinutes: number;
    };
  } | null;
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
  courierLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: string;
  } | null;
  secretCode: string[];
  maskedPhone: string;
};

export type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};
