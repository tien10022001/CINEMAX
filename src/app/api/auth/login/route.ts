import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email là bắt buộc.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Tài khoản mẫu chuẩn phân quyền
    const users = [
      {
        id: 'usr-admin-001',
        full_name: 'Quản trị viên Cinemax',
        email: 'admin@cinemax.vn',
        password: 'admin',
        role: 'admin',
        role_code: 'ADMIN',
        loyalty_points: 9999,
        membership_tier: 'VVIP'
      },
      {
        id: 'usr-staff-001',
        full_name: 'Trần Minh Quân',
        email: 'staff@cinemax.vn',
        password: 'staff',
        role: 'staff',
        role_code: 'STAFF',
        loyalty_points: 500,
        membership_tier: 'MEMBER'
      },
      {
        id: 'usr-staff-003',
        full_name: 'Nguyễn Văn Thu Ngân',
        email: 'pos.cashier@cinemax.vn',
        password: 'staff',
        role: 'staff',
        role_code: 'STAFF',
        staff_permissions: ['POS'],
        staff_position: 'Nhân viên Quầy Vé (POS)',
        loyalty_points: 200,
        membership_tier: 'MEMBER'
      },
      {
        id: 'usr-cust-001',
        full_name: 'Nguyễn Văn A',
        email: 'user@cinemax.vn',
        password: 'password123',
        role: 'user',
        role_code: 'CUSTOMER',
        loyalty_points: 15000,
        membership_tier: 'VIP'
      }
    ];

    const user = users.find(
      (u) =>
        u.email === cleanEmail &&
        (u.password === password ||
          (u.email === 'user@cinemax.vn' && (password === 'user123' || password === 'password123')) ||
          (u.role === 'staff' && (password === 'staff' || password === 'staff123')))
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Email hoặc mật khẩu không chính xác.' },
        { status: 401 }
      );
    }

    const token = 'token-' + Math.random().toString(36).substring(2) + Date.now().toString(36);

    return NextResponse.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        role_code: user.role_code,
        staff_permissions: (user as any).staff_permissions,
        staff_position: (user as any).staff_position,
        loyalty_points: user.loyalty_points,
        membership_tier: user.membership_tier
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Lỗi máy chủ.' }, { status: 500 });
  }
}
