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
