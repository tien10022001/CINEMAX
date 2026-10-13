# 🎬 CINEMAX — Cinema Ticketing & Theater Management Platform

> **Dự án chuyên ngành:** Website Đặt Vé Xem Phim & Quản Trị Rạp Chiếu Phim  
> **Đơn vị đào tạo:** FPT Polytechnic  
> **Giảng viên hướng dẫn:** Thầy Nguyễn Thành Trung  
> **Nhóm thực hiện (HK2T):**
> 1. Trương Công Tiến (Leader)
> 2. Trương Văn Hoàn
> 3. Phạm Thế Trắc
> 4. Quách Duy Khánh

---

## 🚀 1. Hướng Dẫn Cài Đặt Dành Cho Thành Viên Nhóm

Mọi thành viên khi clone mã nguồn về máy đều kết nối chung vào **Database Supabase Cloud** duy nhất của nhóm.

### Bước 1: Clone mã nguồn & Cài đặt thư viện
```bash
git clone <URL_REPO_GITHUB>
cd CINEMAX
npm install
```

### Bước 2: Thiết lập file môi trường (`.env.local`)
Tạo file `.env.local` tại thư mục gốc `CINEMAX/` (hoặc sao chép từ `.env.example`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://cycuxhztpvezqcznifqh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_g_o1rXOoH48TQ80fcAYD6g_vsk-tcs0
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_g_o1rXOoH48TQ80fcAYD6g_vsk-tcs0
```

### Bước 3: Khởi chạy dự án ở môi trường phát triển
```bash
npm run dev
```
Truy cập trình duyệt tại: **http://localhost:3000**

---

## 🛠️ 2. Công Nghệ Sử Dụng (Tech Stack)

| Thành phần | Công nghệ / Thư viện |
|---|---|
| **Frontend Framework** | Next.js 15/16 (App Router, Turbopack) |
| **Ngôn ngữ** | TypeScript |
| **Styling** | Tailwind CSS v4, Lucide Icons |
| **Backend & Database** | Supabase (PostgreSQL 17, Row Level Security, RPC Functions) |
| **Authentication** | Supabase Auth (`@supabase/ssr`) |
| **Quản lý mã nguồn** | Git & GitHub |

---

## 📁 3. Cấu Trúc Thư Mục Dự Án

```text
CINEMAX/
├── public/                     # Static assets (logo, icons, banner)
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (customer)/         # Giao diện khách hàng (trang chủ, phim, đặt vé)
│   │   ├── admin/              # Giao diện Quản trị viên (Master Admin Suite)
│   │   └── api/                # Route Handlers / Webhooks thanh toán
│   ├── components/             # Reusable UI Components
│   ├── lib/
│   │   ├── supabase/           # Supabase client & server helpers
│   │   │   ├── client.ts       # Browser client cho Client Components
│   │   │   └── server.ts       # Server client cho Server Components & Actions
│   │   ├── types.ts            # TypeScript interfaces chuẩn hóa
│   │   └── data-context.tsx    # State management
│   └── proxy.ts                # Next.js session middleware proxy
├── supabase/
│   ├── migrations/             # 4 file SQL migrations theo thứ tự
│   └── full_setup_single_file.sql # File tổng hợp 1-click tạo DB Supabase
├── THIET_KE_CSDL_VA_PHAN_QUYEN_CHUAN_HOA.md # Bản đặc tả ERD 28 bảng & Ma trận RBAC
└── .env.example                # File mẫu cấu hình Supabase cho team
```

---

## 📋 4. Quy Chuẩn Làm Việc Của Nhóm (Git Workflow)

1. **Phân chia nhánh (Branching):**
   * `main`: Nhánh production ổn định, chỉ merge qua Pull Request sau khi kiểm tra.
   * `dev`: Nhánh tích hợp chính của nhóm.
   * `feature/<ten-tinh-nang>`: Nhánh làm việc riêng của từng thành viên (VD: `feature/booking-seatmap`, `feature/pos-terminal`).
2. **Quy chuẩn thông điệp Commit:**
   * Cấu trúc: `[Tên thành viên]_[Tên chức năng]_[Tiến độ]`
   * *Ví dụ:* `tien_setup_supabase_db_100%`, `hoan_create_seat_map_ui_50%`, `trac_food_combo_api_80%`, `khanh_pos_shift_modal_60%`.

---

## 📚 5. Tài Liệu Tham Khảo Nghiệp Vụ

* Đặc tả CSDL và Phân quyền: [`THIET_KE_CSDL_VA_PHAN_QUYEN_CHUAN_HOA.md`](./THIET_KE_CSDL_VA_PHAN_QUYEN_CHUAN_HOA.md)
* File Excel thiết kế CSDL: [`../HK2T_1-rap_database-redesign.xlsx`](../HK2T_1-rap_database-redesign.xlsx)
