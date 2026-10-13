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
