/**
 * WEBSOCKET SERVER CHO REAL-TIME SEAT HOLDING
 * Hỗ trợ cả thư viện 'ws' và Pure Node.js RFC 6455 Handshake & Framing Fallback
 * Giúp mã nguồn có thể chạy ngay trên mọi môi trường Node mà không gặp lỗi thiếu module
 */

const crypto = require('crypto');
const seatHoldManager = require('../services/seatHoldManager');
const dataStore = require('../models/dataStore');

class CinemaxSocketServer {
  constructor(httpServer) {
    this.httpServer = httpServer;
    // Map: showtimeId -> Set of client sockets
    this.rooms = new Map();
    // Map: socket -> { sessionId, currentShowtimeId }
    this.clientMeta = new Map();

    this.init();
  }

  init() {
    // Kết nối SeatHoldManager broadcast với WebSocket
    seatHoldManager.setBroadcastCallback((showtimeId, payload) => {
      this.broadcastToRoom(showtimeId, payload);
    });

    // Cố gắng sử dụng thư viện ws nếu có
    let wsModuleLoaded = false;
    try {
      const WebSocket = require('ws');
      const wss = new WebSocket.Server({ noServer: true });
      this.httpServer.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url, `http://${request.headers.host}`);
        if (url.pathname === '/ws') {
          wss.handleUpgrade(request, socket, head, ws => {
            this.handleWsConnection(ws, request);
          });
        }
      });
      wsModuleLoaded = true;
      console.log('✓ Cinemax WebSocket Server initialized with "ws" library.');
    } catch (e) {
      console.log('Notice: "ws" library not found, activating built-in RFC 6455 WebSocket engine.');
      this.initPureNodeWebSocket();
    }
  }

  /**
   * Built-in RFC 6455 Engine (Zero External Dependencies)
   */
  initPureNodeWebSocket() {
    this.httpServer.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname !== '/ws') {
        socket.destroy();
        return;
      }

      const key = req.headers['sec-websocket-key'];
      const acceptKey = crypto
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');

      const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`
      ];

      socket.write(headers.join('\r\n') + '\r\n\r\n');

      const clientWrapper = {
        socket,
        send: data => {
          try {
            const payload = Buffer.from(data);
            const len = payload.length;
            let header;
            if (len < 126) {
              header = Buffer.from([0x81, len]);
            } else if (len <= 65535) {
              header = Buffer.alloc(4);
              header[0] = 0x81;
              header[1] = 126;
              header.writeUInt16BE(len, 2);
            } else {
              header = Buffer.alloc(10);
              header[0] = 0x81;
              header[1] = 127;
              header.writeBigUInt64BE(BigInt(len), 2);
            }
            socket.write(Buffer.concat([header, payload]));
          } catch (err) {}
        },
        on: (ev, fn) => {
          if (ev === 'close') socket.on('close', fn);
          if (ev === 'message') {
            socket.on('data', buffer => {
              // Parse simple unmasked / masked text frame
              try {
                if (buffer.length < 2) return;
                const isMasked = (buffer[1] & 0x80) !== 0;
                let payloadLength = buffer[1] & 0x7f;
                let dataOffset = 2;
                if (payloadLength === 126) {
                  dataOffset = 4;
                } else if (payloadLength === 127) {
                  dataOffset = 10;
                }
                let rawPayload;
                if (isMasked) {
                  const mask = buffer.slice(dataOffset, dataOffset + 4);
                  dataOffset += 4;
                  rawPayload = buffer.slice(dataOffset);
                  for (let i = 0; i < rawPayload.length; i++) {
                    rawPayload[i] ^= mask[i % 4];
                  }
                } else {
                  rawPayload = buffer.slice(dataOffset);
                }
                fn(rawPayload.toString('utf-8'));
              } catch (err) {}
            });
          }
        }
      };

      this.handleWsConnection(clientWrapper, req);
    });
  }

  handleWsConnection(ws, req) {
    const sessionId = crypto.randomBytes(8).toString('hex');
    this.clientMeta.set(ws, { sessionId, currentShowtimeId: null });

    // Gửi tin chào mừng và định danh phiên
    this.send(ws, {
      event: 'CONNECTED',
      sessionId: sessionId,
      serverTime: Date.now()
    });

    ws.on('message', async messageStr => {
      try {
        const msg = JSON.parse(messageStr);
        await this.handleClientMessage(ws, msg);
      } catch (e) {
        console.error('Error handling WebSocket message:', e.message);
      }
    });

    ws.on('close', () => {
      this.handleClientDisconnect(ws);
    });
  }

  async handleClientMessage(ws, msg) {
    const meta = this.clientMeta.get(ws);
    if (!meta) return;

    switch (msg.action) {
      // 1. Tham gia phòng suất chiếu để nhận live updates
      case 'JOIN_SHOWTIME': {
        const { showtimeId } = msg;
        if (!this.rooms.has(showtimeId)) {
          this.rooms.set(showtimeId, new Set());
        }
        this.rooms.get(showtimeId).add(ws);
        meta.currentShowtimeId = showtimeId;

        // Trả về trạng thái ghế tức thời
        const seats = dataStore.getShowtimeSeats(showtimeId);
        this.send(ws, {
          event: 'SHOWTIME_STATE',
          showtimeId,
          seats: seats.map(s => ({
            seat_id: s.seat_id,
            row_label: s.row_label,
            seat_number: s.seat_number,
            seat_type: s.seat_type,
            seat_group: s.seat_group,
            base_price: s.base_price,
            status: s.status,
            held_until: s.held_until,
            is_mine: (s.held_by === meta.sessionId)
          }))
        });
        break;
      }

      // 2. Yêu cầu Giữ Ghế (Hold Seats) 10 phút
      case 'HOLD_SEATS': {
        const { showtimeId, seatIds, userId } = msg;
        const result = await seatHoldManager.holdSeats(
          showtimeId,
          seatIds,
          meta.sessionId,
          userId
        );

        if (result.success) {
          this.send(ws, {
            event: 'HOLD_SUCCESS',
            showtimeId,
            heldSeats: result.heldSeats.map(s => s.seat_id),
            heldUntil: result.heldUntil,
            remainingSeconds: result.remainingSeconds
          });
        } else {
          this.send(ws, {
            event: 'HOLD_FAILED',
            showtimeId,
            error: result.error,
            conflicts: result.conflicts || []
          });
        }
        break;
      }

      // 3. Yêu cầu Bỏ Giữ Ghế (Release Seats)
      case 'RELEASE_SEATS': {
        const { showtimeId, seatIds } = msg;
        const result = await seatHoldManager.releaseSeats(
          showtimeId,
          seatIds,
          meta.sessionId
        );
        this.send(ws, {
          event: 'RELEASE_SUCCESS',
          showtimeId,
          releasedCount: result.releasedCount
        });
        break;
      }

      // 4. Ping giữ kết nối
      case 'PING': {
        this.send(ws, { event: 'PONG', timestamp: Date.now() });
        break;
      }
    }
  }

  handleClientDisconnect(ws) {
    const meta = this.clientMeta.get(ws);
    if (meta && meta.currentShowtimeId) {
      const room = this.rooms.get(meta.currentShowtimeId);
      if (room) {
        room.delete(ws);
      }
    }
    this.clientMeta.delete(ws);
  }

  broadcastToRoom(showtimeId, data) {
    const room = this.rooms.get(showtimeId);
    if (!room) return;

    const payload = JSON.stringify(data);
    for (const client of room) {
      try {
        client.send(payload);
      } catch (err) {}
    }
  }

  send(ws, data) {
    try {
      ws.send(JSON.stringify(data));
    } catch (err) {}
  }
}

module.exports = CinemaxSocketServer;
