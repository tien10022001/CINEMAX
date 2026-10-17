import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, phone, email, password } = body;

    if (!fullName || !phone || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng điền đầy đủ các trường bắt buộc.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const newUser = {
      id: 'usr-' + Date.now(),
      full_name: fullName.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      role: 'user',
      role_code: 'CUSTOMER',
      loyalty_points: 50,
      membership_tier: 'MEMBER',
      created_at: new Date().toISOString()
    };

    const token = 'token-' + Math.random().toString(36).substring(2) + Date.now().toString(36);

    return NextResponse.json(
      {
        success: true,
        message: 'Đăng ký tài khoản thành viên thành công!',
        token,
        user: {
          id: newUser.id,
          full_name: newUser.full_name,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
          role_code: newUser.role_code,
          loyalty_points: newUser.loyalty_points,
          membership_tier: newUser.membership_tier
        }
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Lỗi đăng ký.' }, { status: 500 });
  }
}
