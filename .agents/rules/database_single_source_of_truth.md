# RULE: Kiến Trúc Database Là Single Source of Truth (SSOT)

> **Phạm vi áp dụng:** Toàn bộ hệ thống CINEMAX (Admin, Staff, User, Guest, API, Database, Realtime).  
> **Mục tiêu:** Chấm dứt hoàn toàn tình trạng lệch dữ liệu (State Drift), trùng lặp dữ liệu, dữ liệu giả lập (hardcoded/mock) hoặc các giao diện tự đồng bộ ngang hàng với nhau ở client mà không thông qua cơ sở dữ liệu.

---

## 1. Mười Lăm Nguyên Tắc Bắt Buộc (Mandatory Principles)

1. **Cấm đồng bộ ngang hàng ở Client:**  
   Không cho phép Admin, Staff, User hoặc Guest tự đồng bộ dữ liệu trực tiếp với nhau ở phía trình duyệt (không dùng `localStorage`, `BroadcastChannel`, `window.dispatchEvent` để tự coi là nguồn dữ liệu chuẩn).
2. **Mọi thao tác CRUD phải qua Backend API:**  
   Tất cả hành động Thêm (Create), Đọc (Read - nếu cần kiểm soát quyền), Sửa (Update), Xóa (Delete) từ bất kỳ vai trò nào bắt buộc phải gửi yêu cầu qua Backend API (`/api/...`).
3. **Thẩm định & Transaction trước khi ghi:**  
   Backend API có trách nhiệm xác thực danh tính (Authentication), thẩm định quyền hạn (Authorization/RBAC), kiểm tra ràng buộc nghiệp vụ (Business Logic Validation), và thực thi trong Transaction của Database trước.
4. **Database Commit thành công mới phát Realtime:**  
   Chỉ sau khi Transaction trong Database hoàn tất và commit thành công 100%, Backend mới được phép phát sự kiện Realtime (WebSocket / SSE / Supabase Realtime) đến các client liên quan.
5. **Dữ liệu phân phối theo cấp quyền (Role-based Data Scoping):**  
   - **Admin:** Luôn nhận được toàn bộ dữ liệu mới nhất của hệ thống.  
   - **Staff:** Chỉ nhận dữ liệu và sự kiện trong phạm vi ca trực / rạp / quầy được chỉ định.  
   - **User:** Chỉ nhận dữ liệu thuộc quyền sở hữu của chính tài khoản đó.  
   - **Guest:** Chỉ nhận thông tin công khai hoặc trạng thái của chính phiên yêu cầu tạm thời.
6. **Luồng dữ liệu 2 chiều chuẩn mực:**  
   - **Admin tác động:** `Admin UI` → `Backend API` → `Database (Commit)` → `Realtime Event` → `Admin UI + Staff/User/Guest liên quan`.  
   - **Staff/User/Guest tác động:** `Client UI` → `Backend API (Verify RBAC)` → `Database (Commit)` → `Realtime Event` → `Admin Dashboard + Các bên liên quan`.
7. **Cấm cập nhật UI giả định (Strict UI State Management):**  
   Không được cập nhật UI như thể đã thành công trước khi nhận được phản hồi xác nhận từ Server/Database. Nếu áp dụng Optimistic UI để tăng trải nghiệm, bắt buộc phải có cơ chế **Rollback về trạng thái cũ** kèm thông báo lỗi rõ ràng nếu API/DB thất bại.
8. **Chuẩn hóa Payload sự kiện Realtime:**  
   Mọi sự kiện Realtime phát đi bắt buộc phải tuân thủ cấu trúc tối thiểu:
   ```typescript
   interface SystemRealtimeEvent<T = any> {
     eventId: string;          // UUID v4 duy nhất của sự kiện
     entityType: string;       // Tên bảng/thực thể (e.g. 'TICKET', 'COUPON', 'ORDER', 'SHIFT')
     entityId: string;         // ID của bản ghi
     action: 'CREATED' | 'UPDATED' | 'DELETED';
     actorId: string;          // ID người thực hiện
     actorRole: 'ADMIN' | 'STAFF' | 'USER' | 'GUEST';
     timestamp: string;        // ISO 8601 UTC
     version: number;          // Phiên bản dữ liệu (dùng chống ghi đè)
     data?: T;                 // Dữ liệu payload (đã lọc theo quyền người nhận)
   }
   ```
9. **Chống ghi đè đồng thời (Optimistic Concurrency Control):**  
   Sử dụng trường `version` (hoặc `updated_at`) trên từng bản ghi. Mọi câu lệnh cập nhật phải kèm điều kiện:  
   `UPDATE table SET ..., version = version + 1 WHERE id = :id AND version = :expectedVersion`. Nếu số dòng cập nhật = 0, báo lỗi xung đột (Conflict 409) và yêu cầu client refresh dữ liệu mới nhất.
10. **Ghi vết kiểm toán đầy đủ (Audit Log):**  
    Mọi thao tác thay đổi dữ liệu nhạy cảm (vé, tài chính, đơn hàng, ca trực, mã giảm giá) phải ghi lại nhật ký: Ai thực hiện (`actor_id`, `actor_role`), hành động (`action`), dữ liệu trước khi sửa (`old_data`), dữ liệu sau khi sửa (`new_data`), thời gian (`created_at`), địa chỉ IP / User-Agent.
11. **Phân quyền chặt chẽ (Zero-Trust RBAC):**  
    - **Admin:** Quản trị toàn hệ thống.
    - **Staff:** Chỉ thao tác nghiệp vụ tại quầy, bán vé, in vé, soát vé, quản lý ca làm việc được giao.
    - **User:** Quản lý vé cá nhân, lịch sử giao dịch, thông tin hồ sơ của chính mình.
    - **Guest:** Quyền tối thiểu; đặt vé/yêu cầu phải qua quy trình kiểm duyệt hoặc tạo đơn chờ xử lý với hạn thời gian (TTL).
12. **Bảo mật kết nối Database:**  
    Tuyệt đối không để Frontend kết nối trực tiếp đến Database bằng `SUPABASE_SERVICE_ROLE_KEY` hoặc chuỗi kết nối Database quản trị. Các credentials này chỉ được lưu trữ và sử dụng trong môi trường Server (`src/app/api/...` hoặc Server Action).
13. **Ưu tiên xóa mềm (Soft Delete):**  
    Các dữ liệu liên quan đến lịch sử giao dịch, vé, phim, suất chiếu, ca làm việc, mã giảm giá phải dùng trường `deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL`. Chỉ ẩn trên UI, không dùng lệnh `DELETE` vật lý trừ khi có quy trình dọn dẹp dữ liệu lưu trữ định kỳ.
14. **Thiết kế chống trùng lặp (Idempotency):**  
    Các request nhạy cảm (đặt vé, thanh toán, áp mã giảm giá) bắt buộc phải truyền header `Idempotency-Key` (hoặc `request_id`). Nếu client bị mất mạng và bấm gửi lại, Backend sẽ kiểm tra key này để trả về kết quả đã xử lý trước đó thay vì tạo thêm vé/đơn hàng mới.
15. **Tách biệt rõ ràng các tầng kiến trúc (Clean Architecture):**  
    - **Presentation Layer (Frontend):** Nhận tương tác người dùng, hiển thị UI, dispatch request.
    - **API / Controller Layer:** Tiếp nhận HTTP request, parse body, validate schema (Zod/DTO), trích xuất actor context (token/session).
    - **Business Service Layer:** Thực hiện quy tắc nghiệp vụ, tính toán tiền, kiểm tra trạng thái logic.
    - **Data Access / Repository Layer:** Tương tác với PostgreSQL thông qua Supabase/ORM với transaction an toàn.
    - **Realtime Event Publisher:** Phát event sau khi commit DB thành công.

---

## 2. Quy Tắc Phân Quyền Theo Role (RBAC Matrix)

| Tài nguyên / Nghiệp vụ | GUEST | USER | STAFF | ADMIN |
| :--- | :---: | :---: | :---: | :---: |
| **Xem danh sách phim & suất chiếu** | Đọc | Đọc | Đọc | Đọc / Ghi |
| **Tạo yêu cầu giữ ghế (Seat Hold)** | Giữ tạm có TTL | Giữ tạm có TTL | Giữ tạm / Đặt tại quầy | Toàn quyền |
| **Đặt vé & Thanh toán** | Tạo đơn chờ | Đặt vé của mình | Xuất vé tại quầy | Toàn quyền |
| **Hủy vé / Hoàn tiền** | Không | Yêu cầu hủy (chờ duyệt) | Xử lý theo quy định | Toàn quyền |
| **Quản lý Mã giảm giá (Coupons)** | Xem mã public | Dùng mã của mình | Áp mã tại quầy | Tạo / Sửa / Xóa |
| **Báo cáo Doanh thu & Thống kê ca** | Không | Không | Xem doanh thu ca trực của mình | Xem toàn bộ hệ thống |
| **Xem Audit Log** | Không | Không | Không | Xem toàn bộ |

---

## 3. Thiết Kế Schema Mẫu & Cơ Chế Audit Log

### 3.1. Bảng lưu Audit Log (`audit_logs`)
```sql
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE'
    actor_id UUID,
    actor_role VARCHAR(20) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id, actor_role);
```

### 3.2. Cấu trúc bảng có Versioning & Soft Delete (Ví dụ: `coupons`)
```sql
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'FIXED',
    discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
    min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    apply_scope VARCHAR(30) NOT NULL DEFAULT 'ALL',
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    usage_limit INT DEFAULT 100,
    used_count INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

---

## 4. Đặc Tả Luồng Mẫu (End-to-End Examples)

### Luồng 1: Admin Chỉnh Sửa Mã Giảm Giá
1. **Admin UI:** Admin chỉnh sửa mức giảm của voucher `CINEMAX50K` trên giao diện và bấm "Lưu Thay Đổi".
2. **Client Request:** Gửi `PUT /api/v1/admin/coupons/:id` kèm Header `Authorization: Bearer <Admin_JWT>` và body `{ discount_value: 60000, expected_version: 3 }`.
3. **Backend API:**
   - Middleware giải mã JWT, xác nhận `role === 'ADMIN'`.
   - Bắt đầu Database Transaction:
     - Kiểm tra `coupons` với `id = :id AND version = 3 AND deleted_at IS NULL`.
     - Nếu khớp, thực hiện update: `discount_value = 60000, version = 4, updated_at = NOW()`.
     - Ghi bản ghi vào bảng `audit_logs` lưu `{ old_data: { discount_value: 50000 }, new_data: { discount_value: 60000 } }`.
     - Commit Transaction.
4. **Realtime Broadcast:**
   - Server phát sự kiện kênh `system_updates`:
     ```json
     {
       "eventId": "evt_987654",
       "entityType": "COUPON",
       "entityId": "uuid-coupon-1",
       "action": "UPDATED",
       "actorId": "admin-uuid",
       "actorRole": "ADMIN",
       "timestamp": "2026-10-17T12:00:00Z",
       "version": 4,
       "data": { "code": "CINEMAX50K", "discount_value": 60000, "apply_scope": "ALL" }
     }
     ```
5. **Client Consume:**
   - **Admin UI:** Cập nhật trạng thái thành công, tắt modal.
   - **User/Guest UI (Đang ở trang giỏ hàng):** Nhận event realtime, tự động tính lại tổng tiền vé theo mức giảm mới 60.000đ mà không cần F5 trang.

---

### Luồng 2: Khách Vãng Lai (Guest) Gửi Yêu Cầu Đặt Vé
1. **Guest UI:** Khách chọn ghế `E05`, điền email và số điện thoại, bấm "Xác Nhận Đặt Vé".
2. **Client Request:** Gửi `POST /api/v1/public/bookings` kèm Header `Idempotency-Key: idemp_112233` và body `{ showtime_id, seat_codes: ['E05'], guest_email, guest_phone }`.
3. **Backend API:**
   - Kiểm tra xem `Idempotency-Key` đã từng xử lý chưa. Nếu có, trả về kết quả cũ.
   - Bắt đầu Database Transaction (Isolation Level: `SERIALIZABLE` hoặc dùng row-lock `FOR UPDATE`):
     - Kiểm tra ghế `E05` của suất chiếu: Nếu đã có người đặt hoặc đang bị lock, rollback và trả về lỗi `409 Seat Already Taken`.
     - Tạo bản ghi `seat_locks` hoặc `bookings` với trạng thái `PENDING_PAYMENT` có thời hạn 10 phút.
     - Commit Transaction.
4. **Realtime Broadcast:**
   - Bắn event `SEAT_LOCKED` đến kênh công khai của suất chiếu đó để toàn bộ khách khác và nhân viên quầy Staff thấy ghế `E05` đổi sang màu đỏ/khóa ngay lập tức.
   - Bắn thông báo `NEW_BOOKING_REQUEST` đến kênh nội bộ của Admin Dashboard.
5. **Xử lý lỗi / Timeout:**
   - Nếu thanh toán thất bại hoặc quá 10 phút không thanh toán: Background Cronjob / DB Trigger tự hủy lock và bắn event `SEAT_RELEASED` để trả ghế về trạng thái trống.

---

## 5. Danh Mục Chống Chỉ Định (Anti-Patterns Cấm Làm)

* ❌ **CẤM:** Dùng mảng JavaScript tĩnh (hardcoded array) trong file frontend để làm dữ liệu hiển thị chính.
* ❌ **CẤM:** Lưu danh sách vé hoặc doanh thu vào `localStorage` rồi đọc từ `localStorage` để tính tổng tiền của rạp.
* ❌ **CẤM:** Dùng `BroadcastChannel` giữa các tab client để giả lập việc dữ liệu đã được lưu xuống database.
* ❌ **CẤM:** Client gọi trực tiếp câu lệnh `supabase.from('...').insert()` hoặc `.delete()` với `service_role_key` lộ ở trình duyệt.
* ❌ **CẤM:** Báo cho người dùng "Đặt vé thành công" khi API mới chỉ nhận request mà Database chưa hoàn thành transaction.
