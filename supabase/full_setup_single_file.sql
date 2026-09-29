-- ====================================================================
-- CINEMAX - BƯỚC 1/5: TÍCH HỢP SUPABASE AUTH & HỒ SƠ NGƯỜI DÙNG
-- Chuyển đổi users thành bảng hồ sơ liên kết auth.users, bỏ password_hash
-- ====================================================================

-- 1. Bỏ NOT NULL ở password_hash để chuyển giao việc hash mật khẩu cho Supabase Auth
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Đổi users.id sang UUID liên kết với auth.users(id)
-- Do chưa có dữ liệu ở bookings và showtimes, chúng ta gỡ khóa ngoại và chuyển kiểu an toàn:
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;
ALTER TABLE public.showtimes DROP CONSTRAINT IF EXISTS showtimes_created_by_fkey;

-- Thay đổi kiểu cột ở các bảng liên quan
ALTER TABLE public.bookings ALTER COLUMN user_id TYPE uuid USING gen_random_uuid();
ALTER TABLE public.showtimes ALTER COLUMN created_by TYPE uuid USING NULL;

-- Xóa identity ở users.id và đổi sang uuid
ALTER TABLE public.users ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE public.users ALTER COLUMN id TYPE uuid USING gen_random_uuid();

-- Thiết lập khóa ngoại users.id -> auth.users(id) ON DELETE CASCADE
ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey 
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Thiết lập lại khóa ngoại ở bookings và showtimes
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.showtimes
  ADD CONSTRAINT showtimes_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Tạo Trigger tự động tạo hồ sơ public.users khi có tài khoản mới đăng ký ở auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role_id smallint;
BEGIN
  -- Lấy role CUSTOMER mặc định
  SELECT id INTO v_role_id FROM public.roles WHERE code = 'CUSTOMER';
  IF v_role_id IS NULL THEN
    v_role_id := 1;
  END IF;

  INSERT INTO public.users (
    id,
    role_id,
    full_name,
    email,
    phone,
    avatar_url,
    email_verified_at,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_role_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email_confirmed_at,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gắn trigger vào auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Tự động tạo hoặc cập nhật hồ sơ người dùng trong public.users khi đăng ký qua Supabase Auth';


-- ====================================================================
-- CINEMAX - BƯỚC 2/5: THIẾT LẬP ROW LEVEL SECURITY (RLS) POLICIES
-- Bật quyền đọc công khai cho dữ liệu danh mục & bảo vệ dữ liệu cá nhân
-- ====================================================================

-- 1. Helper function kiểm tra quyền Admin hoặc Staff
CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid() AND r.code IN ('ADMIN', 'STAFF')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid() AND r.code = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- --------------------------------------------------------------------
-- NHÓM 1: CÔNG KHAI ĐỌC (Public Read) - Danh mục rạp, phim, giá, ghế
-- --------------------------------------------------------------------

-- roles
DROP POLICY IF EXISTS "Public roles read" ON public.roles;
CREATE POLICY "Public roles read" ON public.roles FOR SELECT USING (true);

-- genres
DROP POLICY IF EXISTS "Public genres read" ON public.genres;
CREATE POLICY "Public genres read" ON public.genres FOR SELECT USING (true);

-- movies (chỉ phim chưa bị xóa mềm)
DROP POLICY IF EXISTS "Public movies read" ON public.movies;
CREATE POLICY "Public movies read" ON public.movies FOR SELECT
  USING (is_deleted = false OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admin movies write" ON public.movies;
CREATE POLICY "Admin movies write" ON public.movies FOR ALL
  USING (public.is_admin_or_staff());

-- movie_genres
DROP POLICY IF EXISTS "Public movie_genres read" ON public.movie_genres;
CREATE POLICY "Public movie_genres read" ON public.movie_genres FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin movie_genres write" ON public.movie_genres;
CREATE POLICY "Admin movie_genres write" ON public.movie_genres FOR ALL
  USING (public.is_admin_or_staff());

-- cinemas (chỉ rạp đang hoạt động)
DROP POLICY IF EXISTS "Public cinemas read" ON public.cinemas;
CREATE POLICY "Public cinemas read" ON public.cinemas FOR SELECT
  USING (is_active = true OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admin cinemas write" ON public.cinemas;
CREATE POLICY "Admin cinemas write" ON public.cinemas FOR ALL
  USING (public.is_admin());

-- rooms
DROP POLICY IF EXISTS "Public rooms read" ON public.rooms;
CREATE POLICY "Public rooms read" ON public.rooms FOR SELECT
  USING (status = 'ACTIVE' OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admin rooms write" ON public.rooms;
CREATE POLICY "Admin rooms write" ON public.rooms FOR ALL
  USING (public.is_admin());

-- seat_types
DROP POLICY IF EXISTS "Public seat_types read" ON public.seat_types;
CREATE POLICY "Public seat_types read" ON public.seat_types FOR SELECT USING (true);

-- seats
DROP POLICY IF EXISTS "Public seats read" ON public.seats;
CREATE POLICY "Public seats read" ON public.seats FOR SELECT
  USING (is_active = true OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admin seats write" ON public.seats;
CREATE POLICY "Admin seats write" ON public.seats FOR ALL
  USING (public.is_admin());

-- showtimes (chỉ suất chưa bị hủy)
DROP POLICY IF EXISTS "Public showtimes read" ON public.showtimes;
CREATE POLICY "Public showtimes read" ON public.showtimes FOR SELECT
  USING (status != 'CANCELLED' OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admin showtimes write" ON public.showtimes;
CREATE POLICY "Admin showtimes write" ON public.showtimes FOR ALL
  USING (public.is_admin_or_staff());

-- showtime_prices
DROP POLICY IF EXISTS "Public showtime_prices read" ON public.showtime_prices;
CREATE POLICY "Public showtime_prices read" ON public.showtime_prices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin showtime_prices write" ON public.showtime_prices;
CREATE POLICY "Admin showtime_prices write" ON public.showtime_prices FOR ALL
  USING (public.is_admin_or_staff());

-- food_items (chỉ món đang hoạt động)
DROP POLICY IF EXISTS "Public food_items read" ON public.food_items;
CREATE POLICY "Public food_items read" ON public.food_items FOR SELECT
  USING (is_active = true OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admin food_items write" ON public.food_items;
CREATE POLICY "Admin food_items write" ON public.food_items FOR ALL
  USING (public.is_admin_or_staff());

-- promotions (chỉ khuyến mãi đang hoạt động)
DROP POLICY IF EXISTS "Public promotions read" ON public.promotions;
CREATE POLICY "Public promotions read" ON public.promotions FOR SELECT
  USING (is_active = true OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admin promotions write" ON public.promotions;
CREATE POLICY "Admin promotions write" ON public.promotions FOR ALL
  USING (public.is_admin());

-- --------------------------------------------------------------------
-- NHÓM 2: DỮ LIỆU CÁ NHÂN & GIAO DỊCH (Bảo mật theo User)
-- --------------------------------------------------------------------

-- users
DROP POLICY IF EXISTS "Users read own profile" ON public.users;
CREATE POLICY "Users read own profile" ON public.users FOR SELECT
  USING (id = auth.uid() OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Users update own profile" ON public.users;
CREATE POLICY "Users update own profile" ON public.users FOR UPDATE
  USING (id = auth.uid() OR public.is_admin());

-- bookings
DROP POLICY IF EXISTS "Users view own bookings" ON public.bookings;
CREATE POLICY "Users view own bookings" ON public.bookings FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Users create bookings" ON public.bookings;
CREATE POLICY "Users create bookings" ON public.bookings FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Users update own bookings" ON public.bookings;
CREATE POLICY "Users update own bookings" ON public.bookings FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin_or_staff());

-- tickets
-- Cho phép đọc trạng thái ghế (HELD/SOLD) để hiển thị sơ đồ ghế lúc chọn, nhưng chỉ chủ đơn/nhân viên xem chi tiết vé
DROP POLICY IF EXISTS "Public read occupied tickets for seat map" ON public.tickets;
CREATE POLICY "Public read occupied tickets for seat map" ON public.tickets FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff and Admin manage tickets" ON public.tickets;
CREATE POLICY "Staff and Admin manage tickets" ON public.tickets FOR ALL
  USING (public.is_admin_or_staff());

-- booking_items
DROP POLICY IF EXISTS "Users view own booking items" ON public.booking_items;
CREATE POLICY "Users view own booking items" ON public.booking_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_items.booking_id AND b.user_id = auth.uid())
    OR public.is_admin_or_staff()
  );

DROP POLICY IF EXISTS "Users insert own booking items" ON public.booking_items;
CREATE POLICY "Users insert own booking items" ON public.booking_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_items.booking_id AND b.user_id = auth.uid())
    OR public.is_admin_or_staff()
  );

-- payments
DROP POLICY IF EXISTS "Users view own payments" ON public.payments;
CREATE POLICY "Users view own payments" ON public.payments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = payments.booking_id AND b.user_id = auth.uid())
    OR public.is_admin_or_staff()
  );

DROP POLICY IF EXISTS "Staff and Admin manage payments" ON public.payments;
CREATE POLICY "Staff and Admin manage payments" ON public.payments FOR ALL
  USING (public.is_admin_or_staff());


-- ====================================================================
-- CINEMAX - BƯỚC 3/5: HÀM DB ATOMIC (STORED PROCEDURES / RPC)
-- Đảm bảo toàn vẹn nghiệp vụ: Giữ ghế 10p, Thanh toán, Hủy vé, Soát vé
-- ====================================================================

-- 1. HÀM GIỮ GHẾ VÀ TẠO ĐƠN (Atomic Hold Seats)
-- Đảm bảo trong 1 transaction: kiểm tra ghế trống, tạo booking PENDING (hết hạn 10 phút), tạo tickets HELD
CREATE OR REPLACE FUNCTION public.hold_seats_and_create_booking(
  p_showtime_id bigint,
  p_seat_ids int[],
  p_user_id uuid,
  p_contact_email text,
  p_contact_phone text
)
RETURNS jsonb AS $$
DECLARE
  v_showtime record;
  v_seat record;
  v_booking_id bigint;
  v_booking_code text;
  v_ticket_code text;
  v_price numeric(12,0);
  v_subtotal numeric(12,0) := 0;
  v_expires_at timestamptz;
  v_conflict_count int;
  v_seat_id int;
BEGIN
  -- 1. Kiểm tra suất chiếu hợp lệ
  SELECT * INTO v_showtime 
  FROM public.showtimes 
  WHERE id = p_showtime_id AND status = 'OPEN';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suất chiếu không tồn tại hoặc đã đóng' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Kiểm tra xung đột ghế (đã có vé HELD, SOLD, USED của suất này)
  SELECT count(*) INTO v_conflict_count
  FROM public.tickets
  WHERE showtime_id = p_showtime_id
    AND seat_id = ANY(p_seat_ids)
    AND status IN ('HELD', 'SOLD', 'USED');

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Một hoặc nhiều ghế bạn chọn vừa có người đặt. Vui lòng chọn ghế khác!' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Tạo mã booking_code ngẫu nhiên (ví dụ: CMX849201)
  v_booking_code := 'CMX' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 7));
  v_expires_at := NOW() + INTERVAL '10 minutes';

  -- 4. Tạo bản ghi bookings PENDING
  INSERT INTO public.bookings (
    booking_code,
    user_id,
    showtime_id,
    ticket_subtotal,
    food_subtotal,
    discount_amount,
    total_amount,
    status,
    expires_at,
    contact_email,
    contact_phone,
    created_at,
    updated_at
  ) VALUES (
    v_booking_code,
    p_user_id,
    p_showtime_id,
    0,
    0,
    0,
    0,
    'PENDING',
    v_expires_at,
    p_contact_email,
    p_contact_phone,
    NOW(),
    NOW()
  ) RETURNING id INTO v_booking_id;

  -- 5. Lặp qua từng ghế để tính giá và tạo vé HELD
  FOREACH v_seat_id IN ARRAY p_seat_ids
  LOOP
    -- Tìm loại ghế
    SELECT s.id, s.seat_type_id INTO v_seat
    FROM public.seats s
    WHERE s.id = v_seat_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ghế ID % không tồn tại', v_seat_id USING ERRCODE = 'P0003';
    END IF;

    -- Lấy giá vé theo suất chiếu và loại ghế
    SELECT price INTO v_price
    FROM public.showtime_prices
    WHERE showtime_id = p_showtime_id AND seat_type_id = v_seat.seat_type_id;

    IF v_price IS NULL THEN
      -- Nếu chưa set giá chi tiết thì fallback giá mặc định 90.000đ
      v_price := 90000;
    END IF;

    v_ticket_code := 'TK' || upper(substring(md5(random()::text || clock_timestamp()::text || v_seat_id::text) from 1 for 10));

    -- Tạo vé
    INSERT INTO public.tickets (
      booking_id,
      showtime_id,
      seat_id,
      ticket_code,
      price,
      status,
      created_at
    ) VALUES (
      v_booking_id,
      p_showtime_id,
      v_seat_id,
      v_ticket_code,
      v_price,
      'HELD',
      NOW()
    );

    v_subtotal := v_subtotal + v_price;
  END LOOP;

  -- 6. Cập nhật lại tổng tiền vé vào booking
  UPDATE public.bookings
  SET 
    ticket_subtotal = v_subtotal,
    total_amount = v_subtotal,
    updated_at = NOW()
  WHERE id = v_booking_id;

  RETURN jsonb_build_object(
    'booking_id', v_booking_id,
    'booking_code', v_booking_code,
    'expires_at', v_expires_at,
    'ticket_subtotal', v_subtotal,
    'total_amount', v_subtotal
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. HÀM CHỌN BẮP NƯỚC / COMBO (Add Booking Foods)
CREATE OR REPLACE FUNCTION public.add_booking_foods(
  p_booking_id bigint,
  p_items jsonb, -- Mảng object: [{"food_item_id": 1, "quantity": 2}, ...]
  p_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_booking record;
  v_item record;
  v_unit_price numeric(12,0);
  v_food_subtotal numeric(12,0) := 0;
  v_total numeric(12,0);
BEGIN
  -- Kiểm tra booking
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id AND user_id = p_user_id AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Đơn hàng không tồn tại hoặc đã hết hạn' USING ERRCODE = 'P0004';
  END IF;

  -- Xóa các combo đã chọn trước đó (nếu chọn lại)
  DELETE FROM public.booking_items WHERE booking_id = p_booking_id;

  -- Thêm từng món
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(food_item_id int, quantity smallint)
  LOOP
    IF v_item.quantity > 0 THEN
      SELECT price INTO v_unit_price FROM public.food_items WHERE id = v_item.food_item_id;
      IF v_unit_price IS NOT NULL THEN
        INSERT INTO public.booking_items (booking_id, food_item_id, quantity, unit_price)
        VALUES (p_booking_id, v_item.food_item_id, v_item.quantity, v_unit_price);

        v_food_subtotal := v_food_subtotal + (v_unit_price * v_item.quantity);
      END IF;
    END IF;
  END LOOP;

  -- Tính lại total_amount
  v_total := v_booking.ticket_subtotal + v_food_subtotal - v_booking.discount_amount;
  IF v_total < 0 THEN v_total := 0; END IF;

  UPDATE public.bookings
  SET 
    food_subtotal = v_food_subtotal,
    total_amount = v_total,
    updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'food_subtotal', v_food_subtotal,
    'total_amount', v_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. HÀM ÁP MÃ KHUYẾN MÃI (Apply Promotion)
CREATE OR REPLACE FUNCTION public.apply_booking_promotion(
  p_booking_id bigint,
  p_promo_code text,
  p_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_booking record;
  v_promo record;
  v_user_usage_count int;
  v_subtotal numeric(12,0);
  v_discount numeric(12,0) := 0;
  v_total numeric(12,0);
BEGIN
  -- Lấy booking
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id AND user_id = p_user_id AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Đơn hàng không tồn tại hoặc đã hết hạn' USING ERRCODE = 'P0005';
  END IF;

  -- Lấy thông tin mã khuyến mãi
  SELECT * INTO v_promo
  FROM public.promotions
  WHERE code = upper(p_promo_code)
    AND is_active = true
    AND NOW() BETWEEN valid_from AND valid_to;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mã khuyến mãi không hợp lệ hoặc đã hết hạn' USING ERRCODE = 'P0006';
  END IF;

  v_subtotal := v_booking.ticket_subtotal + v_booking.food_subtotal;

  IF v_subtotal < v_promo.min_order THEN
    RAISE EXCEPTION 'Đơn hàng chưa đạt giá trị tối thiểu % VND để áp dụng mã này', v_promo.min_order USING ERRCODE = 'P0007';
  END IF;

  IF v_promo.usage_limit IS NOT NULL AND v_promo.used_count >= v_promo.usage_limit THEN
    RAISE EXCEPTION 'Mã khuyến mãi đã hết lượt sử dụng' USING ERRCODE = 'P0008';
  END IF;

  -- Kiểm tra số lần dùng của user này
  SELECT count(*) INTO v_user_usage_count
  FROM public.bookings
  WHERE user_id = p_user_id AND promotion_id = v_promo.id AND status = 'PAID';

  IF v_user_usage_count >= v_promo.per_user_limit THEN
    RAISE EXCEPTION 'Bạn đã dùng hết số lượt cho phép của mã này' USING ERRCODE = 'P0009';
  END IF;

  -- Tính mức giảm
  IF v_promo.discount_type = 'PERCENT' THEN
    v_discount := floor(v_subtotal * v_promo.discount_value / 100);
    IF v_promo.max_discount IS NOT NULL AND v_discount > v_promo.max_discount THEN
      v_discount := v_promo.max_discount;
    END IF;
  ELSE
    v_discount := v_promo.discount_value;
  END IF;

  v_total := v_subtotal - v_discount;
  IF v_total < 0 THEN v_total := 0; END IF;

  UPDATE public.bookings
  SET 
    promotion_id = v_promo.id,
    discount_amount = v_discount,
    total_amount = v_total,
    updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'discount_amount', v_discount,
    'total_amount', v_total,
    'promo_code', v_promo.code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. HÀM XÁC NHẬN THANH TOÁN (Atomic Confirm Payment)
CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  p_booking_id bigint,
  p_payment_method public.payment_method_t,
  p_transaction_ref text,
  p_gateway_response jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_booking record;
  v_payment_id bigint;
BEGIN
  -- Khóa dòng booking để tránh race-condition callback kép
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy đơn hàng' USING ERRCODE = 'P0010';
  END IF;

  IF v_booking.status = 'PAID' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Đơn hàng đã được thanh toán trước đó');
  END IF;

  IF v_booking.status != 'PENDING' THEN
    RAISE EXCEPTION 'Đơn hàng đã bị hủy hoặc hết hạn, không thể thanh toán' USING ERRCODE = 'P0011';
  END IF;

  -- 1. Ghi bản ghi thanh toán SUCCESS
  INSERT INTO public.payments (
    booking_id,
    method,
    amount,
    status,
    transaction_ref,
    gateway_response,
    paid_at,
    created_at
  ) VALUES (
    p_booking_id,
    p_payment_method,
    v_booking.total_amount,
    'SUCCESS',
    p_transaction_ref,
    p_gateway_response,
    NOW(),
    NOW()
  ) RETURNING id INTO v_payment_id;

  -- 2. Chuyển trạng thái booking sang PAID
  UPDATE public.bookings
  SET status = 'PAID', updated_at = NOW()
  WHERE id = p_booking_id;

  -- 3. Chuyển toàn bộ vé sang SOLD
  UPDATE public.tickets
  SET status = 'SOLD'
  WHERE booking_id = p_booking_id;

  -- 4. Tăng số lần sử dụng của promotion (nếu có)
  IF v_booking.promotion_id IS NOT NULL THEN
    UPDATE public.promotions
    SET used_count = used_count + 1
    WHERE id = v_booking.promotion_id;
  END IF;

  -- 5. Cộng điểm tích lũy thành viên (10.000đ = 1 điểm)
  UPDATE public.users
  SET loyalty_points = loyalty_points + floor(v_booking.total_amount / 10000)::int
  WHERE id = v_booking.user_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'booking_code', v_booking.booking_code,
    'payment_id', v_payment_id,
    'status', 'PAID'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. HÀM HỦY ĐƠN VÉ (Cancel Booking & Release Seats)
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id bigint,
  p_user_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_booking record;
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id AND user_id = p_user_id AND status = 'PENDING';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Hủy vé -> partial index uq_tickets_active_seat tự động nhả ghế
  UPDATE public.tickets
  SET status = 'CANCELLED'
  WHERE booking_id = p_booking_id;

  UPDATE public.bookings
  SET status = 'CANCELLED', updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. HÀM QUÉT SOÁT VÉ QR (Staff Check-in)
CREATE OR REPLACE FUNCTION public.checkin_ticket(
  p_ticket_code text
)
RETURNS jsonb AS $$
DECLARE
  v_ticket record;
  v_movie_title text;
  v_cinema_name text;
  v_room_name text;
  v_start_time timestamptz;
BEGIN
  -- Chỉ STAFF hoặc ADMIN được soát vé
  IF NOT public.is_admin_or_staff() THEN
    RAISE EXCEPTION 'Chỉ nhân viên hoặc quản trị viên mới có quyền soát vé' USING ERRCODE = 'P0012';
  END IF;

  SELECT t.*, s.start_time, m.title AS movie_title, c.name AS cinema_name, r.name AS room_name
  INTO v_ticket
  FROM public.tickets t
  JOIN public.showtimes s ON t.showtime_id = s.id
  JOIN public.movies m ON s.movie_id = m.id
  JOIN public.rooms r ON s.room_id = r.id
  JOIN public.cinemas c ON r.cinema_id = c.id
  WHERE t.ticket_code = p_ticket_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mã vé không tồn tại trong hệ thống' USING ERRCODE = 'P0013';
  END IF;

  IF v_ticket.status = 'USED' THEN
    RAISE EXCEPTION 'Vé này ĐÃ ĐƯỢC SỬ DỤNG lúc %', v_ticket.checked_in_at USING ERRCODE = 'P0014';
  END IF;

  IF v_ticket.status != 'SOLD' THEN
    RAISE EXCEPTION 'Vé chưa hợp lệ hoặc đã bị hủy (Trạng thái: %)', v_ticket.status USING ERRCODE = 'P0015';
  END IF;

  -- Cập nhật vé sang USED
  UPDATE public.tickets
  SET status = 'USED', checked_in_at = NOW()
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_code', p_ticket_code,
    'movie_title', v_ticket.movie_title,
    'cinema_name', v_ticket.cinema_name,
    'room_name', v_ticket.room_name,
    'start_time', v_ticket.start_time,
    'checked_in_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================================================
-- CINEMAX - BƯỚC 4/5: DỌN DẸP ĐƠN HẾT HẠN GIỮ GHẾ 10 PHÚT
-- ====================================================================

-- 1. Hàm dọn dẹp các đơn PENDING quá expires_at
CREATE OR REPLACE FUNCTION public.cleanup_expired_bookings()
RETURNS int AS $$
DECLARE
  v_count int := 0;
BEGIN
  -- Bước 1: Chuyển vé của các đơn hết hạn sang CANCELLED để nhả ghế tức thì
  UPDATE public.tickets
  SET status = 'CANCELLED'
  WHERE status = 'HELD'
    AND booking_id IN (
      SELECT id FROM public.bookings
      WHERE status = 'PENDING' AND expires_at < NOW()
    );

  -- Bước 2: Chuyển trạng thái đơn sang EXPIRED
  WITH expired_rows AS (
    UPDATE public.bookings
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE status = 'PENDING' AND expires_at < NOW()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM expired_rows;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_expired_bookings() IS 'Hàm quét và giải phóng các ghế giữ tạm (HELD) khi đơn PENDING vượt quá expires_at (10 phút)';

-- 2. Tự động chạy định kỳ mỗi phút bằng pg_cron (nếu extension pg_cron đã được bật)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Hủy cron job cũ nếu có
    PERFORM cron.unschedule('cinemax_cleanup_expired_bookings');
    -- Đăng ký job chạy mỗi phút
    PERFORM cron.schedule(
      'cinemax_cleanup_expired_bookings',
      '* * * * *',
      'SELECT public.cleanup_expired_bookings();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Nếu pg_cron chưa bật trong project, bỏ qua không báo lỗi
  RAISE NOTICE 'pg_cron chưa được cấu hình, có thể gọi cleanup_expired_bookings() thủ công hoặc qua Supabase Edge Function cron.';
END;
$$;


-- ====================================================================
-- CINEMAX - BƯỚC 5/5: DỮ LIỆU MẪU ĐẦY ĐỦ (SEED DATA)
-- Thể loại, Phim, Rạp, Phòng chiếu, Sơ đồ ghế, Suất chiếu + Giá, Bắp nước, Mã giảm giá
-- ====================================================================

-- 1. THỂ LOẠI PHIM (Genres)
INSERT INTO public.genres (name, slug) VALUES
  ('Hành Động', 'hanh-dong'),
  ('Khoa Học Viễn Tưởng', 'khoa-hoc-vien-tuong'),
  ('Hoạt Hình', 'hoat-hinh'),
  ('Phiêu Lưu', 'phieu-luu'),
  ('Kinh Dị', 'kinh-di'),
  ('Hài Kịch', 'hai-kich'),
  ('Tâm Lý - Tình Cảm', 'tam-ly-tinh-cam'),
  ('Giật Gân', 'giat-gan'),
  ('Gia Đình', 'gia-dinh')
ON CONFLICT (slug) DO NOTHING;


-- 2. PHIM (Movies)
INSERT INTO public.movies (
  title, original_title, slug, synopsis, duration_min, release_date, end_date,
  age_rating, country, director, cast_list, poster_url, banner_url, trailer_url, imdb_score, status, is_deleted
) VALUES
(
  'Dune: Hành Tinh Cát - Phần 2',
  'Dune: Part Two',
  'dune-hanh-tinh-cat-phan-2',
  'Paul Atreides hợp lực cùng Chani và tộc người Fremen để trả thù những kẻ đã hủy hoại gia đình anh, đồng thời nỗ lực ngăn chặn viễn cảnh tương lai tăm tối mà chỉ mình anh có thể thấy trước.',
  166,
  CURRENT_DATE - INTERVAL '15 days',
  CURRENT_DATE + INTERVAL '30 days',
  'T16',
  'Mỹ',
  'Denis Villeneuve',
  'Timothée Chalamet, Zendaya, Rebecca Ferguson, Javier Bardem, Austin Butler',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1440&q=80',
  'https://www.youtube.com/watch?v=Way9Dexny3w',
  8.6,
  'NOW_SHOWING',
  false
),
(
  'Mai',
  'Mai',
  'mai',
  'Mai là một phụ nữ ngoài 30 tuổi với quá khứ nhiều tổn thương, làm nghề mát-xa trị liệu. Khi gặp Dương - một chàng trai trẻ phóng khoáng, tình yêu chân thành bắt đầu nảy nở giữa định kiến xã hội.',
  131,
  CURRENT_DATE - INTERVAL '20 days',
  CURRENT_DATE + INTERVAL '25 days',
  'T18',
  'Việt Nam',
  'Trấn Thành',
  'Phương Anh Đào, Tuấn Trần, Trấn Thành, Hồng Đào, Uyển Ân',
  'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1440&q=80',
  'https://www.youtube.com/watch?v=0j3Qk04_1eQ',
  7.3,
  'NOW_SHOWING',
  false
),
(
  'Godzilla x Kong: Đế Chế Mới',
  'Godzilla x Kong: The New Empire',
  'godzilla-x-kong-de-che-moi',
  'Một mối hiểm họa khổng lồ chưa từng thấy xuất hiện từ lòng Trái Đất rỗng, buộc hai quái thú huyền thoại Godzilla và Kong phải liên minh sát cánh bảo vệ nhân loại.',
  115,
  CURRENT_DATE - INTERVAL '10 days',
  CURRENT_DATE + INTERVAL '35 days',
  'T13',
  'Mỹ',
  'Adam Wingard',
  'Rebecca Hall, Brian Tyree Henry, Dan Stevens, Kaylee Hottle',
  'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1440&q=80',
  'https://www.youtube.com/watch?v=lV1OOlGwExg',
  6.5,
  'NOW_SHOWING',
  false
),
(
  'Kung Fu Panda 4',
  'Kung Fu Panda 4',
  'kung-fu-panda-4',
  'Gấu Po chuẩn bị trở thành Thủ lĩnh Tinh thần của Thung lũng Bình Yên và cần tìm một Thần Long Đại Hiệp kế vị, đồng thời phải đối đầu với mụ phù thủy biến hình Tắc Kè Bông xảo quyệt.',
  94,
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE + INTERVAL '40 days',
  'P',
  'Mỹ',
  'Mike Mitchell',
  'Jack Black, Awkwafina, Viola Davis, Dustin Hoffman, James Hong',
  'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1440&q=80',
  'https://www.youtube.com/watch?v=_inKs4eeHiI',
  6.4,
  'NOW_SHOWING',
  false
),
(
  'Lật Mặt 7: Một Điều Ước',
  'Face Off 7: One Wish',
  'lat-mat-7-mot-dieu-uoc',
  'Câu chuyện cảm động về người mẹ già 73 tuổi một mình nuôi 5 người con khôn lớn. Khi bà gặp nạn, 5 người con ở 5 nơi khác nhau phải đối mặt với thử thách về chữ hiếu.',
  138,
  CURRENT_DATE - INTERVAL '2 days',
  CURRENT_DATE + INTERVAL '45 days',
  'K',
  'Việt Nam',
  'Lý Hải',
  'Thanh Hiền, Trương Minh Cường, Đinh Y Nhung, Quách Ngọc Tuyên, Trâm Anh',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1440&q=80',
  'https://www.youtube.com/watch?v=d_kS_Z9k2lY',
  7.6,
  'NOW_SHOWING',
  false
),
(
  'Deadpool & Wolverine',
  'Deadpool & Wolverine',
  'deadpool-va-wolverine',
  'Thánh bựa Deadpool chính thức gia nhập MCU và lôi kéo Wolverine đang chán nản cùng thực hiện một nhiệm vụ sống còn cứu vãn dòng thời gian.',
  127,
  CURRENT_DATE + INTERVAL '10 days',
  CURRENT_DATE + INTERVAL '60 days',
  'T18',
  'Mỹ',
  'Shawn Levy',
  'Ryan Reynolds, Hugh Jackman, Emma Corrin, Morena Baccarin',
  'https://images.unsplash.com/photo-1534809027769-b00d750a6bac?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&w=1440&q=80',
  'https://www.youtube.com/watch?v=73_1biulkYk',
  7.9,
  'COMING_SOON',
  false
),
(
  'Inside Out 2: Những Mảnh Ghép Cảm Xúc',
  'Inside Out 2',
  'inside-out-2-nhung-manh-ghep-cam-xuc',
  'Cô bé Riley bước vào tuổi dậy thì, kéo theo sự xuất hiện của những cảm xúc mới tinh như Lo Âu (Anxiety), Ghen Tị (Envy), Xấu Hổ (Embarrassment) náo loạn trung tâm điều khiển não bộ.',
  100,
  CURRENT_DATE + INTERVAL '14 days',
  CURRENT_DATE + INTERVAL '60 days',
  'P',
  'Mỹ',
  'Kelsey Mann',
  'Amy Poehler, Maya Hawke, Kensington Tallman, Liza Lapira',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1440&q=80',
  'https://www.youtube.com/watch?v=LEjhY15eCx0',
  7.7,
  'COMING_SOON',
  false
)
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  synopsis = EXCLUDED.synopsis,
  imdb_score = EXCLUDED.imdb_score,
  status = EXCLUDED.status;


-- 3. GẮN THỂ LOẠI CHO PHIM (Movie Genres)
INSERT INTO public.movie_genres (movie_id, genre_id)
SELECT m.id, g.id
FROM public.movies m, public.genres g
WHERE 
  (m.slug = 'dune-hanh-tinh-cat-phan-2' AND g.slug IN ('hanh-dong', 'khoa-hoc-vien-tuong', 'phieu-luu'))
  OR (m.slug = 'mai' AND g.slug IN ('tam-ly-tinh-cam', 'hai-kich'))
  OR (m.slug = 'godzilla-x-kong-de-che-moi' AND g.slug IN ('hanh-dong', 'khoa-hoc-vien-tuong', 'phieu-luu'))
  OR (m.slug = 'kung-fu-panda-4' AND g.slug IN ('hoat-hinh', 'hai-kich', 'gia-dinh'))
  OR (m.slug = 'lat-mat-7-mot-dieu-uoc' AND g.slug IN ('gia-dinh', 'tam-ly-tinh-cam'))
  OR (m.slug = 'deadpool-va-wolverine' AND g.slug IN ('hanh-dong', 'hai-kich', 'khoa-hoc-vien-tuong'))
  OR (m.slug = 'inside-out-2-nhung-manh-ghep-cam-xuc' AND g.slug IN ('hoat-hinh', 'gia-dinh', 'hai-kich'))
ON CONFLICT DO NOTHING;


-- 4. DANH SÁCH RẠP CHIẾU (Cinemas)
INSERT INTO public.cinemas (name, address, district, city, latitude, longitude, phone, image_url, is_active) VALUES
(
  'CINEMAX Landmark 81',
  'Tầng B1, TTTM Vincom Center Landmark 81, 720A Điện Biên Phủ, Phường 22',
  'Quận Bình Thạnh',
  'TP. Hồ Chí Minh',
  10.795200,
  106.721800,
  '028 3622 8181',
  'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80',
  true
),
(
  'CINEMAX Đồng Khởi',
  'Tầng 3, Vincom Center Đồng Khởi, 72 Lê Thánh Tôn, Phường Bến Nghé',
  'Quận 1',
  'TP. Hồ Chí Minh',
  10.778100,
  106.702000,
  '028 3822 5599',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
  true
),
(
  'CINEMAX Metropolis Liễu Giai',
  'Tầng 3, Vincom Center Metropolis, 29 Liễu Giai, Phường Ngọc Khánh',
  'Quận Ba Đình',
  'Hà Nội',
  21.033600,
  105.814500,
  '024 3974 8899',
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
  true
),
(
  'CINEMAX Royal City',
  'Tầng B2, Vincom Mega Mall Royal City, 72A Nguyễn Trãi, Phường Thượng Đình',
  'Quận Thanh Xuân',
  'Hà Nội',
  20.999600,
  105.815300,
  '024 6664 2233',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
  true
),
(
  'CINEMAX Sông Hàn',
  'Tầng 4, Vincom Plaza Ngô Quyền, 910A Ngô Quyền, Phường An Hải Bắc',
  'Quận Sơn Trà',
  'Đà Nẵng',
  16.071200,
  108.232500,
  '0236 3996 688',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
  true
)
ON CONFLICT DO NOTHING;


-- 5. PHÒNG CHIẾU (Rooms)
INSERT INTO public.rooms (cinema_id, name, screen_type, total_rows, total_cols, status)
SELECT c.id, r.name, r.screen_type::public.screen_type_t, r.total_rows, r.total_cols, 'ACTIVE'::public.room_status_t
FROM public.cinemas c
CROSS JOIN (
  VALUES 
    ('Phòng 01 - IMAX Laser', 'IMAX', 8, 12),
    ('Phòng 02 - Cinema Gold', '2D', 7, 10),
    ('Phòng 03 - 3D Atmos', '3D', 7, 10)
) AS r(name, screen_type, total_rows, total_cols)
ON CONFLICT (cinema_id, name) DO NOTHING;


-- 6. SƠ ĐỒ GHẾ CHI TIẾT (Seats for each room)
-- Tạo ma trận ghế tự động cho các phòng:
-- Hàng A, B: Standard (Ghế thường)
-- Hàng C, D, E, F: VIP (Ghế VIP - màu vàng gold)
-- Hàng G: Couple (Ghế đôi - màu hồng)
DO $$
DECLARE
  v_room record;
  v_standard_id smallint;
  v_vip_id smallint;
  v_couple_id smallint;
  v_row_char text;
  v_row_idx int;
  v_col_idx int;
  v_type_id smallint;
  v_seat_num int;
BEGIN
  SELECT id INTO v_standard_id FROM public.seat_types WHERE code = 'STANDARD';
  SELECT id INTO v_vip_id FROM public.seat_types WHERE code = 'VIP';
  SELECT id INTO v_couple_id FROM public.seat_types WHERE code = 'COUPLE';

  FOR v_room IN SELECT id, total_rows, total_cols FROM public.rooms
  LOOP
    -- Chỉ sinh ghế nếu phòng đó chưa có ghế nào
    IF NOT EXISTS (SELECT 1 FROM public.seats WHERE room_id = v_room.id) THEN
      FOR v_row_idx IN 1..v_room.total_rows
      LOOP
        v_row_char := chr(64 + v_row_idx); -- 1 -> 'A', 2 -> 'B', etc.
        
        -- Phân loại ghế theo hàng
        IF v_row_idx = v_room.total_rows THEN
          v_type_id := v_couple_id; -- Hàng cuối là ghế đôi
        ELSIF v_row_idx >= 3 THEN
          v_type_id := v_vip_id; -- Hàng giữa là VIP
        ELSE
          v_type_id := v_standard_id; -- 2 hàng đầu là Standard
        END IF;

        IF v_type_id = v_couple_id THEN
          -- Ghế đôi chiếm 2 ô hiển thị, bước nhảy cột = 2
          v_seat_num := 1;
          FOR v_col_idx IN 1..(v_room.total_cols / 2)
          LOOP
            INSERT INTO public.seats (
              room_id, seat_type_id, row_label, seat_number, grid_row, grid_col, is_active
            ) VALUES (
              v_room.id, v_couple_id, v_row_char, v_seat_num, v_row_idx, (v_col_idx * 2 - 1), true
            );
            v_seat_num := v_seat_num + 1;
          END LOOP;
        ELSE
          -- Ghế đơn bình thường
          FOR v_col_idx IN 1..v_room.total_cols
          LOOP
            INSERT INTO public.seats (
              room_id, seat_type_id, row_label, seat_number, grid_row, grid_col, is_active
            ) VALUES (
              v_room.id, v_type_id, v_row_char, v_col_idx, v_row_idx, v_col_idx, true
            );
          END LOOP;
        END IF;

      END LOOP;
    END IF;
  END LOOP;
END;
$$;


-- 7. SUẤT CHIẾU (Showtimes cho 3 ngày tới)
-- Suất chiếu không giao nhau theo ràng buộc showtimes_no_overlap
DO $$
DECLARE
  v_dune_id bigint;
  v_mai_id bigint;
  v_godzilla_id bigint;
  v_panda_id bigint;
  v_latmat_id bigint;
  v_room_imax int;
  v_room_2d int;
  v_day_offset int;
  v_base_date date;
  v_st_id bigint;
BEGIN
  SELECT id INTO v_dune_id FROM public.movies WHERE slug = 'dune-hanh-tinh-cat-phan-2';
  SELECT id INTO v_mai_id FROM public.movies WHERE slug = 'mai';
  SELECT id INTO v_godzilla_id FROM public.movies WHERE slug = 'godzilla-x-kong-de-che-moi';
  SELECT id INTO v_panda_id FROM public.movies WHERE slug = 'kung-fu-panda-4';
  SELECT id INTO v_latmat_id FROM public.movies WHERE slug = 'lat-mat-7-mot-dieu-uoc';

  -- Lấy phòng mẫu tại rạp 1 (Landmark 81)
  SELECT id INTO v_room_imax FROM public.rooms WHERE name LIKE '%IMAX%' LIMIT 1;
  SELECT id INTO v_room_2d FROM public.rooms WHERE name LIKE '%Gold%' LIMIT 1;

  IF v_room_imax IS NOT NULL AND v_dune_id IS NOT NULL THEN
    FOR v_day_offset IN 0..2
    LOOP
      v_base_date := CURRENT_DATE + (v_day_offset || ' days')::interval;

      -- Suất 1: 09:30 - 12:30 (Dune IMAX)
      INSERT INTO public.showtimes (movie_id, room_id, start_time, end_time, language_type, status)
      VALUES (v_dune_id, v_room_imax, v_base_date + TIME '09:30:00', v_base_date + TIME '12:30:00', 'SUBTITLED', 'OPEN')
      RETURNING id INTO v_st_id;

      -- Suất 2: 13:15 - 16:15 (Dune IMAX)
      INSERT INTO public.showtimes (movie_id, room_id, start_time, end_time, language_type, status)
      VALUES (v_dune_id, v_room_imax, v_base_date + TIME '13:15:00', v_base_date + TIME '16:15:00', 'SUBTITLED', 'OPEN');

      -- Suất 3: 17:00 - 19:15 (Godzilla IMAX)
      INSERT INTO public.showtimes (movie_id, room_id, start_time, end_time, language_type, status)
      VALUES (v_godzilla_id, v_room_imax, v_base_date + TIME '17:00:00', v_base_date + TIME '19:15:00', 'SUBTITLED', 'OPEN');

      -- Suất 4: 20:00 - 23:00 (Dune IMAX)
      INSERT INTO public.showtimes (movie_id, room_id, start_time, end_time, language_type, status)
      VALUES (v_dune_id, v_room_imax, v_base_date + TIME '20:00:00', v_base_date + TIME '23:00:00', 'SUBTITLED', 'OPEN');

      -- Suất ở phòng 2D:
      -- Suất 1: 10:00 - 12:30 (Mai)
      INSERT INTO public.showtimes (movie_id, room_id, start_time, end_time, language_type, status)
      VALUES (v_mai_id, v_room_2d, v_base_date + TIME '10:00:00', v_base_date + TIME '12:30:00', 'ORIGINAL', 'OPEN');

      -- Suất 2: 13:00 - 14:45 (Kung Fu Panda 4 Lồng Tiếng)
      INSERT INTO public.showtimes (movie_id, room_id, start_time, end_time, language_type, status)
      VALUES (v_panda_id, v_room_2d, v_base_date + TIME '13:00:00', v_base_date + TIME '14:45:00', 'DUBBED', 'OPEN');

      -- Suất 3: 15:30 - 18:00 (Lật Mặt 7)
      INSERT INTO public.showtimes (movie_id, room_id, start_time, end_time, language_type, status)
      VALUES (v_latmat_id, v_room_2d, v_base_date + TIME '15:30:00', v_base_date + TIME '18:00:00', 'ORIGINAL', 'OPEN');

      -- Suất 4: 18:45 - 21:15 (Mai)
      INSERT INTO public.showtimes (movie_id, room_id, start_time, end_time, language_type, status)
      VALUES (v_mai_id, v_room_2d, v_base_date + TIME '18:45:00', v_base_date + TIME '21:15:00', 'ORIGINAL', 'OPEN');

      -- Suất 5: 21:45 - 24:00 (Lật Mặt 7)
      INSERT INTO public.showtimes (movie_id, room_id, start_time, end_time, language_type, status)
      VALUES (v_latmat_id, v_room_2d, v_base_date + TIME '21:45:00', v_base_date + TIME '24:00:00', 'ORIGINAL', 'OPEN');
    END LOOP;
  END IF;
END;
$$;


-- 8. BẢNG GIÁ VÉ CHO CÁC SUẤT CHIẾU (Showtime Prices)
-- Gán giá vé cho từng loại ghế của tất cả suất chiếu hiện có
INSERT INTO public.showtime_prices (showtime_id, seat_type_id, price)
SELECT 
  s.id AS showtime_id,
  st.id AS seat_type_id,
  CASE 
    -- Suất IMAX
    WHEN r.screen_type = 'IMAX' THEN
      CASE 
        WHEN st.code = 'STANDARD' THEN 140000
        WHEN st.code = 'VIP' THEN 180000
        WHEN st.code = 'COUPLE' THEN 320000
      END
    -- Suất 3D
    WHEN r.screen_type = '3D' THEN
      CASE 
        WHEN st.code = 'STANDARD' THEN 110000
        WHEN st.code = 'VIP' THEN 140000
        WHEN st.code = 'COUPLE' THEN 250000
      END
    -- Suất 2D tiêu chuẩn
    ELSE
      CASE 
        WHEN st.code = 'STANDARD' THEN 90000
        WHEN st.code = 'VIP' THEN 115000
        WHEN st.code = 'COUPLE' THEN 210000
      END
  END AS price
FROM public.showtimes s
JOIN public.rooms r ON s.room_id = r.id
CROSS JOIN public.seat_types st
ON CONFLICT (showtime_id, seat_type_id) DO UPDATE
SET price = EXCLUDED.price;


-- 9. ĐỒ ĂN & BẮP NƯỚC (Food Items)
INSERT INTO public.food_items (name, category, description, price, image_url, is_active) VALUES
(
  'Bắp Ngọt Truyền Thống (Lớn)',
  'POPCORN',
  'Bắp rang bơ giòn rụm thơm lừng chuẩn vị rạp chiếu phim',
  65000,
  'https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=400&q=80',
  true
),
(
  'Bắp Phô Mai Thượng Hạng (Lớn)',
  'POPCORN',
  'Bắp rang áo đều lớp bột phô mai béo ngậy, đậm đà',
  75000,
  'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=400&q=80',
  true
),
(
  'Bắp Caramel Đặc Biệt (Lớn)',
  'POPCORN',
  'Bắp ngọt phủ sốt caramel thơm lừng ngọt ngào',
  75000,
  'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=400&q=80',
  true
),
(
  'Pepsi Mát Lạnh (Lớn)',
  'DRINK',
  'Nước ngọt có gas Pepsi 32oz sảng khoái',
  35000,
  'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
  true
),
(
  '7Up Chanh Mát Lạnh (Lớn)',
  'DRINK',
  'Nước giải khát vị chanh thanh mát 32oz',
  35000,
  'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=400&q=80',
  true
),
(
  'Trà Sữa Trân Châu Phô Mai',
  'DRINK',
  'Trà sữa béo ngậy kèm trân châu giòn dai mát lạnh',
  50000,
  'https://images.unsplash.com/photo-1558857563-b37cf5a3bc32?auto=format&fit=crop&w=400&q=80',
  true
),
(
  'Combo Solo Tiết Kiệm',
  'COMBO',
  'Gồm 1 Bắp ngọt (Lớn) + 1 Nước ngọt có gas (Lớn)',
  89000,
  'https://images.unsplash.com/photo-1512149177596-f817c7ef5d4c?auto=format&fit=crop&w=400&q=80',
  true
),
(
  'Combo Couple Ngọt Ngào',
  'COMBO',
  'Gồm 1 Bắp 2 ngăn (Caramel + Phô mai) + 2 Nước ngọt (Lớn)',
  135000,
  'https://images.unsplash.com/photo-1572177812156-58036aae439c?auto=format&fit=crop&w=400&q=80',
  true
),
(
  'Combo Gia Đình Party',
  'COMBO',
  'Gồm 2 Bắp lớn đặc biệt + 4 Nước ngọt + 1 Snack khoai tây chiên',
  229000,
  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=400&q=80',
  true
)
ON CONFLICT DO NOTHING;


-- 10. MÃ KHUYẾN MÃI (Promotions)
INSERT INTO public.promotions (
  code, description, discount_type, discount_value, max_discount, min_order, usage_limit, per_user_limit, used_count, valid_from, valid_to, is_active
) VALUES
(
  'CHAOBANMOI',
  'Giảm 20% tối đa 40.000đ cho khách hàng mới đặt vé xem phim',
  'PERCENT',
  20,
  40000,
  100000,
  1000,
  1,
  0,
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '90 days',
  true
),
(
  'CINEMAX30K',
  'Giảm ngay 30.000đ cho đơn hàng từ 150.000đ trở lên',
  'FIXED',
  30000,
  NULL,
  150000,
  500,
  1,
  0,
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '60 days',
  true
),
(
  'VNPAY20',
  'Giảm 15% tối đa 35.000đ khi thanh toán qua cổng điện tử',
  'PERCENT',
  15,
  35000,
  120000,
  500,
  2,
  0,
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '60 days',
  true
),
(
  'HOCSINHSINHVIEN',
  'Ưu đãi cố định 20.000đ dành cho học sinh, sinh viên yêu điện ảnh',
  'FIXED',
  20000,
  NULL,
  80000,
  NULL,
  5,
  0,
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '180 days',
  true
)
ON CONFLICT (code) DO NOTHING;
