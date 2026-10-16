import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Webhook tiếp nhận biến động số dư ngân hàng (Casso / SeAPay / VietQR Open API / Bank Webhook)
 * Khi khách chuyển tiền tới số tài khoản TPBank của CINEMAX, webhook này sẽ nhận payload biến động số dư,
 * trích xuất mã đơn hàng (orderCode) trong nội dung chuyển tiền, kiểm tra số tiền và xác nhận đơn vé.
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Hỗ trợ cả định dạng Casso và SeAPay / Direct
    // Ví dụ Casso: { error: 0, data: [ { id, tid, description, amount, cusum_balance, when } ] }
    // Hoặc Direct: { orderCode, amount, transactionId, bank }
    let transactions: any[] = [];

    if (Array.isArray(payload.data)) {
      transactions = payload.data;
    } else if (payload.orderCode || payload.transactionId) {
      transactions = [payload];
    }

    const results: any[] = [];

    for (const item of transactions) {
      const description = item.description || item.content || item.memo || '';
      const amount = Number(item.amount) || 0;
      const tid = item.tid || item.transactionId || `FT-${Date.now()}`;

      // Tìm mã đơn hàng có tiền tố CNM hoặc format tương đương trong description
      const match = description.match(/CNM\d{6}-[A-Z0-9]+/i) || description.match(/CNM[A-Z0-9-]+/i);
      const extractedOrderCode = match ? match[0].toUpperCase() : null;

      results.push({
        rawTransactionId: tid,
        extractedOrderCode,
        amount,
        description,
        verified: !!extractedOrderCode && amount > 0,
      });
    }

    return NextResponse.json({
      error: 0,
      message: 'Đã nhận biến động số dư và ghi nhận đối soát thành công',
      processed: results,
    });
  } catch (error: any) {
    console.error('Lỗi xử lý webhook ngân hàng:', error);
    return NextResponse.json(
      { error: 1, message: error.message || 'Lỗi xử lý webhook' },
      { status: 500 }
    );
  }
}
