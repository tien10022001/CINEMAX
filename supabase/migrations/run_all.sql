-- ====================================================================
-- CINEMAX — TOÀN BỘ SCRIPT THIẾT LẬP DATABASE (RUN ALL IN ONE)
-- Thứ tự thực hiện:
-- 1. Tích hợp Supabase Auth & hồ sơ người dùng
-- 2. Cấu hình Row Level Security (RLS) cho 17 bảng
-- 3. Stored Procedures Atomic (giữ ghế, tính tiền, xác nhận thanh toán, soát vé)
-- 4. Job dọn dẹp đơn hết hạn
-- 5. Seed dữ liệu mẫu (Thể loại, Phim, Rạp, Phòng, Ghế, Suất chiếu, Bắp nước, Voucher)
-- ====================================================================

\i 01_auth_profile_migration.sql
\i 02_rls_policies.sql
\i 03_atomic_functions.sql
\i 04_cleanup_expired_bookings.sql
\i 05_seed_data.sql
