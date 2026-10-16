export type Gender = 'M' | 'F' | 'OTHER';
export type AgeRating = 'P' | 'K' | 'T13' | 'T16' | 'T18';
export type MovieStatus = 'COMING_SOON' | 'NOW_SHOWING' | 'ENDED';
export type ScreenType = '2D' | '3D' | 'IMAX' | '4DX';
export type RoomStatus = 'ACTIVE' | 'MAINTENANCE';
export type LanguageType = 'SUBTITLED' | 'DUBBED' | 'ORIGINAL';
export type ShowtimeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type DiscountType = 'PERCENT' | 'FIXED';
export type BookingStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
export type TicketStatus = 'HELD' | 'SOLD' | 'CANCELLED' | 'USED';
export type FoodCategory = 'POPCORN' | 'DRINK' | 'SNACK' | 'COMBO' | 'FOOD' | 'BEVERAGE';
export type PaymentMethod = 'MOMO' | 'VNPAY' | 'ZALOPAY' | 'CARD' | 'CASH' | 'VIETQR' | string;
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export type StaffPermission = 'POS' | 'CHECKIN' | 'CONCESSION' | 'SUPERVISOR';

export interface Role {
  id: number | string;
  code: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'user' | 'staff' | 'admin';
  name: string;
}

export interface User {
  id: string; // uuid
  role_id?: number | string;
  role_code?: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'user' | 'staff' | 'admin';
  staff_permissions?: StaffPermission[];
  staff_position?: string;
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
  supabase_id?: string;
  title: string;
  original_title?: string;
  slug: string;
  synopsis?: string;
  duration_min: number;
  duration_minutes?: number;
  release_date?: string;
  end_date?: string;
  age_rating: AgeRating;
  country?: string;
  director?: string;
  cast_list?: string;
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
  supabase_id?: string;
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
  supabase_id?: string;
  cinema_id?: number | string;
  name: string;
  screen_type: ScreenType;
  total_rows?: number;
  total_cols?: number;
  total_seats?: number;
  status: RoomStatus;
  cinema?: Cinema;
}

export interface SeatType {
  id: number | string;
  code: 'STANDARD' | 'VIP' | 'COUPLE' | 'WHEELCHAIR' | string;
  name: string;
  capacity?: number;
  color_code?: string;
}

export interface Seat {
  id: number | string;
  supabase_id?: string;
  room_id?: number | string;
  auditorium_id?: string;
  seat_type_id?: number | string;
  row_label: string;
  seat_number: number;
  grid_row: number;
  grid_col: number;
  is_active?: boolean;
  seat_type?: SeatType;
  seat_group?: string | null;
  status?: 'AVAILABLE' | 'SELECTED' | 'HELD' | 'SOLD' | 'BOOKED' | 'BLOCKED' | 'available' | 'held' | 'sold' | 'booked' | 'blocked';
}

export interface Showtime {
  id: number | string;
  supabase_id?: string;
  auditorium_id?: string;
  movie_id: number | string;
  room_id?: number | string;
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
  prices?: ShowtimePrice[];
  available_seats?: number;
}

export interface ShowtimePrice {
  showtime_id: number | string;
  seat_type_id: number | string;
  price: number;
  seat_type?: SeatType;
}

export interface FoodModifierOption {
  id: string;
  modifier_group: string;
  option_name: string;
  extra_price: number;
  is_default: boolean;
}

export interface FoodItem {
  id: number;
  supabase_id?: string;
  name: string;
  category: FoodCategory;
  description?: string;
  price: number;
  stock?: number;
  modifiers?: FoodModifierOption[];
  image_url?: string;
  is_active: boolean;
}

export interface Promotion {
  id: number;
  supabase_id?: string;
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount?: number;
  min_order: number;
  usage_limit?: number;
  per_user_limit: number;
  used_count: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
}

export interface Booking {
  id: number;
  booking_code: string;
  user_id: string;
  showtime_id: number;
  promotion_id?: number;
  ticket_subtotal: number;
  food_subtotal: number;
  discount_amount: number;
  total_amount: number;
  status: BookingStatus;
  expires_at?: string;
  contact_email?: string;
  contact_phone?: string;
  showtime?: Showtime;
  tickets?: Ticket[];
  booking_items?: BookingItem[];
  created_at: string;
}

export interface Ticket {
  id: number;
  booking_id: number;
  showtime_id: number;
  seat_id: number;
  ticket_code: string;
  price: number;
  status: TicketStatus;
  seat?: Seat;
  checked_in_at?: string;
}

export interface BookingItem {
  booking_id: number;
  food_item_id: number;
  quantity: number;
  unit_price: number;
  food_item?: FoodItem;
}

export interface Payment {
  id: number;
  booking_id: number;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  transaction_ref?: string;
  gateway_response?: Record<string, unknown>;
  paid_at?: string;
}

export interface NewsArticle {
  id: number;
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
  featured_movie_id?: number;
}
