import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const STORE_FILE = path.join(DATA_DIR, 'cinema-store.json');

function readStore(): any {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function writeStore(data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing store in webhook:', err);
  }
}

/**
 * Webhook tiếp nhận biến động số dư ngân hàng (Casso / SeAPay / VietQR Open API / Bank Webhook)
 * Khi khách chuyển tiền tới số tài khoản TPBank của CINEMAX, webhook này sẽ nhận payload biến động số dư,
 * trích xuất mã đơn hàng (orderCode) trong nội dung chuyển tiền, kiểm tra số tiền và xác nhận đơn vé.
 * 
 * Nghiệp vụ Late Webhook Resolution (Tiền về muộn khi ghế đã bị giải phóng):
 * - Nếu đơn hàng đã bị expired / cancelled / ghế đã mất:
 *   + Đổi trạng thái sang 'orphaned_payment'
 *   + Tự động tạo bản ghi trong support_requests và refunds để CSKH hỗ trợ hoàn tiền/đổi suất 100%
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();

    let transactions: any[] = [];
    if (Array.isArray(payload.data)) {
      transactions = payload.data;
    } else if (payload.orderCode || payload.transactionId) {
      transactions = [payload];
    }

    const results: any[] = [];
    const store = readStore();
    const orders = store.orders || [];
    let storeModified = false;

    if (!store.support_requests) store.support_requests = [];
    if (!store.refunds) store.refunds = [];

    for (const item of transactions) {
      const description = item.description || item.content || item.memo || '';
      const amount = Number(item.amount) || 0;
      const tid = item.tid || item.transactionId || `FT-${Date.now()}`;

      // Tìm mã đơn hàng có tiền tố CNM hoặc format tương đương trong description
      const match = description.match(/CNM\d{6}-[A-Z0-9]+/i) || description.match(/CNM[A-Z0-9-]+/i);
      const extractedOrderCode = match ? match[0].toUpperCase() : null;

      let resolution = 'unmatched';
      let targetOrder = null;

      if (extractedOrderCode && amount > 0) {
        targetOrder = orders.find(
          (o: any) =>
            o.code?.toUpperCase() === extractedOrderCode ||
            o.orderCode?.toUpperCase() === extractedOrderCode ||
            o.id?.toUpperCase() === extractedOrderCode
        );

        if (targetOrder) {
          const isExpiredOrCancelled =
            targetOrder.status === 'cancelled' ||
            targetOrder.status === 'expired' ||
            (targetOrder.expires_at && new Date(targetOrder.expires_at).getTime() < Date.now());

          if (isExpiredOrCancelled) {
            // TIỀN VỀ MUỘN: Chuyển sang orphaned_payment và kích hoạt hỗ trợ CSKH
            targetOrder.status = 'orphaned_payment';
            targetOrder.paid_amount = amount;
            targetOrder.transaction_id = tid;
            targetOrder.orphaned_at = new Date().toISOString();

            const supportReq = {
              id: crypto.randomUUID(),
              order_id: targetOrder.id,
              type: 'payment_pending',
              description: `Khách chuyển khoản ${amount.toLocaleString('vi-VN')} VNĐ (Mã GD: ${tid}) nhưng phiên thanh toán đã hết hạn trước khi tiền về. Cần CSKH hoàn tiền 100% hoặc hỗ trợ đổi sang suất chiếu khác.`,
              status: 'pending',
              created_at: new Date().toISOString()
            };
            store.support_requests.unshift(supportReq);

            const refundReq = {
              id: crypto.randomUUID(),
              order_id: targetOrder.id,
              reason: 'Tiền về sau khi hết phiên giữ ghế, cần CSKH hoàn tiền 100% hoặc đổi suất chiếu khác',
              amount,
              refund_type: 'automatic',
              status: 'pending',
              created_at: new Date().toISOString()
            };
            store.refunds.unshift(refundReq);

            resolution = 'orphaned_payment_ticket_created';
            storeModified = true;
          } else {
            // THANH TOÁN HỢP LỆ TRONG THỜI HẠN
            targetOrder.status = 'paid';
            targetOrder.paid_at = new Date().toISOString();
            targetOrder.paid_amount = amount;
            targetOrder.transaction_id = tid;
            resolution = 'order_confirmed_paid';
            storeModified = true;
          }
        }
      }

      results.push({
        rawTransactionId: tid,
        extractedOrderCode,
        amount,
        description,
        verified: !!extractedOrderCode && amount > 0,
        resolution,
        orderId: targetOrder?.id || null,
      });
    }

    if (storeModified) {
      store.last_updated = new Date().toISOString();
      writeStore(store);
    }

    return NextResponse.json({
      error: 0,
      message: 'Đã nhận biến động số dư và hoàn tất đối soát nghiệp vụ',
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
