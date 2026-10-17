import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface HeldSeatRecord {
  showtimeId: string;
  sessionId: string;
  seats: string[];
  expiresAt: number;
  firstHeldAt: number;
  clientIp?: string;
  isPaymentExtended?: boolean;
  isReconciliationExtended?: boolean;
  status?: 'HELD' | 'PENDING_RECONCILIATION';
}

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const HOLDS_FILE = path.join(DATA_DIR, 'seat-holds.json');

// Memory cache để rate-limit chống spam API
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || '127.0.0.1';
}

function checkRateLimit(clientIp: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const limitWindow = 60 * 1000; // 1 phút
  const maxRequests = 30; // Tối đa 30 request/phút trên mỗi IP

  const record = ipRateLimitMap.get(clientIp);
  if (!record || now > record.resetAt) {
    ipRateLimitMap.set(clientIp, { count: 1, resetAt: now + limitWindow });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count += 1;
  return { allowed: true };
}

function readHoldsFile(): HeldSeatRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(HOLDS_FILE)) {
      fs.writeFileSync(HOLDS_FILE, '[]', 'utf-8');
      return [];
    }
    const content = fs.readFileSync(HOLDS_FILE, 'utf-8');
    const parsed = JSON.parse(content || '[]');
    const now = Date.now();
    return Array.isArray(parsed) ? parsed.filter((h) => h && h.expiresAt > now) : [];
  } catch (err) {
    console.error('Error reading seat-holds file:', err);
    return [];
  }
}

function writeHoldsFile(records: HeldSeatRecord[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const now = Date.now();
    const valid = records.filter((h) => h && h.expiresAt > now);
    fs.writeFileSync(HOLDS_FILE, JSON.stringify(valid, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing seat-holds file:', err);
  }
}

// GET: Lấy danh sách ghế đang bị giữ chỗ theo suất chiếu
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const showtimeId = searchParams.get('showtimeId');
    const sessionId = searchParams.get('sessionId');
    const currentHolds = readHoldsFile();

    let result = currentHolds;
    if (showtimeId) {
      result = currentHolds.filter((h) => h.showtimeId.toString() === showtimeId.toString());
    }

    const sessionHold = sessionId ? currentHolds.find((h) => h.sessionId === sessionId) : null;

    return NextResponse.json({
      success: true,
      heldSeats: result,
      sessionHold: sessionHold || null,
      now: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Giữ ghế, Gia hạn khi sang bước thanh toán, hoặc Chờ đối soát do mạng yếu
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // 1. Kiểm tra Rate Limiting chống spam bot phá hoại API
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Bạn đang gửi yêu cầu quá nhanh. Vui lòng thử lại sau ${rateCheck.retryAfter} giây!`,
          retryAfter: rateCheck.retryAfter,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      showtimeId,
      sessionId,
      seatLabels,
      action = 'HOLD', // 'HOLD' | 'EXTEND_PAYMENT' | 'PENDING_RECONCILIATION' | 'RELEASE'
      holdMinutes = 10,
    } = body;

    if (!showtimeId || !sessionId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu showtimeId hoặc sessionId' },
        { status: 400 }
      );
    }

    const stIdStr = showtimeId.toString();
    const seatsArray: string[] = Array.isArray(seatLabels) ? seatLabels : [];
    let currentHolds = readHoldsFile();
    const now = Date.now();
    const existingHold = currentHolds.find((h) => h.sessionId === sessionId);

    // XỬ LÝ HỦY GIỮ GHẾ
    if (action === 'RELEASE' || (action === 'HOLD' && seatsArray.length === 0)) {
      currentHolds = currentHolds.filter((h) => h.sessionId !== sessionId);
      writeHoldsFile(currentHolds);
      return NextResponse.json({ success: true, message: 'Đã giải phóng ghế', expiresAt: 0 });
    }

    // XỬ LÝ GIA HẠN +1 PHÚT KHI Ở BƯỚC THANH TOÁN (ACTION: EXTEND_PAYMENT)
    if (action === 'EXTEND_PAYMENT') {
      if (!existingHold) {
        return NextResponse.json(
          { success: false, error: 'Phiên giữ ghế không tồn tại hoặc đã hết hạn.' },
          { status: 404 }
        );
      }

      // Chỉ cho phép gia hạn thanh toán 1 lần duy nhất
      if (existingHold.isPaymentExtended) {
        return NextResponse.json({
          success: true,
          message: 'Đã gia hạn thanh toán trước đó',
          expiresAt: existingHold.expiresAt,
          firstHeldAt: existingHold.firstHeldAt,
          seats: existingHold.seats,
        });
      }

      // Hard Cap trần thời gian 11 phút tính từ firstHeldAt
      const MAX_TOTAL_MS = 11 * 60 * 1000;
      const proposedExpiresAt = Math.min(
        existingHold.expiresAt + 60 * 1000,
        existingHold.firstHeldAt + MAX_TOTAL_MS
      );

      existingHold.expiresAt = Math.max(existingHold.expiresAt, proposedExpiresAt);
      existingHold.isPaymentExtended = true;
      writeHoldsFile(currentHolds);

      return NextResponse.json({
        success: true,
        message: 'Đã cộng thêm 1 phút hoàn tất thanh toán',
        expiresAt: existingHold.expiresAt,
        firstHeldAt: existingHold.firstHeldAt,
        seats: existingHold.seats,
      });
    }

    // XỬ LÝ GIA HẠN +3 PHÚT ĐỐI SOÁT KHI MẠNG YẾU (ACTION: PENDING_RECONCILIATION)
    if (action === 'PENDING_RECONCILIATION') {
      if (!existingHold) {
        return NextResponse.json(
          { success: false, error: 'Phiên giữ ghế không tồn tại hoặc đã hết hạn.' },
          { status: 404 }
        );
      }

      // Hard Cap tuyệt đối 14 phút tính từ firstHeldAt (10p gốc + 1p thanh toán + 3p đối soát)
      const MAX_TOTAL_RECON_MS = 14 * 60 * 1000;
      if (now - existingHold.firstHeldAt > MAX_TOTAL_RECON_MS) {
        return NextResponse.json(
          {
            success: false,
            error: 'Đã vượt quá thời gian giữ ghế tối đa cho phép (14 phút). Ghế đã được mở lại cho khách khác.',
          },
          { status: 410 }
        );
      }

      const proposedExpiresAt = Math.min(
        now + 3 * 60 * 1000,
        existingHold.firstHeldAt + MAX_TOTAL_RECON_MS
      );

      existingHold.expiresAt = Math.max(existingHold.expiresAt, proposedExpiresAt);
      existingHold.isReconciliationExtended = true;
      existingHold.status = 'PENDING_RECONCILIATION';
      writeHoldsFile(currentHolds);

      return NextResponse.json({
        success: true,
        message: 'Đã kích hoạt chế độ chờ đối soát ngân hàng (+3 phút)',
        expiresAt: existingHold.expiresAt,
        firstHeldAt: existingHold.firstHeldAt,
        seats: existingHold.seats,
      });
    }

    // XỬ LÝ GIỮ GHẾ TIÊU CHUẨN (ACTION: HOLD)
    // 2. Kiểm tra giới hạn số ghế tối đa per IP (Max 8 ghế toàn hệ thống/IP)
    const otherHoldsOfIp = currentHolds.filter(
      (h) => h.clientIp === clientIp && h.sessionId !== sessionId && h.expiresAt > now
    );
    const totalOtherSeatsOfIp = otherHoldsOfIp.reduce((acc, h) => acc + (h.seats?.length || 0), 0);
    if (totalOtherSeatsOfIp + seatsArray.length > 8) {
      return NextResponse.json(
        {
          success: false,
          error: `Địa chỉ IP của bạn đang giữ ${totalOtherSeatsOfIp} ghế. Mỗi IP chỉ được giữ tối đa 8 ghế đồng thời trên toàn hệ thống để chống phá hoại.`,
        },
        { status: 403 }
      );
    }

    // 3. Kiểm tra xem có ghế nào đang bị phiên khác giữ không
    for (const h of currentHolds) {
      if (h.showtimeId.toString() === stIdStr && h.sessionId !== sessionId && h.expiresAt > now) {
        for (const s of h.seats || []) {
          if (seatsArray.includes(s)) {
            return NextResponse.json(
              {
                success: false,
                error: `Ghế ${s} đang được tạm giữ bởi khách hàng khác. Vui lòng chọn ghế khác!`,
                conflictedSeat: s,
              },
              { status: 409 }
            );
          }
        }
      }
    }

    // 4. Kiểm tra Hard Cap thời gian cho phiên hiện tại
    const firstHeldAt = existingHold ? existingHold.firstHeldAt : now;
    const MAX_STANDARD_HOLD_MS = 10 * 60 * 1000;
    const MAX_CAP_MS = 11 * 60 * 1000;

    // Nếu phiên đã tồn tại quá trần thời gian thì không cho reset lại thành 10 phút mới
    if (existingHold && now - existingHold.firstHeldAt >= MAX_CAP_MS) {
      return NextResponse.json(
        {
          success: false,
          error: 'Thời gian giữ ghế của bạn đã hết hạn (tối đa 10 phút). Vui lòng thực hiện lại từ đầu!',
        },
        { status: 410 }
      );
    }

    // Tính expiresAt: Luôn tính từ firstHeldAt để ngăn chặn trick gửi API liên tục để reset timer
    let expiresAt = firstHeldAt + MAX_STANDARD_HOLD_MS;
    if (existingHold?.isPaymentExtended) {
      expiresAt += 60 * 1000;
    }
    if (existingHold?.isReconciliationExtended) {
      expiresAt += 3 * 60 * 1000;
    }

    // Đảm bảo expiresAt luôn ở tương lai ít nhất 1 phút nếu vừa chọn ghế
    if (expiresAt < now) {
      expiresAt = now + holdMinutes * 60 * 1000;
    }

    // 5. Cập nhật hoặc lưu phiên giữ ghế
    const remainingHolds = currentHolds.filter((h) => h.sessionId !== sessionId);
    remainingHolds.push({
      showtimeId: stIdStr,
      sessionId,
      seats: seatsArray,
      expiresAt,
      firstHeldAt,
      clientIp,
      isPaymentExtended: existingHold?.isPaymentExtended || false,
      isReconciliationExtended: existingHold?.isReconciliationExtended || false,
      status: existingHold?.status || 'HELD',
    });

    writeHoldsFile(remainingHolds);

    return NextResponse.json({
      success: true,
      expiresAt,
      firstHeldAt,
      seats: seatsArray,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Hủy phiên giữ ghế khi khách đóng tab hoặc hoàn tất
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      const currentHolds = readHoldsFile();
      const updated = currentHolds.filter((h) => h.sessionId !== sessionId);
      writeHoldsFile(updated);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
