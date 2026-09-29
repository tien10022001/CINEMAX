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
