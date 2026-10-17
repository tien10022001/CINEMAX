/**
 * QUẢN LÝ QUY TRÌNH ĐẶT VÉ (3 BƯỚC HOÀN CHỈNH)
 * Bước 1: Chọn ghế Real-time (Sơ đồ ma trận A-H, 1-10)
 * Bước 2: Chọn bắp nước & combo kèm đổi vị, đổi nước, đổi size
 * Bước 3: Thanh toán điện tử, áp voucher & Nhận vé QR
 */

class BookingFlow {
  constructor() {
    this.currentStep = 1;
    this.currentShowtime = null;
    this.selectedSeats = [];
    this.audienceTypes = {}; // seatId -> 'ADULT' | 'STUDENT_U22' | 'CHILD' | 'SENIOR'
    this.concessions = {}; // productId -> { quantity, modifiers: [] }
    this.appliedCoupon = null;
    this.loyaltyPointsUsed = 0;
    this.calculation = null;

    this.init();
  }

  init() {
    // Đăng ký callback từ WebSocket client
    window.realtimeSeatClient.onStateChangeCallback = (type, data) => {
      if (type === 'INIT_STATE') {
        this.renderSeatMap(data);
      } else if (type === 'HOLD_SUCCESS') {
        this.selectedSeats = data.heldSeats || [];
        this.updateOrderSummary();
      } else if (type === 'SEAT_RELEASED_LOCAL' || type === 'SEATS_FREED') {
        this.selectedSeats = data.heldSeats || [];
        this.updateOrderSummary();
      }
    };

    window.realtimeSeatClient.onCountdownTickCallback = (formattedTime) => {
      const timerEl = document.getElementById('countdown-display');
      if (timerEl) timerEl.innerText = formattedTime;
    };

    window.realtimeSeatClient.onExpiredCallback = () => {
      if (window.showToast) {
        window.showToast('Hết 10 phút giữ chỗ! Vui lòng chọn lại ghế.', 'warning');
      }
      this.selectedSeats = [];
      this.updateOrderSummary();
      this.refreshSeatMap();
    };
  }

  async startBooking(showtimeId) {
    try {
      // 1. Tải thông tin suất chiếu và ghế
      const res = await fetch(`/api/showtimes/${showtimeId}/seats`);
      const data = await res.json();
      if (!data.success) {
        alert('Không thể tải thông tin phòng chiếu.');
        return;
      }

      this.currentShowtime = data.showtime;
      this.selectedSeats = [];
      this.audienceTypes = {};
      this.concessions = {};
      this.appliedCoupon = null;
      this.loyaltyPointsUsed = 0;

      // 2. Chuyển sang màn hình Đặt Vé
      window.cinemaxApp.showPage('booking');
      this.setStep(1);

      // 3. Cập nhật thông tin phim bên thanh tóm tắt
      document.getElementById('summary-movie-title').innerText = 'Dune: Hành Tinh Cát - Phần 2';
      document.getElementById('summary-cinema-name').innerText = 'CINEMAX Plaza';
      document.getElementById('summary-auditorium').innerText = this.currentShowtime.auditorium_name || 'Phòng 3 - 2D';
      document.getElementById('summary-showtime-time').innerText = `${this.currentShowtime.time} • 17/10/2026`;

      // 4. Kết nối WebSocket phòng chiếu này
      window.realtimeSeatClient.joinShowtime(showtimeId);
      this.renderSeatMap(data.data);
      this.updateOrderSummary();
    } catch (e) {
      console.error('Lỗi khởi tạo đặt vé:', e);
    }
  }

  renderSeatMap(seats) {
    const matrixEl = document.getElementById('seat-matrix');
    if (!matrixEl) return;
    matrixEl.innerHTML = '';

    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    rows.forEach(r => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'seat-row';

      const leftLabel = document.createElement('div');
      leftLabel.className = 'row-label';
      leftLabel.innerText = r;
      rowDiv.appendChild(leftLabel);

      const rowSeats = seats.filter(s => s.row_label === r).sort((a, b) => a.seat_number - b.seat_number);
      rowSeats.forEach(seat => {
        const btn = document.createElement('button');
        btn.id = `seat-${seat.seat_id}`;
        btn.dataset.seatId = seat.seat_id;
        btn.dataset.seatType = seat.seat_type;
        btn.dataset.group = seat.seat_group || '';
        btn.innerText = seat.seat_id;

        // Trạng thái ghế
        let classList = `seat-btn ${seat.seat_type.toLowerCase()}`;
        if (seat.status === 'sold') {
          classList += ' sold';
        } else if (seat.status === 'held') {
          if (seat.is_mine) {
            classList += ' selected';
          } else {
            classList += ' held-by-other';
          }
        } else if (this.selectedSeats.includes(seat.seat_id)) {
          classList += ' selected';
        }

        btn.className = classList;

        if (seat.status !== 'sold') {
          btn.onclick = () => {
            window.realtimeSeatClient.toggleSeat(seat.seat_id, seat.seat_type, seat.seat_group);
          };
        }

        rowDiv.appendChild(btn);
      });

      const rightLabel = document.createElement('div');
      rightLabel.className = 'row-label';
      rightLabel.innerText = r;
      rowDiv.appendChild(rightLabel);

      matrixEl.appendChild(rowDiv);
    });
  }

  async updateOrderSummary() {
    // 1. Cập nhật các chip ghế đã chọn
    const chipsContainer = document.getElementById('selected-seats-container');
    if (chipsContainer) {
      chipsContainer.innerHTML = '';
      if (this.selectedSeats.length === 0) {
        chipsContainer.innerHTML = '<span style="font-size:0.8rem;color:#6B7280;">Chưa chọn ghế</span>';
      } else {
        this.selectedSeats.forEach(sid => {
          const chip = document.createElement('span');
          chip.className = 'seat-chip';
          chip.innerText = sid;
          chipsContainer.appendChild(chip);
        });
      }
    }

    // 2. Đồng bộ trạng thái visual trên sơ đồ
    document.querySelectorAll('.seat-btn').forEach(btn => {
      const sid = btn.dataset.seatId;
      if (btn.classList.contains('sold') || btn.classList.contains('held-by-other')) return;
      if (this.selectedSeats.includes(sid)) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });

    // 3. Tính tiền qua Backend API
    if (this.selectedSeats.length > 0 && this.currentShowtime) {
      const concessionList = Object.entries(this.concessions).map(([pid, item]) => ({
        productId: pid,
        quantity: item.quantity,
        modifiers: item.modifiers
      }));

      try {
        const res = await fetch('/api/bookings/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            showtimeId: this.currentShowtime.id,
            seatIds: this.selectedSeats,
            audienceTypes: this.audienceTypes,
            concessions: concessionList,
            couponCode: this.appliedCoupon ? this.appliedCoupon.code : null,
            loyaltyPointsUsed: this.loyaltyPointsUsed
          })
        });
        const result = await res.json();
        if (result.success) {
          this.calculation = result.data;
          document.getElementById('summary-total-price').innerText = `${this.calculation.total_amount.toLocaleString('vi-VN')} đ`;
        }
      } catch (err) {
        console.error('Lỗi tính tiền:', err);
      }
    } else {
      document.getElementById('summary-total-price').innerText = '0 đ';
    }

    // Kích hoạt/Vô hiệu hóa nút Tiếp tục
    const btnContinue = document.getElementById('btn-step-continue');
    if (btnContinue) {
      btnContinue.disabled = (this.selectedSeats.length === 0);
    }
  }

  setStep(stepNumber) {
    this.currentStep = stepNumber;

    // Cập nhật giao diện Stepper
    document.querySelectorAll('.step-item').forEach((el, idx) => {
      if (idx + 1 === stepNumber) {
        el.className = 'step-item active';
      } else {
        el.className = 'step-item';
      }
    });

    // Ẩn/hiển thị màn hình từng bước
    document.getElementById('step-1-seats').style.display = (stepNumber === 1) ? 'grid' : 'none';
    document.getElementById('step-2-concessions').style.display = (stepNumber === 2) ? 'block' : 'none';
    document.getElementById('step-3-payment').style.display = (stepNumber === 3) ? 'block' : 'none';

    if (stepNumber === 2) {
      this.loadConcessionsList();
    } else if (stepNumber === 3) {
      this.loadPaymentSummary();
    }
  }

  nextStep() {
    if (this.currentStep === 1) {
      if (this.selectedSeats.length === 0) {
        alert('Vui lòng chọn ít nhất một ghế.');
        return;
      }
      this.setStep(2);
    } else if (this.currentStep === 2) {
      this.setStep(3);
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.setStep(this.currentStep - 1);
    }
  }

  async loadConcessionsList() {
    const container = document.getElementById('concessions-container');
    if (!container) return;

    try {
      const res = await fetch('/api/concessions');
      const data = await res.json();
      if (!data.success) return;

      container.innerHTML = '';
      data.products.forEach(prod => {
        const item = this.concessions[prod.id] || { quantity: 0, modifiers: [] };
        const card = document.createElement('div');
        card.className = 'concession-card';

        card.innerHTML = `
          <div style="font-size:3rem;text-align:center;margin-bottom:0.8rem;">🍿</div>
          <div class="concession-title">${prod.name}</div>
          <div class="concession-desc">${prod.description}</div>
          <div class="concession-price">${prod.base_price.toLocaleString('vi-VN')} đ</div>
          <div class="qty-control">
            <button class="qty-btn" onclick="window.bookingFlow.changeQty('${prod.id}', -1)">-</button>
            <span class="qty-val" id="qty-${prod.id}">${item.quantity}</span>
            <button class="qty-btn" onclick="window.bookingFlow.changeQty('${prod.id}', 1)">+</button>
          </div>
        `;
        container.appendChild(card);
      });
    } catch (e) {
      console.error('Lỗi tải bắp nước:', e);
    }
  }

  changeQty(productId, delta) {
    if (!this.concessions[productId]) {
      this.concessions[productId] = { quantity: 0, modifiers: [] };
    }
    this.concessions[productId].quantity += delta;
    if (this.concessions[productId].quantity < 0) {
      this.concessions[productId].quantity = 0;
    }
    const valEl = document.getElementById(`qty-${productId}`);
    if (valEl) valEl.innerText = this.concessions[productId].quantity;

    this.updateOrderSummary();
  }

  loadPaymentSummary() {
    const tableEl = document.getElementById('payment-breakdown-table');
    if (!tableEl || !this.calculation) return;

    tableEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:0.6rem;">
        <span style="color:#9CA3AF;">Tiền vé (${this.selectedSeats.length} ghế):</span>
        <span style="font-weight:600;">${this.calculation.ticket_subtotal.toLocaleString('vi-VN')} đ</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:0.6rem;">
        <span style="color:#9CA3AF;">Bắp nước & Combo:</span>
        <span style="font-weight:600;">${this.calculation.concession_subtotal.toLocaleString('vi-VN')} đ</span>
      </div>
      ${this.calculation.coupon_discount > 0 ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:0.6rem;color:#10B981;">
          <span>Giảm giá khuyến mãi (${this.calculation.applied_coupon.code}):</span>
          <span style="font-weight:600;">-${this.calculation.coupon_discount.toLocaleString('vi-VN')} đ</span>
        </div>
      ` : ''}
      <div style="height:1px;background:#202738;margin:1rem 0;"></div>
      <div style="display:flex;justify-content:space-between;font-size:1.2rem;font-weight:800;color:#E50914;">
        <span>Tổng thanh toán:</span>
        <span>${this.calculation.total_amount.toLocaleString('vi-VN')} đ</span>
      </div>
    `;
  }

  async applyCoupon() {
    const code = document.getElementById('coupon-input').value.trim();
    if (!code) return;

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          subtotal: this.calculation ? this.calculation.gross_total : 0,
          ticketSubtotal: this.calculation ? this.calculation.ticket_subtotal : 0,
          comboSubtotal: this.calculation ? this.calculation.concession_subtotal : 0
        })
      });
      const data = await res.json();
      if (data.success) {
        this.appliedCoupon = data.coupon;
        if (window.showToast) window.showToast(`Áp dụng mã ${code} thành công!`, 'success');
        this.updateOrderSummary();
        this.loadPaymentSummary();
      } else {
        if (window.showToast) window.showToast(data.error, 'error');
      }
    } catch (e) {
      console.error('Lỗi áp mã giảm giá:', e);
    }
  }

  async confirmPayment() {
    const name = document.getElementById('contact-name').value.trim();
    const phone = document.getElementById('contact-phone').value.trim();
    const email = document.getElementById('contact-email').value.trim();

    if (!name || !phone || !email) {
      alert('Vui lòng điền họ tên, số điện thoại và email nhận vé.');
      return;
    }

    try {
      // 1. Tạo đơn hàng checkout
      const checkRes = await fetch('/api/bookings/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': window.realtimeSeatClient.sessionId
        },
        body: JSON.stringify({
          showtimeId: this.currentShowtime.id,
          seatIds: this.selectedSeats,
          audienceTypes: this.audienceTypes,
          concessions: Object.entries(this.concessions).map(([pid, item]) => ({
            productId: pid,
            quantity: item.quantity,
            modifiers: item.modifiers
          })),
          couponCode: this.appliedCoupon ? this.appliedCoupon.code : null,
          loyaltyPointsUsed: this.loyaltyPointsUsed,
          contactName: name,
          contactPhone: phone,
          contactEmail: email,
          paymentProvider: 'MOMO',
          userId: window.cinemaxAuth ? window.cinemaxAuth.getCurrentUserId() : null
        })
      });

      const checkData = await checkRes.json();
      if (!checkData.success) {
        alert(checkData.error || 'Lỗi tạo đơn hàng');
        return;
      }

      // 2. Xác nhận thanh toán & Nhận vé QR
      const payRes = await fetch('/api/bookings/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderCode: checkData.order.order_code,
          transactionId: 'MOMO-' + Date.now()
        })
      });

      const payData = await payRes.json();
      if (payData.success) {
        this.showElectronicTicketModal(payData.order, payData.tickets);
      } else {
        alert(payData.error || 'Lỗi thanh toán');
      }
    } catch (e) {
      console.error('Lỗi quy trình thanh toán:', e);
    }
  }

  showElectronicTicketModal(order, tickets) {
    const modal = document.getElementById('ticket-modal');
    const content = document.getElementById('ticket-modal-content');
    if (!modal || !content) return;

    content.innerHTML = `
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="color:#10B981;font-size:2.8rem;margin-bottom:0.5rem;">✓</div>
        <h2 style="font-size:1.4rem;font-weight:800;color:#FFFFFF;">ĐẶT VÉ THÀNH CÔNG!</h2>
        <div style="color:#9CA3AF;font-size:0.85rem;">Mã đơn hàng: <strong style="color:#E50914;">${order.order_code}</strong></div>
      </div>

      <div style="background:#151A26;border-radius:14px;padding:1.2rem;margin-bottom:1.5rem;border:1px solid #202738;">
        <div style="font-weight:700;font-size:1.1rem;color:#FFFFFF;margin-bottom:0.4rem;">${order.movie_title}</div>
        <div style="font-size:0.85rem;color:#D1D5DB;margin-bottom:0.2rem;">${order.cinema_name} • ${order.auditorium_name}</div>
        <div style="font-size:0.85rem;color:#FBBF24;margin-bottom:0.8rem;">Suất chiếu: ${order.showtime_time} • ${order.showtime_date}</div>
        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
          <span style="font-size:0.8rem;color:#9CA3AF;">Ghế đã đặt:</span>
          ${order.seat_ids.map(s => `<span class="seat-chip">${s}</span>`).join('')}
        </div>
      </div>

      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="font-size:0.8rem;color:#9CA3AF;margin-bottom:0.6rem;">Mã QR soát vé tại cửa phòng chiếu:</div>
        <div style="background:#FFFFFF;padding:12px;border-radius:12px;display:inline-block;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=CINEMAX_${order.order_code}" style="width:160px;height:160px;" alt="QR Ticket" />
        </div>
      </div>

      <button class="btn-primary-red" style="width:100%;justify-content:center;" onclick="window.bookingFlow.closeTicketModal()">
        Hoàn tất & Về trang chủ
      </button>
    `;

    modal.classList.add('active');
  }

  closeTicketModal() {
    const modal = document.getElementById('ticket-modal');
    if (modal) modal.classList.remove('active');
    window.cinemaxApp.showPage('home');
  }
}

window.bookingFlow = new BookingFlow();
