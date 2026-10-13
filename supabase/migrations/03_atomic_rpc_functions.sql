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
