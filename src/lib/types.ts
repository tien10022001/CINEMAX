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
export type FoodCategory = 'POPCORN' | 'DRINK' | 'SNACK' | 'COMBO';
export type PaymentMethod = 'MOMO' | 'VNPAY' | 'ZALOPAY' | 'CARD' | 'CASH';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface Role {
  id: number;
  code: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  name: string;
}

export interface User {
  id: string; // uuid
  role_id: number;
  role_code?: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  full_name: string;
  email: string;
  phone?: string;
  gender?: Gender;
  birth_date?: string;
  avatar_url?: string;
  loyalty_points: number;
  email_verified_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Genre {
  id: number;
  name: string;
  slug: string;
}

export interface Movie {
  id: number | string;
  title: string;
  original_title?: string;
  slug: string;
  synopsis?: string;
  duration_min: number;
  release_date?: string;
  end_date?: string;
  age_rating: AgeRating;
  country?: string;
  director?: string;
  cast_list?: string;
  poster_url?: string;
  banner_url?: string;
  trailer_url?: string;
  imdb_score?: number;
  status: MovieStatus | 'now_showing' | 'coming_soon' | 'ended' | 'draft';
  is_deleted: boolean;
  genres?: Genre[];
  studio?: string;
  meta_title?: string;
  meta_description?: string;
  formats?: string[];
  created_at?: string;
}

export interface Cinema {
  id: number;
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
  id: number;
  cinema_id: number;
  name: string;
  screen_type: ScreenType;
  total_rows: number;
  total_cols: number;
  status: RoomStatus;
  cinema?: Cinema;
}

export interface SeatType {
  id: number;
  code: 'STANDARD' | 'VIP' | 'COUPLE';
  name: string;
  capacity: number;
  color_code?: string;
}

export interface Seat {
  id: number;
  room_id: number;
  seat_type_id: number;
  row_label: string;
  seat_number: number;
  grid_row: number;
  grid_col: number;
  is_active: boolean;
  seat_type?: SeatType;
  status?: 'AVAILABLE' | 'SELECTED' | 'HELD' | 'SOLD';
}

export interface Showtime {
  id: number | string;
  movie_id: number | string;
  room_id: number | string;
  start_time: string;
  end_time: string;
  language_type: LanguageType;
  status: ShowtimeStatus;
  movie?: Movie;
  room?: Room;
  prices?: ShowtimePrice[];
  available_seats?: number;
}

export interface ShowtimePrice {
  showtime_id: number;
  seat_type_id: number;
  price: number;
  seat_type?: SeatType;
}

export interface FoodItem {
  id: number;
  name: string;
  category: FoodCategory;
  description?: string;
  price: number;
  image_url?: string;
  is_active: boolean;
}

export interface Promotion {
  id: number;
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
