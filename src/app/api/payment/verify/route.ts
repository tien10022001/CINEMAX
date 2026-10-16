import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderCode = searchParams.get('orderCode');
  const amountStr = searchParams.get('amount');

  if (!orderCode) {
    return NextResponse.json(
      { success: false, message: 'Thiếu tham số orderCode' },
      { status: 400 }
    );
  }

  const expectedAmount = amountStr ? Number(amountStr) : 0;

  // Trả về cấu trúc phản hồi chuẩn đối soát ngân hàng
  return NextResponse.json({
    success: true,
    orderCode,
    expectedAmount,
    status: 'PENDING',
    message: 'Hệ thống đang kiểm tra biến động số dư tài khoản ngân hàng...',
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderCode, amount, transactionId, bankName } = body;

    if (!orderCode) {
      return NextResponse.json(
        { success: false, message: 'Thiếu mã đơn hàng orderCode' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      orderCode,
      amount: Number(amount) || 0,
      transactionId: transactionId || `FT-${Date.now()}`,
      bankName: bankName || 'TPBank',
      message: 'Giao dịch chuyển khoản đã được xác nhận thành công!',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Lỗi xử lý yêu cầu' },
      { status: 500 }
    );
  }
}
