export type Role = "owner" | "staff";
export type BookingStatus = "new" | "confirmed" | "in_progress" | "ready" | "completed" | "cancelled";
export type PaymentMethod = "cash" | "upi" | "bank";

export type Business = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  public_bookings_enabled: boolean;
};

export type Booking = {
  id: string;
  business_id: string;
  booking_code: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  product_type: string;
  quantity: number;
  design_notes: string | null;
  scheduled_for: string;
  status: BookingStatus;
  quoted_total: number;
  created_at: string;
};

export type Payment = {
  id: string;
  business_id: string;
  booking_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paid_at: string;
  created_at: string;
  booking?: Pick<Booking, "booking_code" | "customer_name"> | null;
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  new: "New request",
  confirmed: "Confirmed",
  in_progress: "In production",
  ready: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank transfer",
};
