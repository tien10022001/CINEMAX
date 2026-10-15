import { createClient as baseCreateClient } from '@/lib/supabase/client';
import type { PaymentProviderT } from '@/types/database';

const createClient = (): any => baseCreateClient();

export interface ConfirmPaymentResult {
  success: boolean;
  order_code: string;
  total_amount: number;
  message?: string;
}

export interface InvoiceRequestInput {
  orderId: string;
  taxCode: string;
  companyName: string;
  address: string;
  email: string;
}

export interface IssuedTicket {
  ticketId: string;
  ticketCode: string;
  qrHash: string;
  seatLabel: string;
  seatType: string;
  movieTitle: string;
  showtime: string;
  roomName: string;
  status: string;
}

export class PaymentService {
  /**
   * Gọi Stored Procedure confirm_order_payment để xác nhận thanh toán, phát hành vé QR
   */
  static async confirmPayment(
    orderId: string,
    provider: PaymentProviderT = 'MOMO',
    providerTxnId?: string
  ): Promise<ConfirmPaymentResult> {
    const supabase = createClient();
    const txnId = providerTxnId || `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const { data, error } = await supabase.rpc('confirm_order_payment', {
      p_order_id: orderId,
      p_provider: provider,
      p_provider_txn_id: txnId,
    });

    if (error) {
      console.error('Error confirming payment:', error);
      throw new Error(error.message || 'Xác nhận thanh toán thất bại');
    }

    const res = data as any;
    return {
      success: res.success,
      order_code: res.order_code,
      total_amount: Number(res.total_amount),
      message: res.message,
    };
  }

  /**
   * Yêu cầu xuất hóa đơn VAT điện tử (Lưu vào bảng invoice_requests)
   */
  static async requestInvoice(input: InvoiceRequestInput): Promise<boolean> {
    const supabase = createClient();

    const { error } = await supabase.from('invoice_requests').insert({
      order_id: input.orderId,
      tax_code: input.taxCode,
      company_name: input.companyName,
      address: input.address,
      email: input.email,
      status: 'pending',
    });

    if (error) {
      console.error('Error creating invoice request:', error);
      return false;
    }
    return true;
  }

  /**
   * Lấy danh sách vé đã phát hành của đơn hàng
   */
  static async getOrderTickets(orderId: string): Promise<IssuedTicket[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        qr_token_hash,
        status,
        order_items!inner (
          id,
          item_snapshot,
          showtimes (
            starts_at,
            auditoriums (name),
            movies (title)
          )
        )
      `)
      .eq('order_items.order_id', orderId);

    if (error || !data) {
      console.error('Error fetching tickets for order:', error);
      return [];
    }

    return (data || []).map((t: any) => {
      const oi = t.order_items;
      const snapshot = oi?.item_snapshot || {};
      const st = oi?.showtimes;
      return {
        ticketId: t.id,
        ticketCode: `TKT-${t.id.substring(0, 8).toUpperCase()}`,
        qrHash: t.qr_token_hash,
        seatLabel: snapshot.seat_label || 'Ghế',
        seatType: snapshot.seat_type || 'STANDARD',
        movieTitle: st?.movies?.title || 'Phim',
        showtime: st?.starts_at ? new Date(st.starts_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '',
        roomName: st?.auditoriums?.name || 'Phòng chiếu',
        status: t.status,
      };
    });
  }
}
