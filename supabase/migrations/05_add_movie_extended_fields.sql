-- ====================================================================
-- CINEMAX SUPABASE MIGRATION 05: BỔ SUNG CÁC TRƯỜNG MỞ RỘNG CHO PHIM
-- Hỗ trợ đầy đủ: Ngày kết thúc, Banner ngang, Trailer, Quốc gia, Studio,
-- Cấu hình định dạng suất chiếu, SEO Meta và Điểm đánh giá (Rating)
-- ====================================================================

-- 1. Bổ sung các cột mở rộng cho bảng movies (nếu chưa có)
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

-- 2. Đảm bảo bảng danh mục thể loại (genres) có đầy đủ các thể loại phổ biến
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

-- 3. Tạo comment giải thích các trường
COMMENT ON COLUMN public.movies.end_date IS 'Ngày kết thúc chiếu dự kiến';
COMMENT ON COLUMN public.movies.banner_url IS 'URL ảnh cover ngang chuẩn 16:9 dùng cho Hero slider và detail background';
COMMENT ON COLUMN public.movies.trailer_url IS 'URL trailer YouTube / video giới thiệu';
COMMENT ON COLUMN public.movies.country IS 'Quốc gia sản xuất (Việt Nam, Mỹ, Hàn Quốc, Nhật Bản...)';
COMMENT ON COLUMN public.movies.studio IS 'Hãng phát hành / Studio sản xuất';
COMMENT ON COLUMN public.movies.meta_title IS 'Thẻ tiêu đề chuẩn SEO';
COMMENT ON COLUMN public.movies.meta_description IS 'Mô tả ngắn chuẩn SEO cho công cụ tìm kiếm';
COMMENT ON COLUMN public.movies.imdb_score IS 'Điểm đánh giá uy tín (IMDb/nội bộ)';
COMMENT ON COLUMN public.movies.formats IS 'Các định dạng phim hỗ trợ chiếu (2D, 3D, IMAX, 4DX, Dolby Atmos)';
