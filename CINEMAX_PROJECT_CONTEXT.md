# CINEMAX — Website bán vé xem phim: Tài liệu ngữ cảnh dự án

> **Mục đích:** đây là nguồn sự thật chung (single source of truth) cho mọi agent làm việc trên dự án.
> Đọc file này trước khi làm bất cứ việc gì. Nếu thay đổi schema, giao diện hoặc quy tắc nghiệp vụ, **cập nhật lại file này** trong cùng lượt làm việc.
>
> Ngày lập: 29/09/2026 · Ngôn ngữ giao diện: tiếng Việt · Tiền tệ: VND

---

## 1. Tổng quan

Website bán vé xem phim cơ bản, đầy đủ luồng: xem phim → chọn suất → chọn ghế → chọn bắp nước → áp mã giảm giá → thanh toán → nhận vé QR. Thương hiệu tạm đặt là **CINEMAX**.

| Hạng mục | Trạng thái | Vị trí |
|---|---|---|
| Ý tưởng chức năng | Xong (mục 2) | File này & `THIET_KE_CSDL_VA_PHAN_QUYEN_CHUAN_HOA.md` |
| Database Redesign (28 bảng) | **Đã hoàn thiện chuẩn hóa** | Excel `HK2T_1-rap_database-redesign.xlsx` & `THIET_KE_CSDL_VA_PHAN_QUYEN_CHUAN_HOA.md` |
| Database cũ (17 bảng) | Bản tham khảo v1 | Supabase project `cycuxhztpvezqcznifqh` |
| ERD & Kiến trúc chuẩn | Đã vẽ & Đặc tả chi tiết | [Tài liệu Kiến trúc Chuẩn Hóa](file:///c:/Users/Tien/Desktop/Cinemax_v1/CINEMAX/THIET_KE_CSDL_VA_PHAN_QUYEN_CHUAN_HOA.md) |
| Thiết kế UI | 5 màn hình desktop | [Figma Prototype UI Design](https://www.figma.com/proto/LeISRokOLPtDIEkR4lfwKH/Website-b%C3%A1n-v%C3%A9-xem-phim---UI-Design?node-id=1-2) |
| Tech Stack đã chọn | Next.js 15 (App Router, TS, Tailwind CSS) + Supabase SSR | Khởi tạo dự án |


---

## 2. Chức năng

### Khách hàng
- Đăng ký, đăng nhập, quên mật khẩu, xác thực email, xem/sửa hồ sơ.
- Xem phim đang chiếu / sắp chiếu; lọc theo thể loại, độ tuổi, rạp, ngày; tìm kiếm.
- Xem chi tiết phim (nội dung, trailer, diễn viên) và lịch chiếu theo rạp.
- Chọn ghế trên sơ đồ, **giữ ghế 10 phút**, chống hai người đặt trùng ghế.
- Chọn bắp nước/combo, áp mã giảm giá, thanh toán online (MoMo, VNPay, ZaloPay, thẻ), nhận vé QR qua email.
- Xem lịch sử đặt vé, hủy đơn chưa thanh toán, tích điểm thành viên.

### Nhân viên rạp
- Quét QR soát vé (`tickets.ticket_code` → `USED`), bán vé tại quầy (thanh toán `CASH`).

### Quản trị (admin)
- Quản lý phim, thể loại, rạp, phòng, sơ đồ ghế.
- Xếp lịch chiếu (DB đã chặn trùng phòng) và đặt giá theo suất + loại ghế.
- Quản lý bắp nước, khuyến mãi, người dùng, phân quyền.
- Báo cáo doanh thu theo phim / rạp / ngày.

### Giai đoạn 2 (chưa làm, đừng tự thêm)
Đánh giá phim (`reviews`), thông báo nhắc suất chiếu, điểm thành viên nâng cao, đăng nhập Google, bảng diễn viên/đạo diễn tách riêng, `audit_logs`.

---

## 3. Database (Supabase / PostgreSQL 17)

- **Project:** `tien10022001's Project` · id/ref `cycuxhztpvezqcznifqh` · vùng `ap-southeast-1`.
- **Lưu ý:** project từng bị tạm dừng (INACTIVE) và đã được khôi phục ngày 29/09/2026. Nếu kết nối báo timeout hoặc `ECONNREFUSED`, kiểm tra trạng thái project trước.
- **Schema:** `public`. Migration đã áp dụng: `create_movie_ticket_schema`, `enable_rls_and_seed_reference_data`.
- **Mọi thay đổi schema phải đi qua migration** (`apply_migration`), không sửa tay bằng SQL rời.

### 3.1 Quy ước
| Chủ đề | Quy ước |
|---|---|
| Tên bảng/cột | `snake_case`, tên bảng số nhiều |
| Khóa chính | `generated always as identity` (kiểu `smallint`/`integer`/`bigint` tùy bảng) |
| Tiền | `numeric(12,0)` — đơn vị VND, không có phần thập phân |
| Thời gian | `timestamptz` (lưu UTC, hiển thị theo giờ Việt Nam) |
| Trạng thái | Enum của Postgres, tên kiểu kết thúc bằng `_t` |
| Xóa mềm | Chỉ `movies.is_deleted`; các bảng khác dùng `is_active` hoặc `status` |
| `updated_at` | Tự cập nhật bằng trigger `set_updated_at()` ở `users`, `movies`, `bookings` |
| RLS | **Đã bật trên cả 17 bảng, chưa có policy nào** (xem mục 3.5) |

### 3.2 Enum types
| Kiểu | Giá trị |
|---|---|
| `gender_t` | `M`, `F`, `OTHER` |
| `age_rating_t` | `P`, `K`, `T13`, `T16`, `T18` |
| `movie_status_t` | `COMING_SOON`, `NOW_SHOWING`, `ENDED` |
| `screen_type_t` | `2D`, `3D`, `IMAX`, `4DX` |
| `room_status_t` | `ACTIVE`, `MAINTENANCE` |
| `language_type_t` | `SUBTITLED`, `DUBBED`, `ORIGINAL` |
| `showtime_status_t` | `OPEN`, `CLOSED`, `CANCELLED` |
| `discount_type_t` | `PERCENT`, `FIXED` |
| `booking_status_t` | `PENDING`, `PAID`, `CANCELLED`, `EXPIRED` |
| `ticket_status_t` | `HELD`, `SOLD`, `CANCELLED`, `USED` |
| `food_category_t` | `POPCORN`, `DRINK`, `SNACK`, `COMBO` |
| `payment_method_t` | `MOMO`, `VNPAY`, `ZALOPAY`, `CARD`, `CASH` |
| `payment_status_t` | `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED` |

### 3.3 Danh sách bảng và cột

Ký hiệu: **PK** khóa chính · **FK** khóa ngoại · **UQ** duy nhất · **NN** not null.

#### Nhóm Người dùng
**`roles`**: `id` smallint PK · `code` varchar(30) UQ NN (`CUSTOMER`/`STAFF`/`ADMIN`) · `name` varchar(50) NN

**`users`**: `id` uuid PK (liên kết `auth.users(id)` ON DELETE CASCADE) · `role_id` → roles NN · `full_name` NN · `email` UQ NN · `phone` UQ · `password_hash` (nullable do Supabase Auth quản lý) · `gender` gender_t · `birth_date` date · `avatar_url` · `loyalty_points` int NN default 0 (>= 0) · `email_verified_at` · `last_login_at` · `is_active` NN default true · `created_at` · `updated_at`

#### Nhóm Phim
**`genres`**: `id` int PK · `name` UQ NN · `slug` UQ NN

**`movies`**: `id` bigint PK · `title` NN · `original_title` · `slug` UQ NN · `synopsis` text · `duration_min` smallint NN (> 0) · `release_date` · `end_date` · `age_rating` age_rating_t NN · `country` · `director` · `cast_list` varchar(500) · `poster_url` · `banner_url` · `trailer_url` · `imdb_score` numeric(3,1) (0–10) · `status` movie_status_t NN default `COMING_SOON` · `is_deleted` NN default false · `created_at` · `updated_at`

**`movie_genres`** (N-N): `movie_id` → movies (ON DELETE CASCADE) + `genre_id` → genres, PK ghép

#### Nhóm Rạp
**`cinemas`**: `id` int PK · `name` NN · `address` NN · `district` · `city` NN · `latitude`/`longitude` numeric(9,6) · `phone` · `image_url` · `is_active` NN default true

**`rooms`**: `id` int PK · `cinema_id` → cinemas NN · `name` NN · `screen_type` screen_type_t NN default `2D` · `total_rows` smallint NN (> 0) · `total_cols` smallint NN (> 0) · `status` room_status_t NN default `ACTIVE` · UQ (`cinema_id`, `name`)

**`seat_types`**: `id` smallint PK · `code` UQ NN · `name` NN · `capacity` smallint NN default 1 · `color_code` varchar(7)

**`seats`**: `id` int PK · `room_id` → rooms NN · `seat_type_id` → seat_types NN · `row_label` varchar(2) NN · `seat_number` smallint NN · `grid_row`, `grid_col` smallint NN (vị trí vẽ trên lưới, cho phép chừa lối đi) · `is_active` NN default true · UQ (`room_id`, `row_label`, `seat_number`)

#### Nhóm Suất chiếu
**`showtimes`**: `id` bigint PK · `movie_id` → movies NN · `room_id` → rooms NN · `start_time` NN · `end_time` NN (CHECK `end_time > start_time`) · `language_type` language_type_t NN default `SUBTITLED` · `status` showtime_status_t NN default `OPEN` · `created_by` → users(uuid) · `created_at`
Ràng buộc `showtimes_no_overlap` (EXCLUDE gist): **không cho hai suất cùng `room_id` giao nhau về thời gian**, trừ suất `CANCELLED`. `end_time` phải gồm thời lượng phim + quảng cáo + dọn phòng.

**`showtime_prices`**: `showtime_id` → showtimes (CASCADE) + `seat_type_id` → seat_types, PK ghép · `price` numeric(12,0) NN

#### Nhóm Khuyến mãi
**`promotions`**: `id` int PK · `code` UQ NN · `description` · `discount_type` NN · `discount_value` numeric(12,0) NN (> 0; là phần trăm nếu `PERCENT`, là VND nếu `FIXED`) · `max_discount` (trần giảm khi `PERCENT`) · `min_order` NN default 0 · `usage_limit` (NULL = không giới hạn) · `per_user_limit` default 1 · `used_count` NN default 0 · `valid_from`, `valid_to` NN (CHECK `valid_to > valid_from`) · `is_active` NN default true

#### Nhóm Đặt vé
**`bookings`**: `id` bigint PK · `booking_code` UQ NN (mã hiển thị / QR đơn) · `user_id` uuid → users NN · `showtime_id` → showtimes NN (**một đơn = một suất chiếu**) · `promotion_id` → promotions (nullable) · `ticket_subtotal`, `food_subtotal`, `discount_amount`, `total_amount` numeric(12,0) NN default 0 · `status` booking_status_t NN default `PENDING` · `expires_at` (hạn giữ ghế khi PENDING) · `contact_email`, `contact_phone` · `created_at` · `updated_at`

**`tickets`**: `id` bigint PK · `booking_id` → bookings (CASCADE) NN · `showtime_id` → showtimes NN · `seat_id` → seats NN · `ticket_code` UQ NN (QR từng ghế) · `price` NN (giá chốt lúc đặt) · `status` ticket_status_t NN default `HELD` · `checked_in_at`
Chống đặt trùng ghế: unique index một phần `uq_tickets_active_seat` trên (`showtime_id`, `seat_id`) **chỉ với vé `HELD`/`SOLD`/`USED`**. Vé `CANCELLED` tự nhả ghế, vẫn giữ lịch sử.

#### Nhóm Đồ ăn
**`food_items`**: `id` int PK · `name` NN · `category` food_category_t NN · `description` varchar(300) · `price` NN · `image_url` · `is_active` NN default true

**`booking_items`**: `booking_id` → bookings (CASCADE) + `food_item_id` → food_items, PK ghép · `quantity` smallint NN (> 0) · `unit_price` NN (giá chốt lúc đặt)

#### Nhóm Thanh toán
**`payments`**: `id` bigint PK · `booking_id` → bookings NN (một đơn có thể có nhiều lần thanh toán: thử lại, hoàn tiền) · `method` payment_method_t NN · `amount` NN · `status` payment_status_t NN default `PENDING` · `transaction_ref` · `gateway_response` jsonb · `paid_at` · `refunded_at` · `created_at` · UQ (`method`, `transaction_ref`) để chống ghi trùng callback

### 3.4 Quan hệ chính
```
roles 1─N users
cinemas 1─N rooms 1─N seats N─1 seat_types
movies 1─N showtimes N─1 rooms
movies N─N genres              (qua movie_genres)
showtimes 1─N showtime_prices N─1 seat_types
users 1─N bookings N─1 showtimes
promotions 0..1─N bookings
bookings 1─N tickets N─1 seats ; tickets N─1 showtimes
bookings 1─N booking_items N─1 food_items
bookings 1─N payments
```

### 3.5 Trạng thái RLS và bảo mật
- Script chính sách RLS đã tạo tại `supabase/migrations/02_rls_policies.sql`.
- Cho phép Public đọc danh mục: `movies`, `genres`, `movie_genres`, `cinemas`, `rooms`, `seats`, `seat_types`, `showtimes`, `showtime_prices`, `food_items`, `promotions` (chỉ bản ghi hoạt động) và xem trạng thái ghế đã chọn trên `tickets`.
- Bảo mật quyền riêng tư cho các bảng: `users`, `bookings`, `tickets`, `booking_items`, `payments` (chỉ chủ sở hữu hoặc Staff/Admin).
- `users` đã tích hợp với Supabase Auth (`auth.users`), trigger `handle_new_user` tự động tạo profile khi đăng ký.
- **Không bao giờ để lộ `service_role` key ra frontend.**

### 3.6 Dữ liệu mẫu (Seed Data)
Đã chuẩn bị đầy đủ trong `supabase/migrations/05_seed_data.sql` và file gộp `supabase/full_setup_single_file.sql`:
- 9 thể loại phim
- 7 phim hot (Dune 2, Mai, Godzilla x Kong, Kung Fu Panda 4, Lật Mặt 7, Deadpool, Inside Out 2)
- 5 cụm rạp tại TP.HCM, Hà Nội, Đà Nẵng
- Các phòng chiếu IMAX Laser, Cinema Gold, 3D Atmos
- Toàn bộ sơ đồ ghế (Standard, VIP, Couple)
- Suất chiếu các ngày tới và bảng giá vé theo loại phòng/loại ghế
- Menu đồ ăn bắp nước, combo
- Các mã khuyến mãi mẫu (CHAOBANMOI, CINEMAX30K, VNPAY20, HOCSINHSINHVIEN)

---

## 4. Quy tắc nghiệp vụ (mọi agent phải tuân thủ)

### 4.1 Luồng đặt vé
1. Người dùng chọn suất → lấy sơ đồ ghế từ `seats` của phòng; ghế đã bị chiếm là các dòng `tickets` của suất đó có `status` in (`HELD`,`SOLD`,`USED`).
2. Chọn ghế → trong **một transaction**: tạo `bookings` (`PENDING`, `expires_at = now() + 10 phút`) và các `tickets` (`HELD`, `price` lấy từ `showtime_prices`). Nếu vi phạm `uq_tickets_active_seat` → báo "ghế vừa có người chọn", không tạo đơn.
3. Chọn bắp nước, áp mã → ghi `booking_items` (sao chép `unit_price`), tính lại các cột tổng tiền.
4. Thanh toán → tạo `payments` (`PENDING`). Khi cổng gọi callback thành công, trong **một transaction**: `payments` → `SUCCESS`, `bookings` → `PAID`, `tickets` → `SOLD`.
5. Quá `expires_at` mà chưa trả tiền → `bookings` → `EXPIRED`, `tickets` → `CANCELLED`.
6. Soát vé: quét `ticket_code` → `tickets.status = USED`, ghi `checked_in_at`.

### 4.2 Tính tiền
```
ticket_subtotal = tổng tickets.price của đơn
food_subtotal   = tổng booking_items.quantity * unit_price
discount_amount = theo promotions (xem dưới)
total_amount    = ticket_subtotal + food_subtotal - discount_amount   (không âm)
```
- Giá **chốt tại thời điểm đặt**: `tickets.price`, `booking_items.unit_price`. Đổi giá sau này không được làm sai lịch sử.
- Mã giảm giá: kiểm tra `is_active`, trong `valid_from..valid_to`, `total >= min_order`, `used_count < usage_limit`, số lần dùng của user `< per_user_limit`. `PERCENT` = `floor(subtotal * value / 100)` rồi cắt trần `max_discount`; `FIXED` = `discount_value`. Tăng `used_count` khi đơn chuyển `PAID`.
- **DB chưa ép** công thức tổng tiền và `per_user_limit`; logic này nằm ở tầng ứng dụng/hàm DB.

### 4.3 Khác
- Giới hạn độ tuổi: so `users.birth_date` với `movies.age_rating` (P/K: mọi người; T13/T16/T18: từ 13/16/18 tuổi).
- Ghế đôi (`COUPLE`) có `capacity = 2` nhưng vẫn là **một dòng** trong `seats` và **một vé**.
- Chỉ hiển thị `movies` có `is_deleted = false`.
- Phân quyền theo `roles.code`: `CUSTOMER`, `STAFF`, `ADMIN`.

---

## 5. Thiết kế UI (Figma)

- **File:** [Figma Prototype UI Design](https://www.figma.com/proto/LeISRokOLPtDIEkR4lfwKH/Website-b%C3%A1n-v%C3%A9-xem-phim---UI-Design?node-id=1-2) (trang `UI Design`)
- **ERD:** [FigJam Board ERD](https://www.figma.com/board/dlbHpFuwCsSFTWsycdFrSC/ERD---Website-b%C3%A1n-v%C3%A9-xem-phim?node-id=0-1)
- Desktop 1440 px, nền tối, màu nhấn đỏ, font **Inter** (style: `Regular`, `Medium`, `Semi Bold`, `Bold`). Dựng bằng auto-layout.

| # | Frame | Node ID | Nội dung chính |
|---|---|---|---|
| 01 | Trang chủ | `1:2` | Header, banner phim nổi bật, thanh mua vé nhanh (rạp/phim/ngày/suất), phim đang chiếu, phim sắp chiếu, footer |
| 02 | Chi tiết phim & lịch chiếu | `1:147` | Thông tin phim, tab chọn ngày, danh sách rạp kèm chip suất chiếu (hiện số ghế còn) |
| 03 | Chọn ghế | `1:257` | Stepper, đồng hồ giữ ghế, sơ đồ ghế (thường/VIP/đôi/đã bán/đang chọn), tóm tắt đơn |
| 04 | Bắp nước & Thanh toán | `1:430` | Chọn combo, mã giảm giá, phương thức thanh toán, tóm tắt đơn |
| 05 | Vé điện tử | `1:518` | Thông báo thành công, thông tin vé, mã QR, mã đặt vé |

### Design tokens (đang dùng trong Figma)
| Token | Hex | Dùng cho |
|---|---|---|
| `bg` | `#0F1217` | Nền trang |
| `surface` | `#1A1C26` | Card, header, footer |
| `primary` | `#E63845` | Nút chính, nhấn, ghế đang chọn |
| `text` | `#FFFFFF` | Chữ chính |
| `muted` | `#9EA6B8` | Chữ phụ |
| `border` | `#303645` | Viền |
| `gold` | `#FABF2E` | Ghế VIP, điểm sao, đồng hồ giữ ghế |
| `success` | `#33C773` | Thành công, giảm giá |
| `seat-taken` | `#383D4D` | Ghế đã bán |

Bo góc: nút 8–10 px, card 12–16 px, chip 8 px. Khoảng lề ngang trang 80 px.

### Chưa có trong Figma
Bản mobile · trang đăng nhập/đăng ký · hồ sơ và lịch sử vé · trang danh sách phim có bộ lọc · trang rạp · toàn bộ khu vực admin và nhân viên. Màu và số liệu trong các frame là dữ liệu minh họa (tên phim "Tên phim 1…", giá 90.000đ/ghế).

---

## 6. Việc còn lại và điểm cần quyết định

### Đã triển khai trên Frontend (100% Khớp Figma Mới & Nghiệp Vụ Bảo Mật)
- Đã thiết kế lại toàn bộ mã giao diện chuẩn xác 100% theo Figma Prototype (Node 1:2):
  1. **Screen 1 (Trang chủ)**: Header (Logo đỏ, Nav có hiệu ứng glow sáng tab đang chọn, Search pill, Đăng nhập/Profile pill), Hero banner (glow đỏ, badge ĐANG CHIẾU, nút Đặt vé & Trailer), Thanh mua vé nhanh (Chọn rạp, Thể loại, Chọn ngày với tùy chọn "Tất cả các ngày", Suất chiếu với khung giờ Sáng/Trưa/Chiều/Tối và tùy chọn "Tất cả suất chiếu"), Phim đang chiếu, Phim sắp chiếu, Footer chuẩn token.
  2. **Screen 2 (Chi tiết phim & Lịch chiếu)**: Poster, badges T18, 2D, IMAX, rating IMDb, thông tin chi tiết, nút Mua vé & TrailerModal pop-up video, pills chọn ngày, danh sách rạp kèm chips suất chiếu & số ghế trống.
  3. **Screen 3 (Chọn ghế)**: Stepper 3 bước, đồng hồ đếm ngược giữ ghế 10:00 (vàng), đường cong màn hình đỏ phát sáng, ma trận ghế có lối đi ở giữa, các loại ghế Standard / VIP / Ghế đôi / Đang chọn / Đã bán, card thông tin vé & nút Tiếp tục.
  4. **Screen 4 (Bắp nước & Thanh toán)**: Stepper, menu bắp nước & combo kèm bộ tăng giảm số lượng, ô nhập mã giảm giá (áp dụng thành công mã `GIAM20K`), 4 phương thức thanh toán (MoMo, VNPAY, ZaloPay, Thẻ ATM/Visa), card tóm tắt đơn hàng & nút Thanh toán. Tích hợp form thông tin liên hệ cho khách vãng lai hoặc tự động nạp thông tin thành viên.
  5. **Screen 5 (Vé điện tử)**: Biểu tượng thành công màu xanh lá, vé xem phim bo góc có rãnh xé vé đục lỗ, thông tin phim/rạp/suất/ghế/mã vé, mã QR xuất trình tại quầy soát vé, nút đỏ Tải vé PDF & nút outline Xem vé của tôi.
  6. **Trang `/my-tickets` (Vé của tôi & Tra cứu vé)**:
     - Không hardcode vé mặc định.
     - Khách chưa đăng nhập: Hiển thị form tra cứu bảo mật theo Mã vé + Số điện thoại hoặc nút đăng nhập.
     - Thành viên (User): Chỉ hiển thị danh sách vé do tài khoản đó đặt.
     - Quản trị viên (Admin): Có công tắc xem toàn bộ vé trong hệ thống.
  7. **Hệ thống Đăng nhập / Đăng ký & Phân quyền (Guest, User, Admin)**:
     - Tạo `AuthProvider` trong `src/lib/auth-context.tsx`.
     - Phân định 3 cấp độ:
       + **Khách chưa đăng nhập (GUEST)**: Mặc định là `null`, nút Đăng nhập màu đỏ trên Header. Vẫn mua vé bình thường với thông tin cá nhân của riêng mình, không bị gán vào tài khoản nào khác.
       + **Thành viên (CUSTOMER/USER)**: Menu tài khoản, điểm tích lũy, xem vé của tôi, tự động áp dụng thông tin khi thanh toán. Tài khoản test: `user@cinemax.vn` (Mật khẩu: `user123`).
       + **Quản trị viên (ADMIN)**: Huy hiệu Admin màu đỏ, truy cập được trang Quản trị `/admin`. Tài khoản test: `admin@cinemax.vn` (Mật khẩu: `admin`).
  8. **Trang Quản trị `/admin` (Dành riêng cho ADMIN)**:
     - Kiểm tra phân quyền truy cập (bảo vệ route, từ chối Guest và User).
     - Bảng điều khiển doanh thu, tổng số vé bán ra, tỷ lệ lấp đầy rạp.
     - Quản lý danh mục phim (thêm phim mới, chuyển đổi trạng thái Đang chiếu / Sắp chiếu, xóa phim).
     - Quản lý đơn đặt vé và danh sách mã khuyến mãi.
  9. **Trang Nhân viên rạp `/staff` (Dành cho STAFF: POS, CHECKIN, CONCESSION, SUPERVISOR)**:
     - Bố cục Sidebar + Topbar + Dark Mode toàn màn hình (không dùng icon/emoji), tự động hiển thị menu và giao diện theo nhiệm vụ của nhân viên.
     - Đầy đủ 6 phân khu: Thống kê ca trực, Quầy Vé POS (bán vé tại quầy, bán vé trễ <15p, phân tầng giá vé U22/Trẻ em/Người cao tuổi, tính tiền mặt thối lại), Cổng Soát Vé QR & Kiểm tra độ tuổi, Quầy Bắp Nước (`fulfillments`) & Kiểm kho F&B (`inventory_movements`), Quản lý Ca trực & Két tiền (`shifts`, `close_shift`, Trưởng ca duyệt ca), và Hậu mãi (Đổi ghế, Hoàn vé, Xuất hóa đơn đỏ VAT).
     - Tài khoản test nhân viên (mật khẩu chung `staff123`): `staff@cinemax.vn` (Trưởng ca), `pos@cinemax.vn` (Thu ngân POS), `checkin@cinemax.vn` (Soát vé), `fnb@cinemax.vn` (Quầy Bắp nước).

**Cần làm tiếp theo**
1. Tích hợp trực tiếp với Supabase Database & Auth thực tế khi triển khai production.
2. Thiết lập Webhook cổng thanh toán thực tế (MoMo/VNPAY IPN).

---

## 7. Quy tắc làm việc cho agent

1. **Đọc file này trước, cập nhật sau.** Đổi schema/UI/nghiệp vụ thì sửa mục tương ứng ở đây.
2. Không đổi tên bảng, cột, enum, hay ý nghĩa trạng thái nếu chưa có lý do rõ ràng; nếu đổi, viết migration và cập nhật mục 3.
3. Không tạo bảng/tính năng ngoài mục 2 (đặc biệt phần "Giai đoạn 2") khi chưa được yêu cầu.
4. Luôn dùng tiếng Việt cho nội dung hiển thị; mã/định danh dùng tiếng Anh `snake_case`.
5. Mọi thao tác thay đổi trạng thái đơn/vé/thanh toán phải nằm trong transaction.
6. Không đưa khóa bí mật (service role key, khóa cổng thanh toán) vào mã frontend hay vào repo.
7. Khi thiết kế thêm màn hình, bám design tokens ở mục 5 và đặt tên frame theo mẫu `NN - Tên màn hình`.
8. Nếu thông tin trong file này mâu thuẫn với database thực tế, **database thực tế đúng**; hãy sửa file này cho khớp và ghi chú lại.
