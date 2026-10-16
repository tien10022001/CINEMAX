// ====================================================================
// CINEMAX 28-TABLE REDESIGN v3.0 - TYPE DEFINITIONS
// Single Theater MVP Architecture based on HK2T_1-rap_database-redesign.xlsx
// ====================================================================

export type UserRole = 'admin' | 'staff' | 'user';
export type StaffPerm = 'POS' | 'CHECKIN' | 'CONCESSION' | 'SUPERVISOR';
export type ContentType = 'banner' | 'post' | 'promotion';
export type ContentStatus = 'draft' | 'published' | 'archived';
export type AgeRating = 'P' | 'K' | 'T13' | 'T16' | 'T18';
export type MovieStatus = 'draft' | 'coming_soon' | 'now_showing' | 'ended';
export type ScreenType = '2D' | '3D' | 'IMAX' | '4DX';
export type RoomStatus = 'active' | 'maintenance';
export type SeatType = 'STANDARD' | 'VIP' | 'COUPLE' | 'WHEELCHAIR';
export type SeatStatus = 'ACTIVE' | 'BLOCKED';
export type AudienceType = 'ADULT' | 'STUDENT_U22' | 'CHILD' | 'SENIOR';
export type ShowtimeStatus = 'scheduled' | 'open' | 'closed' | 'cancelled' | 'finished';
export type ShowtimeSeatStatus = 'available' | 'held' | 'sold' | 'blocked';
export type ProductType = 'FOOD' | 'BEVERAGE' | 'COMBO';
export type MovementType = 'IMPORT' | 'SALE' | 'LOSS' | 'ADJUSTMENT';
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
  id: string; // uuid
  role: UserRole;
  full_name: string;
  phone?: string | null;
  loyalty_points: number;
  status: 'active' | 'suspended' | 'banned';
  created_at: string;
  updated_at: string;
}

// 2. staff_permissions
export interface StaffPermission {
  id: string;
  staff_id: string;
  permission: StaffPerm;
  assigned_by?: string | null;
  assigned_at: string;
  active: boolean;
}

// 3. cinema_settings
export interface CinemaSetting {
  setting_key: string;
  setting_value: Record<string, any>;
  updated_by?: string | null;
  updated_at: string;
}

// 4. genres
export interface Genre {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at?: string;
}

// 5. movies
export interface Movie {
  id: string;
  title: string;
  slug: string;
  synopsis?: string | null;
  director?: string | null;
  cast_list?: string | null;
  language?: string | null;
  duration_minutes: number;
  age_rating: AgeRating;
  poster_url?: string | null;
  banner_url?: string | null;
  trailer_url?: string | null;
  release_date?: string | null;
  end_date?: string | null;
  status: MovieStatus;
  created_at?: string;
  updated_at?: string;
  genres?: Genre[];
  country?: string | null;
  studio?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  imdb_score?: number | null;
  formats?: string[] | null;
  original_title?: string | null;
}

// 6. auditoriums
export interface Auditorium {
  id: string;
  name: string;
  screen_type: ScreenType;
  sound_system: string;
  total_seats: number;
  cleaning_buffer_minutes: number;
  status: RoomStatus;
  seat_map_version: number;
  created_at?: string;
  updated_at?: string;
}

// 7. seats
export interface Seat {
  id: string;
  auditorium_id: string;
  row_label: string;
  seat_number: number;
  grid_row: number;
  grid_col: number;
  seat_type: SeatType;
  seat_group?: string | null;
  status: SeatStatus;
  block_reason?: string | null;
  price?: number;
}

// 8. showtimes
export interface Showtime {
  id: string;
  movie_id: string;
  auditorium_id: string;
  format: string;
  language_version: string;
  starts_at: string;
  ends_at: string;
  booking_opens_at?: string | null;
  booking_closes_at?: string | null;
  status: ShowtimeStatus;
  movie?: Movie;
  auditorium?: Auditorium;
  prices?: ShowtimePrice[];
}

// 9. showtime_prices
export interface ShowtimePrice {
  id: string;
  showtime_id: string;
  seat_type: SeatType;
  audience_type: AudienceType;
  price: number;
  currency: string;
}

// 10. showtime_seats
export interface ShowtimeSeat {
  showtime_id: string;
  seat_id: string;
  status: ShowtimeSeatStatus;
  held_until?: string | null;
  order_id?: string | null;
  seat?: Seat;
}

// 11. products (F&B)
export interface Product {
  id: string;
  name: string;
  product_type: ProductType;
  base_price: number;
  inventory_tracking: boolean;
  available_stock: number;
  active: boolean;
  image_url?: string | null;
  components?: ProductComponent[];
  modifiers?: ProductModifier[];
}

// 12. product_components
export interface ProductComponent {
  combo_id: string;
  component_id: string;
  quantity: number;
  component?: Product;
}

// 13. product_modifiers
export interface ProductModifier {
  id: string;
  product_id: string;
  modifier_group: string;
  option_name: string;
  extra_price: number;
  is_default: boolean;
  active: boolean;
}

// 14. inventory_movements
export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  reason?: string | null;
  reference_order_item_id?: string | null;
  created_by?: string | null;
  created_at: string;
  product?: Product;
}

// 15. coupons
export interface Coupon {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount?: number | null;
  min_order_amount: number;
  apply_scope: CouponScope;
  starts_at: string;
  ends_at: string;
  usage_limit?: number | null;
  per_user_limit: number;
  active: boolean;
}

// 16. shifts
export interface Shift {
  id: string;
  staff_id: string;
  pos_terminal: string;
  shift_type: string;
  opened_at: string;
  closed_at?: string | null;
  opening_cash: number;
  expected_cash: number;
  counted_cash?: number | null;
  variance_reason?: string | null;
  supervisor_id?: string | null;
  approved_at?: string | null;
  status: ShiftStatus;
  staff_name?: string;
  supervisor_name?: string;
}

// 17. orders
export interface Order {
  id: string;
  order_code: string;
  user_id?: string | null;
  guest_access_hash?: string | null;
  channel: OrderChannel;
  created_by?: string | null;
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
  items?: OrderItem[];
  payments?: Payment[];
}

// 18. order_items
export interface OrderItem {
  id: string;
  order_id: string;
  item_type: OrderItemType;
  showtime_seat_id?: string | null;
  product_id?: string | null;
  audience_type?: AudienceType | null;
  selected_modifiers?: Record<string, any> | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  item_snapshot: Record<string, any>;
  ticket?: Ticket;
}

// 19. order_item_fulfillments
export interface OrderItemFulfillment {
  id: string;
  order_item_id: string;
  quantity: number;
  delivered_at: string;
  delivered_by?: string | null;
}

// 20. payments
export interface Payment {
  id: string;
  order_id: string;
  shift_id?: string | null;
  received_by?: string | null;
  provider: PaymentProvider;
  provider_txn_id?: string | null;
  amount: number;
  status: PaymentStatus;
  payload?: Record<string, any> | null;
  paid_at?: string | null;
  created_at: string;
}

// 21. tickets
export interface Ticket {
  id: string;
  order_item_id: string;
  qr_token_hash: string;
  status: TicketStatus;
  age_check_passed: boolean;
  checked_in_at?: string | null;
  checked_in_by?: string | null;
  seat_label?: string;
  movie_title?: string;
  showtime_str?: string;
}

// 22. refunds
export interface Refund {
  id: string;
  order_id: string;
  payment_id?: string | null;
  refund_type: RefundType;
  requested_by?: string | null;
  reason: string;
  amount: number;
  status: RefundStatus;
  approved_by?: string | null;
  provider_ref?: string | null;
  created_at: string;
  resolved_at?: string | null;
  order_code?: string;
}

// 23. invoice_requests
export interface InvoiceRequest {
  id: string;
  order_id: string;
  tax_code: string;
  company_name: string;
  address: string;
  email: string;
  status: InvoiceStatus;
  invoice_ref?: string | null;
  requested_at: string;
  resolved_at?: string | null;
  order_code?: string;
}

// 24. support_requests
export interface SupportRequest {
  id: string;
  order_id?: string | null;
  type: SupportType;
  description: string;
  status: SupportStatus;
  created_by?: string | null;
  guest_access_hash?: string | null;
  assigned_to?: string | null;
  created_at: string;
  resolved_at?: string | null;
  order_code?: string;
}

// 25. audit_logs
export interface AuditLog {
  id: string;
  actor_id?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_data?: Record<string, any> | null;
  after_data?: Record<string, any> | null;
  created_at: string;
  actor_name?: string;
}
