/**
 * CINEMAX FULL-STACK SERVER (HTTP + REST API + WEBSOCKET ENGINE)
 * Chạy ngay lập tức với lệnh: node server.js
 * Tự động phục vụ giao diện tĩnh và toàn bộ API cho Task User & Khách hàng
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataStore = require('./src/models/dataStore');
const seatHoldManager = require('./src/services/seatHoldManager');
const pricingService = require('./src/services/pricingService');
const CinemaxSocketServer = require('./src/websocket/socketServer');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types phổ biến cho static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper đọc body request dạng JSON
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

// Helper gửi response JSON
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Id'
  });
  res.end(JSON.stringify(data));
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Id'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // ==========================================
    // 1. REST API: MOVIES
    // ==========================================
    if (pathname === '/api/movies' && method === 'GET') {
      const status = parsedUrl.searchParams.get('status');
      const genre = parsedUrl.searchParams.get('genre');
      const search = parsedUrl.searchParams.get('search');

      let result = [...dataStore.movies];
      if (status && status !== 'all') {
        if (status === 'sneak_show') {
          result = result.filter(m => m.is_sneak_show);
        } else {
          result = result.filter(m => m.status === status);
        }
      }
      if (genre && genre !== 'all') {
        result = result.filter(m => m.genres.includes(genre));
      }
      if (search) {
        const q = search.toLowerCase();
        result = result.filter(m => m.title.toLowerCase().includes(q) || m.director.toLowerCase().includes(q));
      }

      return sendJSON(res, 200, { success: true, count: result.length, data: result });
    }

    if (pathname.startsWith('/api/movies/') && method === 'GET') {
      const id = pathname.split('/')[3];
      const movie = dataStore.movies.find(m => m.id === id || m.slug === id);
      if (!movie) return sendJSON(res, 404, { success: false, error: 'Không tìm thấy phim' });
      return sendJSON(res, 200, { success: true, data: movie });
    }

    // ==========================================
    // 2. REST API: CINEMAS
    // ==========================================
    if (pathname === '/api/cinemas' && method === 'GET') {
      return sendJSON(res, 200, { success: true, data: dataStore.cinemas });
    }

    // ==========================================
    // 3. REST API: SHOWTIMES
    // ==========================================
    if (pathname === '/api/showtimes' && method === 'GET') {
      const movieId = parsedUrl.searchParams.get('movie_id');
      const cinemaId = parsedUrl.searchParams.get('cinema_id');
      const date = parsedUrl.searchParams.get('date');

      let result = [...dataStore.showtimes];
      if (movieId) result = result.filter(s => s.movie_id === movieId);
      if (cinemaId) result = result.filter(s => s.cinema_id === cinemaId);
      if (date) result = result.filter(s => s.date === date);

      return sendJSON(res, 200, { success: true, count: result.length, data: result });
    }

    // ==========================================
    // 4. REST API: SEATS PER SHOWTIME
    // ==========================================
    if (pathname.match(/^\/api\/showtimes\/[^\/]+\/seats$/) && method === 'GET') {
      const showtimeId = pathname.split('/')[3];
      const sessionId = req.headers['x-session-id'] || 'default-session';
      const seats = dataStore.getShowtimeSeats(showtimeId);
      const showtime = dataStore.showtimes.find(s => s.id === showtimeId);

      return sendJSON(res, 200, {
        success: true,
        showtime: showtime,
        data: seats.map(s => ({
          ...s,
          is_mine: (s.held_by === sessionId)
        }))
      });
    }

    // ==========================================
    // 5. REST API: HOLD SEATS (HTTP Fallback)
    // ==========================================
    if (pathname === '/api/bookings/hold' && method === 'POST') {
      const body = await parseRequestBody(req);
      const { showtimeId, seatIds, userId } = body;
      const sessionId = req.headers['x-session-id'] || body.sessionId || crypto.randomBytes(8).toString('hex');

      const result = await seatHoldManager.holdSeats(showtimeId, seatIds, sessionId, userId);
      return sendJSON(res, result.success ? 200 : 409, {
        ...result,
        sessionId
      });
    }

    // ==========================================
    // 6. REST API: RELEASE SEATS
    // ==========================================
    if (pathname === '/api/bookings/release' && method === 'POST') {
      const body = await parseRequestBody(req);
      const { showtimeId, seatIds } = body;
      const sessionId = req.headers['x-session-id'] || body.sessionId;

      const result = await seatHoldManager.releaseSeats(showtimeId, seatIds, sessionId);
      return sendJSON(res, 200, result);
    }

    // ==========================================
    // 7. REST API: CONCESSIONS (BẮP NƯỚC)
    // ==========================================
    if (pathname === '/api/concessions' && method === 'GET') {
      return sendJSON(res, 200, {
        success: true,
        products: dataStore.products,
        modifiers: dataStore.productModifiers
      });
    }

    // ==========================================
    // 8. REST API: VALIDATE COUPON
    // ==========================================
    if (pathname === '/api/coupons/validate' && method === 'POST') {
      const body = await parseRequestBody(req);
      const { code, subtotal, ticketSubtotal, comboSubtotal } = body;

      const coupon = dataStore.coupons.find(c => c.code.toUpperCase() === (code || '').trim().toUpperCase() && c.active);
      if (!coupon) {
        return sendJSON(res, 404, { success: false, error: 'Mã giảm giá không tồn tại hoặc đã hết hạn.' });
      }

      let eligibleBase = subtotal;
      if (coupon.apply_scope === 'TICKET_ONLY') eligibleBase = ticketSubtotal || subtotal;
      if (coupon.apply_scope === 'COMBO_ONLY') eligibleBase = comboSubtotal || 0;

      if (eligibleBase < (coupon.min_order_amount || 0)) {
        return sendJSON(res, 400, {
          success: false,
          error: `Đơn hàng chưa đạt mức tối thiểu ${coupon.min_order_amount.toLocaleString('vi-VN')} đ để dùng mã này.`
        });
      }

      let discount = 0;
      if (coupon.discount_type === 'PERCENT') {
        discount = (eligibleBase * coupon.discount_value) / 100;
        if (coupon.max_discount && discount > coupon.max_discount) {
          discount = coupon.max_discount;
        }
      } else {
        discount = Math.min(coupon.discount_value, eligibleBase);
      }

      return sendJSON(res, 200, {
        success: true,
        coupon: {
          code: coupon.code,
          discount_amount: discount,
          apply_scope: coupon.apply_scope,
          description: coupon.description
        }
      });
    }

    // ==========================================
    // 9. REST API: CALCULATE ORDER PRICE
    // ==========================================
    if (pathname === '/api/bookings/calculate' && method === 'POST') {
      const body = await parseRequestBody(req);
      const { showtimeId, seatIds, audienceTypes, concessions, couponCode, loyaltyPointsUsed } = body;

      const allSeats = dataStore.getShowtimeSeats(showtimeId);
      const selectedSeatObjs = allSeats.filter(s => seatIds.includes(s.seat_id));

      const calcResult = pricingService.calculateOrder(
        selectedSeatObjs,
        audienceTypes || {},
        concessions || [],
        couponCode,
        loyaltyPointsUsed || 0
      );

      return sendJSON(res, 200, { success: true, data: calcResult });
    }

    // ==========================================
    // 10. REST API: CHECKOUT / CREATE ORDER
    // ==========================================
    if (pathname === '/api/bookings/checkout' && method === 'POST') {
      const body = await parseRequestBody(req);
      const {
        showtimeId,
        seatIds,
        audienceTypes,
        concessions,
        couponCode,
        loyaltyPointsUsed,
        contactName,
        contactEmail,
        contactPhone,
        paymentProvider,
        userId
      } = body;

      const sessionId = req.headers['x-session-id'] || body.sessionId;
      const allSeats = dataStore.getShowtimeSeats(showtimeId);
      const selectedSeatObjs = allSeats.filter(s => seatIds.includes(s.seat_id));

      // Tính tiền
      const calcResult = pricingService.calculateOrder(
        selectedSeatObjs,
        audienceTypes || {},
        concessions || [],
        couponCode,
        loyaltyPointsUsed || 0
      );

      const orderCode = 'CNX' + Math.floor(100000 + Math.random() * 900000);
      const showtime = dataStore.showtimes.find(s => s.id === showtimeId);
      const movie = dataStore.movies.find(m => m.id === showtime.movie_id);
      const cinema = dataStore.cinemas.find(c => c.id === showtime.cinema_id);

      const order = {
        id: 'ord-' + crypto.randomBytes(6).toString('hex'),
        order_code: orderCode,
        user_id: userId || null,
        session_id: sessionId,
        showtime_id: showtimeId,
        movie_title: movie.title,
        cinema_name: cinema.name,
        auditorium_name: showtime.auditorium_name,
        showtime_date: showtime.date,
        showtime_time: showtime.time,
        seat_ids: seatIds,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        payment_provider: paymentProvider || 'MOMO',
        calculation: calcResult,
        total_amount: calcResult.total_amount,
        status: 'pending', // 'pending' -> 'paid'
        created_at: new Date().toISOString()
      };

      dataStore.orders.push(order);

      return sendJSON(res, 200, {
        success: true,
        message: 'Đơn hàng đã được tạo. Vui lòng thanh toán.',
        order: order
      });
    }

    // ==========================================
    // 11. REST API: CONFIRM PAYMENT & ISSUE QR TICKET
    // ==========================================
    if (pathname === '/api/bookings/confirm-payment' && method === 'POST') {
      const body = await parseRequestBody(req);
      const { orderCode, transactionId } = body;

      const order = dataStore.orders.find(o => o.order_code === orderCode);
      if (!order) return sendJSON(res, 404, { success: false, error: 'Không tìm thấy đơn hàng' });

      // 1. Chuyển trạng thái đơn sang 'paid'
      order.status = 'paid';
      order.transaction_id = transactionId || 'TXN-' + Date.now();
      order.paid_at = new Date().toISOString();

      // 2. Chuyển ghế sang 'sold' vĩnh viễn và broadcast
      await seatHoldManager.confirmSold(order.showtime_id, order.seat_ids, order.id, order.session_id);

      // 3. Sinh Vé Điện Tử Mã QR duy nhất (Zero-Leakage Hash)
      const tickets = order.seat_ids.map(seatId => {
        const qrHash = crypto.createHash('sha256').update(`${order.order_code}_${seatId}_${order.showtime_id}`).digest('hex');
        const ticketObj = {
          id: 'tkt-' + crypto.randomBytes(6).toString('hex'),
          order_id: order.id,
          order_code: order.order_code,
          seat_id: seatId,
          movie_title: order.movie_title,
          cinema_name: order.cinema_name,
          auditorium_name: order.auditorium_name,
          showtime_date: order.showtime_date,
          showtime_time: order.showtime_time,
          qr_token_hash: qrHash,
          qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=CINEMAX_${qrHash}`,
          status: 'issued', // 'issued', 'used', 'cancelled'
          issued_at: new Date().toISOString()
        };
        dataStore.tickets.push(ticketObj);
        return ticketObj;
      });

      // 4. Cộng điểm tích lũy thành viên nếu có user_id
      if (order.user_id) {
        const user = dataStore.users.find(u => u.id === order.user_id);
        if (user) {
          user.loyalty_points = (user.loyalty_points || 0) + (order.calculation.points_earned || 0);
          if (order.calculation.loyalty_points_used > 0) {
            user.loyalty_points -= order.calculation.loyalty_points_used;
          }
        }
      }

      return sendJSON(res, 200, {
        success: true,
        message: 'Thanh toán thành công! Vé điện tử đã sẵn sàng.',
        order: order,
        tickets: tickets
      });
    }

    // ==========================================
    // 12. REST API: GET ORDER & TICKETS
    // ==========================================
    if (pathname.startsWith('/api/orders/') && method === 'GET') {
      const orderCode = pathname.split('/')[3];
      const order = dataStore.orders.find(o => o.order_code === orderCode);
      if (!order) return sendJSON(res, 404, { success: false, error: 'Không tìm thấy đơn hàng' });

      const tickets = dataStore.tickets.filter(t => t.order_id === order.id);
      return sendJSON(res, 200, { success: true, order, tickets });
    }

    // ==========================================
    // 13. REST API: USER SELF-SERVICE CANCEL/REFUND TICKET
    // ==========================================
    if (pathname.match(/^\/api\/orders\/[^\/]+\/cancel$/) && method === 'POST') {
      const orderCode = pathname.split('/')[2];
      const order = dataStore.orders.find(o => o.order_code === orderCode);
      if (!order) return sendJSON(res, 404, { success: false, error: 'Không tìm thấy đơn hàng' });

      // Kiểm tra hạn hủy trước 60 phút
      const showtime = dataStore.showtimes.find(s => s.id === order.showtime_id);
      const showtimeStarts = new Date(showtime.starts_at).getTime();
      const now = Date.now();
      const diffMinutes = (showtimeStarts - now) / (1000 * 60);

      if (diffMinutes < 60) {
        return sendJSON(res, 400, {
          success: false,
          error: 'Chỉ được phép hủy vé trước giờ chiếu ít nhất 60 phút theo chính sách của rạp.'
        });
      }

      order.status = 'refunded';
      const tickets = dataStore.tickets.filter(t => t.order_id === order.id);
      tickets.forEach(t => (t.status = 'cancelled'));

      // Trả lại trạng thái ghế
      const seats = dataStore.getShowtimeSeats(order.showtime_id);
      order.seat_ids.forEach(sid => {
        const seat = seats.find(s => s.seat_id === sid);
        if (seat) {
          seat.status = 'available';
          seat.order_id = null;
        }
      });

      return sendJSON(res, 200, {
        success: true,
        message: 'Hủy vé và yêu cầu hoàn tiền thành công. Tiền sẽ được hoàn về tài khoản trong 24h.'
      });
    }

    // ==========================================
    // 14. REST API: VAT INVOICE REQUEST
    // ==========================================
    if (pathname.match(/^\/api\/orders\/[^\/]+\/vat-invoice$/) && method === 'POST') {
      const orderCode = pathname.split('/')[2];
      const body = await parseRequestBody(req);
      const order = dataStore.orders.find(o => o.order_code === orderCode);
      if (!order) return sendJSON(res, 404, { success: false, error: 'Không tìm thấy đơn hàng' });

      order.vat_invoice = {
        tax_code: body.taxCode,
        company_name: body.companyName,
        address: body.address,
        email: body.email,
        requested_at: new Date().toISOString()
      };

      return sendJSON(res, 200, {
        success: true,
        message: 'Đã tiếp nhận yêu cầu xuất hóa đơn điện tử VAT.'
      });
    }

    // ==========================================
    // 15. REST API: AUTHENTICATION
    // ==========================================
    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await parseRequestBody(req);
      const { fullName, phone, email, password } = body;

      if (!fullName || !phone || !email || !password) {
        return sendJSON(res, 400, { success: false, error: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
      }

      const existing = dataStore.users.find(u => u.email === email || u.phone === phone);
      if (existing) {
        return sendJSON(res, 400, { success: false, error: 'Email hoặc Số điện thoại đã được đăng ký.' });
      }

      const newUser = {
        id: 'usr-' + crypto.randomBytes(6).toString('hex'),
        full_name: fullName,
        email: email,
        phone: phone,
        password_hash: password,
        role: 'user',
        loyalty_points: 0,
        membership_tier: 'MEMBER',
        created_at: new Date().toISOString()
      };

      dataStore.users.push(newUser);
      const token = 'token-' + crypto.randomBytes(16).toString('hex');

      return sendJSON(res, 201, {
        success: true,
        message: 'Đăng ký tài khoản thành viên thành công!',
        token,
        user: {
          id: newUser.id,
          full_name: newUser.full_name,
          email: newUser.email,
          phone: newUser.phone,
          loyalty_points: newUser.loyalty_points,
          membership_tier: newUser.membership_tier
        }
      });
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseRequestBody(req);
      const { email, password } = body;

      const user = dataStore.users.find(u => u.email === email && u.password_hash === password);
      if (!user) {
        return sendJSON(res, 401, { success: false, error: 'Email hoặc mật khẩu không chính xác.' });
      }

      const token = 'token-' + crypto.randomBytes(16).toString('hex');
      return sendJSON(res, 200, {
        success: true,
        message: 'Đăng nhập thành công!',
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          loyalty_points: user.loyalty_points,
          membership_tier: user.membership_tier
        }
      });
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const authHeader = req.headers['authorization'];
      // Demo: trả về tài khoản mẫu hoặc tài khoản đăng nhập
      const user = dataStore.users[0];
      const userOrders = dataStore.orders.filter(o => o.user_id === user.id);

      return sendJSON(res, 200, {
        success: true,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          loyalty_points: user.loyalty_points,
          membership_tier: user.membership_tier
        },
        orders: userOrders
      });
    }

    // ==========================================
    // 16. REST API: NEWS & ARTICLES
    // ==========================================
    if (pathname === '/api/news' && method === 'GET') {
      return sendJSON(res, 200, { success: true, data: dataStore.news });
    }

    // ==========================================
    // 17. STATIC FILE SERVING
    // ==========================================
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });

  } catch (err) {
    console.error('Server request error:', err);
    sendJSON(res, 500, { success: false, error: err.message });
  }
});

// Khởi chạy WebSocket Server
const socketServer = new CinemaxSocketServer(server);

// Khởi động lắng nghe
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎬 CINEMAX MOVIE BOOKING PLATFORM`);
  console.log(`   Task: User & Khách Hàng (Đặt vé, Giữ ghế Real-time)`);
  console.log(`   Địa chỉ Web: http://localhost:${PORT}`);
  console.log(`   WebSocket:   ws://localhost:${PORT}/ws`);
  console.log(`====================================================`);
});
