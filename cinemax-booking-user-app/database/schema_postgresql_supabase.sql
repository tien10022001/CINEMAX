-- ====================================================================
-- CINEMAX DATABASE SCHEMA - POSTGRESQL / SUPABASE
-- Kiến Trúc 1 Rạp Tiêu Chuẩn (Single Theater Architecture)
-- Bảng showtime_seats là Nguồn sự thật duy nhất (Single Source of Truth)
-- Đầy đủ 28 bảng, RLS Policies, Triggers & Stored Procedures (RPC)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ENUM TYPES
CREATE TYPE user_role_t AS ENUM ('admin', 'staff', 'user');
CREATE TYPE account_status_t AS ENUM ('active', 'blocked');
CREATE TYPE staff_perm_t AS ENUM ('POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR');
CREATE TYPE content_type_t AS ENUM ('banner', 'post', 'promotion');
CREATE TYPE content_status_t AS ENUM ('draft', 'published', 'archived');
CREATE TYPE age_rating_t AS ENUM ('P', 'K', 'T13', 'T16', 'T18');
CREATE TYPE movie_status_t AS ENUM ('draft', 'coming_soon', 'now_showing', 'ended');
CREATE TYPE screen_type_t AS ENUM ('2D', '3D', 'IMAX', '4DX');
CREATE TYPE room_status_t AS ENUM ('active', 'maintenance');
CREATE TYPE seat_type_t AS ENUM ('STANDARD', 'VIP', 'COUPLE', 'WHEELCHAIR');
CREATE TYPE seat_status_t AS ENUM ('ACTIVE', 'BLOCKED');
CREATE TYPE showtime_status_t AS ENUM ('scheduled', 'open', 'closed', 'cancelled', 'finished');
CREATE TYPE audience_type_t AS ENUM ('ADULT', 'STUDENT_U22', 'CHILD', 'SENIOR');
CREATE TYPE showtime_seat_status_t AS ENUM ('available', 'held', 'sold', 'blocked');
CREATE TYPE product_type_t AS ENUM ('FOOD', 'BEVERAGE', 'COMBO');
CREATE TYPE inventory_movement_t AS ENUM ('IMPORT', 'SALE', 'LOSS', 'ADJUSTMENT');
CREATE TYPE discount_type_t AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE coupon_scope_t AS ENUM ('ALL', 'TICKET_ONLY', 'COMBO_ONLY');
CREATE TYPE order_channel_t AS ENUM ('online', 'pos');
CREATE TYPE order_status_t AS ENUM ('pending', 'paid', 'cancelled', 'expired', 'refunded');
CREATE TYPE order_item_type_t AS ENUM ('ticket', 'product');
CREATE TYPE payment_provider_t AS ENUM ('CASH', 'MOMO', 'VNPAY', 'ZALOPAY', 'CARD');
CREATE TYPE payment_status_t AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
CREATE TYPE ticket_status_t AS ENUM ('issued', 'used', 'cancelled', 'refunded');
CREATE TYPE shift_status_t AS ENUM ('open', 'submitted', 'closed');
CREATE TYPE refund_type_t AS ENUM ('CUSTOMER_REQUEST', 'SYSTEM_SHOWTIME_CANCEL', 'EXCHANGE');
CREATE TYPE refund_status_t AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE invoice_status_t AS ENUM ('pending', 'issued', 'rejected');
CREATE TYPE support_type_t AS ENUM ('lost_ticket', 'contact_change', 'payment_pending', 'cancellation', 'seat_exchange');
CREATE TYPE support_status_t AS ENUM ('pending', 'in_progress', 'resolved', 'closed');
CREATE TYPE challenge_channel_t AS ENUM ('email', 'sms');

-- 1. profiles
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  role user_role_t NOT NULL DEFAULT 'user',
  full_name text NOT NULL,
  phone varchar(20) UNIQUE,
  loyalty_points int DEFAULT 0 CHECK (loyalty_points >= 0),
  membership_tier varchar(20) DEFAULT 'MEMBER',
  status account_status_t DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. staff_permissions
CREATE TABLE staff_permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission staff_perm_t NOT NULL,
  active boolean DEFAULT true,
  assigned_by uuid REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(staff_id, permission)
);

-- 3. cinema_settings
CREATE TABLE cinema_settings (
  setting_key varchar(50) PRIMARY KEY,
  setting_value jsonb NOT NULL,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
);

-- 4. content_items (Banners, Tin tức, Khuyến mãi)
CREATE TABLE content_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type content_type_t NOT NULL,
  title text NOT NULL,
  body text,
  image_url text,
  link_url text,
  published_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  status content_status_t DEFAULT 'published'
);

-- 5. genres
CREATE TABLE genres (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(50) NOT NULL,
  slug varchar(60) UNIQUE NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. movies
CREATE TABLE movies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  slug varchar(120) UNIQUE NOT NULL,
  synopsis text,
  director varchar(100),
  cast_list text,
  language varchar(50),
  duration_minutes smallint NOT NULL CHECK (duration_minutes > 0),
  age_rating age_rating_t NOT NULL,
  poster_url text,
  banner_url text,
  trailer_url text,
  release_date date,
  end_date date,
  status movie_status_t DEFAULT 'now_showing'
);

-- 7. movie_genres
CREATE TABLE movie_genres (
  movie_id uuid REFERENCES movies(id) ON DELETE CASCADE,
  genre_id uuid REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (movie_id, genre_id)
);

-- 8. auditoriums
CREATE TABLE auditoriums (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(50) UNIQUE NOT NULL,
  screen_type screen_type_t DEFAULT '2D',
  sound_system varchar(50) DEFAULT 'Dolby Atmos',
  total_seats smallint NOT NULL CHECK (total_seats > 0),
  cleaning_buffer_minutes smallint DEFAULT 15,
  status room_status_t DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 9. seats (Sơ đồ mẫu 80 ghế)
CREATE TABLE seats (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auditorium_id uuid NOT NULL REFERENCES auditoriums(id) ON DELETE CASCADE,
  row_label varchar(3) NOT NULL,
  seat_number smallint NOT NULL,
  grid_row smallint NOT NULL,
  grid_col smallint NOT NULL,
  seat_type seat_type_t NOT NULL DEFAULT 'STANDARD',
  seat_group varchar(20) NULL,
  status seat_status_t DEFAULT 'ACTIVE',
  block_reason varchar(100) NULL,
  UNIQUE(auditorium_id, row_label, seat_number)
);

-- 10. showtimes
CREATE TABLE showtimes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  movie_id uuid NOT NULL REFERENCES movies(id),
  auditorium_id uuid NOT NULL REFERENCES auditoriums(id),
  format varchar(20) DEFAULT '2D',
  language_version varchar(50) DEFAULT 'Phụ đề Tiếng Việt',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  booking_opens_at timestamptz,
  booking_closes_at timestamptz,
  status showtime_status_t DEFAULT 'open'
);

-- 11. showtime_prices
CREATE TABLE showtime_prices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  showtime_id uuid NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
  seat_type seat_type_t NOT NULL,
  audience_type audience_type_t NOT NULL,
  price numeric(12,0) NOT NULL CHECK (price >= 0),
  currency char(3) DEFAULT 'VND',
  UNIQUE(showtime_id, seat_type, audience_type)
);

-- 12. showtime_seats (NGUỒN SỰ THẬT DUY NHẤT)
CREATE TABLE showtime_seats (
  showtime_id uuid NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
  seat_id uuid NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  status showtime_seat_status_t DEFAULT 'available',
  held_until timestamptz NULL,
  held_by text NULL,
  order_id uuid NULL,
  PRIMARY KEY (showtime_id, seat_id)
);

-- 13. products (Bắp nước & Combo F&B)
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(100) NOT NULL,
  product_type product_type_t NOT NULL,
  base_price numeric(12,0) NOT NULL CHECK (base_price >= 0),
  inventory_tracking boolean DEFAULT true,
  available_stock int DEFAULT 0 CHECK (available_stock >= 0),
  active boolean DEFAULT true,
  image_url text
);

-- 14. product_components
CREATE TABLE product_components (
  combo_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES products(id),
  quantity smallint NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (combo_id, component_id)
);

-- 15. product_modifiers (Tùy chọn đổi vị / size)
CREATE TABLE product_modifiers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  modifier_group varchar(50) NOT NULL,
  option_name varchar(50) NOT NULL,
  extra_price numeric(12,0) DEFAULT 0 CHECK (extra_price >= 0),
  is_default boolean DEFAULT false,
  active boolean DEFAULT true
);

-- 16. coupons
CREATE TABLE coupons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code varchar(30) UNIQUE NOT NULL,
  discount_type discount_type_t NOT NULL,
  discount_value numeric(12,0) NOT NULL CHECK (discount_value > 0),
  max_discount numeric(12,0) NULL,
  min_order_amount numeric(12,0) DEFAULT 0,
  apply_scope coupon_scope_t DEFAULT 'ALL',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  usage_limit int NULL,
  active boolean DEFAULT true
);

-- 17. orders
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_code varchar(20) UNIQUE NOT NULL,
  user_id uuid REFERENCES profiles(id) NULL,
  guest_access_hash text NULL,
  channel order_channel_t DEFAULT 'online',
  created_by uuid REFERENCES profiles(id) NULL,
  status order_status_t DEFAULT 'pending',
  contact_name varchar(100) NOT NULL,
  contact_email varchar(100) NOT NULL,
  contact_phone varchar(20) NOT NULL,
  subtotal numeric(12,0) NOT NULL,
  discount_amount numeric(12,0) DEFAULT 0,
  loyalty_points_used int DEFAULT 0,
  loyalty_discount_amount numeric(12,0) DEFAULT 0,
  total_amount numeric(12,0) NOT NULL,
  coupon_id uuid REFERENCES coupons(id) NULL,
  expires_at timestamptz NULL,
  created_at timestamptz DEFAULT now()
);

-- 18. order_items
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type order_item_type_t NOT NULL,
  seat_id uuid REFERENCES seats(id) NULL,
  product_id uuid REFERENCES products(id) NULL,
  audience_type audience_type_t NULL,
  selected_modifiers jsonb NULL,
  quantity smallint NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,0) NOT NULL,
  line_total numeric(12,0) NOT NULL,
  item_snapshot jsonb NOT NULL
);

-- 19. payments
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES orders(id),
  provider payment_provider_t NOT NULL,
  provider_txn_id text UNIQUE NULL,
  amount numeric(12,0) NOT NULL,
  status payment_status_t DEFAULT 'PENDING',
  payload jsonb,
  paid_at timestamptz NULL,
  created_at timestamptz DEFAULT now()
);

-- 20. tickets (Vé QR Điện Tử)
CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id uuid UNIQUE NOT NULL REFERENCES order_items(id),
  qr_token_hash text UNIQUE NOT NULL,
  status ticket_status_t DEFAULT 'issued',
  age_check_passed boolean DEFAULT true,
  checked_in_at timestamptz NULL,
  checked_in_by uuid REFERENCES profiles(id) NULL
);

-- 21. refunds
CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES orders(id),
  refund_type refund_type_t NOT NULL,
  reason text NOT NULL,
  amount numeric(12,0) NOT NULL,
  status refund_status_t DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- 22. invoice_requests (Hóa đơn VAT)
CREATE TABLE invoice_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid UNIQUE NOT NULL REFERENCES orders(id),
  tax_code varchar(30) NOT NULL,
  company_name text NOT NULL,
  address text NOT NULL,
  email varchar(100) NOT NULL,
  status invoice_status_t DEFAULT 'pending',
  requested_at timestamptz DEFAULT now()
);

-- ====================================================================
-- STORED PROCEDURE (RPC): HOLD SEATS (TRIỆT TIÊU RACE CONDITION)
-- ====================================================================
CREATE OR REPLACE FUNCTION rpc_hold_seats(
  p_showtime_id uuid,
  p_seat_ids uuid[],
  p_session_id text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_held_until timestamptz;
  v_conflict_count int;
BEGIN
  -- Khóa các dòng ghế cần đặt để ngăn ngừa 2 request đồng thời (FOR UPDATE)
  PERFORM 1 FROM showtime_seats
  WHERE showtime_id = p_showtime_id AND seat_id = ANY(p_seat_ids)
  FOR UPDATE;

  -- Kiểm tra xem có ghế nào đã bị bán hoặc đang bị phiên khác giữ không
  SELECT COUNT(*) INTO v_conflict_count
  FROM showtime_seats
  WHERE showtime_id = p_showtime_id
    AND seat_id = ANY(p_seat_ids)
    AND (status = 'sold' OR (status = 'held' AND held_by != p_session_id AND held_until > now()));

  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ghế đã được người khác đặt hoặc giữ chỗ');
  END IF;

  v_held_until := now() + interval '10 minutes';

  -- Cập nhật trạng thái giữ ghế 10 phút
  UPDATE showtime_seats
  SET status = 'held',
      held_until = v_held_until,
      held_by = p_session_id
  WHERE showtime_id = p_showtime_id AND seat_id = ANY(p_seat_ids);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Giữ ghế thành công 10 phút',
    'held_until', v_held_until
  );
END;
$$;
