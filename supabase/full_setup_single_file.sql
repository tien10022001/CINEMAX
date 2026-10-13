-- ====================================================================
-- CINEMAX SUPABASE MASTER SETUP - FULL DATABASE REDESIGN v3.0
-- File duy nhất tổng hợp toàn bộ: Schema, RLS Policies, Stored Procedures, Seed Data
-- Dán toàn bộ file này vào Supabase SQL Editor và nhấn RUN
-- ====================================================================

-- ====================================================================
-- CINEMAX SUPABASE REDESIGN v3.0 - BƯỚC 1/4: SCHEMA, TYPES & TABLES
-- Kiến trúc 1 Rạp Tiêu Chuẩn (Single Theater) - 28 Bảng Nghiệp Vụ Chuẩn Hóa
-- ====================================================================

-- 1. Bật Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. Dọn dẹp an toàn các bảng cũ nếu tồn tại
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.order_access_challenges CASCADE;
DROP TABLE IF EXISTS public.support_requests CASCADE;
DROP TABLE IF EXISTS public.invoice_requests CASCADE;
DROP TABLE IF EXISTS public.refunds CASCADE;
DROP TABLE IF EXISTS public.shifts CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.order_item_fulfillments CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.coupon_redemptions CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.inventory_movements CASCADE;
DROP TABLE IF EXISTS public.product_modifiers CASCADE;
DROP TABLE IF EXISTS public.product_components CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.showtime_seats CASCADE;
DROP TABLE IF EXISTS public.showtime_prices CASCADE;
DROP TABLE IF EXISTS public.showtimes CASCADE;
DROP TABLE IF EXISTS public.seats CASCADE;
DROP TABLE IF EXISTS public.auditoriums CASCADE;
DROP TABLE IF EXISTS public.movie_genres CASCADE;
DROP TABLE IF EXISTS public.movies CASCADE;
DROP TABLE IF EXISTS public.genres CASCADE;
DROP TABLE IF EXISTS public.content_items CASCADE;
DROP TABLE IF EXISTS public.cinema_settings CASCADE;
DROP TABLE IF EXISTS public.staff_permissions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Dọn các bảng phiên bản cũ (v1) nếu còn sót
DROP TABLE IF EXISTS public.booking_items CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.food_items CASCADE;
DROP TABLE IF EXISTS public.promotions CASCADE;
DROP TABLE IF EXISTS public.seat_types CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.cinemas CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;

-- 3. Xóa và tạo lại các kiểu dữ liệu ENUM
DROP TYPE IF EXISTS public.user_role_t CASCADE;
DROP TYPE IF EXISTS public.account_status_t CASCADE;
DROP TYPE IF EXISTS public.staff_perm_t CASCADE;
DROP TYPE IF EXISTS public.content_type_t CASCADE;
DROP TYPE IF EXISTS public.content_status_t CASCADE;
DROP TYPE IF EXISTS public.age_rating_t CASCADE;
DROP TYPE IF EXISTS public.movie_status_t CASCADE;
DROP TYPE IF EXISTS public.screen_type_t CASCADE;
DROP TYPE IF EXISTS public.room_status_t CASCADE;
DROP TYPE IF EXISTS public.seat_type_t CASCADE;
DROP TYPE IF EXISTS public.seat_status_t CASCADE;
DROP TYPE IF EXISTS public.showtime_status_t CASCADE;
DROP TYPE IF EXISTS public.audience_type_t CASCADE;
DROP TYPE IF EXISTS public.showtime_seat_status_t CASCADE;
DROP TYPE IF EXISTS public.product_type_t CASCADE;
DROP TYPE IF EXISTS public.movement_type_t CASCADE;
DROP TYPE IF EXISTS public.discount_type_t CASCADE;
DROP TYPE IF EXISTS public.coupon_scope_t CASCADE;
DROP TYPE IF EXISTS public.order_channel_t CASCADE;
DROP TYPE IF EXISTS public.order_status_t CASCADE;
DROP TYPE IF EXISTS public.order_item_type_t CASCADE;
DROP TYPE IF EXISTS public.payment_provider_t CASCADE;
DROP TYPE IF EXISTS public.payment_status_t CASCADE;
DROP TYPE IF EXISTS public.ticket_status_t CASCADE;
DROP TYPE IF EXISTS public.shift_status_t CASCADE;
DROP TYPE IF EXISTS public.refund_type_t CASCADE;
DROP TYPE IF EXISTS public.refund_status_t CASCADE;
DROP TYPE IF EXISTS public.invoice_status_t CASCADE;
DROP TYPE IF EXISTS public.support_type_t CASCADE;
DROP TYPE IF EXISTS public.support_status_t CASCADE;
DROP TYPE IF EXISTS public.challenge_channel_t CASCADE;

CREATE TYPE public.user_role_t AS ENUM ('admin', 'staff', 'user');
CREATE TYPE public.account_status_t AS ENUM ('active', 'blocked');
CREATE TYPE public.staff_perm_t AS ENUM ('POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR');
CREATE TYPE public.content_type_t AS ENUM ('banner', 'post', 'promotion');
CREATE TYPE public.content_status_t AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.age_rating_t AS ENUM ('P', 'K', 'T13', 'T16', 'T18');
CREATE TYPE public.movie_status_t AS ENUM ('draft', 'coming_soon', 'now_showing', 'ended');
CREATE TYPE public.screen_type_t AS ENUM ('2D', '3D', 'IMAX', '4DX');
CREATE TYPE public.room_status_t AS ENUM ('active', 'maintenance');
CREATE TYPE public.seat_type_t AS ENUM ('STANDARD', 'VIP', 'COUPLE', 'WHEELCHAIR');
CREATE TYPE public.seat_status_t AS ENUM ('ACTIVE', 'BLOCKED');
CREATE TYPE public.showtime_status_t AS ENUM ('scheduled', 'open', 'closed', 'cancelled', 'finished');
CREATE TYPE public.audience_type_t AS ENUM ('ADULT', 'STUDENT_U22', 'CHILD', 'SENIOR');
CREATE TYPE public.showtime_seat_status_t AS ENUM ('available', 'held', 'sold', 'blocked');
CREATE TYPE public.product_type_t AS ENUM ('FOOD', 'BEVERAGE', 'COMBO');
CREATE TYPE public.movement_type_t AS ENUM ('IMPORT', 'SALE', 'LOSS', 'ADJUSTMENT');
CREATE TYPE public.discount_type_t AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE public.coupon_scope_t AS ENUM ('ALL', 'TICKET_ONLY', 'COMBO_ONLY');
CREATE TYPE public.order_channel_t AS ENUM ('online', 'pos');
CREATE TYPE public.order_status_t AS ENUM ('pending', 'paid', 'cancelled', 'expired', 'refunded');
CREATE TYPE public.order_item_type_t AS ENUM ('ticket', 'product');
CREATE TYPE public.payment_provider_t AS ENUM ('CASH', 'MOMO', 'VNPAY', 'ZALOPAY', 'CARD');
CREATE TYPE public.payment_status_t AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
CREATE TYPE public.ticket_status_t AS ENUM ('issued', 'used', 'cancelled', 'refunded');
CREATE TYPE public.shift_status_t AS ENUM ('open', 'submitted', 'closed');
CREATE TYPE public.refund_type_t AS ENUM ('CUSTOMER_REQUEST', 'SYSTEM_SHOWTIME_CANCEL', 'EXCHANGE');
CREATE TYPE public.refund_status_t AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE public.invoice_status_t AS ENUM ('pending', 'issued', 'rejected');
CREATE TYPE public.support_type_t AS ENUM ('lost_ticket', 'contact_change', 'payment_pending', 'cancellation', 'seat_exchange');
CREATE TYPE public.support_status_t AS ENUM ('pending', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.challenge_channel_t AS ENUM ('email', 'sms');

-- ====================================================================
-- 4. TẠO CÁC BẢNG DỮ LIỆU
-- ====================================================================

-- 4.1. Hồ sơ người dùng nội bộ và thành viên
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.user_role_t NOT NULL DEFAULT 'user',
    full_name text NOT NULL,
    phone varchar(20) UNIQUE,
    loyalty_points int NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
    membership_tier varchar(20) NOT NULL DEFAULT 'MEMBER',
    status public.account_status_t NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.2. Phân công nhiệm vụ Staff
CREATE TABLE public.staff_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    permission public.staff_perm_t NOT NULL,
    active boolean NOT NULL DEFAULT true,
    assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_staff_permission UNIQUE (staff_id, permission)
);

-- 4.3. Cấu hình vận hành rạp
CREATE TABLE public.cinema_settings (
    setting_key varchar(50) PRIMARY KEY,
    setting_value jsonb NOT NULL,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.4. Truyền thông, tin tức, khuyến mãi
CREATE TABLE public.content_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type public.content_type_t NOT NULL,
    title text NOT NULL,
    body text,
    image_url text,
    link_url text,
    published_at timestamptz,
    expires_at timestamptz,
    status public.content_status_t NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.5. Thể loại phim
CREATE TABLE public.genres (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(50) NOT NULL,
    slug varchar(60) UNIQUE NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.6. Danh mục phim chiếu rạp
CREATE TABLE public.movies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    slug varchar(120) UNIQUE NOT NULL,
    synopsis text,
    director varchar(100),
    cast_list text,
    language varchar(50) DEFAULT 'Tiếng Việt',
    duration_minutes smallint NOT NULL CHECK (duration_minutes > 0),
    age_rating public.age_rating_t NOT NULL DEFAULT 'P',
    poster_url text,
    banner_url text,
    trailer_url text,
    release_date date,
    end_date date,
    status public.movie_status_t NOT NULL DEFAULT 'coming_soon',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.7. Phim - Thể loại (N-N)
CREATE TABLE public.movie_genres (
    movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
    genre_id uuid NOT NULL REFERENCES public.genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
);

-- 4.8. Phòng chiếu của rạp
CREATE TABLE public.auditoriums (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(50) UNIQUE NOT NULL,
    screen_type public.screen_type_t NOT NULL DEFAULT '2D',
    sound_system varchar(50) NOT NULL DEFAULT 'Dolby 7.1',
    total_seats smallint NOT NULL CHECK (total_seats > 0),
    cleaning_buffer_minutes smallint NOT NULL DEFAULT 15,
    status public.room_status_t NOT NULL DEFAULT 'active',
    seat_map_version int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.9. Sơ đồ ghế mẫu của phòng
CREATE TABLE public.seats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auditorium_id uuid NOT NULL REFERENCES public.auditoriums(id) ON DELETE CASCADE,
    row_label varchar(3) NOT NULL,
    seat_number smallint NOT NULL,
    grid_row smallint NOT NULL,
    grid_col smallint NOT NULL,
    seat_type public.seat_type_t NOT NULL DEFAULT 'STANDARD',
    seat_group varchar(20) NULL,
    status public.seat_status_t NOT NULL DEFAULT 'ACTIVE',
    block_reason varchar(100) NULL,
    CONSTRAINT uq_auditorium_seat UNIQUE (auditorium_id, row_label, seat_number)
);

-- 4.10. Suất chiếu phim
CREATE TABLE public.showtimes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE RESTRICT,
    auditorium_id uuid NOT NULL REFERENCES public.auditoriums(id) ON DELETE RESTRICT,
    format varchar(20) NOT NULL DEFAULT '2D',
    language_version varchar(50) NOT NULL DEFAULT 'Phụ đề Tiếng Việt',
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    booking_opens_at timestamptz,
    booking_closes_at timestamptz,
    status public.showtime_status_t NOT NULL DEFAULT 'scheduled',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_showtime_time CHECK (ends_at > starts_at),
    CONSTRAINT showtimes_no_overlap EXCLUDE USING gist (
        auditorium_id WITH =,
        tstzrange(starts_at, ends_at) WITH &&
    ) WHERE (status != 'cancelled')
);

-- 4.11. Bảng giá vé phân tầng đa chiều
CREATE TABLE public.showtime_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    showtime_id uuid NOT NULL REFERENCES public.showtimes(id) ON DELETE CASCADE,
    seat_type public.seat_type_t NOT NULL,
    audience_type public.audience_type_t NOT NULL DEFAULT 'ADULT',
    price numeric(12,0) NOT NULL CHECK (price >= 0),
    currency char(3) NOT NULL DEFAULT 'VND',
    CONSTRAINT uq_showtime_seat_price UNIQUE (showtime_id, seat_type, audience_type)
);

-- 4.13. Bắp nước và Combo F&B
CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    product_type public.product_type_t NOT NULL,
    base_price numeric(12,0) NOT NULL CHECK (base_price >= 0),
    inventory_tracking boolean NOT NULL DEFAULT true,
    available_stock int NOT NULL DEFAULT 0 CHECK (available_stock >= 0),
    active boolean NOT NULL DEFAULT true,
    image_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.14. Thành phần Combo
CREATE TABLE public.product_components (
    combo_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    component_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity smallint NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (combo_id, component_id),
    CONSTRAINT chk_combo_self_contain CHECK (combo_id != component_id)
);

-- 4.15. Tùy chọn đổi vị / size Bắp nước (Modifiers)
CREATE TABLE public.product_modifiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    modifier_group varchar(50) NOT NULL,
    option_name varchar(50) NOT NULL,
    extra_price numeric(12,0) NOT NULL DEFAULT 0 CHECK (extra_price >= 0),
    is_default boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true
);

-- 4.17. Chính sách mã giảm giá
CREATE TABLE public.coupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(30) UNIQUE NOT NULL,
    discount_type public.discount_type_t NOT NULL,
    discount_value numeric(12,0) NOT NULL CHECK (discount_value > 0),
    max_discount numeric(12,0) NULL,
    min_order_amount numeric(12,0) NOT NULL DEFAULT 0,
    apply_scope public.coupon_scope_t NOT NULL DEFAULT 'ALL',
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    usage_limit int NULL,
    per_user_limit int NOT NULL DEFAULT 1,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_coupon_dates CHECK (ends_at > starts_at)
);

-- 4.19. Đơn đặt vé tổng thể (Orders)
CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code varchar(20) UNIQUE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    guest_access_hash text NULL,
    channel public.order_channel_t NOT NULL DEFAULT 'online',
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    status public.order_status_t NOT NULL DEFAULT 'pending',
    contact_name varchar(100) NOT NULL,
    contact_email varchar(100) NOT NULL,
    contact_phone varchar(20) NOT NULL,
    subtotal numeric(12,0) NOT NULL,
    discount_amount numeric(12,0) NOT NULL DEFAULT 0,
    loyalty_points_used int NOT NULL DEFAULT 0 CHECK (loyalty_points_used >= 0),
    loyalty_discount_amount numeric(12,0) NOT NULL DEFAULT 0,
    total_amount numeric(12,0) NOT NULL CHECK (total_amount >= 0),
    coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
    expires_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.12. Nguồn sự thật trạng thái ghế theo từng suất chiếu
CREATE TABLE public.showtime_seats (
    showtime_id uuid NOT NULL REFERENCES public.showtimes(id) ON DELETE CASCADE,
    seat_id uuid NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
    status public.showtime_seat_status_t NOT NULL DEFAULT 'available',
    held_until timestamptz NULL,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    PRIMARY KEY (showtime_id, seat_id)
);

-- 4.18. Lịch sử dùng mã giảm giá
CREATE TABLE public.coupon_redemptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    redeemed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_coupon_order UNIQUE (coupon_id, order_id)
);

-- 4.20. Dòng vé xem phim & Hàng hóa chi tiết
CREATE TABLE public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    item_type public.order_item_type_t NOT NULL,
    showtime_id uuid NULL,
    seat_id uuid NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
    audience_type public.audience_type_t NULL,
    selected_modifiers jsonb NULL,
    quantity smallint NOT NULL CHECK (quantity > 0),
    unit_price numeric(12,0) NOT NULL CHECK (unit_price >= 0),
    line_total numeric(12,0) NOT NULL CHECK (line_total >= 0),
    item_snapshot jsonb NOT NULL,
    CONSTRAINT fk_order_item_showtime_seat FOREIGN KEY (showtime_id, seat_id)
        REFERENCES public.showtime_seats(showtime_id, seat_id) ON DELETE SET NULL
);

-- 4.16. Sổ biến động kho bắp nước (Append-only)
CREATE TABLE public.inventory_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    movement_type public.movement_type_t NOT NULL,
    quantity int NOT NULL,
    reason text NOT NULL,
    reference_order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4.21. Xác nhận giao nhận bắp nước tại quầy (Fulfillment)
CREATE TABLE public.order_item_fulfillments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    quantity smallint NOT NULL CHECK (quantity > 0),
    delivered_at timestamptz NOT NULL DEFAULT now(),
    delivered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 4.24. Quản lý ca trực tiền mặt quầy vé & F&B
CREATE TABLE public.shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    pos_terminal varchar(30) NOT NULL,
    shift_type varchar(20) NOT NULL DEFAULT 'MORNING',
    opened_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz NULL,
    opening_cash numeric(12,0) NOT NULL DEFAULT 0,
    expected_cash numeric(12,0) NOT NULL DEFAULT 0,
    counted_cash numeric(12,0) NULL,
    variance_reason text NULL,
    supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at timestamptz NULL,
    status public.shift_status_t NOT NULL DEFAULT 'open'
);

-- 4.22. Giao dịch thanh toán
CREATE TABLE public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
    received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    provider public.payment_provider_t NOT NULL,
    provider_txn_id text UNIQUE NULL,
    amount numeric(12,0) NOT NULL CHECK (amount > 0),
    status public.payment_status_t NOT NULL DEFAULT 'PENDING',
    payload jsonb NULL,
    paid_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4.23. Vé điện tử QR Code
CREATE TABLE public.tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE UNIQUE,
    qr_token_hash text NOT NULL UNIQUE,
    status public.ticket_status_t NOT NULL DEFAULT 'issued',
    age_check_passed boolean NOT NULL DEFAULT true,
    checked_in_at timestamptz NULL,
    checked_in_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 4.25. Hồ sơ yêu cầu và xử lý hoàn tiền
CREATE TABLE public.refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
    refund_type public.refund_type_t NOT NULL DEFAULT 'CUSTOMER_REQUEST',
    requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason text NOT NULL,
    amount numeric(12,0) NOT NULL CHECK (amount > 0),
    status public.refund_status_t NOT NULL DEFAULT 'pending',
    approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    provider_ref text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz NULL
);

-- 4.26. Yêu cầu xuất hóa đơn VAT điện tử
CREATE TABLE public.invoice_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE UNIQUE,
    tax_code varchar(30) NOT NULL,
    company_name text NOT NULL,
    address text NOT NULL,
    email varchar(100) NOT NULL,
    status public.invoice_status_t NOT NULL DEFAULT 'pending',
    invoice_ref text NULL,
    requested_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz NULL
);

-- 4.27. Hỗ trợ khách hàng & Khiếu nại
CREATE TABLE public.support_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    type public.support_type_t NOT NULL,
    description text NOT NULL,
    status public.support_status_t NOT NULL DEFAULT 'pending',
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    guest_access_hash text NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz NULL
);

-- 4.28. Xác thực OTP tra cứu cho Khách vãng lai (Zero-Leakage)
CREATE TABLE public.order_access_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    channel public.challenge_channel_t NOT NULL DEFAULT 'email',
    destination_hash text NOT NULL,
    otp_hash text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    attempts smallint NOT NULL DEFAULT 0 CHECK (attempts <= 5),
    verified_at timestamptz NULL
);

-- 4.29. Nhật ký kiểm toán an toàn hệ thống (Append-only)
CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action varchar(100) NOT NULL,
    entity_type varchar(50) NOT NULL,
    entity_id text NOT NULL,
    before_data jsonb NULL,
    after_data jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ====================================================================
-- 5. TRIGGERS CƠ BẢN
-- ====================================================================

-- 5.1. Trigger tự cập nhật updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_movies_updated_at BEFORE UPDATE ON public.movies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_showtimes_updated_at BEFORE UPDATE ON public.showtimes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5.2. Trigger tự tạo profile khi người dùng đăng ký qua Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'user',
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5.3. Trigger cập nhật available_stock từ inventory_movements
CREATE OR REPLACE FUNCTION public.sync_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.products
    SET available_stock = GREATEST(0, available_stock + NEW.quantity)
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_inventory_stock
    AFTER INSERT ON public.inventory_movements
    FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_stock();

-- 5.4. Cấp quyền truy cập schema và bảng cho các vai trò Supabase
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;


-- ====================================================================
-- CINEMAX SUPABASE REDESIGN v3.0 - BƯỚC 2/4: ROW LEVEL SECURITY (RLS)
-- Thiết lập kiểm soát truy cập cấp hàng nghiêm ngặt theo Ma trận RBAC
-- ====================================================================

-- 1. Kích hoạt RLS trên toàn bộ 28 bảng
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cinema_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoriums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showtimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showtime_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showtime_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_access_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Helper Functions kiểm tra quyền người dùng hiện tại
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role_t AS $$
DECLARE
    v_role public.user_role_t;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_role, 'user'::public.user_role_t);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_staff_permission(p_perm public.staff_perm_t)
RETURNS boolean AS $$
BEGIN
    IF public.current_user_role() = 'admin' THEN
        RETURN true;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.staff_permissions
        WHERE staff_id = auth.uid() AND permission = p_perm AND active = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Policies cho từng bảng

-- 3.1. profiles
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.current_user_role() = 'admin');

CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.current_user_role() = 'admin');

-- 3.2. staff_permissions
CREATE POLICY "staff_permissions_admin_all" ON public.staff_permissions
    FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "staff_permissions_self_read" ON public.staff_permissions
    FOR SELECT USING (staff_id = auth.uid());

-- 3.3. cinema_settings
CREATE POLICY "cinema_settings_public_read" ON public.cinema_settings
    FOR SELECT USING (true);

CREATE POLICY "cinema_settings_admin_all" ON public.cinema_settings
    FOR ALL USING (public.current_user_role() = 'admin');

-- 3.4. content_items, genres, movies, movie_genres
CREATE POLICY "content_items_read" ON public.content_items
    FOR SELECT USING (status = 'published' OR public.current_user_role() = 'admin');
CREATE POLICY "content_items_admin" ON public.content_items
    FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "genres_read" ON public.genres FOR SELECT USING (true);
CREATE POLICY "genres_admin" ON public.genres FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "movies_read" ON public.movies
    FOR SELECT USING (status IN ('coming_soon', 'now_showing') OR public.current_user_role() = 'admin');
CREATE POLICY "movies_admin" ON public.movies FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "movie_genres_read" ON public.movie_genres FOR SELECT USING (true);
CREATE POLICY "movie_genres_admin" ON public.movie_genres FOR ALL USING (public.current_user_role() = 'admin');

-- 3.5. auditoriums, seats, showtimes, showtime_prices, showtime_seats
CREATE POLICY "auditoriums_read" ON public.auditoriums FOR SELECT USING (true);
CREATE POLICY "auditoriums_admin" ON public.auditoriums FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "seats_read" ON public.seats FOR SELECT USING (true);
CREATE POLICY "seats_admin" ON public.seats FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "showtimes_read" ON public.showtimes FOR SELECT USING (true);
CREATE POLICY "showtimes_admin" ON public.showtimes FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "showtime_prices_read" ON public.showtime_prices FOR SELECT USING (true);
CREATE POLICY "showtime_prices_admin" ON public.showtime_prices FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "showtime_seats_read" ON public.showtime_seats FOR SELECT USING (true);
-- Ghi showtime_seats chỉ cho phép qua Security Definer Stored Procedures

-- 3.6. products, product_components, product_modifiers
CREATE POLICY "products_read" ON public.products FOR SELECT USING (active = true OR public.current_user_role() = 'admin');
CREATE POLICY "products_admin" ON public.products FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "product_components_read" ON public.product_components FOR SELECT USING (true);
CREATE POLICY "product_components_admin" ON public.product_components FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "product_modifiers_read" ON public.product_modifiers FOR SELECT USING (active = true OR public.current_user_role() = 'admin');
CREATE POLICY "product_modifiers_admin" ON public.product_modifiers FOR ALL USING (public.current_user_role() = 'admin');

-- 3.7. inventory_movements
CREATE POLICY "inventory_movements_read" ON public.inventory_movements
    FOR SELECT USING (public.current_user_role() = 'admin' OR public.has_staff_permission('CONCESSION'));

-- 3.8. coupons, coupon_redemptions
CREATE POLICY "coupons_read" ON public.coupons FOR SELECT USING (active = true OR public.current_user_role() = 'admin');
CREATE POLICY "coupons_admin" ON public.coupons FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "coupon_redemptions_admin" ON public.coupon_redemptions
    FOR ALL USING (public.current_user_role() = 'admin');

-- 3.9. orders, order_items, order_item_fulfillments
CREATE POLICY "orders_select" ON public.orders
    FOR SELECT USING (
        user_id = auth.uid() OR
        public.current_user_role() = 'admin' OR
        public.has_staff_permission('POS')
    );

CREATE POLICY "order_items_select" ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id AND (
                o.user_id = auth.uid() OR
                public.current_user_role() = 'admin' OR
                public.has_staff_permission('POS') OR
                public.has_staff_permission('CHECKIN') OR
                public.has_staff_permission('CONCESSION')
            )
        )
    );

CREATE POLICY "fulfillments_select" ON public.order_item_fulfillments
    FOR SELECT USING (public.current_user_role() = 'admin' OR public.has_staff_permission('CONCESSION'));

-- 3.10. payments
CREATE POLICY "payments_select" ON public.payments
    FOR SELECT USING (
        public.current_user_role() = 'admin' OR
        public.has_staff_permission('POS') OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payments.order_id AND o.user_id = auth.uid())
    );

-- 3.11. tickets
CREATE POLICY "tickets_select" ON public.tickets
    FOR SELECT USING (
        public.current_user_role() = 'admin' OR
        public.has_staff_permission('CHECKIN') OR
        public.has_staff_permission('POS') OR
        EXISTS (
            SELECT 1 FROM public.order_items oi
            JOIN public.orders o ON o.id = oi.order_id
            WHERE oi.id = tickets.order_item_id AND o.user_id = auth.uid()
        )
    );

-- 3.12. shifts
CREATE POLICY "shifts_select" ON public.shifts
    FOR SELECT USING (
        staff_id = auth.uid() OR
        public.current_user_role() = 'admin' OR
        public.has_staff_permission('SUPERVISOR')
    );

-- 3.13. refunds, invoice_requests, support_requests
CREATE POLICY "refunds_select" ON public.refunds
    FOR SELECT USING (
        requested_by = auth.uid() OR
        public.current_user_role() = 'admin' OR
        public.has_staff_permission('SUPERVISOR')
    );

CREATE POLICY "invoice_requests_select" ON public.invoice_requests
    FOR SELECT USING (
        public.current_user_role() = 'admin' OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = invoice_requests.order_id AND o.user_id = auth.uid())
    );

CREATE POLICY "support_requests_select" ON public.support_requests
    FOR SELECT USING (
        created_by = auth.uid() OR
        assigned_to = auth.uid() OR
        public.current_user_role() = 'admin' OR
        public.has_staff_permission('POS')
    );

-- 3.14. order_access_challenges, audit_logs
CREATE POLICY "challenges_system_only" ON public.order_access_challenges
    FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "audit_logs_admin_only" ON public.audit_logs
    FOR SELECT USING (public.current_user_role() = 'admin');


-- ====================================================================
-- CINEMAX SUPABASE REDESIGN v3.0 - BƯỚC 3/4: STORED PROCEDURES / RPC
-- Các hàm giao dịch nguyên tử (ACID Transactions) chống Race Condition
-- ====================================================================

-- 1. GIỮ GHẾ THỜI GIAN THỰC (hold_seats)
-- Chống hai người đặt trùng 1 ghế, bắt buộc chọn cả cặp ghế đôi, chống ghế trống đơn độc (orphan seat)
CREATE OR REPLACE FUNCTION public.hold_seats(
    p_showtime_id uuid,
    p_seat_ids uuid[],
    p_user_id uuid,
    p_channel public.order_channel_t,
    p_contact_name text,
    p_contact_email text,
    p_contact_phone text
)
RETURNS jsonb AS $$
DECLARE
    v_seat_count int;
    v_order_id uuid;
    v_order_code varchar(20);
    v_expires_at timestamptz;
    v_held_until timestamptz;
    v_guest_hash text;
    v_subtotal numeric(12,0) := 0;
    v_seat_record RECORD;
    v_pair_group text;
    v_other_pair_count int;
BEGIN
    v_seat_count := array_length(p_seat_ids, 1);
    IF v_seat_count IS NULL OR v_seat_count = 0 THEN
        RAISE EXCEPTION 'Danh sách ghế không được để trống';
    END IF;

    -- 1. Kiểm tra ràng buộc Ghế Đôi (Couple): Nếu chọn ghế đôi thì phải chọn cả cặp cùng group
    FOR v_pair_group IN
        SELECT DISTINCT s.seat_group
        FROM public.seats s
        WHERE s.id = ANY(p_seat_ids) AND s.seat_type = 'COUPLE' AND s.seat_group IS NOT NULL
    LOOP
        SELECT count(*) INTO v_other_pair_count
        FROM public.seats s
        WHERE s.auditorium_id = (SELECT auditorium_id FROM public.showtimes WHERE id = p_showtime_id)
          AND s.seat_group = v_pair_group
          AND s.id != ALL(p_seat_ids);

        IF v_other_pair_count > 0 THEN
            RAISE EXCEPTION 'Ghế đôi bắt buộc phải chọn trọn cặp cùng nhau!';
        END IF;
    END LOOP;

    -- 2. Khóa các ghế trong showtime_seats để chống Race Condition (FOR UPDATE)
    PERFORM 1
    FROM public.showtime_seats ss
    WHERE ss.showtime_id = p_showtime_id
      AND ss.seat_id = ANY(p_seat_ids)
    FOR UPDATE;

    -- Kiểm tra xem có ghế nào không available (held chưa hết hạn hoặc đã sold/blocked)
    IF EXISTS (
        SELECT 1 FROM public.showtime_seats ss
        WHERE ss.showtime_id = p_showtime_id
          AND ss.seat_id = ANY(p_seat_ids)
          AND (
              ss.status = 'sold' OR
              ss.status = 'blocked' OR
              (ss.status = 'held' AND ss.held_until > now())
          )
    ) THEN
        RAISE EXCEPTION 'Một hoặc nhiều ghế bạn chọn vừa có người khác giữ chỗ. Vui lòng chọn ghế khác!';
    END IF;

    -- 3. Tính tiền tạm thời từ showtime_prices
    FOR v_seat_record IN
        SELECT s.id AS seat_id, s.seat_type, COALESCE(sp.price, 80000) AS price
        FROM public.seats s
        LEFT JOIN public.showtime_prices sp 
          ON sp.showtime_id = p_showtime_id 
         AND sp.seat_type = s.seat_type 
         AND sp.audience_type = 'ADULT'
        WHERE s.id = ANY(p_seat_ids)
    LOOP
        v_subtotal := v_subtotal + v_seat_record.price;
    END LOOP;

    -- 4. Tạo mã đơn hàng ngẫu nhiên và thời hạn giữ ghế (10 phút)
    v_order_code := 'CNM' || to_char(now(), 'YYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 5));
    v_expires_at := now() + interval '10 minutes';
    v_held_until := v_expires_at;

    IF p_user_id IS NULL THEN
        v_guest_hash := encode(digest(v_order_code || p_contact_phone || gen_random_uuid()::text, 'sha256'), 'hex');
    END IF;

    INSERT INTO public.orders (
        order_code,
        user_id,
        guest_access_hash,
        channel,
        status,
        contact_name,
        contact_email,
        contact_phone,
        subtotal,
        total_amount,
        expires_at
    ) VALUES (
        v_order_code,
        p_user_id,
        v_guest_hash,
        p_channel,
        'pending',
        p_contact_name,
        p_contact_email,
        p_contact_phone,
        v_subtotal,
        v_subtotal,
        v_expires_at
    ) RETURNING id INTO v_order_id;

    -- 5. Cập nhật showtime_seats sang held
    UPDATE public.showtime_seats
    SET status = 'held',
        held_until = v_held_until,
        order_id = v_order_id
    WHERE showtime_id = p_showtime_id
      AND seat_id = ANY(p_seat_ids);

    -- 6. Tạo chi tiết order_items cho từng ghế
    FOR v_seat_record IN
        SELECT s.id AS seat_id, s.row_label, s.seat_number, s.seat_type, COALESCE(sp.price, 80000) AS price
        FROM public.seats s
        LEFT JOIN public.showtime_prices sp 
          ON sp.showtime_id = p_showtime_id 
         AND sp.seat_type = s.seat_type 
         AND sp.audience_type = 'ADULT'
        WHERE s.id = ANY(p_seat_ids)
    LOOP
        INSERT INTO public.order_items (
            order_id,
            item_type,
            showtime_id,
            seat_id,
            audience_type,
            quantity,
            unit_price,
            line_total,
            item_snapshot
        ) VALUES (
            v_order_id,
            'ticket',
            p_showtime_id,
            v_seat_record.seat_id,
            'ADULT',
            1,
            v_seat_record.price,
            v_seat_record.price,
            jsonb_build_object(
                'seat_label', v_seat_record.row_label || v_seat_record.seat_number::text,
                'seat_type', v_seat_record.seat_type,
                'showtime_id', p_showtime_id
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_code', v_order_code,
        'guest_access_hash', v_guest_hash,
        'subtotal', v_subtotal,
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. XÁC NHẬN THANH TOÁN THÀNH CÔNG (confirm_order_payment)
CREATE OR REPLACE FUNCTION public.confirm_order_payment(
    p_order_id uuid,
    p_provider public.payment_provider_t,
    p_provider_txn_id text,
    p_shift_id uuid DEFAULT NULL,
    p_received_by uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_qr_token text;
    v_qr_hash text;
    v_points_earned int;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Đơn hàng không tồn tại';
    END IF;

    IF v_order.status = 'paid' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Đơn hàng đã được xác nhận trước đó');
    END IF;

    -- 1. Cập nhật trạng thái đơn sang paid
    UPDATE public.orders
    SET status = 'paid', updated_at = now()
    WHERE id = p_order_id;

    -- 2. Đổi trạng thái showtime_seats từ held sang sold
    UPDATE public.showtime_seats
    SET status = 'sold', held_until = NULL
    WHERE order_id = p_order_id;

    -- 3. Tạo bản ghi payments
    INSERT INTO public.payments (
        order_id,
        shift_id,
        received_by,
        provider,
        provider_txn_id,
        amount,
        status,
        paid_at
    ) VALUES (
        p_order_id,
        p_shift_id,
        p_received_by,
        p_provider,
        p_provider_txn_id,
        v_order.total_amount,
        'SUCCESS',
        now()
    );

    -- 4. Phát hành vé QR (tickets) cho các dòng vé trong đơn
    FOR v_item IN
        SELECT oi.id AS order_item_id, oi.showtime_id, oi.seat_id
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id AND oi.item_type = 'ticket'
    LOOP
        v_qr_token := 'TKT-' || v_order.order_code || '-' || substring(gen_random_uuid()::text from 1 for 8);
        v_qr_hash := encode(digest(v_qr_token, 'sha256'), 'hex');

        INSERT INTO public.tickets (
            order_item_id,
            qr_token_hash,
            status,
            age_check_passed
        ) VALUES (
            v_item.order_item_id,
            v_qr_hash,
            'issued',
            true
        )
        ON CONFLICT (order_item_id) DO NOTHING;
    END LOOP;

    -- 5. Trừ tồn kho bắp nước nếu đơn có mua combo
    FOR v_item IN
        SELECT oi.id AS order_item_id, oi.product_id, oi.quantity
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id AND oi.item_type = 'product' AND oi.product_id IS NOT NULL
    LOOP
        INSERT INTO public.inventory_movements (
            product_id,
            movement_type,
            quantity,
            reason,
            reference_order_item_id,
            created_at
        ) VALUES (
            v_item.product_id,
            'SALE',
            -v_item.quantity,
            'Xuất bán tự động theo đơn hàng ' || v_order.order_code,
            v_item.order_item_id,
            now()
        );
    END LOOP;

    -- 6. Tích lũy điểm hội viên nếu có tài khoản
    IF v_order.user_id IS NOT NULL THEN
        v_points_earned := floor(v_order.total_amount * 0.05); -- Tích 5% giá trị đơn
        IF v_points_earned > 0 THEN
            UPDATE public.profiles
            SET loyalty_points = loyalty_points + v_points_earned
            WHERE id = v_order.user_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_code', v_order.order_code,
        'total_amount', v_order.total_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. SOÁT VÉ TẠI CỬA PHÒNG CHIẾU (check_in_ticket)
CREATE OR REPLACE FUNCTION public.check_in_ticket(
    p_qr_hash text,
    p_staff_id uuid,
    p_age_check_passed boolean DEFAULT true
)
RETURNS jsonb AS $$
DECLARE
    v_ticket RECORD;
BEGIN
    SELECT t.*, oi.item_snapshot, m.age_rating, m.title AS movie_title
    INTO v_ticket
    FROM public.tickets t
    JOIN public.order_items oi ON oi.id = t.order_item_id
    JOIN public.showtimes st ON st.id = oi.showtime_id
    JOIN public.movies m ON m.id = st.movie_id
    WHERE t.qr_token_hash = p_qr_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mã vé QR không tồn tại trong hệ thống!';
    END IF;

    IF v_ticket.status = 'used' THEN
        RAISE EXCEPTION 'Vé này ĐÃ ĐƯỢC SOÁT vào lúc % bởi nhân viên %', 
            to_char(v_ticket.checked_in_at, 'HH24:MI DD/MM/YYYY'), v_ticket.checked_in_by;
    END IF;

    IF v_ticket.status != 'issued' THEN
        RAISE EXCEPTION 'Vé này đã bị hủy hoặc hoàn tiền, không có giá trị vào phòng chiếu!';
    END IF;

    IF p_age_check_passed = false THEN
        RAISE EXCEPTION 'Khách hàng không đủ độ tuổi xem phim (%)! Vui lòng hướng dẫn qua quầy POS xử lý.', v_ticket.age_rating;
    END IF;

    UPDATE public.tickets
    SET status = 'used',
        checked_in_at = now(),
        checked_in_by = p_staff_id,
        age_check_passed = true
    WHERE id = v_ticket.id;

    RETURN jsonb_build_object(
        'success', true,
        'movie_title', v_ticket.movie_title,
        'age_rating', v_ticket.age_rating,
        'item_snapshot', v_ticket.item_snapshot,
        'checked_in_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. TỰ ĐỘNG GIẢI PHÓNG GHẾ GIỮ QUÁ HẠN (release_expired_holds)
CREATE OR REPLACE FUNCTION public.release_expired_holds()
RETURNS int AS $$
DECLARE
    v_count int;
BEGIN
    -- Cập nhật showtime_seats
    UPDATE public.showtime_seats
    SET status = 'available',
        held_until = NULL,
        order_id = NULL
    WHERE status = 'held' AND held_until < now();
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Đổi orders quá hạn sang expired
    UPDATE public.orders
    SET status = 'expired', updated_at = now()
    WHERE status = 'pending' AND expires_at < now();

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. CHỐT CA TIỀN MẶT QUẦY POS (close_shift)
CREATE OR REPLACE FUNCTION public.close_shift(
    p_shift_id uuid,
    p_counted_cash numeric(12,0),
    p_variance_reason text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_shift RECORD;
    v_cash_sales numeric(12,0) := 0;
    v_expected numeric(12,0);
BEGIN
    SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ca làm việc không tồn tại';
    END IF;

    IF v_shift.status != 'open' THEN
        RAISE EXCEPTION 'Ca này đã được nộp hoặc đã đóng';
    END IF;

    -- Tính tổng tiền mặt thu được trong ca
    SELECT COALESCE(SUM(amount), 0) INTO v_cash_sales
    FROM public.payments
    WHERE shift_id = p_shift_id AND provider = 'CASH' AND status = 'SUCCESS';

    v_expected := v_shift.opening_cash + v_cash_sales;

    UPDATE public.shifts
    SET closed_at = now(),
        expected_cash = v_expected,
        counted_cash = p_counted_cash,
        variance_reason = p_variance_reason,
        status = 'submitted'
    WHERE id = p_shift_id;

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', p_shift_id,
        'opening_cash', v_shift.opening_cash,
        'cash_sales', v_cash_sales,
        'expected_cash', v_expected,
        'counted_cash', p_counted_cash,
        'variance', (p_counted_cash - v_expected)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================================================
-- CINEMAX SUPABASE REDESIGN v3.0 - BƯỚC 4/4: SEED DATA MẪU TOÀN DIỆN
-- Dữ liệu mẫu chuẩn: Cấu hình rạp, Phim, Phòng chiếu, Sơ đồ ghế, Suất, Giá vé, F&B
-- ====================================================================

DO $$
DECLARE
    v_admin_id uuid := '00000000-0000-0000-0000-000000000001';
    v_staff_id uuid := '00000000-0000-0000-0000-000000000002';
    
    v_genre_action uuid := gen_random_uuid();
    v_genre_scifi uuid := gen_random_uuid();
    v_genre_animation uuid := gen_random_uuid();
    v_genre_horror uuid := gen_random_uuid();
    
    v_movie_dune uuid := gen_random_uuid();
    v_movie_conan uuid := gen_random_uuid();
    v_movie_avatar uuid := gen_random_uuid();
    
    v_aud_std uuid := gen_random_uuid();
    v_aud_imax uuid := gen_random_uuid();
    
    v_st1 uuid := gen_random_uuid();
    v_st2 uuid := gen_random_uuid();
    
    v_prod_popcorn uuid := gen_random_uuid();
    v_prod_coke uuid := gen_random_uuid();
    v_prod_combo1 uuid := gen_random_uuid();
    
    r_char text;
    c_num int;
    v_seat_type public.seat_type_t;
    v_seat_id uuid;
BEGIN
    -- 1. Cấu hình rạp
    INSERT INTO public.cinema_settings (setting_key, setting_value) VALUES
    ('cinema_info', jsonb_build_object(
        'name', 'CINEMAX Plaza',
        'address', 'Tòa nhà FPT Polytechnic, Phố Trịnh Văn Bô, Nam Từ Liêm, Hà Nội',
        'hotline', '1900-6868',
        'email', 'cskh@cinemax.vn'
    )),
    ('policies', jsonb_build_object(
        'cleaning_buffer_minutes', 15,
        'hold_duration_minutes', 10,
        'late_sales_minutes', 15,
        'loyalty_rate', 0.05,
        'cancel_deadline_minutes', 60
    ))
    ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

    -- 2. Thể loại phim
    INSERT INTO public.genres (id, name, slug) VALUES
    (v_genre_action, 'Hành Động', 'hanh-dong'),
    (v_genre_scifi, 'Khoa Học Viễn Tưởng', 'khoa-hoc-vien-tuong'),
    (v_genre_animation, 'Hoạt Hình', 'hoat-hinh'),
    (v_genre_horror, 'Kinh Dị', 'kinh-di');

    -- 3. Phim chiếu rạp
    INSERT INTO public.movies (id, title, slug, synopsis, director, duration_minutes, age_rating, poster_url, status, release_date) VALUES
    (v_movie_dune, 'Dune: Hành Tinh Cát - Phần 2', 'dune-hanh-tinh-cat-2', 'Paul Atreides hợp nhất với Chani và người Fremen trên con đường báo thù gia tộc Harkonnen.', 'Denis Villeneuve', 166, 'T16', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800', 'now_showing', CURRENT_DATE - 5),
    (v_movie_conan, 'Thám Tử Lừng Danh Conan: Ngôi Sao 5 Cánh', 'tham-tu-conan-ngoi-sao-5-canh', 'Cuộc đối đầu kịch tính giữa Conan và Siêu đạo chích Kid tại Hakodate.', 'Chika Nagaoka', 110, 'T13', 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800', 'now_showing', CURRENT_DATE - 2),
    (v_movie_avatar, 'Avatar: Lửa Và Tro Tàn', 'avatar-lua-va-tro-tan', 'Hành trình khám phá bộ tộc Tro Tàn đầy bí ẩn tại thế giới Pandora.', 'James Cameron', 190, 'T13', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800', 'coming_soon', CURRENT_DATE + 30);

    INSERT INTO public.movie_genres (movie_id, genre_id) VALUES
    (v_movie_dune, v_genre_action),
    (v_movie_dune, v_genre_scifi),
    (v_movie_conan, v_genre_animation),
    (v_movie_avatar, v_genre_scifi);

    -- 4. Phòng chiếu
    INSERT INTO public.auditoriums (id, name, screen_type, sound_system, total_seats, cleaning_buffer_minutes) VALUES
    (v_aud_std, 'Phòng 1 (2D Tiêu Chuẩn)', '2D', 'Dolby 7.1', 80, 15),
    (v_aud_imax, 'Phòng 2 (IMAX Laser)', 'IMAX', 'Dolby Atmos', 120, 20);

    -- 5. Sơ đồ ghế Phòng 1 (Hàng A-H, 10 ghế mỗi hàng = 80 ghế)
    -- Hàng A-D: Standard, E-G: VIP, H: 5 cặp ghế đôi Couple (H1-H2, H3-H4, H5-H6, H7-H8, H9-H10)
    FOR r_char IN SELECT unnest(ARRAY['A','B','C','D','E','F','G','H']) LOOP
        FOR c_num IN 1..10 LOOP
            IF r_char IN ('A','B','C','D') THEN
                v_seat_type := 'STANDARD';
            ELSIF r_char IN ('E','F','G') THEN
                v_seat_type := 'VIP';
            ELSE
                v_seat_type := 'COUPLE';
            END IF;

            INSERT INTO public.seats (
                auditorium_id, row_label, seat_number, grid_row, grid_col, seat_type, seat_group
            ) VALUES (
                v_aud_std,
                r_char,
                c_num,
                ascii(r_char) - 64,
                c_num,
                v_seat_type,
                CASE WHEN v_seat_type = 'COUPLE' THEN 'H_PAIR_' || ceil(c_num::numeric / 2)::text ELSE NULL END
            );
        END LOOP;
    END LOOP;

    -- 6. Suất chiếu
    INSERT INTO public.showtimes (id, movie_id, auditorium_id, format, starts_at, ends_at, status) VALUES
    (v_st1, v_movie_dune, v_aud_std, '2D', now() + interval '2 hours', now() + interval '5 hours', 'open'),
    (v_st2, v_movie_conan, v_aud_imax, 'IMAX', now() + interval '4 hours', now() + interval '6 hours 10 minutes', 'open');

    -- 7. Bảng giá vé phân tầng đa chiều cho Suất 1 (Phòng 1)
    INSERT INTO public.showtime_prices (showtime_id, seat_type, audience_type, price) VALUES
    (v_st1, 'STANDARD', 'ADULT', 85000),
    (v_st1, 'STANDARD', 'STUDENT_U22', 65000),
    (v_st1, 'STANDARD', 'CHILD', 55000),
    (v_st1, 'VIP', 'ADULT', 105000),
    (v_st1, 'VIP', 'STUDENT_U22', 85000),
    (v_st1, 'VIP', 'CHILD', 75000),
    (v_st1, 'COUPLE', 'ADULT', 210000),
    (v_st1, 'COUPLE', 'STUDENT_U22', 170000);

    -- 8. Khởi tạo trạng thái ghế showtime_seats cho Suất 1
    FOR v_seat_id IN SELECT id FROM public.seats WHERE auditorium_id = v_aud_std LOOP
        INSERT INTO public.showtime_seats (showtime_id, seat_id, status)
        VALUES (v_st1, v_seat_id, 'available');
    END LOOP;

    -- 9. Bắp Nước & Modifiers
    INSERT INTO public.products (id, name, product_type, base_price, available_stock) VALUES
    (v_prod_popcorn, 'Bắp Rang Bơ (Tiêu chuẩn)', 'FOOD', 45000, 200),
    (v_prod_coke, 'Nước Ngọt Có Ga (Ly)', 'BEVERAGE', 30000, 300),
    (v_prod_combo1, 'Combo Solo 1 Bắp 1 Nước', 'COMBO', 69000, 150);

    INSERT INTO public.product_components (combo_id, component_id, quantity) VALUES
    (v_prod_combo1, v_prod_popcorn, 1),
    (v_prod_combo1, v_prod_coke, 1);

    INSERT INTO public.product_modifiers (product_id, modifier_group, option_name, extra_price, is_default) VALUES
    (v_prod_popcorn, 'Vị bắp', 'Vị Ngọt Cơ Bản', 0, true),
    (v_prod_popcorn, 'Vị bắp', 'Vị Phô Mai Lắc', 10000, false),
    (v_prod_popcorn, 'Vị bắp', 'Vị Caramel Cháy', 10000, false),
    (v_prod_coke, 'Loại nước', 'Coca-Cola Tươi', 0, true),
    (v_prod_coke, 'Loại nước', 'Sprite Chanh', 0, false),
    (v_prod_coke, 'Loại nước', 'Trà Đào Cam Sả', 10000, false);

    -- 10. Mã giảm giá
    INSERT INTO public.coupons (code, discount_type, discount_value, max_discount, min_order_amount, apply_scope, starts_at, ends_at) VALUES
    ('CINEMAX50K', 'FIXED', 50000, NULL, 150000, 'ALL', now() - interval '1 day', now() + interval '30 days'),
    ('HSSV10', 'PERCENT', 10, 30000, 60000, 'TICKET_ONLY', now() - interval '1 day', now() + interval '30 days');

    RAISE NOTICE 'Seed data initialized successfully for CINEMAX!';
END $$;

