import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');

    // Mẫu tài khoản hội viên hiện tại
    const user = {
      id: 'usr-cust-001',
      full_name: 'Nguyễn Văn A',
      email: 'user@cinemax.vn',
      phone: '0912345678',
      role: 'user',
      role_code: 'CUSTOMER',
      loyalty_points: 15000,
      membership_tier: 'VIP',
      created_at: '2026-02-15T00:00:00.000Z'
    };

    return NextResponse.json({
      success: true,
      user
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
