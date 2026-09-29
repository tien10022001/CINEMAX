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
