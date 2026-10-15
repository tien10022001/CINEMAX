export * from '@/types/database';

export type Gender = 'M' | 'F' | 'OTHER';
export type AgeRating = 'P' | 'K' | 'T13' | 'T16' | 'T18';
export type MovieStatus = 'COMING_SOON' | 'NOW_SHOWING' | 'ENDED' | 'draft' | 'coming_soon' | 'now_showing' | 'ended';
export type ScreenType = '2D' | '3D' | 'IMAX' | '4DX';
export type RoomStatus = 'ACTIVE' | 'MAINTENANCE' | 'active' | 'maintenance';
export type LanguageType = 'SUBTITLED' | 'DUBBED' | 'ORIGINAL';
export type ShowtimeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED' | 'scheduled' | 'open' | 'closed' | 'cancelled' | 'finished';
export type DiscountType = 'PERCENT' | 'FIXED';
export type BookingStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'pending' | 'paid' | 'cancelled' | 'expired' | 'refunded';
export type TicketStatus = 'HELD' | 'SOLD' | 'CANCELLED' | 'USED' | 'issued' | 'used' | 'cancelled' | 'refunded';
export type FoodCategory = 'POPCORN' | 'DRINK' | 'SNACK' | 'COMBO' | 'FOOD' | 'BEVERAGE';
export type PaymentMethod = 'MOMO' | 'VNPAY' | 'ZALOPAY' | 'CARD' | 'CASH';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface Role {
  id: number | string;
  code: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'user' | 'staff' | 'admin';
  name: string;
}

export interface User {
  id: string; // uuid
  role_id?: number | string;
  role_code?: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'user' | 'staff' | 'admin';
  role?: string;
  full_name: string;
  email: string;
  phone?: string | null;
  gender?: Gender;
  birth_date?: string;
  avatar_url?: string;
  loyalty_points: number;
  email_verified_at?: string;
  is_active?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Genre {
  id: number | string;
  name: string;
  slug: string;
}

export interface Movie {
  id: number | string;
  title: string;
  original_title?: string;
  slug: string;
  synopsis?: string | null;
  duration_min: number;
  duration_minutes?: number;
  release_date?: string | null;
  end_date?: string | null;
  age_rating: AgeRating;
  country?: string;
  director?: string | null;
  cast_list?: string | null;
  language?: string | null;
  poster_url?: string;
  banner_url?: string;
  trailer_url?: string;
  imdb_score?: number;
  status: MovieStatus;
  is_deleted?: boolean;
  genres?: Genre[];
  created_at?: string;
}

export interface Cinema {
  id: number | string;
  name: string;
  address: string;
  district?: string;
  city: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  image_url?: string;
  is_active: boolean;
}

export interface Room {
  id: number | string;
  cinema_id?: number | string;
  name: string;
  screen_type: ScreenType;
  total_rows?: number;
  total_cols?: number;
  total_seats?: number;
  status: RoomStatus;
  cinema?: Cinema;
}

export type Auditorium = Room;

export interface SeatType {
  id: number | string;
  code: 'STANDARD' | 'VIP' | 'COUPLE' | 'WHEELCHAIR' | string;
  name: string;
  capacity?: number;
  color_code?: string;
}

export interface Seat {
  id: number | string;
  room_id?: number | string;
  auditorium_id?: string;
  seat_type_id?: number | string;
  row_label: string;
  seat_number: number;
  grid_row: number;
  grid_col: number;
  seat_type?: SeatType;
  seat_group?: string | null;
  is_active?: boolean;
  status?: 'AVAILABLE' | 'SELECTED' | 'HELD' | 'SOLD' | 'BOOKED' | 'BLOCKED' | 'available' | 'held' | 'sold' | 'booked' | 'blocked';
}

export interface ShowtimePrice {
  id?: string;
  showtime_id: number | string;
  seat_type_id?: number | string;
  seat_type?: SeatType | string;
  audience_type?: string;
  price: number;
}

export interface Showtime {
  id: number | string;
  movie_id: number | string;
  room_id?: number | string;
  auditorium_id?: string;
  start_time: string;
  end_time: string;
  starts_at?: string;
  ends_at?: string;
  format?: string;
  language_type?: LanguageType;
  language_version?: string;
  status: ShowtimeStatus;
  movie?: Movie;
  room?: Room;
  auditorium?: Auditorium;
  prices?: ShowtimePrice[];
  available_seats?: number;
}

export interface FoodItem {
  id: number | string;
  name: string;
  category?: FoodCategory;
  product_type?: string;
  description?: string;
  price: number;
  base_price?: number;
  image_url?: string;
  is_active: boolean;
  active?: boolean;
}

export interface Promotion {
  id: number | string;
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount?: number | null;
  min_order: number;
  min_order_amount?: number;
  usage_limit?: number | null;
  per_user_limit?: number;
  used_count?: number;
  valid_from?: string;
  valid_to?: string;
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
  active?: boolean;
}

export interface Booking {
  id: number | string;
  booking_code?: string;
  order_code?: string;
  user_id?: string | null;
  showtime_id?: number | string;
  promotion_id?: number | string;
  ticket_subtotal?: number;
  food_subtotal?: number;
  subtotal?: number;
  discount_amount?: number;
  total_amount: number;
  status: BookingStatus;
  expires_at?: string | null;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  showtime?: Showtime;
  tickets?: Ticket[];
  booking_items?: BookingItem[];
  created_at?: string;
}

export interface Ticket {
  id: number | string;
  booking_id?: number | string;
  order_id?: string;
  order_item_id?: string;
  showtime_id?: number | string;
  seat_id?: number | string;
  ticket_code?: string;
  qr_token_hash?: string;
  price?: number;
  status: TicketStatus;
  seat?: Seat;
  checked_in_at?: string | null;
}

export interface BookingItem {
  id?: string;
  booking_id?: number | string;
  order_id?: string;
  food_item_id?: number | string;
  product_id?: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
  food_item?: FoodItem;
}

export interface Payment {
  id: number | string;
  booking_id?: number | string;
  order_id?: string;
  method?: PaymentMethod;
  provider?: string;
  amount: number;
  status: PaymentStatus;
  transaction_ref?: string;
  provider_txn_id?: string | null;
  gateway_response?: Record<string, unknown>;
  paid_at?: string | null;
}

export interface NewsArticle {
  id: number | string;
  title: string;
  date: string;
  summary: string;
  content?: string;
  img: string;
  author?: string;
  category?: string;
}

export interface SiteSettings {
  hero_title?: string;
  hero_subtitle?: string;
  hotline: string;
  support_email: string;
  announcement_banner?: string;
  featured_movie_id?: number | string;
}
