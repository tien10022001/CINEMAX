-- ============================================================================
-- CINEMAX — SCRIPT MỞ QUYỀN ĐỒNG BỘ SUPABASE (RLS POLICIES & RPC FUNCTIONS)
-- Hướng dẫn: Copy toàn bộ nội dung file này dán vào Supabase Dashboard -> SQL Editor -> Run
-- Project URL: https://supabase.com/dashboard/project/cycuxhztpvezqcznifqh/sql/new
-- ============================================================================

-- 1. Cho phép Web App (anon & authenticated) đọc và ghi đồng bộ trực tiếp trên các bảng vận hành
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'profiles', 'staff_permissions', 'cinema_settings', 'content_items',
    'genres', 'movies', 'movie_genres', 'auditoriums', 'seats', 'showtimes',
    'showtime_prices', 'showtime_seats', 'products', 'product_components',
    'product_modifiers', 'inventory_movements', 'coupons', 'coupon_redemptions',
    'orders', 'order_items', 'tickets', 'order_item_fulfillments',
    'shifts', 'payments', 'refunds', 'invoice_requests', 'support_requests',
    'order_access_challenges', 'audit_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "cinemax_app_full_sync_%I" ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "cinemax_app_full_sync_%I" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      tbl, tbl
    );
  END LOOP;
END $$;

-- 2. Tạo ghế mẫu cho Phòng 2 (IMAX Laser) nếu chưa có ghế trong bảng seats
INSERT INTO public.seats (auditorium_id, row_label, seat_number, grid_row, grid_col, seat_type, seat_group, status)
SELECT
  '28368dd8-750b-40a0-b6bd-3d763bd0c0f5'::uuid,
  r.row_label,
  c.col_num,
  r.row_idx,
  c.col_num,
  CASE
    WHEN r.row_label = 'H' THEN 'COUPLE'::seat_type_t
    WHEN r.row_label IN ('D', 'E', 'F', 'G') THEN 'VIP'::seat_type_t
    ELSE 'STANDARD'::seat_type_t
  END,
  CASE
    WHEN r.row_label = 'H' THEN 'H-' || ((c.col_num + 1) / 2)::text
    ELSE NULL
  END,
  'ACTIVE'::seat_status_t
FROM (
  VALUES ('A', 1), ('B', 2), ('C', 3), ('D', 4), ('E', 5), ('F', 6), ('G', 7), ('H', 8)
) AS r(row_label, row_idx)
CROSS JOIN generate_series(1, 10) AS c(col_num)
ON CONFLICT (auditorium_id, row_label, seat_number) DO NOTHING;

-- 3. Khởi tạo trạng thái ghế (showtime_seats) cho mọi suất chiếu chưa có sơ đồ ghế
INSERT INTO public.showtime_seats (showtime_id, seat_id, status)
SELECT st.id, s.id, 'available'::showtime_seat_status_t
FROM public.showtimes st
JOIN public.seats s ON s.auditorium_id = st.auditorium_id
ON CONFLICT (showtime_id, seat_id) DO NOTHING;

-- 4. Bổ sung bảng giá vé (showtime_prices) cho các suất chiếu còn thiếu
INSERT INTO public.showtime_prices (showtime_id, seat_type, audience_type, price, currency)
SELECT
  st.id,
  p.seat_type::seat_type_t,
  p.audience_type::audience_type_t,
  p.price,
  'VND'
FROM public.showtimes st
CROSS JOIN (
  VALUES
    ('STANDARD', 'ADULT', 85000),
    ('STANDARD', 'STUDENT_U22', 65000),
    ('STANDARD', 'CHILD', 55000),
    ('STANDARD', 'SENIOR', 60000),
    ('VIP', 'ADULT', 105000),
    ('VIP', 'STUDENT_U22', 85000),
    ('VIP', 'CHILD', 75000),
    ('VIP', 'SENIOR', 80000),
    ('COUPLE', 'ADULT', 210000),
    ('COUPLE', 'STUDENT_U22', 170000)
) AS p(seat_type, audience_type, price)
ON CONFLICT (showtime_id, seat_type, audience_type) DO NOTHING;

-- 5. Bật Realtime cho các bảng quan trọng
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.showtime_seats;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.refunds;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
