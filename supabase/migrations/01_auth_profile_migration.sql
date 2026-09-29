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
