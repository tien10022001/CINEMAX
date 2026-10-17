-- ====================================================================
-- CINEMAX SUPABASE MIGRATION 06: FULL DATABASE SYNC & DEV POLICIES (FIXED)
-- Tự động bổ sung các cột mở rộng, mở quyền RLS và nạp toàn bộ dữ liệu mẫu thực tế
-- ====================================================================

-- 1. BỔ SUNG CÁC CỘT MỞ RỘNG CHO BẢNG MOVIES (TRÁNH LỖI CỘT KHÔNG TỒN TẠI)
ALTER TABLE public.movies 
    ADD COLUMN IF NOT EXISTS end_date date,
    ADD COLUMN IF NOT EXISTS banner_url text,
    ADD COLUMN IF NOT EXISTS trailer_url text,
    ADD COLUMN IF NOT EXISTS country varchar(100) DEFAULT 'Việt Nam',
    ADD COLUMN IF NOT EXISTS studio varchar(150),
    ADD COLUMN IF NOT EXISTS meta_title varchar(200),
    ADD COLUMN IF NOT EXISTS meta_description text,
    ADD COLUMN IF NOT EXISTS imdb_score numeric(3,1) DEFAULT 8.0,
    ADD COLUMN IF NOT EXISTS formats text[] DEFAULT ARRAY['2D'];

-- 2. ĐẢM BẢO BẢNG THỂ LOẠI ĐẦY ĐỦ
INSERT INTO public.genres (name, slug, active)
VALUES 
    ('Hành Động', 'hanh-dong', true),
    ('Khoa Học Viễn Tưởng', 'khoa-hoc-vien-tuong', true),
    ('Phiêu Lưu', 'phieu-luu', true),
    ('Hài Kịch', 'hai-kich', true),
    ('Kinh Dị', 'kinh-di', true),
    ('Tâm Lý', 'tam-ly', true),
    ('Hoạt Hình', 'hoat-hinh', true),
    ('Tình Cảm', 'tinh-cam', true),
    ('Gia Đình', 'gia-dinh', true),
    ('Tài Liệu', 'tai-lieu', true)
ON CONFLICT (slug) DO NOTHING;

-- 3. MỞ QUYỀN TRUY CẬP RLS ĐỂ ADMIN WEB CÓ THỂ ĐỌC/GHI VÀO SUPABASE
DROP POLICY IF EXISTS "dev_anon_movies_all" ON public.movies;
CREATE POLICY "dev_anon_movies_all" ON public.movies FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_auditoriums_all" ON public.auditoriums;
CREATE POLICY "dev_anon_auditoriums_all" ON public.auditoriums FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_seats_all" ON public.seats;
CREATE POLICY "dev_anon_seats_all" ON public.seats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_showtimes_all" ON public.showtimes;
CREATE POLICY "dev_anon_showtimes_all" ON public.showtimes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_showtime_prices_all" ON public.showtime_prices;
CREATE POLICY "dev_anon_showtime_prices_all" ON public.showtime_prices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_showtime_seats_all" ON public.showtime_seats;
CREATE POLICY "dev_anon_showtime_seats_all" ON public.showtime_seats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_products_all" ON public.products;
CREATE POLICY "dev_anon_products_all" ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_product_modifiers_all" ON public.product_modifiers;
CREATE POLICY "dev_anon_product_modifiers_all" ON public.product_modifiers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_coupons_all" ON public.coupons;
CREATE POLICY "dev_anon_coupons_all" ON public.coupons FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_profiles_all" ON public.profiles;
CREATE POLICY "dev_anon_profiles_all" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_orders_all" ON public.orders;
CREATE POLICY "dev_anon_orders_all" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_order_items_all" ON public.order_items;
CREATE POLICY "dev_anon_order_items_all" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_tickets_all" ON public.tickets;
CREATE POLICY "dev_anon_tickets_all" ON public.tickets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_anon_cinema_settings_all" ON public.cinema_settings;
CREATE POLICY "dev_anon_cinema_settings_all" ON public.cinema_settings FOR ALL USING (true) WITH CHECK (true);

-- 4. ĐỒNG BỘ 10 BỘ PHIM BOM TẤN THỰC TẾ
INSERT INTO public.movies (id, title, slug, synopsis, director, duration_minutes, age_rating, poster_url, banner_url, trailer_url, status, release_date, country, imdb_score, formats)
VALUES
  ('c1da65d7-b688-4bcc-9fb8-75efb28e319f', 'Dune: Hành Tinh Cát - Phần 2', 'dune-hanh-tinh-cat-phan-2', 'Paul Atreides hợp nhất với Chani và người Fremen trên con đường báo thù những kẻ đã hủy hoại gia đình mình.', 'Denis Villeneuve', 166, 'T16', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1440', 'https://www.youtube.com/watch?v=Way9Dexny3w', 'now_showing', '2026-03-01', 'Mỹ', 8.7, ARRAY['2D', 'IMAX']),
  ('63572ecf-6383-49b1-8d64-d52432be6dac', 'Mai', 'mai', 'Quá khứ nhiều vết thương khiến Mai dè dặt khi đón nhận tình yêu của Dương - một chàng trai kém tuổi nhiệt thành và lãng mạn.', 'Trấn Thành', 131, 'T18', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1440', 'https://www.youtube.com/watch?v=cZp91NnQ_0g', 'now_showing', '2026-02-10', 'Việt Nam', 8.2, ARRAY['2D']),
  ('27c3ef14-cbc5-439e-95b8-ef842c284330', 'Kung Fu Panda 4', 'kung-fu-panda-4', 'Po được chọn trở thành Thủ lĩnh Tâm linh của Thung lũng Bình Yên và phải tìm kiếm một Hiệp sĩ Rồng mới.', 'Mike Mitchell', 94, 'P', 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800', 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1440', 'https://www.youtube.com/watch?v=_inKs4eeHiI', 'now_showing', '2026-03-08', 'Mỹ', 7.8, ARRAY['2D', '3D']),
  ('a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d', 'Deadpool & Wolverine', 'deadpool-wolverine', 'Hai siêu anh hùng huyền thoại của Marvel kết hợp trong một chuyến phiêu lưu đa vũ trụ đầy bạo lực và hài hước.', 'Shawn Levy', 127, 'T18', 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800', 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1440', 'https://www.youtube.com/watch?v=73_1biulkYk', 'now_showing', '2026-07-26', 'Mỹ', 8.3, ARRAY['2D', '3D', 'IMAX']),
  ('b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e', 'Lật Mặt 7: Một Điều Ước', 'lat-mat-7-mot-dieu-uoc', 'Câu chuyện xúc động về tình mẫu tử của bà Hai và những người con trưởng thành bận rộn với cuộc sống riêng.', 'Lý Hải', 138, 'T13', 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800', 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1440', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'now_showing', '2026-04-26', 'Việt Nam', 8.5, ARRAY['2D']),
  ('c3d4e5f6-a1b2-4c3d-0e4f-5a6b7c8d9e0f', 'Kẻ Trộm Mặt Trời (Furiosa)', 'furiosa-a-mad-max-saga', 'Nguồn gốc của nữ chiến binh Furiosa trước khi cô gặp Mad Max trong vùng đất hoang tàn bạo tàn.', 'George Miller', 148, 'T18', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1440', 'https://www.youtube.com/watch?v=XJMuhwVlca4', 'now_showing', '2026-05-24', 'Úc', 8.0, ARRAY['2D', 'IMAX']),
  ('d4e5f6a1-b2c3-4d4e-1f5a-6b7c8d9e0f1a', 'Inside Out 2: Cảm Xúc Mới', 'inside-out-2', 'Riley bước vào tuổi dậy thì với những cảm xúc mới đầy hỗn loạn: Lo Âu, Ganh Tị, Xấu Hổ và Chán Nản.', 'Kelsey Mann', 96, 'P', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=1440', 'https://www.youtube.com/watch?v=LEjhY15eCx0', 'now_showing', '2026-06-14', 'Mỹ', 8.6, ARRAY['2D', '3D']),
  ('e5f6a1b2-c3d4-4e5f-2a6b-7c8d9e0f1a2b', 'Transformers Một', 'transformers-one', 'Câu chuyện nguồn gốc chưa từng được kể về tình bạn biến thành thù địch giữa Optimus Prime và Megatron.', 'Josh Cooley', 104, 'T13', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1440', 'https://www.youtube.com/watch?v=u2NuUVbfz4U', 'now_showing', '2026-09-20', 'Mỹ', 7.9, ARRAY['2D', '3D', 'IMAX']),
  ('f6a1b2c3-d4e5-4f6a-3b7c-8d9e0f1a2b3c', 'Hành Tinh Khỉ: Vương Quốc Mới', 'hanh-tinh-khi-vuong-quoc-moi', 'Nhiều thế hệ sau triều đại của Caesar, một thủ lĩnh khỉ bạo ngược vươn lên xây dựng đế chế nô dịch loài người.', 'Wes Ball', 145, 'T13', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1440', 'https://www.youtube.com/watch?v=XtFI7SNtVpY', 'now_showing', '2026-05-10', 'Mỹ', 7.5, ARRAY['2D', 'IMAX']),
  ('a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d', 'Chúa Tể Godzilla x Kong: Đế Chế Mới', 'chua-te-godzilla-x-kong', 'Hai quái thú khổng lồ buộc phải liên minh để đối đầu với mối hiểm họa ngầm ẩn giấu trong Trái Đất Rỗng.', 'Adam Wingard', 115, 'T13', 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800', 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1440', 'https://www.youtube.com/watch?v=lV1OOlGwExg', 'coming_soon', '2026-11-15', 'Mỹ', 7.6, ARRAY['2D', '3D', 'IMAX'])
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  synopsis = EXCLUDED.synopsis,
  director = EXCLUDED.director,
  duration_minutes = EXCLUDED.duration_minutes,
  age_rating = EXCLUDED.age_rating,
  poster_url = EXCLUDED.poster_url,
  banner_url = EXCLUDED.banner_url,
  trailer_url = EXCLUDED.trailer_url,
  status = EXCLUDED.status,
  country = EXCLUDED.country,
  imdb_score = EXCLUDED.imdb_score,
  formats = EXCLUDED.formats;

-- 5. ĐỒNG BỘ 6 PHÒNG CHIẾU CHUẨN
INSERT INTO public.auditoriums (id, name, screen_type, sound_system, total_seats, cleaning_buffer_minutes)
VALUES
  ('d8eae7e2-cf8d-40c6-96d2-bc690626e180', 'Phòng 1 (2D Tiêu Chuẩn)', '2D', 'Dolby 7.1', 80, 15),
  ('28368dd8-750b-40a0-b6bd-3d763bd0c0f5', 'Phòng 2 (2D Digital)', '2D', 'Dolby 7.1', 80, 15),
  ('33333333-3333-3333-3333-333333333333', 'Phòng 3 (IMAX Laser)', 'IMAX', 'Dolby Atmos 64-Channel', 120, 20),
  ('44444444-4444-4444-4444-444444444444', 'Phòng 4 (2D Digital)', '2D', 'Dolby 7.1', 80, 15),
  ('55555555-5555-5555-5555-555555555555', 'Phòng 5 (IMAX Laser)', 'IMAX', 'Dolby Atmos 64-Channel', 120, 20),
  ('66666666-6666-6666-6666-666666666666', 'Phòng 6 (2D Digital)', '2D', 'Dolby 7.1', 80, 15)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  screen_type = EXCLUDED.screen_type,
  sound_system = EXCLUDED.sound_system,
  total_seats = EXCLUDED.total_seats,
  cleaning_buffer_minutes = EXCLUDED.cleaning_buffer_minutes;

-- 6. ĐỒNG BỘ 9 SẢN PHẨM BẮP NƯỚC (F&B)
INSERT INTO public.products (id, name, product_type, base_price, available_stock, active, image_url)
VALUES
  ('6bf3dc87-4194-4a5c-95ff-c8944bbcbd42', 'Combo Solo (1 Bắp + 1 Nước)', 'COMBO', 79000, 150, true, 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=600'),
  ('d9c66e64-45ca-4c9e-8b6f-4a45667d6418', 'Combo Couple Hẹn Hò (1 Bắp Lớn + 2 Nước)', 'COMBO', 109000, 120, true, 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=600'),
  ('e0bf4efd-b1af-4a43-878f-05adfb17a33e', 'Combo Family Tiết Kiệm (2 Bắp + 3 Nước + Snack)', 'COMBO', 189000, 80, true, 'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?w=600'),
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'Bắp Rang Bơ Thượng Hạng (Vị Bơ Pháp)', 'FOOD', 49000, 200, true, 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=600'),
  ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'Bắp Phô Mai Lắc Thơm Béo', 'FOOD', 55000, 180, true, 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=600'),
  ('b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3', 'Bắp Ngọt Caramel Nóng Hổi', 'FOOD', 55000, 160, true, 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=600'),
  ('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'Coca-Cola Mát Lạnh (Ly Lớn 32oz)', 'BEVERAGE', 35000, 300, true, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=600'),
  ('d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'Sprite Chanh Bạc Hà (Ly Lớn 32oz)', 'BEVERAGE', 35000, 250, true, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=600'),
  ('d3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', 'Trà Đào Hạt Chia Tươi Mát', 'BEVERAGE', 45000, 140, true, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  product_type = EXCLUDED.product_type,
  base_price = EXCLUDED.base_price,
  available_stock = EXCLUDED.available_stock,
  active = EXCLUDED.active,
  image_url = EXCLUDED.image_url;

-- 7. ĐỒNG BỘ MÃ GIẢM GIÁ
INSERT INTO public.coupons (code, discount_type, discount_value, max_discount, min_order_amount, apply_scope, starts_at, ends_at, active)
VALUES
  ('CINEMAX50K', 'FIXED', 50000, 50000, 150000, 'ALL', now() - interval '30 days', now() + interval '90 days', true),
  ('CINEMAX20', 'PERCENT', 20, 50000, 100000, 'ALL', now() - interval '30 days', now() + interval '90 days', true),
  ('HSSV10', 'PERCENT', 10, 30000, 60000, 'TICKET_ONLY', now() - interval '30 days', now() + interval '90 days', true)
ON CONFLICT (code) DO UPDATE SET
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  max_discount = EXCLUDED.max_discount,
  min_order_amount = EXCLUDED.min_order_amount,
  apply_scope = EXCLUDED.apply_scope,
  active = EXCLUDED.active;

-- 8. GỠ RÀNG BUỘC AUTH.USERS ĐỂ CHO PHÉP TÀI KHOẢN MẪU HOẠT ĐỘNG
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

INSERT INTO public.profiles (id, full_name, role, loyalty_points, membership_tier, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Quản trị viên Cinemax', 'admin', 9999, 'VVIP', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'Trần Minh Quân', 'staff', 500, 'MEMBER', 'active'),
  ('00000000-0000-0000-0000-000000000003', 'Nguyễn Văn A', 'user', 15000, 'VIP', 'active')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  loyalty_points = EXCLUDED.loyalty_points,
  membership_tier = EXCLUDED.membership_tier,
  status = EXCLUDED.status;

-- 9. TỰ ĐỘNG SINH SƠ ĐỒ GHẾ CHO CẢ 6 PHÒNG CHIẾU (80 GHẾ/PHÒNG)
DO $$
DECLARE
    v_aud RECORD;
    r_char text;
    c_num int;
    v_seat_type public.seat_type_t;
BEGIN
    FOR v_aud IN SELECT id FROM public.auditoriums LOOP
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
                    v_aud.id,
                    r_char,
                    c_num,
                    ascii(r_char) - 64,
                    c_num,
                    v_seat_type,
                    CASE WHEN v_seat_type = 'COUPLE' THEN 'H_PAIR_' || ceil(c_num::numeric / 2)::text ELSE NULL END
                )
                ON CONFLICT DO NOTHING;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;