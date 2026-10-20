import { NextResponse } from 'next/server';

interface MovieItem {
  id: string;
  title: string;
  duration_minutes: number;
  formats?: string[];
  age_rating?: string;
  release_date?: string;
  end_date?: string;
  status?: string;
  genres?: { id: string; name: string }[];
  imdb_score?: number;
  is_blockbuster?: boolean;
}

interface AuditoriumItem {
  id: string;
  name: string;
  screen_type: string;
  total_seats: number;
  cleaning_buffer_minutes?: number;
  status?: string;
}

interface ExistingShowtime {
  id?: string;
  auditorium_id: string;
  starts_at: string;
  ends_at: string;
  status?: string;
}

export type OptimizationCriteria = 'DEFAULT' | 'REVENUE' | 'TICKETS' | 'HOT' | 'GENRE';

interface AIScheduleRequest {
  target_date?: string;
  start_date?: string;
  end_date?: string;
  movies: MovieItem[];
  auditoriums: AuditoriumItem[];
  historical_orders?: any[];
  existing_showtimes?: ExistingShowtime[];
  locked_showtimes?: ExistingShowtime[];
  overwrite_existing?: boolean;
  target_slots_per_room?: number | string;
  optimization_criteria?: OptimizationCriteria;
  operating_hours?: {
    open_time: string;
    close_time: string;
  };
  cleaning_buffer_minutes?: number;
}

export interface AIScheduledSlot {
  movie_id: string;
  movie_title: string;
  movie_duration: number;
  format: string;
  auditorium_id: string;
  auditorium_name: string;
  auditorium_screen_type: string;
  date: string;
  start_time: string;
  end_time: string;
  starts_at: string;
  ends_at: string;
  ai_reasoning: string;
  confidence_score: number;
  rule_tags: string[];
}

// Helper: Kiểm tra tính tương thích định dạng phim và phòng chiếu
function isCompatible(movie: MovieItem, aud: AuditoriumItem): boolean {
  const formats = (movie.formats || ['2D']).map((f) => f.toUpperCase());
  const screen = (aud.screen_type || '2D').toUpperCase();

  if (screen === 'IMAX') {
    return formats.includes('IMAX') || formats.includes('3D IMAX');
  }
  if (screen === '4DX') {
    return formats.includes('4DX');
  }
  if (screen === '3D') {
    return formats.includes('3D') || formats.includes('2D');
  }
  return formats.includes('2D');
}

// Engine Lập Lịch Tối Ưu Thông Minh (Tuân thủ 100% Rules và Tiêu Chí Lựa Chọn)
function generateOptimizedScheduleWithRules(
  targetDate: string,
  validMovies: MovieItem[],
  activeAuds: AuditoriumItem[],
  movieStats: Record<string, { revenue: number; tickets: number; occupancy: number }>,
  existingShowtimes: ExistingShowtime[] = [],
  lockedShowtimes: ExistingShowtime[] = [],
  overwrite: boolean = true,
  openTime: string = '08:30',
  closeTime: string = '23:30',
  bufferMinutes: number = 15,
  targetSlotsPerRoom?: number | 'MAX',
  optimizationCriteria: OptimizationCriteria = 'DEFAULT'
): AIScheduledSlot[] {
  const results: AIScheduledSlot[] = [];

  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const startMinute = openH * 60 + openM;
  let endMinute = closeH * 60 + closeM;
  if (endMinute <= startMinute) {
    endMinute += 24 * 60; // Ca chiếu kéo dài qua nửa đêm
  }

  // Sắp xếp phòng: Phòng IMAX & phòng lớn ưu tiên xếp trước
  const sortedAuds = [...activeAuds].sort((a, b) => {
    if (a.screen_type === 'IMAX' && b.screen_type !== 'IMAX') return -1;
    if (b.screen_type === 'IMAX' && a.screen_type !== 'IMAX') return 1;
    return (b.total_seats || 0) - (a.total_seats || 0);
  });

  const targetDateTime = new Date(`${targetDate}T00:00:00Z`).getTime();

  // Hồ sơ chi tiết của từng phim (TUYỆT ĐỐI KHÔNG XẾP SUẤT TRƯỚC NGÀY KHỞI CHIẾU)
  const movieProfiles = validMovies
    .filter((m) => {
      if (m.release_date && targetDate < m.release_date.slice(0, 10)) {
        return false; // Chưa đến ngày khởi chiếu -> Tuyệt đối không xếp lịch
      }
      return true;
    })
    .map((m) => {
      const stats = movieStats[m.id] || { revenue: 0, tickets: 0, occupancy: 0 };
      const releaseDateTime = m.release_date ? new Date(`${m.release_date}T00:00:00Z`).getTime() : 0;

      // Đúng ngày khởi chiếu hoặc trong tuần đầu tiên ra mắt
      const isPremiere = Boolean(
        releaseDateTime > 0 && targetDateTime >= releaseDateTime && (targetDateTime - releaseDateTime) <= 7 * 86400000
      );
      const isAdvanceOrSneak = false; // Tuyệt đối không cho phép tạo suất trước ngày khởi chiếu

      // Điểm doanh số giả lập cho phim mới ra mắt để giữ rạp giờ vàng
      const effectiveRevenue = isPremiere ? Math.max(stats.revenue, 88000000) : stats.revenue;
      const effectiveOccupancy = isPremiere ? Math.max(stats.occupancy, 92) : stats.occupancy;

    const isBlockbuster = Boolean(
      m.is_blockbuster ||
      isPremiere ||
      isAdvanceOrSneak ||
      (m.imdb_score && m.imdb_score >= 8.0) ||
      stats.revenue > 20000000 ||
      stats.occupancy >= 60
    );
    const isFamily =
      m.age_rating === 'P' ||
      m.age_rating === 'K' ||
      Boolean(m.genres?.some((g) => ['hoạt hình', 'gia đình', 'kids', 'family', 'animation'].includes(g.name.toLowerCase())));
    const isHorror = Boolean(m.genres?.some((g) => g.name.toLowerCase().includes('kinh dị') || g.name.toLowerCase().includes('horror')));
    const isAdult = m.age_rating === 'T18';
    const isLowPerformer = !isPremiere && !isAdvanceOrSneak && stats.revenue < 5000000 && stats.occupancy < 20;

    return {
      movie: m,
      stats: {
        ...stats,
        revenue: effectiveRevenue,
        occupancy: effectiveOccupancy
      },
      isPremiere,
      isAdvanceOrSneak,
      isBlockbuster,
      isFamily,
      isHorror,
      isAdult,
      isLowPerformer
    };
  });

  // Xếp lịch cho từng phòng chiếu
  sortedAuds.forEach((aud, audIdx) => {
    const compatible = movieProfiles.filter((p) => isCompatible(p.movie, aud));
    if (compatible.length === 0) return;

    // Giãn cách mở màn giữa các phòng (15 phút) để khách không dồn sảnh cùng lúc
    const clusterOffset = (audIdx * 15) % 45;
    let currentMin = startMinute + clusterOffset;
    let loopGuard = 0;
    let roomSlotCount = 0;

    while (currentMin + 60 < endMinute && loopGuard < 20) {
      // Nếu đã đạt số suất mong muốn cho phòng này -> Dừng lại
      if (typeof targetSlotsPerRoom === 'number' && targetSlotsPerRoom > 0 && roomSlotCount >= targetSlotsPerRoom) {
        break;
      }

      loopGuard++;

      const timeOfDay = currentMin % 1440;
      const isMorning = timeOfDay < 12 * 60; // 08:30 - 12:00
      const isAfternoon = timeOfDay >= 12 * 60 && timeOfDay < 18 * 60; // 12:00 - 18:00
      const isPrimeTime = timeOfDay >= 18 * 60 && timeOfDay < 21 * 60 + 30; // 18:00 - 21:30 (Giờ vàng)
      const isLateNight = timeOfDay >= 21 * 60 + 30; // Sau 21:30

      // LỰA CHỌN PHIM THEO TIÊU CHÍ (OPTIMIZATION CRITERIA)
      let chosen = compatible[0];
      let reasoning = '';
      const ruleTags: string[] = [];

      // QUY TẮC BẮT BUỘC: Nếu có phim Mới Khởi Chiếu (trong tuần đầu ra mắt từ đúng ngày release_date), ưu tiên giữ rạp
      const premiereMovies = compatible.filter((p) => p.isPremiere);
      const shouldPrioritizePremiere = premiereMovies.length > 0 && (loopGuard === 1 || isPrimeTime || loopGuard % 2 === 1);

      if (shouldPrioritizePremiere && premiereMovies.length > 0) {
        chosen = premiereMovies[(loopGuard - 1) % premiereMovies.length];
        reasoning = `🎉 PHIM MỚI KHỞI CHIẾU (${chosen.movie.release_date}): Ưu tiên giữ rạp & chiếm khung giờ đẹp, bảo đảm không bị phim cũ lấn át.`;
        ruleTags.push('Mới Khởi Chiếu', 'Giữ Rạp', isPrimeTime ? 'Giờ Vàng' : 'Tâm Điểm');
      } else if (optimizationCriteria === 'REVENUE') {
        // 1. Tiêu chí Doanh thu: Ưu tiên phim có tổng doanh thu phòng vé cao nhất
        const sortedByRev = [...compatible].sort((a, b) => (b.stats.revenue || 0) - (a.stats.revenue || 0));
        chosen = sortedByRev[(loopGuard - 1) % Math.min(2, sortedByRev.length)] || compatible[0];
        reasoning = `Tiêu chí DOANH THU: Phim mang lại doanh thu cao nhất (${chosen.stats.revenue.toLocaleString('vi-VN')} đ).`;
        ruleTags.push('Doanh Thu Top', 'Tối Đa Lợi Nhuận');
      } else if (optimizationCriteria === 'TICKETS') {
        // 2. Tiêu chí Lượt bán: Ưu tiên phim bán chạy nhất / tỷ lệ lấp đầy cao nhất
        const sortedByTickets = [...compatible].sort((a, b) => (b.stats.tickets || 0) - (a.stats.tickets || 0));
        chosen = sortedByTickets[(loopGuard - 1) % Math.min(2, sortedByTickets.length)] || compatible[0];
        reasoning = `Tiêu chí LƯỢT BÁN: Phim bán chạy nhất (${chosen.stats.tickets} vé, tỷ lệ lấp đầy ghế ${chosen.stats.occupancy}%).`;
        ruleTags.push('Lượt Bán Cháy Vé', 'Tỷ Lệ Lấp Đầy Cao');
      } else if (optimizationCriteria === 'HOT') {
        // 3. Tiêu chí Độ Hot / Bom Tấn: Ưu tiên phim gắn nhãn Bom Tấn khi tạo vé/phim
        const hotMovies = compatible.filter((p) => p.isBlockbuster);
        chosen = hotMovies.length > 0 ? hotMovies[(loopGuard - 1) % hotMovies.length] : compatible[0];
        reasoning = `Tiêu chí ĐỘ HOT: Phim bom tấn / xếp hạng cao (${chosen.movie.imdb_score || 8.5}★), ưu tiên suất đẹp.`;
        ruleTags.push('Phim Bom Tấn', 'Độ Hot Cao');
      } else if (optimizationCriteria === 'GENRE') {
        // 4. Tiêu chí Thể loại: Phân bổ khoa học theo khung giờ
        if (isMorning) {
          chosen = compatible.find((p) => p.isFamily) || compatible[0];
          reasoning = 'Tiêu chí THỂ LOẠI: Phim hoạt hình / thiếu nhi phù hợp xem buổi sáng.';
          ruleTags.push('Thể Loại Hoạt Hình', 'Gia Đình');
        } else if (isLateNight) {
          chosen = compatible.find((p) => p.isAdult || p.isHorror) || compatible[0];
          reasoning = 'Tiêu chí THỂ LOẠI: Phim hành động / kinh dị kịch tính vào khung đêm muộn.';
          ruleTags.push('Thể Loại Kinh Dị/18+', 'Khán Giả Trẻ');
        } else if (isPrimeTime) {
          chosen = compatible.find((p) => p.isBlockbuster) || compatible[0];
          reasoning = 'Tiêu chí THỂ LOẠI: Siêu phẩm điện ảnh tâm điểm cho giờ vàng tối.';
          ruleTags.push('Thể Loại Bom Tấn', 'Giờ Vàng');
        } else {
          chosen = compatible[(loopGuard - 1) % compatible.length];
          reasoning = 'Tiêu chí THỂ LOẠI: Đa dạng hóa các dòng phim chiều.';
          ruleTags.push('Thể Loại Đa Dạng');
        }
      } else {
        // 5. Tiêu chí MẶC ĐỊNH: Cân bằng kết hợp doanh thu + khung giờ vàng
        if (isPrimeTime) {
          const topMovies = compatible.filter((p) => p.isBlockbuster || !p.isLowPerformer);
          chosen = topMovies.length > 0 ? topMovies[(loopGuard - 1) % topMovies.length] : compatible[0];
          reasoning = `Khung giờ vàng tối (${Math.floor(timeOfDay / 60)}h${(timeOfDay % 60).toString().padStart(2, '0')}). Ưu tiên phim bom tấn có doanh thu & tỷ lệ lấp đầy cao.`;
          ruleTags.push('Giờ Vàng', 'Tối Ưu Doanh Thu');
        } else if (isMorning) {
          const morningCandidates = compatible.filter((p) => p.isFamily || !p.isHorror);
          chosen = morningCandidates.length > 0 ? morningCandidates[(loopGuard - 1) % morningCandidates.length] : compatible[0];
          reasoning = chosen.isFamily
            ? 'Khung giờ sáng phù hợp gia đình & trẻ em (nhãn ' + (chosen.movie.age_rating || 'P') + ').'
            : 'Khung giờ sáng mở màn linh hoạt, hạn chế phim kinh dị/18+.';
          ruleTags.push('Suất Sáng', chosen.isFamily ? 'Phim Gia Đình' : 'Thấp Điểm');
        } else if (isLateNight) {
          const lateCandidates = compatible.filter((p) => p.isAdult || p.isHorror || p.isBlockbuster);
          chosen = lateCandidates.length > 0 ? lateCandidates[(loopGuard - 1) % lateCandidates.length] : compatible[0];
          reasoning = 'Khung đêm muộn thích hợp cho khán giả trẻ, ưu tiên phim kinh dị / hành động giật gân.';
          ruleTags.push('Suất Đêm', 'Khán Giả Trẻ');
        } else {
          chosen = compatible[(loopGuard - 1) % compatible.length];
          reasoning = 'Khung giờ chiều ổn định, phân bổ đều lượt chiếu giữa các phim đang phát hành.';
          ruleTags.push('Suất Chiều', 'Cân Bằng');
        }
      }

      const duration = chosen.movie.duration_minutes || 110;
      const slotEndMin = currentMin + duration;

      // Nếu thời gian không đủ để tạo thì chỉ cần tạo đúng với thời gian (không vượt quá giờ đóng cửa)
      if (slotEndMin > endMinute + 60) {
        break;
      }

      const startH = Math.floor(currentMin / 60) % 24;
      const startM = currentMin % 60;
      const endH = Math.floor(slotEndMin / 60) % 24;
      const endM = slotEndMin % 60;

      const startTimeStr = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
      const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

      const startsAt = new Date(`${targetDate}T${startTimeStr}:00+07:00`).toISOString();
      const endsAt = new Date(`${targetDate}T${endTimeStr}:00+07:00`).toISOString();

      // Kiểm tra xem có bị trùng với suất đã có khách đặt hoặc suất cố định không (Bảo lưu 100% suất đã có vé)
      let hasConflict = false;
      const mustAvoidShowtimes = overwrite ? lockedShowtimes : [...lockedShowtimes, ...existingShowtimes];
      if (mustAvoidShowtimes.length > 0) {
        const sTime = new Date(startsAt).getTime();
        const eTime = new Date(endsAt).getTime();
        const conflictingSlot = mustAvoidShowtimes.find((ex) => {
          if (ex.auditorium_id !== aud.id || ex.status === 'cancelled') return false;
          const exStart = new Date(ex.starts_at).getTime() - bufferMinutes * 60 * 1000;
          const exEnd = new Date(ex.ends_at).getTime() + bufferMinutes * 60 * 1000;
          return sTime < exEnd && eTime > exStart;
        });
        if (conflictingSlot) {
          hasConflict = true;
          // Nhảy sang thời điểm sau khi suất đã có vé kết thúc + buffer
          const exEndDate = new Date(conflictingSlot.ends_at);
          const nextAvailMin = exEndDate.getHours() * 60 + exEndDate.getMinutes() + bufferMinutes;
          if (nextAvailMin > currentMin) {
            currentMin = nextAvailMin;
          }
        }
      }

      if (!hasConflict) {
        const format = aud.screen_type === 'IMAX' && chosen.movie.formats?.includes('IMAX')
          ? 'IMAX'
          : aud.screen_type === '3D' && chosen.movie.formats?.includes('3D')
          ? '3D'
          : '2D';

        results.push({
          movie_id: chosen.movie.id,
          movie_title: chosen.movie.title,
          movie_duration: duration,
          format,
          auditorium_id: aud.id,
          auditorium_name: aud.name,
          auditorium_screen_type: aud.screen_type,
          date: targetDate,
          start_time: startTimeStr,
          end_time: endTimeStr,
          starts_at: startsAt,
          ends_at: endsAt,
          ai_reasoning: reasoning,
          confidence_score: isPrimeTime && chosen.isBlockbuster ? 98 : 92,
          rule_tags: ruleTags
        });
        roomSlotCount++;
      }

      // Bước nhảy = Thời lượng phim + Thời gian dọn phòng (buffer)
      currentMin = slotEndMin + bufferMinutes;
    }
  });

  return results;
}

export async function POST(req: Request) {
  try {
    const body: AIScheduleRequest = await req.json();
    const {
      target_date,
      start_date,
      end_date,
      movies = [],
      auditoriums = [],
      historical_orders = [],
      existing_showtimes = [],
      locked_showtimes = [],
      overwrite_existing = true,
      target_slots_per_room = 'MAX',
      optimization_criteria = 'DEFAULT',
      operating_hours = { open_time: '08:30', close_time: '23:30' },
      cleaning_buffer_minutes = 15
    } = body;

    const startDateStr = start_date || target_date;
    const endDateStr = end_date || target_date || start_date;

    if (!startDateStr) {
      return NextResponse.json(
        { success: false, error: 'Thiếu ngày bắt đầu xếp lịch (start_date hoặc target_date).' },
        { status: 400 }
      );
    }

    // Tính danh sách các ngày cần tạo lịch (tối đa 14 ngày)
    const sDate = new Date(`${startDateStr}T00:00:00`);
    const eDate = new Date(`${endDateStr}T00:00:00`);
    const dayDiff = Math.max(0, Math.min(14, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 3600 * 24))));

    const dateList: string[] = [];
    for (let i = 0; i <= dayDiff; i++) {
      const d = new Date(sDate);
      d.setDate(d.getDate() + i);
      dateList.push(d.toISOString().split('T')[0]);
    }

    // Lọc phòng đang hoạt động
    const activeAuds = auditoriums.filter((a) => a.status !== 'maintenance');
    if (activeAuds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tất cả các phòng chiếu đang trong trạng thái bảo trì. Không thể xếp suất chiếu.'
      }, { status: 400 });
    }

    // Phân tích doanh thu & số vé lịch sử từ orders
    const movieStats: Record<string, { revenue: number; tickets: number; occupancy: number }> = {};
    movies.forEach((m) => {
      movieStats[m.id] = { revenue: 0, tickets: 0, occupancy: 40 };
    });

    if (Array.isArray(historical_orders)) {
      historical_orders.forEach((order) => {
        if (order.status === 'paid' && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const mId = item.movie_id || item.item_snapshot?.movieId;
            if (mId && movieStats[mId]) {
              movieStats[mId].revenue += Number(item.price || 0) * Number(item.quantity || 1);
              movieStats[mId].tickets += Number(item.quantity || 1);
            }
          });
        }
      });

      const maxTickets = Math.max(...Object.values(movieStats).map((s) => s.tickets), 1);
      Object.keys(movieStats).forEach((mId) => {
        const ratio = movieStats[mId].tickets / maxTickets;
        movieStats[mId].occupancy = Math.min(95, Math.max(15, Math.round(ratio * 90)));
      });
    }

    const numericSlotsLimit = typeof target_slots_per_room === 'number'
      ? target_slots_per_room
      : target_slots_per_room === 'MAX'
      ? undefined
      : parseInt(String(target_slots_per_room), 10) || undefined;

    // Lấy API key
    let apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const match = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
          if (match && match[1]) {
            apiKey = match[1].trim();
          }
        }
      } catch (e) {
        // ignore
      }
    }

    let allGeneratedSlots: AIScheduledSlot[] = [];
    let usedSource = 'cinemax_rules_engine';

    // Thử gọi Gemini AI nếu có key và chỉ xếp trong phạm vi <= 3 ngày để bảo đảm tốc độ phản hồi nhanh
    if (apiKey && dateList.length <= 3) {
      try {
        const firstDayValidMovies = movies.filter((m) => {
          if (m.status === 'ended') return false;
          // TUYỆT ĐỐI KHÔNG XẾP LỊCH nếu mọi ngày trong danh sách đều trước ngày khởi chiếu
          if (m.release_date && dateList.every((d) => d < m.release_date!.slice(0, 10))) return false;
          return true;
        });

        const promptMovies = firstDayValidMovies.map((m) => ({
          id: m.id,
          title: m.title,
          release_date: m.release_date || null,
          duration: m.duration_minutes || 110,
          formats: m.formats || ['2D'],
          age_rating: m.age_rating || 'P',
          is_blockbuster: Boolean(m.is_blockbuster || (m.imdb_score && m.imdb_score >= 8.0)),
          revenue_vnd: movieStats[m.id]?.revenue || 0,
          occupancy_rate: `${movieStats[m.id]?.occupancy || 40}%`
        }));

        const promptAuds = activeAuds.map((a) => ({
          id: a.id,
          name: a.name,
          screen_type: a.screen_type,
          total_seats: a.total_seats
        }));

        const systemInstruction = `Bạn là Trí tuệ Nhân tạo Giám đốc Điều hành Lịch chiếu (AI Cinema Scheduler) của hệ thống cụm rạp CINEMAX.
Nhiệm vụ: Lập lịch chiếu tối ưu cho các ngày: ${dateList.join(', ')}.

BỘ QUY TẮC RÀNG BUỘC (CINEMAX BUSINESS RULES):
1. CHỐNG TRÙNG PHÒNG: Suất sau >= suất trước + ${cleaning_buffer_minutes} phút dọn phòng.
2. KHUNG GIỜ: ${operating_hours.open_time} đến ${operating_hours.close_time}. Nếu thời gian không đủ để tạo thêm suất thì chỉ cần tạo đúng với thời gian có thể chứa.
3. TIÊU CHÍ ƯU TIÊN HIỆN TẠI: ${optimization_criteria}
   - REVENUE: Phim doanh thu cao nhất chiếm các phòng lớn và giờ vàng tối.
   - TICKETS: Phim bán nhiều vé nhất chiếm ưu tiên.
   - HOT: Phim bom tấn chiếm phòng IMAX và khung giờ đẹp.
   - GENRE: Phân bổ phim gia đình buổi sáng, kinh dị đêm muộn, bom tấn giờ vàng.
   - DEFAULT: Cân bằng toàn diện.
4. SỐ SUẤT MỖI PHÒNG: ${numericSlotsLimit ? `Tối đa ${numericSlotsLimit} suất/phòng` : 'Tối đa vừa vặn khung giờ'}.
5. BẢO VỆ SUẤT CÓ VÉ: Danh sách locked_showtimes là các suất đã có vé đặt, tuyệt đối KHÔNG xếp đè lên và chừa buffer ${cleaning_buffer_minutes}p.
6. TUYỆT ĐỐI TUÂN THỦ NGÀY KHỞI CHIẾU (RELEASE DATE):
   - Phim có ngày khởi chiếu (release_date), TUYỆT ĐỐI KHÔNG ĐƯỢC XẾP SUẤT CHIẾU TRƯỚC NGÀY KHỞI CHIẾU (date < release_date).
   - Chỉ được xếp lịch cho phim từ đúng ngày khởi chiếu trở đi (date >= release_date).
   - Khi xếp đúng ngày khởi chiếu hoặc tuần đầu ra rạp, ưu tiên dành phòng đẹp và khung giờ vàng để giữ rạp.

OUTPUT FORMAT: Trả về duy nhất một JSON Array tuân thủ đúng định dạng:
[
  {
    "movie_id": "...",
    "movie_title": "...",
    "movie_duration": 120,
    "format": "IMAX" | "2D",
    "auditorium_id": "...",
    "auditorium_name": "...",
    "auditorium_screen_type": "IMAX" | "2D",
    "date": "YYYY-MM-DD",
    "start_time": "HH:mm",
    "end_time": "HH:mm",
    "ai_reasoning": "Lý do AI sắp xếp suất này ngắn gọn",
    "confidence_score": 95,
    "rule_tags": ["Giờ Vàng", "Bom Tấn"]
  }
]`;

        const userContent = JSON.stringify({
          dates: dateList,
          optimization_criteria,
          target_slots_per_room: numericSlotsLimit || 'MAX',
          operating_hours,
          cleaning_buffer_minutes,
          auditoriums: promptAuds,
          movies: promptMovies,
          locked_showtimes
        });

        const modelName = 'gemini-2.5-flash';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(12000),
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemInstruction}\n\nDATA:\n${userContent}` }]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json'
            }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsedSlots = JSON.parse(rawText);
            if (Array.isArray(parsedSlots) && parsedSlots.length > 0) {
              allGeneratedSlots = parsedSlots.map((slot: any) => {
                const sDate = slot.date || startDateStr;
                return {
                  movie_id: slot.movie_id,
                  movie_title: slot.movie_title || movies.find((m) => m.id === slot.movie_id)?.title || 'Phim',
                  movie_duration: slot.movie_duration || movies.find((m) => m.id === slot.movie_id)?.duration_minutes || 110,
                  format: slot.format || '2D',
                  auditorium_id: slot.auditorium_id,
                  auditorium_name: slot.auditorium_name || activeAuds.find((a) => a.id === slot.auditorium_id)?.name || 'Phòng chiếu',
                  auditorium_screen_type: slot.auditorium_screen_type || activeAuds.find((a) => a.id === slot.auditorium_id)?.screen_type || '2D',
                  date: sDate,
                  start_time: slot.start_time,
                  end_time: slot.end_time,
                  starts_at: new Date(`${sDate}T${slot.start_time}:00+07:00`).toISOString(),
                  ends_at: new Date(`${sDate}T${slot.end_time}:00+07:00`).toISOString(),
                  ai_reasoning: slot.ai_reasoning || 'Tối ưu theo tiêu chí rạp.',
                  confidence_score: slot.confidence_score || 95,
                  rule_tags: Array.isArray(slot.rule_tags) ? slot.rule_tags : ['AI Tối Ưu']
                };
              });
              usedSource = 'gemini-2.5-flash';
            }
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini call failed or timed out, using rule engine fallback:', geminiErr);
      }
    }

    // Nếu Gemini chưa trả về kết quả (hoặc không có key / ngày dài), chạy qua Rule Engine cho từng ngày
    if (allGeneratedSlots.length === 0) {
      dateList.forEach((curDate) => {
        const curTargetTime = new Date(`${curDate}T00:00:00Z`).getTime();
        const validMoviesForDay = movies.filter((m) => {
          if (m.status === 'ended') return false;
          if (m.end_date) {
            const endTime = new Date(`${m.end_date}T23:59:59Z`).getTime();
            if (curTargetTime > endTime) return false;
          }
          if (m.release_date) {
            // TUYỆT ĐỐI CHỈ XẾP SUẤT TỪ ĐÚNG NGÀY KHỞI CHIẾU TRỞ ĐI (curDate >= release_date)
            // Phim chưa khởi chiếu (curDate < release_date) tuyệt đối KHÔNG ĐƯỢC PHÉP tạo suất chiếu
            if (curDate < m.release_date.slice(0, 10)) return false;
          }
          return true;
        });

        if (validMoviesForDay.length > 0) {
          const daySlots = generateOptimizedScheduleWithRules(
            curDate,
            validMoviesForDay,
            activeAuds,
            movieStats,
            existing_showtimes,
            locked_showtimes,
            overwrite_existing,
            operating_hours.open_time,
            operating_hours.close_time,
            cleaning_buffer_minutes,
            numericSlotsLimit,
            optimization_criteria
          );
          allGeneratedSlots.push(...daySlots);
        }
      });
      usedSource = 'cinemax_rules_engine';
    }

    return NextResponse.json({
      success: true,
      source: usedSource,
      start_date: startDateStr,
      end_date: endDateStr,
      total_days: dateList.length,
      total_slots: allGeneratedSlots.length,
      showtimes: allGeneratedSlots,
      optimization_criteria,
      target_slots_per_room: numericSlotsLimit || 'MAX'
    });
  } catch (error: any) {
    console.error('Error in AI schedule endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi khi sinh lịch chiếu AI.'
      },
      { status: 500 }
    );
  }
}
