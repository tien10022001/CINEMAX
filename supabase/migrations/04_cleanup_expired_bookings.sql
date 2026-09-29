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
