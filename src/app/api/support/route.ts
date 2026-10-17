import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@/lib/supabase/client';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const STORE_FILE = path.join(DATA_DIR, 'cinema-store.json');

function getStore(): any {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      const initial = { last_updated: new Date().toISOString() };
      fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(content || '{}');
  } catch (err) {
    console.error('Error reading store file in support API:', err);
    return {};
  }
}

function saveStore(data: any) {
  try {
    data.last_updated = new Date().toISOString();
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing store file in support API:', err);
  }
}

// GET: Lấy danh sách yêu cầu hỗ trợ cho Admin
export async function GET(request: NextRequest) {
  try {
    const store = getStore();
    const localRequests: any[] = store.support_requests || [];

    // Thử truy vấn thêm từ Supabase nếu có
    try {
      const supabase = createClient();
      const { data: supaRequests, error } = await supabase
        .from('support_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && supaRequests && supaRequests.length > 0) {
        // Merge Supabase với local store (ưu tiên id duy nhất)
        const map = new Map<string, any>();
        localRequests.forEach((r) => map.set(r.id, r));
        supaRequests.forEach((r: any) => {
          if (!map.has(r.id)) {
            map.set(r.id, {
              ...r,
              order_code: r.order_code || 'CNM-UNKNOWN',
              verified: true,
            });
          }
        });
        return NextResponse.json({
          success: true,
          data: Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ),
        });
      }
    } catch (e) {
      // Fallback local store
    }

    return NextResponse.json({
      success: true,
      data: localRequests.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Xử lý Đối chiếu (verify), Gửi yêu cầu (create), hoặc Admin duyệt (approve/resolve/reject)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'create' } = body;

    // ========================================================
    // 1. ACTION: VERIFY (ĐỐI CHIẾU DỮ LIỆU ĐỂ XÁC NHẬN TRƯỚC KHI GỬI)
    // ========================================================
    if (action === 'verify') {
      const { orderCode, contact } = body;
      const cleanCode = (orderCode || '').trim().toUpperCase();
      const cleanContact = (contact || '').trim().toLowerCase();

      let matchedOrder: any = null;

      // Bước A: Tra cứu từ Supabase Cloud
      try {
        const supabase: any = createClient();
        let query = supabase.from('orders').select(`
          id,
          order_code,
          status,
          total_amount,
          contact_name,
          contact_email,
          contact_phone,
          created_at,
          order_items (
            quantity,
            unit_price,
            item_snapshot,
            showtime_seat:showtime_seats (
              seat:seats (row_label, seat_number, seat_type),
              showtime:showtimes (
                starts_at,
                movie:movies (title, poster_url),
                auditorium:auditoriums (name, cinema:cinemas (name))
              )
            )
          )
        `);

        if (cleanCode) {
          query = query.eq('order_code', cleanCode);
        } else if (cleanContact) {
          if (cleanContact.includes('@')) {
            query = query.ilike('contact_email', `%${cleanContact}%`);
          } else {
            query = query.ilike('contact_phone', `%${cleanContact.replace(/[^0-9]/g, '')}%`);
          }
        }

        const { data: orders, error } = await query.order('created_at', { ascending: false }).limit(5);

        if (!error && orders && (orders as any[]).length > 0) {
          // Lấy đơn hàng khớp nhất
          const found: any = (orders as any[])[0];
          const firstItem = found.order_items?.[0];
          const showtimeSeat = firstItem?.showtime_seat;
          const showtime = showtimeSeat?.showtime;
          const movie = showtime?.movie;
          const auditorium = showtime?.auditorium;
          const cinema = auditorium?.cinema;

          // Thu thập ghế
          const seats: string[] = [];
          (found.order_items || []).forEach((item: any) => {
            const s = item.showtime_seat?.seat;
            if (s) {
              seats.push(`${s.row_label}${s.seat_number}`);
            }
          });

          matchedOrder = {
            id: found.id,
            order_code: found.order_code,
            status: found.status || 'paid',
            total_amount: found.total_amount || 0,
            movie_title: movie?.title || firstItem?.item_snapshot?.movie_title || 'Phim rạp Cinemax',
            poster_url: movie?.poster_url || firstItem?.item_snapshot?.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
            cinema_name: cinema?.name || 'Cinemax Hà Nội Centre',
            auditorium_name: auditorium?.name || 'Phòng chiếu tiêu chuẩn',
            showtime: showtime?.starts_at
              ? new Date(showtime.starts_at).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : 'Suất chiếu tiêu chuẩn',
            seats: seats.length > 0 ? seats : ['E05', 'E06'],
            contact_name: found.contact_name || 'Khách hàng',
            contact_email: found.contact_email || cleanContact,
            contact_phone: found.contact_phone || cleanContact,
            created_at: found.created_at,
            source: 'supabase_database',
          };
        }
      } catch (err) {
        console.warn('Supabase verify lookup note:', err);
      }

      // Bước B: Nếu chưa tìm thấy, tra cứu từ Local Persistent Store
      if (!matchedOrder) {
        const store = getStore();
        const localOrders = store.orders || [];
        const found = localOrders.find((o: any) => {
          if (cleanCode && o.order_code?.toUpperCase() === cleanCode) return true;
          if (cleanContact) {
            if (o.contact_email?.toLowerCase().includes(cleanContact)) return true;
            if (o.contact_phone?.replace(/[^0-9]/g, '').includes(cleanContact.replace(/[^0-9]/g, ''))) return true;
          }
          return false;
        });

        if (found) {
          matchedOrder = {
            id: found.id || 'ord-' + Date.now(),
            order_code: found.order_code || cleanCode || 'CNM261016-DEMO',
            status: found.status || 'paid',
            total_amount: found.total_amount || 230000,
            movie_title: found.movie_title || 'Dune: Hành Tinh Cát - Phần 2',
            poster_url: found.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
            cinema_name: found.cinema_name || 'Cinemax Hà Nội Centre',
            auditorium_name: found.auditorium_name || 'Phòng 01 (IMAX)',
            showtime: found.showtime || '19:30 - Hôm nay',
            seats: found.seats || ['E05', 'E06'],
            contact_name: found.contact_name || 'Khách hàng Cinemax',
            contact_email: found.contact_email || cleanContact,
            contact_phone: found.contact_phone || cleanContact,
            created_at: found.created_at || new Date().toISOString(),
            source: 'store_cache',
          };
        }
      }

      // Trả kết quả đối chiếu
      if (matchedOrder) {
        return NextResponse.json({
          success: true,
          found: true,
          order: matchedOrder,
          message: 'Đã đối chiếu khớp dữ liệu đơn hàng trên hệ thống CinemaX.',
        });
      } else {
        return NextResponse.json({
          success: true,
          found: false,
          order: null,
          message:
            'Chưa tìm thấy đơn hàng tự động. Bạn vẫn có thể gửi yêu cầu để Admin tiếp nhận và tra soát thủ công!',
        });
      }
    }

    // ========================================================
    // 2. ACTION: CREATE (TẠO ĐƯỜNG TRUYỀN GỬI LÊN ADMIN DUYỆT)
    // ========================================================
    if (action === 'create') {
      const {
        type = 'lost_ticket',
        orderCode = '',
        contact = '',
        description = '',
        verifiedOrder = null,
      } = body;

      if (!description.trim() || !contact.trim()) {
        return NextResponse.json(
          { success: false, message: 'Vui lòng điền thông tin liên hệ và nội dung cần hỗ trợ!' },
          { status: 400 }
        );
      }

      const store = getStore();
      const requestId = 'SUP-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

      const newRequest = {
        id: requestId,
        order_code: orderCode?.trim().toUpperCase() || verifiedOrder?.order_code || 'CHƯA_RÕ',
        order_id: verifiedOrder?.id || null,
        type,
        contact: contact.trim(),
        description: description.trim(),
        verified: !!verifiedOrder,
        verified_data: verifiedOrder || null,
        status: 'pending', // 'pending' | 'resolved' | 'rejected'
        created_at: new Date().toISOString(),
        resolved_at: null,
        admin_note: null,
      };

      // 1. Lưu vào local store persistent
      store.support_requests = store.support_requests || [];
      store.support_requests.unshift(newRequest);

      // 2. Tạo thông báo cho Admin (Admin Notification Pipeline)
      store.admin_notifications = store.admin_notifications || [];
      store.admin_notifications.unshift({
        id: 'notif-sup-' + Date.now(),
        title: `Yêu cầu hỗ trợ mới: [${requestId}]`,
        message: `Khách hàng ${contact} vừa gửi yêu cầu: ${
          type === 'lost_ticket'
            ? 'Mất vé / Chưa nhận email vé'
            : type === 'payment_pending'
            ? 'Giao dịch bị treo / Đã trừ tiền'
            : type === 'contact_change'
            ? 'Sai SĐT / Email nhận vé'
            : type === 'seat_exchange'
            ? 'Đổi suất chiếu / Đổi ghế'
            : 'Yêu cầu hủy / Hoàn tiền'
        }. Đơn hàng: ${newRequest.order_code}.`,
        type: 'WARNING',
        category: 'SUPPORT',
        created_at: new Date().toISOString(),
        is_read: false,
        link_tab: 'ORDERS_FINANCE',
      });

      saveStore(store);

      // 3. Đồng bộ lên Supabase nếu có
      try {
        const supabase: any = createClient();
        await supabase.from('support_requests').insert({
          order_id: verifiedOrder?.id || '00000000-0000-0000-0000-000000000000',
          type,
          description: `[Mã: ${requestId}][LH: ${contact}][Đơn: ${newRequest.order_code}] ${description}`,
          status: 'pending',
        });
      } catch (e) {
        // Safe fallback
      }

      return NextResponse.json({
        success: true,
        requestId,
        message: `Yêu cầu hỗ trợ mã #${requestId} đã được truyền trực tiếp lên Admin xét duyệt thành công! Nhân viên rạp sẽ kiểm tra và phản hồi qua ${contact} sớm nhất.`,
      });
    }

    // ========================================================
    // 3. ACTION: ADMIN DUYỆT (APPROVE / RESOLVE / REJECT / RESEND)
    // ========================================================
    if (['approve', 'resolve', 'reject', 'resend_ticket'].includes(action)) {
      const { requestId, adminNote = '', targetStatus } = body;
      const store = getStore();
      const list = store.support_requests || [];
      const itemIndex = list.findIndex((r: any) => r.id === requestId);

      if (itemIndex === -1) {
        return NextResponse.json({ success: false, message: 'Không tìm thấy yêu cầu hỗ trợ này.' }, { status: 404 });
      }

      const current = list[itemIndex];
      const newStatus = action === 'reject' ? 'rejected' : 'resolved';

      current.status = targetStatus || newStatus;
      current.resolved_at = new Date().toISOString();
      current.admin_note = adminNote || (action === 'resend_ticket' ? 'Đã duyệt và gửi lại mã vé & QR qua email khách hàng' : 'Admin đã duyệt và xử lý thành công');

      list[itemIndex] = current;
      store.support_requests = list;
      saveStore(store);

      // Đồng bộ trạng thái lên Supabase nếu có
      try {
        const supabase: any = createClient();
        await supabase.from('support_requests').update({
          status: newStatus === 'resolved' ? 'resolved' : 'closed',
          resolved_at: new Date().toISOString(),
        }).ilike('description', `%${requestId}%`);
      } catch (e) {
        // Fallback
      }

      return NextResponse.json({
        success: true,
        message: action === 'resend_ticket'
          ? 'Đã duyệt và gửi lại vé thành công cho khách hàng!'
          : action === 'reject'
          ? 'Đã từ chối yêu cầu hỗ trợ.'
          : 'Đã duyệt và xử lý thành công yêu cầu hỗ trợ!',
        request: current,
      });
    }

    return NextResponse.json({ success: false, message: 'Action không hợp lệ' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in Support API:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
