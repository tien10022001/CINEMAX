import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export interface HeldSeatRecord {
  showtimeId: string;
  sessionId: string;
  seats: string[];
  expiresAt: number;
  firstHeldAt: number;
  clientIp?: string;
  userId?: string;
  isPaymentExtended?: boolean;
  isReconciliationExtended?: boolean;
  status?: 'HELD' | 'PENDING_RECONCILIATION';
}

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const HOLDS_FILE = path.join(DATA_DIR, 'seat-holds.json');

// Supabase client cho Server API (Single Source of Truth)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cycuxhztpvezqcznifqh.supabase.co';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_g_o1rXOoH48TQ80fcAYD6g_vsk-tcs0';
const supabase = createClient(supabaseUrl, supabaseKey);

// Memory cache để rate-limit chống spam API
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Anti-speculation release tracking (Chống đầu cơ găm/nhả ghế bom tấn)
interface ReleaseRecord {
  timestamps: number[];
  cooldownUntil: number;
}
const releaseTrackerMap = new Map<string, ReleaseRecord>();

function recordRelease(identifier: string) {
  if (!identifier) return;
  const now = Date.now();
  const record = releaseTrackerMap.get(identifier) || { timestamps: [], cooldownUntil: 0 };
  record.timestamps = record.timestamps.filter((t) => now - t <= 10 * 60 * 1000);
  record.timestamps.push(now);

  if (record.timestamps.length >= 3) {
    record.cooldownUntil = now + 15 * 60 * 1000;
  }
  releaseTrackerMap.set(identifier, record);
}

function clearReleaseCooldown(identifier: string) {
  if (!identifier) return;
  releaseTrackerMap.delete(identifier);
}

function checkCooldown(identifier: string): { isCooldown: boolean; remainingSeconds: number } {
  if (!identifier) return { isCooldown: false, remainingSeconds: 0 };
  const now = Date.now();
  const record = releaseTrackerMap.get(identifier);
  if (record && record.cooldownUntil > now) {
    const remainingSeconds = Math.ceil((record.cooldownUntil - now) / 1000);
    return { isCooldown: true, remainingSeconds };
  }
  return { isCooldown: false, remainingSeconds: 0 };
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || '127.0.0.1';
}

function checkRateLimit(clientIp: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const limitWindow = 60 * 1000;
  const maxRequests = 30;

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

/**
 * Tra cứu Showtime và Ánh xạ nhãn ghế (A1, E9, ĐÔI 1...) sang seat_id UUID trong Supabase Database
 */
async function resolveSupabaseShowtimeAndSeats(showtimeIdStr: string, seatLabels: string[] = []) {
  if (!showtimeIdStr) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(showtimeIdStr);

  let showtime: { id: string; auditorium_id: string } | null = null;
  if (isUuid) {
    const { data } = await supabase.from('showtimes').select('id, auditorium_id').eq('id', showtimeIdStr).maybeSingle();
    if (data) showtime = data;
  }

  if (!showtime) {
    const { data: openSt } = await supabase.from('showtimes').select('id, auditorium_id').eq('status', 'open').limit(1).maybeSingle();
    if (openSt) showtime = openSt;
  }

  if (!showtime || !showtime.auditorium_id) return null;

  const { data: seats } = await supabase
    .from('seats')
    .select('id, row_label, seat_number, seat_type')
    .eq('auditorium_id', showtime.auditorium_id);

  if (!seats || seats.length === 0) return null;

  const labelToSeatMap = new Map<string, string>();
  const idToLabelMap = new Map<string, string>();

  seats.forEach((s: any) => {
    const code = s.seat_type === 'COUPLE' ? `ĐÔI ${s.seat_number}` : `${s.row_label}${s.seat_number}`;
    labelToSeatMap.set(code.toUpperCase(), s.id);
    idToLabelMap.set(s.id, code.toUpperCase());
    labelToSeatMap.set(`${s.row_label}${s.seat_number}`.toUpperCase(), s.id);
  });

  const targetSeatIds: string[] = [];
  seatLabels.forEach((label) => {
    const sid = labelToSeatMap.get(label.trim().toUpperCase());
    if (sid) targetSeatIds.push(sid);
  });

  return {
    showtimeUuid: showtime.id,
    auditoriumId: showtime.auditorium_id,
    targetSeatIds,
    labelToSeatMap,
    idToLabelMap,
  };
}

// GET: Lấy danh sách ghế đang bị giữ chỗ theo suất chiếu trực tiếp từ Database Supabase (SSOT)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const showtimeId = searchParams.get('showtimeId');
    const sessionId = searchParams.get('sessionId');
    const now = Date.now();
    const nowIso = new Date().toISOString();

    const currentHolds = readHoldsFile();
    let fileResult = currentHolds;
    if (showtimeId) {
      fileResult = currentHolds.filter((h) => h.showtimeId.toString() === showtimeId.toString());
    }

    // Đồng bộ trực tiếp từ bảng showtime_seats trong Supabase Database
    let dbHeldRecords: HeldSeatRecord[] = [];
    if (showtimeId) {
      try {
        const showtimeInfo = await resolveSupabaseShowtimeAndSeats(showtimeId);
        if (showtimeInfo) {
          // 1. Tự động dọn dẹp các ghế giữ đã hết hạn trong DB
          await supabase
            .from('showtime_seats')
            .update({ status: 'available', held_until: null })
            .eq('showtime_id', showtimeInfo.showtimeUuid)
            .eq('status', 'held')
            .lte('held_until', nowIso);

          // 2. Lấy danh sách ghế đang 'held' còn hạn trong DB
          const { data: dbSeats } = await supabase
            .from('showtime_seats')
            .select('seat_id, held_until')
            .eq('showtime_id', showtimeInfo.showtimeUuid)
            .eq('status', 'held')
            .gt('held_until', nowIso);

          if (dbSeats && dbSeats.length > 0) {
            const heldLabels: string[] = [];
            let latestExpiry = now + 10 * 60 * 1000;
            dbSeats.forEach((ss: any) => {
              const label = showtimeInfo.idToLabelMap.get(ss.seat_id);
              if (label) {
                heldLabels.push(label);
                if (ss.held_until) {
                  latestExpiry = Math.max(latestExpiry, new Date(ss.held_until).getTime());
                }
              }
            });

            if (heldLabels.length > 0) {
              dbHeldRecords.push({
                showtimeId,
                sessionId: 'supabase_db_hold',
                seats: heldLabels,
                expiresAt: latestExpiry,
                firstHeldAt: now,
                status: 'HELD',
              });
            }
          }
        }
      } catch (dbErr) {
        console.warn('Supabase DB get showtime_seats sync error:', dbErr);
      }
    }

    // Kết hợp dữ liệu (Ưu tiên Database SSOT)
    const combinedHeldMap = new Map<string, number>();
    fileResult.forEach((h) => {
      (h.seats || []).forEach((s) => combinedHeldMap.set(s, Math.max(combinedHeldMap.get(s) || 0, h.expiresAt)));
    });
    dbHeldRecords.forEach((h) => {
      (h.seats || []).forEach((s) => combinedHeldMap.set(s, Math.max(combinedHeldMap.get(s) || 0, h.expiresAt)));
    });

    const finalHeldSeats: HeldSeatRecord[] = [];
    if (combinedHeldMap.size > 0) {
      finalHeldSeats.push({
        showtimeId: showtimeId || 'all',
        sessionId: 'db_ssot_sync',
        seats: Array.from(combinedHeldMap.keys()),
        expiresAt: Math.max(...Array.from(combinedHeldMap.values())),
        firstHeldAt: now,
        status: 'HELD',
      });
    }

    const sessionHold = sessionId ? currentHolds.find((h) => h.sessionId === sessionId) : null;

    return NextResponse.json({
      success: true,
      heldSeats: finalHeldSeats.length > 0 ? finalHeldSeats : fileResult,
      sessionHold: sessionHold || null,
      now,
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
      action = 'HOLD',
      holdMinutes = 10,
      userId,
    } = body;

    const rawSeats = body.seatLabels !== undefined ? body.seatLabels : body.seatCodes;
    const seatsArray: string[] = Array.isArray(rawSeats) ? rawSeats : [];

    if (action === 'RESET_COOLDOWN') {
      clearReleaseCooldown(clientIp);
      clearReleaseCooldown(sessionId);
      if (userId) clearReleaseCooldown(userId);
      return NextResponse.json({ success: true, message: 'Đã giải tỏa trạng thái cooldown' });
    }

    if (!showtimeId || !sessionId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu showtimeId hoặc sessionId' },
        { status: 400 }
      );
    }

    const stIdStr = showtimeId.toString();
    let currentHolds = readHoldsFile();
    const now = Date.now();
    const nowIso = new Date().toISOString();
    const existingHold = currentHolds.find((h) => h.sessionId === sessionId);

    const effectiveSeatsForLookup = seatsArray.length > 0 ? seatsArray : (existingHold?.seats || []);
    // Ánh xạ showtime và seats lên Database Supabase
    const showtimeInfo = await resolveSupabaseShowtimeAndSeats(stIdStr, effectiveSeatsForLookup);

    // XỬ LÝ HỦY GIỮ GHẾ (RELEASE)
    const isExplicitRelease = action === 'RELEASE' || (action === 'HOLD' && Array.isArray(rawSeats) && rawSeats.length === 0);
    if (isExplicitRelease) {
      if (existingHold && existingHold.seats && existingHold.seats.length > 0) {
        recordRelease(clientIp);
        recordRelease(sessionId);
        if (userId || existingHold.userId) recordRelease(userId || existingHold.userId || '');
      }

      // 1. Giải phóng trực tiếp trong Supabase Database showtime_seats
      if (showtimeInfo && showtimeInfo.targetSeatIds.length > 0) {
        try {
          await supabase
            .from('showtime_seats')
            .update({ status: 'available', held_until: null })
            .eq('showtime_id', showtimeInfo.showtimeUuid)
            .in('seat_id', showtimeInfo.targetSeatIds)
            .eq('status', 'held');
        } catch (dbErr) {
          console.warn('Supabase DB release seat error:', dbErr);
        }
      }

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

      if (existingHold.isPaymentExtended) {
        return NextResponse.json({
          success: true,
          message: 'Đã gia hạn thanh toán trước đó',
          expiresAt: existingHold.expiresAt,
          firstHeldAt: existingHold.firstHeldAt,
          seats: existingHold.seats,
        });
      }

      const MAX_TOTAL_MS = 11 * 60 * 1000;
      const proposedExpiresAt = Math.min(
        existingHold.expiresAt + 60 * 1000,
        existingHold.firstHeldAt + MAX_TOTAL_MS
      );

      existingHold.expiresAt = Math.max(existingHold.expiresAt, proposedExpiresAt);
      existingHold.isPaymentExtended = true;
      writeHoldsFile(currentHolds);

      // Đồng bộ thời gian mới lên Supabase Database
      if (showtimeInfo && showtimeInfo.targetSeatIds.length > 0) {
        try {
          await supabase
            .from('showtime_seats')
            .update({ held_until: new Date(existingHold.expiresAt).toISOString() })
            .eq('showtime_id', showtimeInfo.showtimeUuid)
            .in('seat_id', showtimeInfo.targetSeatIds)
            .eq('status', 'held');
        } catch {}
      }

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

      if (showtimeInfo && showtimeInfo.targetSeatIds.length > 0) {
        try {
          await supabase
            .from('showtime_seats')
            .update({ held_until: new Date(existingHold.expiresAt).toISOString() })
            .eq('showtime_id', showtimeInfo.showtimeUuid)
            .in('seat_id', showtimeInfo.targetSeatIds)
            .eq('status', 'held');
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: 'Đã kích hoạt chế độ chờ đối soát ngân hàng (+3 phút)',
        expiresAt: existingHold.expiresAt,
        firstHeldAt: existingHold.firstHeldAt,
        seats: existingHold.seats,
      });
    }

    // XỬ LÝ GIỮ GHẾ TIÊU CHUẨN (ACTION: HOLD)
    if (seatsArray.length > 8) {
      return NextResponse.json(
        {
          success: false,
          error: 'Mỗi giao dịch chỉ được đặt tối đa 8 ghế theo quy định rạp.',
        },
        { status: 400 }
      );
    }

    // Chống bot/đầu cơ găm-nhả ghế (Anti-Speculation Cooldown)
    const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';
    const ipCooldown = isLoopback ? { isCooldown: false, remainingSeconds: 0 } : checkCooldown(clientIp);
    const sessionCooldown = checkCooldown(sessionId);
    const userCooldown = userId ? checkCooldown(userId) : { isCooldown: false, remainingSeconds: 0 };
    if (ipCooldown.isCooldown || sessionCooldown.isCooldown || userCooldown.isCooldown) {
      const maxRemaining = Math.max(
        ipCooldown.remainingSeconds,
        sessionCooldown.remainingSeconds,
        userCooldown.remainingSeconds
      );
      const minutesLeft = Math.ceil(maxRemaining / 60);
      return NextResponse.json(
        {
          success: false,
          isCooldown: true,
          cooldownSeconds: maxRemaining,
          error: `Bạn đã thay đổi/hủy chọn ghế quá nhiều lần liên tiếp. Vui lòng chờ ${minutesLeft} phút trước khi chọn lại ghế mới để đảm bảo công bằng cho khán giả khác.`,
        },
        { status: 429 }
      );
    }

    // Kiểm tra xung đột trực tiếp trên Supabase Database (SSOT)
    if (showtimeInfo && showtimeInfo.targetSeatIds.length > 0) {
      try {
        // Dọn dẹp ghế hết hạn trước
        await supabase
          .from('showtime_seats')
          .update({ status: 'available', held_until: null })
          .eq('showtime_id', showtimeInfo.showtimeUuid)
          .eq('status', 'held')
          .lte('held_until', nowIso);

        // Đọc trạng thái hiện tại của các ghế yêu cầu
        const { data: dbOccupied } = await supabase
          .from('showtime_seats')
          .select('seat_id, status, held_until')
          .eq('showtime_id', showtimeInfo.showtimeUuid)
          .in('seat_id', showtimeInfo.targetSeatIds);

        if (dbOccupied && dbOccupied.length > 0) {
          for (const occ of dbOccupied) {
            const label = showtimeInfo.idToLabelMap.get(occ.seat_id) || occ.seat_id;
            if (occ.status === 'sold' || occ.status === 'blocked') {
              return NextResponse.json(
                {
                  success: false,
                  error: `Ghế ${label} đã được bán hoặc bảo trì. Vui lòng chọn ghế khác!`,
                  conflictedSeat: label,
                },
                { status: 409 }
              );
            }
            if (occ.status === 'held' && occ.held_until && new Date(occ.held_until).getTime() > now) {
              // Nếu ghế này không thuộc phiên hiện tại
              const isHeldByMe = existingHold && existingHold.seats && existingHold.seats.includes(label);
              if (!isHeldByMe) {
                return NextResponse.json(
                  {
                    success: false,
                    error: `Ghế ${label} đang được tạm giữ bởi khách hàng khác trên hệ thống. Vui lòng chọn ghế khác!`,
                    conflictedSeat: label,
                  },
                  { status: 409 }
                );
              }
            }
          }
        }
      } catch (dbCheckErr) {
        console.warn('Supabase DB seat conflict check error:', dbCheckErr);
      }
    }

    // Kiểm tra Hard Cap thời gian cho phiên hiện tại
    const firstHeldAt = existingHold ? existingHold.firstHeldAt : now;
    const MAX_STANDARD_HOLD_MS = 10 * 60 * 1000;
    const MAX_CAP_MS = 11 * 60 * 1000;

    if (existingHold && now - existingHold.firstHeldAt >= MAX_CAP_MS) {
      return NextResponse.json(
        {
          success: false,
          error: 'Thời gian giữ ghế của bạn đã hết hạn (tối đa 10 phút). Vui lòng thực hiện lại từ đầu!',
        },
        { status: 410 }
      );
    }

    let expiresAt = firstHeldAt + MAX_STANDARD_HOLD_MS;
    if (existingHold?.isPaymentExtended) {
      expiresAt += 60 * 1000;
    }
    if (existingHold?.isReconciliationExtended) {
      expiresAt += 3 * 60 * 1000;
    }

    if (expiresAt < now) {
      expiresAt = now + holdMinutes * 60 * 1000;
    }

    // GHI VÀO SUPABASE DATABASE (COMMIT TRƯỚC THEO QUY TẮC SSOT)
    if (showtimeInfo && showtimeInfo.targetSeatIds.length > 0) {
      try {
        const upsertRows = showtimeInfo.targetSeatIds.map((sid) => ({
          showtime_id: showtimeInfo.showtimeUuid,
          seat_id: sid,
          status: 'held' as const,
          held_until: new Date(expiresAt).toISOString(),
        }));
        const { error: upsertErr } = await supabase.from('showtime_seats').upsert(upsertRows);
        if (upsertErr) {
          console.warn('Supabase DB showtime_seats upsert error:', upsertErr);
        }
      } catch (dbErr) {
        console.warn('Supabase DB hold commit error:', dbErr);
      }
    }

    // Cập nhật lưu phiên giữ ghế
    const remainingHolds = currentHolds.filter((h) => h.sessionId !== sessionId);
    remainingHolds.push({
      showtimeId: stIdStr,
      sessionId,
      seats: seatsArray,
      expiresAt,
      firstHeldAt,
      clientIp,
      userId: userId || existingHold?.userId,
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
    const clientIp = getClientIp(request);

    if (sessionId) {
      const currentHolds = readHoldsFile();
      const existing = currentHolds.find((h) => h.sessionId === sessionId);
      if (existing && existing.seats && existing.seats.length > 0) {
        recordRelease(clientIp);
        recordRelease(sessionId);
        if (existing.userId) recordRelease(existing.userId);

        // Giải phóng ghế trong Supabase Database
        try {
          const showtimeInfo = await resolveSupabaseShowtimeAndSeats(existing.showtimeId, existing.seats);
          if (showtimeInfo && showtimeInfo.targetSeatIds.length > 0) {
            await supabase
              .from('showtime_seats')
              .update({ status: 'available', held_until: null })
              .eq('showtime_id', showtimeInfo.showtimeUuid)
              .in('seat_id', showtimeInfo.targetSeatIds)
              .eq('status', 'held');
          }
        } catch {}
      }
      const updated = currentHolds.filter((h) => h.sessionId !== sessionId);
      writeHoldsFile(updated);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
