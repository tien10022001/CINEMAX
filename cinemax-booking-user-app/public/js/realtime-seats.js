/**
 * CLIENT REAL-TIME SEAT HOLDING ENGINE
 * Kết nối WebSocket hai chiều, đồng bộ trạng thái ghế tức thời và đếm ngược 10 phút
 */

class RealtimeSeatClient {
  constructor() {
    this.ws = null;
    this.sessionId = sessionStorage.getItem('cinemax_session_id') || ('sess_' + Math.random().toString(36).substring(2, 10));
    sessionStorage.setItem('cinemax_session_id', this.sessionId);

    this.currentShowtimeId = null;
    this.heldSeats = new Set();
    this.countdownTimer = null;
    this.remainingSeconds = 600; // 10 phút = 600s

    this.onStateChangeCallback = null;
    this.onCountdownTickCallback = null;
    this.onExpiredCallback = null;

    this.connect();
  }

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✓ Đã kết nối WebSocket Real-time CINEMAX');
        if (this.currentShowtimeId) {
          this.joinShowtime(this.currentShowtimeId);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerEvent(msg);
        } catch (e) {
          console.error('Lỗi phân tích WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        console.warn('Mất kết nối WebSocket. Đang tự động kết nối lại sau 3s...');
        setTimeout(() => this.connect(), 3000);
      };
    } catch (e) {
      console.error('Không thể tạo kết nối WebSocket:', e);
    }
  }

  joinShowtime(showtimeId) {
    this.currentShowtimeId = showtimeId;
    this.heldSeats.clear();
    this.stopCountdown();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'JOIN_SHOWTIME',
        showtimeId: showtimeId
      }));
    }
  }

  toggleSeat(seatId, seatType, seatGroup) {
    // Nếu ghế này đã được mình giữ -> giải phóng
    if (this.heldSeats.has(seatId)) {
      const seatsToRelease = [seatId];
      // Nếu là ghế đôi, bỏ cả cặp
      if (seatType === 'COUPLE' && seatGroup) {
        document.querySelectorAll(`.seat-btn[data-group="${seatGroup}"]`).forEach(el => {
          seatsToRelease.push(el.dataset.seatId);
        });
      }
      this.releaseSeats(seatsToRelease);
      return;
    }

    // Nếu muốn giữ ghế mới
    const seatsToHold = Array.from(this.heldSeats);
    seatsToHold.push(seatId);

    // Nếu là ghế đôi, tự động thêm đối tác
    if (seatType === 'COUPLE' && seatGroup) {
      document.querySelectorAll(`.seat-btn[data-group="${seatGroup}"]`).forEach(el => {
        if (!seatsToHold.includes(el.dataset.seatId)) {
          seatsToHold.push(el.dataset.seatId);
        }
      });
    }

    this.sendHoldRequest(seatsToHold);
  }

  sendHoldRequest(seatIds) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Fallback qua REST API nếu WS chưa sẵn sàng
      this.holdSeatsViaREST(seatIds);
      return;
    }

    this.ws.send(JSON.stringify({
      action: 'HOLD_SEATS',
      showtimeId: this.currentShowtimeId,
      seatIds: seatIds,
      userId: window.cinemaxAuth ? window.cinemaxAuth.getCurrentUserId() : null
    }));
  }

  async holdSeatsViaREST(seatIds) {
    try {
      const res = await fetch('/api/bookings/hold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': this.sessionId
        },
        body: JSON.stringify({
          showtimeId: this.currentShowtimeId,
          seatIds: seatIds,
          sessionId: this.sessionId
        })
      });
      const data = await res.json();
      if (data.success) {
        this.heldSeats = new Set(data.heldSeats.map(s => s.seat_id));
        this.startCountdown(data.remainingSeconds || 600);
        if (this.onStateChangeCallback) this.onStateChangeCallback('HOLD_SUCCESS', data);
      } else {
        if (window.showToast) window.showToast(data.error || 'Ghế đã được người khác giữ', 'error');
      }
    } catch (e) {
      console.error('Lỗi giữ ghế REST fallback:', e);
    }
  }

  releaseSeats(seatIds) {
    seatIds.forEach(id => this.heldSeats.delete(id));

    if (this.heldSeats.size === 0) {
      this.stopCountdown();
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'RELEASE_SEATS',
        showtimeId: this.currentShowtimeId,
        seatIds: seatIds
      }));
    } else {
      fetch('/api/bookings/release', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': this.sessionId
        },
        body: JSON.stringify({
          showtimeId: this.currentShowtimeId,
          seatIds: seatIds
        })
      });
    }

    if (this.onStateChangeCallback) {
      this.onStateChangeCallback('SEAT_RELEASED_LOCAL', { heldSeats: Array.from(this.heldSeats) });
    }
  }

  handleServerEvent(msg) {
    switch (msg.event) {
      case 'SHOWTIME_STATE': {
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback('INIT_STATE', msg.seats);
        }
        break;
      }

      case 'HOLD_SUCCESS': {
        this.heldSeats = new Set(msg.heldSeats);
        this.startCountdown(msg.remainingSeconds || 600);
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback('HOLD_SUCCESS', msg);
        }
        break;
      }

      case 'HOLD_FAILED': {
        if (window.showToast) {
          window.showToast(msg.error || 'Ghế này đã có người giữ chỗ!', 'error');
        }
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback('HOLD_FAILED', msg);
        }
        break;
      }

      case 'SEATS_HELD': {
        // Broadcast từ server khi người khác giữ ghế
        if (msg.showtimeId === this.currentShowtimeId) {
          msg.heldSeats.forEach(hs => {
            if (hs.held_by !== this.sessionId) {
              const el = document.getElementById(`seat-${hs.seat_id}`);
              if (el) {
                el.className = 'seat-btn held-by-other';
                el.title = 'Ghế đang được giữ chỗ trong 10 phút';
              }
            }
          });
        }
        break;
      }

      case 'SEATS_RELEASED':
      case 'SEATS_EXPIRED': {
        const releasedIds = msg.releasedSeats || msg.expiredSeats || [];
        releasedIds.forEach(id => {
          if (this.heldSeats.has(id)) {
            this.heldSeats.delete(id);
            if (msg.event === 'SEATS_EXPIRED') {
              if (window.showToast) {
                window.showToast(`Ghế ${id} đã hết 10 phút giữ chỗ và tự động giải phóng.`, 'warning');
              }
            }
          }
          const el = document.getElementById(`seat-${id}`);
          if (el && !el.classList.contains('sold')) {
            const seatType = el.dataset.seatType.toLowerCase();
            el.className = `seat-btn ${seatType}`;
            el.title = `Ghế ${id}`;
          }
        });

        if (this.heldSeats.size === 0) {
          this.stopCountdown();
        }

        if (this.onStateChangeCallback) {
          this.onStateChangeCallback('SEATS_FREED', { heldSeats: Array.from(this.heldSeats) });
        }
        break;
      }

      case 'SEATS_SOLD': {
        msg.soldSeats.forEach(id => {
          this.heldSeats.delete(id);
          const el = document.getElementById(`seat-${id}`);
          if (el) {
            el.className = 'seat-btn sold';
            el.title = 'Ghế đã bán';
          }
        });
        if (this.heldSeats.size === 0) {
          this.stopCountdown();
        }
        break;
      }
    }
  }

  startCountdown(seconds) {
    this.remainingSeconds = seconds;
    this.stopCountdown();

    this.countdownTimer = setInterval(() => {
      this.remainingSeconds--;
      if (this.onCountdownTickCallback) {
        this.onCountdownTickCallback(this.formatTime(this.remainingSeconds));
      }

      if (this.remainingSeconds <= 0) {
        this.stopCountdown();
        this.heldSeats.clear();
        if (this.onExpiredCallback) {
          this.onExpiredCallback();
        }
      }
    }, 1000);

    if (this.onCountdownTickCallback) {
      this.onCountdownTickCallback(this.formatTime(this.remainingSeconds));
    }
  }

  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  formatTime(totalSecs) {
    if (totalSecs < 0) totalSecs = 0;
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}

window.realtimeSeatClient = new RealtimeSeatClient();
