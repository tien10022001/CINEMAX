# CINEMAX - HỆ THỐNG ĐẶT VÉ XEM PHIM & GIỮ GHẾ REAL-TIME
> Dự án Chuyên đề Tốt nghiệp / Môn học HK2T - FPT Polytechnic  
> Phân hệ chuyên sâu: **Task 3: User (Khách hàng thành viên) & Task 4: Guest (Khách vãng lai)**  
> Trọng tâm nghiệp vụ: **Sơ đồ ghế Real-time, Khóa ghế 10 phút, Chống Race Condition, Gom cặp ghế đôi, Bắp nước modifiers & Vé điện tử QR**

---

## 📌 1. TỔNG QUAN VÀ ĐẶC TẢ GIAO DIỆN
Toàn bộ giao diện người dùng được thiết kế chuẩn chỉnh **Dark Cinema Theme** (Nền đen huyền bí `#0B0E17`, điểm nhấn Đỏ thương hiệu `#E50914`, bo góc chuẩn hiện đại và hiệu ứng mờ kính `backdrop-blur`), bám sát 100% các màn hình trong đề cương:
1. **Trang chủ (`#page-home`)**: Hero banner bom tấn *Dune: Hành Tinh Cát - Phần 2*, nhãn phân loại T16, thời lượng 166 phút, phụ đề Việt; thanh lọc nhanh 4 chiều (Rạp, Thể loại, Ngày, Suất chiếu); lưới phim đang chiếu.
2. **Modal Đăng nhập / Đăng ký**: Hỗ trợ chuyển tab mượt mà, đầy đủ trường Họ tên, Số điện thoại, Email, Mật khẩu, tích hợp kiểm tra dữ liệu và hiệu ứng phát sáng nút ĐĂNG NHẬP.
3. **Danh mục phim (`#page-movies`)**: Tab lọc trạng thái (*Tất cả phim, Đang chiếu, Suất chiếu đặc biệt Sneak Show Hot, Sắp chiếu*), hiển thị nhãn độ tuổi (P, K, T13, T16, T18).
4. **Lịch rạp & Suất chiếu (`#page-showtimes`)**: Chọn ngày trực quan (*Hôm nay 17/10, Ngày mai 18/10...*), danh sách cụm rạp (*CINEMAX Plaza, Cinemax Cầu Giấy, Cinemax Landmark 81*), badge "Đang mở bán", các khung giờ chiếu hiển thị số lượng ghế trống thực tế (*80/80 ghế trống, 61/80 ghế trống, Đã chiếu*).
5. **Chọn ghế Real-time (`#page-booking`)**: 
   - Thanh tiến trình 3 bước: `1. Chọn ghế` > `2. Bắp nước` > `3. Thanh toán`.
   - Đồng hồ đếm ngược giữ ghế **10 phút** (`Giữ ghế còn: MM:SS`).
   - Màn hình cong phát sáng `MÀN HÌNH`.
   - Ma trận 80 ghế (Hàng A đến H, cột 1 đến 10) chia 3 phân hạng:
     - **Hàng A - E**: Ghế thường (Standard) `90.000 đ`
     - **Hàng F - G**: Ghế VIP `110.000 đ`
     - **Hàng H**: Ghế đôi (Couple) `210.000 đ` (Trọn cặp)
   - Bảng tổng kết thông tin vé bên phải tự động tính tiền và hiển thị chips ghế đã chọn.
6. **Bắp nước F&B & Modifiers**: Chọn combo Solo, Couple, Family VIP kèm tùy chọn đổi vị bắp (*Ngọt, Phô mai +10k, Caramel +10k*), đổi nước (*Coca, Sprite, Trà đào +5k*), tăng size (*Size M, Size L +15k*).
7. **Thanh toán & Vé điện tử QR**: Tích hợp mã giảm giá (*CINEMAX20, TICKET10, BAPNUOC15*), khấu trừ điểm thưởng hội viên, quét mã thanh toán MoMo/VNPAY giả lập, xuất mã QR vé chuẩn Zero-Leakage.
8. **Tin tức điện ảnh (`#page-news`)**: Danh mục bài viết tin tức phòng vé, công nghệ âm thanh Dolby Atmos và ngày hội thành viên.

---

## ⚡ 2. CƠ CHẾ GIỮ GHẾ REAL-TIME & CHỐNG RACE CONDITION

Khóa ghế thời gian thực là nghiệp vụ nhạy cảm và quan trọng nhất của hệ thống đặt vé. CINEMAX giải quyết triệt để các bài toán kỹ thuật sau:

### 2.1. Triệt tiêu Race Condition bằng Khóa Nguyên Tử (Mutex Lock)
- Khi 2 người dùng (hoặc nhiều hơn) cùng nhấn chọn một ghế tại cùng một thời điểm:
  - Máy chủ sử dụng cơ chế xếp hàng tuần tự `acquireLock(showtimeId)`.
  - Yêu cầu đầu tiên sẽ kiểm tra tình trạng ghế trong `showtime_seats`, khóa ghế và gán hạn giữ `held_until = now() + 10 phút`.
  - Yêu cầu thứ hai đến sau sẽ bị từ chối ngay lập tức với mã lỗi `409 Conflict` và thông báo `"Một hoặc nhiều ghế đã không còn khả dụng"`.
  - Trên Database PostgreSQL / Supabase, nghiệp vụ này được hiện thực bằng Stored Procedure `rpc_hold_seats` với câu lệnh `SELECT ... FOR UPDATE`.

### 2.2. Tự động gom cặp Ghế Đôi (Couple Seat Auto-Pairing)
- Các ghế ở hàng H được gán nhóm `seat_group` theo cặp (`COUPLE_1` gồm H1-H2, `COUPLE_2` gồm H3-H4...).
- Khi người dùng bấm vào H1, hệ thống tự động khóa cả H1 và H2 để đảm bảo không ai mua lẻ một nửa ghế đôi.

### 2.3. Quy tắc chống để trống ghế đơn độc (Orphan Seat Rule)
- Thuật toán `validateOrphanSeats` kiểm tra hàng ghế sau khi chọn, không cho phép khách hàng để lại khoảng trống duy nhất 1 ghế đơn ở đầu hàng hoặc kẹp giữa 2 ghế đã có người ngồi, giúp rạp tối ưu hóa tỷ lệ lấp đầy phòng chiếu.

### 2.4. Đồng bộ Real-time qua WebSocket và Bộ đếm ngược 10 phút
- Sử dụng kết nối WebSocket hai chiều (`ws://localhost:3000/ws`):
  - Khi User A chọn ghế, sự kiện `SEATS_HELD` lập tức được phát thanh tới tất cả các client đang xem cùng suất chiếu. Ghế đó trên màn hình của User B sẽ chuyển sang màu vàng viền cam kèm hiệu ứng phát sáng `holdingGlow` và vô hiệu hóa click.
  - Sau 10 phút, Worker tự động quét `cleanupExpiredHolds()` giải phóng ghế hết hạn và phát sự kiện `SEATS_EXPIRED` để đưa ghế về trạng thái sẵn sàng.

---

## 🚀 3. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY DỰ ÁN

Dự án được xây dựng với kiến trúc Zero-Config độc lập. Không cần cài đặt phức tạp, có thể chạy ngay với Node.js có sẵn.

### Cách 1: Khởi chạy trực tiếp (Khuyên dùng)
```bash
# 1. Giải nén thư mục dự án
unzip cinemax_booking_user_app.zip
cd cinemax-booking-user-app

# 2. Khởi động máy chủ Full-Stack
node server.js
```
Truy cập trình duyệt tại: **http://localhost:3000**

### Cách 2: Khởi chạy với NPM
```bash
npm install
npm start
```

---

## 🧪 4. CHẠY CÁC KỊCH BẢN KIỂM THỬ (TEST SCRIPTS)

### 4.1. Kiểm thử Real-time & Race Condition:
```bash
node tests/test_realtime_hold.js
```
Kết quả kiểm thử tự động xác minh:
- ✓ Giữ ghế hợp lệ trong 600 giây (10 phút).
- ✓ 2 người tranh chấp 1 ghế đồng thời: 1 người thành công, 1 người bị từ chối chính xác.
- ✓ Tự động gom cặp ghế đôi H1 & H2.
- ✓ Chặn quy tắc bỏ trống 1 ghế đơn độc (Orphan seat).
- ✓ Tự động dọn dẹp và giải phóng ghế hết hạn.

### 4.2. Kiểm thử luồng tính tiền & nghiệp vụ User (End-to-End):
```bash
node tests/test_user_flow.js
```
Kết quả kiểm thử xác minh:
- ✓ Giá vé phân tầng theo loại ghế × đối tượng khán giả (HSSV giảm 15%).
- ✓ Tính phụ thu đổi vị bắp và nâng size combo.
- ✓ Áp mã giảm giá `CINEMAX20` chuẩn trần chiết khấu.
- ✓ Tính điểm thưởng tích lũy hội viên (5% tiền vé).

---

## 📁 5. CẤU TRÚC MÃ NGUỒN DỰ ÁN

```
cinemax-booking-user-app/
├── package.json                          # Cấu hình dự án & scripts khởi chạy
├── server.js                             # Máy chủ Full-Stack (HTTP REST API + WebSocket Server)
├── .env.example                          # File mẫu cấu hình biến môi trường
├── README.md                             # Tài liệu kỹ thuật chi tiết
│
├── public/                               # Giao diện người dùng (Frontend SPA)
│   ├── index.html                        # HTML đầy đủ các màn hình chuẩn ảnh thiết kế
│   ├── css/
│   │   └── style.css                     # Cinema Dark Mode, ma trận 80 ghế, hiệu ứng glow
│   └── js/
│       ├── app.js                        # Bộ điều hướng trang, lọc danh mục phim & tin tức
│       ├── realtime-seats.js             # WebSocket Client, đếm ngược 10 phút, đồng bộ live
│       ├── booking-flow.js               # Quy trình 3 bước đặt vé, chọn combo bắp nước & QR
│       └── auth.js                       # Quản lý đăng nhập, đăng ký, tích điểm hội viên
│
├── src/                                  # Mã nguồn nghiệp vụ Backend
│   ├── config/
│   │   └── constants.js                  # Hằng số hệ thống, bảng giá gốc, tỷ lệ tích điểm
│   ├── models/
│   │   └── dataStore.js                  # Kho dữ liệu mô phỏng chuẩn PostgreSQL
│   ├── services/
│   │   ├── seatHoldManager.js            # Engine giữ ghế Real-time, Mutex, Orphan check
│   │   └── pricingService.js             # Dịch vụ tính tiền đa chiều & chiết khấu mã ưu đãi
│   ├── websocket/
│   │   └── socketServer.js               # WebSocket Server pub/sub theo phòng chiếu
│   └── types/
│       ├── database.d.ts                 # TypeScript Type chuẩn cho 28 bảng Supabase
│       └── booking.d.ts                  # TypeScript Type cho sự kiện Real-time & đặt vé
│
├── database/                             # Cơ sở dữ liệu PostgreSQL / Supabase
│   └── schema_postgresql_supabase.sql    # DDL 28 bảng, RLS Policies & Stored Procedures (RPC)
│
└── tests/                                # Kịch bản kiểm thử tự động
    ├── test_realtime_hold.js             # Test Race Condition & Khóa ghế 10 phút
    └── test_user_flow.js                 # Test toàn bộ luồng thanh toán và xuất vé QR
```

---

## 💾 6. CƠ SỞ DỮ LIỆU POSTGRESQL / SUPABASE (28 BẢNG)
Tệp `database/schema_postgresql_supabase.sql` chứa toàn bộ DDL đã được tinh chỉnh cho Supabase:
- **Tài khoản & Phân quyền**: `profiles`, `staff_permissions`, `cinema_settings`.
- **Nội dung & Phim**: `content_items`, `genres`, `movies`, `movie_genres`.
- **Phòng chiếu & Ghế**: `auditoriums`, `seats`, `showtimes`, `showtime_prices`, `showtime_seats` (*Nguồn sự thật duy nhất*).
- **Bắp nước & Kho**: `products`, `product_components`, `product_modifiers`, `inventory_movements`, `order_item_fulfillments`.
- **Đơn hàng & Giao dịch**: `orders`, `order_items`, `payments`, `tickets`, `coupons`, `coupon_redemptions`.
- **Vận hành & Hậu mãi**: `shifts`, `refunds`, `invoice_requests`, `support_requests`, `order_access_challenges`, `audit_logs`.
- **Stored Procedure cốt lõi**: `rpc_hold_seats` sử dụng khóa hàng `FOR UPDATE` triệt tiêu mọi xung đột khi bán vé đồng thời.
