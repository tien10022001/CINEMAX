/**
 * CINEMAX DATABASE SCHEMA TYPESCRIPT DEFINITIONS
 * Phản ánh toàn diện 28 bảng dữ liệu PostgreSQL / Supabase theo thiết kế nhóm HK2T
 */

export type UserRole = 'admin' | 'staff' | 'user';
export type AccountStatus = 'active' | 'blocked';
export type StaffPermission = 'POS' | 'CHECKIN' | 'CONCESSION' | 'SUPERVISOR';
export type ContentType = 'banner' | 'post' | 'promotion';
export type ContentStatus = 'draft' | 'published' | 'archived';
export type AgeRating = 'P' | 'K' | 'T13' | 'T16' | 'T18';
export type MovieStatus = 'draft' | 'coming_soon' | 'now_showing' | 'ended';
export type ScreenType = '2D' | '3D' | 'IMAX' | '4DX';
export type RoomStatus = 'active' | 'maintenance';
export type SeatType = 'STANDARD' | 'VIP' | 'COUPLE' | 'WHEELCHAIR';
export type SeatStatus = 'ACTIVE' | 'BLOCKED';
export type ShowtimeStatus = 'scheduled' | 'open' | 'closed' | 'cancelled' | 'finished';
export type AudienceType = 'ADULT' | 'STUDENT_U22' | 'CHILD' | 'SENIOR';
export type ShowtimeSeatStatus = 'available' | 'held' | 'sold' | 'blocked';
export type ProductType = 'FOOD' | 'BEVERAGE' | 'COMBO';
export type InventoryMovementType = 'IMPORT' | 'SALE' | 'LOSS' | 'ADJUSTMENT';
export type DiscountType = 'PERCENT' | 'FIXED';
export type CouponScope = 'ALL' | 'TICKET_ONLY' | 'COMBO_ONLY';
export type OrderChannel = 'online' | 'pos';
export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'expired' | 'refunded';
export type OrderItemType = 'ticket' | 'product';
export type PaymentProvider = 'CASH' | 'MOMO' | 'VNPAY' | 'ZALOPAY' | 'CARD';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type TicketStatus = 'issued' | 'used' | 'cancelled' | 'refunded';
export type ShiftStatus = 'open' | 'submitted' | 'closed';
export type RefundType = 'CUSTOMER_REQUEST' | 'SYSTEM_SHOWTIME_CANCEL' | 'EXCHANGE';
export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type InvoiceStatus = 'pending' | 'issued' | 'rejected';
export type SupportType = 'lost_ticket' | 'contact_change' | 'payment_pending' | 'cancellation' | 'seat_exchange';
export type SupportStatus = 'pending' | 'in_progress' | 'resolved' | 'closed';

// 1. profiles
export interface Profile {
  id: string; // uuid PK (= auth.users.id)
  role: UserRole;
  full_name: string;
  phone?: string;
  loyalty_points: number;
  membership_tier: 'MEMBER' | 'VIP' | 'VVIP';
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

// 2. movies
export interface Movie {
  id: string;
  title: string;
  slug: string;
  synopsis?: string;
  director?: string;
  cast_list?: string;
  language?: string;
  duration_minutes: number;
  age_rating: AgeRating;
  poster_url?: string;
  banner_url?: string;
  trailer_url?: string;
  release_date?: string;
  end_date?: string;
  status: MovieStatus;
}

// 3. showtimes
export interface Showtime {
  id: string;
  movie_id: string;
  auditorium_id: string;
  format: string;
  language_version: string;
  starts_at: string;
  ends_at: string;
  booking_opens_at?: string;
  booking_closes_at?: string;
  status: ShowtimeStatus;
}

// 4. showtime_seats
export interface ShowtimeSeat {
  showtime_id: string;
  seat_id: string;
  status: ShowtimeSeatStatus;
  held_until?: string | null;
  order_id?: string | null;
}

// 5. products (Bắp nước & Combo)
export interface Product {
  id: string;
  name: string;
  product_type: ProductType;
  base_price: number;
  inventory_tracking: boolean;
  available_stock: number;
  active: boolean;
  image_url?: string;
}

// 6. product_modifiers
export interface ProductModifier {
  id: string;
  product_id: string;
  modifier_group: string;
  option_name: string;
  extra_price: number;
  is_default: boolean;
  active: boolean;
}

// 7. orders
export interface Order {
  id: string;
  order_code: string;
  user_id?: string | null;
  guest_access_hash?: string | null;
  channel: OrderChannel;
  status: OrderStatus;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  subtotal: number;
  discount_amount: number;
  loyalty_points_used: number;
  loyalty_discount_amount: number;
  total_amount: number;
  coupon_id?: string | null;
  expires_at?: string | null;
  created_at: string;
}

// 8. tickets
export interface Ticket {
  id: string;
  order_item_id: string;
  qr_token_hash: string;
  status: TicketStatus;
  age_check_passed: boolean;
  checked_in_at?: string | null;
  checked_in_by?: string | null;
}
