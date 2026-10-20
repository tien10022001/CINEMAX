import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// File-based persistent store located in data directory
const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const STORE_FILE = path.join(DATA_DIR, 'cinema-store.json');

interface StoreData {
  movies?: any[];
  showtimes?: any[];
  auditoriums?: any[];
  products?: any[];
  foods?: any[];
  settings?: any[];
  coupons?: any[];
  promotions?: any[];
  cinemas?: any[];
  news?: any[];
  orders?: any[];
  shifts?: any[];
  deleted_ids?: string[];
  last_updated?: string;
}

function ensureStoreFile(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      const initial: StoreData = {
        last_updated: new Date().toISOString()
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(content || '{}');
  } catch (err) {
    console.error('Error reading store file:', err);
    return {};
  }
}

function writeStoreFile(data: StoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    data.last_updated = new Date().toISOString();
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing store file:', err);
  }
}

// GET: Retrieve all or specific synchronized entities
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get('entity');
    const store = ensureStoreFile();

    if (entity && entity in store) {
      return NextResponse.json({ success: true, data: (store as any)[entity] });
    }

    return NextResponse.json({ success: true, data: store });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Synchronize directly with Supabase Cloud for all admin create, update, and delete actions
async function syncToSupabaseIfConfigured(entityOrAction: string, data: any) {
  const apiKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_g_o1rXOoH48TQ80fcAYD6g_vsk-tcs0';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cycuxhztpvezqcznifqh.supabase.co';
  if (!apiKey) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, apiKey);

    if (entityOrAction === 'save_movie' && data) {
      const moviePayload = { ...data };
      delete moviePayload.genres; // handled separately or not a column in movies
      if (moviePayload.id && !moviePayload.id.includes('-')) {
        delete moviePayload.id;
      }
      await supabase.from('movies').upsert(moviePayload);
    } else if (entityOrAction === 'delete_movie' && data?.id) {
      await supabase.from('showtimes').delete().eq('movie_id', data.id);
      await supabase.from('movies').delete().eq('id', data.id);
    } else if (entityOrAction === 'save_movies' && Array.isArray(data)) {
      const cleanMovies = data.map((m: any) => {
        const item = { ...m };
        delete item.genres;
        return item;
      });
      await supabase.from('movies').upsert(cleanMovies);
    } else if (entityOrAction === 'showtimes' && Array.isArray(data)) {
      const cleanShowtimes = data.map((st: any) => ({
        id: st.id,
        movie_id: st.movie_id,
        auditorium_id: st.auditorium_id,
        format: st.format || '2D',
        language_version: st.language_version || 'Phụ đề Tiếng Việt',
        starts_at: st.starts_at || st.start_time,
        ends_at: st.ends_at || st.end_time,
        status: st.status || 'open'
      })).filter((st: any) => st.movie_id && st.auditorium_id);
      if (cleanShowtimes.length > 0) {
        for (let i = 0; i < cleanShowtimes.length; i += 50) {
          await supabase.from('showtimes').upsert(cleanShowtimes.slice(i, i + 50));
        }
      }
    } else if (entityOrAction === 'delete_showtime' && data?.id) {
      await supabase.from('showtime_prices').delete().eq('showtime_id', data.id);
      await supabase.from('showtimes').delete().eq('id', data.id);
    } else if ((entityOrAction === 'products' || entityOrAction === 'foods') && Array.isArray(data)) {
      await supabase.from('products').upsert(data);
    } else if ((entityOrAction === 'delete_product' || entityOrAction === 'delete_food') && data?.id) {
      await supabase.from('products').delete().eq('id', data.id);
    } else if ((entityOrAction === 'coupons' || entityOrAction === 'promotions') && Array.isArray(data)) {
      const cleanCoupons = data.map((c: any) => ({
        id: c.id && String(c.id).length === 36 ? c.id : undefined,
        code: String(c.code).trim().toUpperCase(),
        discount_type: c.discount_type || 'FIXED',
        discount_value: Number(c.discount_value || 0),
        max_discount: c.max_discount != null ? Number(c.max_discount) : null,
        min_order_amount: Number(c.min_order_amount ?? c.min_order ?? 0),
        apply_scope: c.apply_scope || 'ALL',
        starts_at: c.starts_at || c.valid_from || new Date().toISOString(),
        ends_at: c.ends_at || c.valid_to || new Date(Date.now() + 90 * 86400000).toISOString(),
        usage_limit: c.usage_limit != null ? Number(c.usage_limit) : null,
        per_user_limit: Number(c.per_user_limit || 1),
        active: c.active ?? c.is_active ?? true
      }));
      await supabase.from('coupons').upsert(cleanCoupons);
    } else if ((entityOrAction === 'delete_coupon' || entityOrAction === 'delete_promotion') && (data?.id || data?.code)) {
      if (data?.id) await supabase.from('coupons').delete().eq('id', data.id);
      if (data?.code) await supabase.from('coupons').delete().eq('code', data.code);
    } else if (entityOrAction === 'auditoriums' && Array.isArray(data)) {
      const cleanAuds = data.map((a: any) => ({
        id: a.id && a.id.length === 36 ? a.id : undefined,
        name: a.name || 'Phòng chiếu',
        screen_type: a.screen_type || '2D',
        sound_system: a.sound_system || 'Dolby 7.1',
        total_seats: Number(a.total_seats) || 80,
        cleaning_buffer_minutes: Number(a.cleaning_buffer_minutes) || 15,
        status: a.status || 'active',
        seat_map_version: a.seat_map_version || 1
      })).filter((a: any) => a.id);
      if (cleanAuds.length > 0) {
        await supabase.from('auditoriums').upsert(cleanAuds);
      }
    } else if (entityOrAction === 'delete_auditorium' && data?.id) {
      await supabase.from('seats').delete().eq('auditorium_id', data.id);
      await supabase.from('showtimes').delete().eq('auditorium_id', data.id);
      await supabase.from('auditoriums').delete().eq('id', data.id);
    } else if (entityOrAction === 'settings' && Array.isArray(data)) {
      await supabase.from('cinema_settings').upsert(data);
    } else if (entityOrAction === 'seats' && Array.isArray(data)) {
      const cleanSeats = data.map((s: any) => ({
        id: s.id && s.id.length === 36 ? s.id : undefined,
        auditorium_id: s.auditorium_id,
        row_label: s.row_label,
        seat_number: s.seat_number,
        grid_row: s.grid_row,
        grid_col: s.grid_col,
        seat_type: s.seat_type || 'STANDARD',
        status: s.status || 'ACTIVE',
        block_reason: s.block_reason || null
      })).filter((s: any) => s.id && s.auditorium_id);
      for (let i = 0; i < cleanSeats.length; i += 80) {
        await supabase.from('seats').upsert(cleanSeats.slice(i, i + 80));
      }
    } else if ((entityOrAction === 'cinemas' || entityOrAction === 'cinema') && Array.isArray(data)) {
      const primary = data[0];
      await supabase.from('cinema_settings').upsert([
        {
          setting_key: 'cinemas_list',
          setting_value: data,
          updated_at: new Date().toISOString()
        },
        ...(primary
          ? [
              {
                setting_key: 'cinema_info',
                setting_value: {
                  name: primary.name || 'CINEMAX Xuân Thủy',
                  address: primary.address || '',
                  hotline: primary.hotline || '1900 1081',
                  city: primary.city || 'Hà Nội'
                },
                updated_at: new Date().toISOString()
              }
            ]
          : [])
      ]);
    } else if ((entityOrAction === 'shifts' || entityOrAction === 'save_shift') && data) {
      const shiftData = Array.isArray(data) ? data[0] : data;
      if (shiftData) {
        const { data: prof } = await supabase.from('profiles').select('id').limit(1);
        const staffId = shiftData.staff_id || prof?.[0]?.id || '67de8101-c50f-426c-846a-f3866de62e1b';
        await supabase.from('shifts').upsert([{
          pos_terminal: shiftData.pos_terminal || 'POS-01',
          staff_id: staffId,
          shift_type: String(shiftData.shift_type || 'MORNING').slice(0, 20),
          opening_cash: Number(shiftData.opening_cash || 2000000),
          expected_cash: Number(shiftData.expected_cash || 2000000),
          counted_cash: shiftData.counted_cash != null ? Number(shiftData.counted_cash) : null,
          variance_reason: shiftData.variance_reason || null,
          status: shiftData.status || 'open'
        }]);
      }
    } else if (entityOrAction === 'cancel_showtime' && data?.id) {
      await supabase.from('showtimes').update({ status: 'cancelled' }).eq('id', data.id);
    }
  } catch (err) {
    console.warn('Supabase Cloud sync note:', err);
  }
}

// POST: Upsert or replace synchronized entities
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, entity, data } = body;
    const store = ensureStoreFile();

    if (action === 'save_movies' || entity === 'movies') {
      const sanitized = (data || []).map((m: any, idx: number) => ({
        ...m,
        id: m.id || ('mov-' + Date.now() + '-' + idx),
        poster_url: m.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
        banner_url: m.banner_url || m.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800'
      }));
      store.movies = sanitized;
      writeStoreFile(store);
      syncToSupabaseIfConfigured('save_movies', sanitized).catch(() => {});
      return NextResponse.json({ success: true, count: store.movies?.length });
    }

    if (action === 'save_movie') {
      const currentMovies = store.movies || [];
      const item = {
        ...data,
        id: data.id || ('mov-' + Date.now()),
        poster_url: data.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
        banner_url: data.banner_url || data.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800'
      };
      const idx = currentMovies.findIndex((m: any) => m.id === item.id);
      if (idx >= 0) {
        currentMovies[idx] = { ...currentMovies[idx], ...item };
      } else {
        currentMovies.unshift(item);
      }
      store.movies = currentMovies;
      writeStoreFile(store);
      syncToSupabaseIfConfigured('save_movie', item).catch(() => {});
      return NextResponse.json({ success: true, movie: item });
    }

    if (action === 'delete_movie') {
      const deleteId = data?.id;
      store.deleted_ids = store.deleted_ids || [];
      if (deleteId && !store.deleted_ids.includes(deleteId)) {
        store.deleted_ids.push(deleteId);
      }
      const currentMovies = store.movies || [];
      store.movies = currentMovies.filter((m: any) => m.id !== deleteId);
      if (store.showtimes) {
        store.showtimes = store.showtimes.filter((s: any) => s.movie_id !== deleteId);
      }
      writeStoreFile(store);
      syncToSupabaseIfConfigured('delete_movie', data).catch(() => {});
      return NextResponse.json({ success: true, id: deleteId });
    }

    if (action === 'cancel_showtime') {
      const showtimeId = data?.id;
      if (showtimeId && Array.isArray(store.showtimes)) {
        store.showtimes = store.showtimes.map((st: any) =>
          String(st.id) === String(showtimeId) ? { ...st, status: 'cancelled' } : st
        );
        writeStoreFile(store);
      }
      syncToSupabaseIfConfigured('cancel_showtime', data).catch(() => {});
      return NextResponse.json({ success: true, cancelled: showtimeId, status: 'cancelled' });
    }

    if (action && action.startsWith('delete_')) {
      const deleteId = data?.id;

      // NGUYÊN TẮC BẤT BIẾN: Nếu xóa suất chiếu mà đã có vé/đơn hàng, tự động chuyển sang CANCELLED thay vì xóa cứng
      if (action === 'delete_showtime' && deleteId) {
        const hasSoldTickets = (store.orders || []).some((o: any) =>
          (o.items || []).some((item: any) => String(item.showtime_id) === String(deleteId) || String(item.item_snapshot?.showtime_id) === String(deleteId))
        );
        if (hasSoldTickets) {
          if (Array.isArray(store.showtimes)) {
            store.showtimes = store.showtimes.map((st: any) =>
              String(st.id) === String(deleteId) ? { ...st, status: 'cancelled' } : st
            );
            writeStoreFile(store);
          }
          syncToSupabaseIfConfigured('cancel_showtime', data).catch(() => {});
          return NextResponse.json({
            success: true,
            cancelled: deleteId,
            status: 'cancelled',
            note: 'Tự động chuyển sang CANCELLED để bảo vệ dữ liệu vé của khách hàng'
          });
        }
      }

      store.deleted_ids = store.deleted_ids || [];
      if (deleteId && !store.deleted_ids.includes(deleteId)) {
        store.deleted_ids.push(deleteId);
      }
      if (data?.code && !store.deleted_ids.includes(data.code)) {
        store.deleted_ids.push(data.code);
      }

      const entityType = action.replace('delete_', '');
      const cleanupMap: Record<string, string[]> = {
        movie: ['movies'],
        movies: ['movies'],
        showtime: ['showtimes'],
        showtimes: ['showtimes'],
        product: ['products', 'foods'],
        products: ['products', 'foods'],
        coupon: ['coupons', 'promotions'],
        coupons: ['coupons', 'promotions'],
        auditorium: ['auditoriums'],
        auditoriums: ['auditoriums'],
        cinema: ['cinemas'],
        cinemas: ['cinemas']
      };

      const keysToClean = cleanupMap[entityType] || [entityType];
      keysToClean.forEach((key) => {
        if (Array.isArray((store as any)[key])) {
          (store as any)[key] = (store as any)[key].filter(
            (item: any) => String(item.id) !== String(deleteId) && item.code !== deleteId && item.code !== data?.code
          );
        }
      });

      writeStoreFile(store);
      syncToSupabaseIfConfigured(action, data).catch(() => {});
      return NextResponse.json({ success: true, deleted: deleteId, from: keysToClean });
    }

    if (action === 'save_order' || action === 'save_user_ticket') {
      store.orders = store.orders || [];
      const orderItem = {
        id: data.bookingCode || data.id,
        order_code: data.bookingCode || ('ORD-' + data.id),
        channel: 'online',
        status: data.status === 'ĐÃ XEM' ? 'used' : 'paid',
        contact_name: data.customerName || 'Khách Đặt Online',
        contact_phone: data.customerPhone || '0900000000',
        contact_email: data.customerEmail || 'khachhang@cinemax.vn',
        total_amount: Number(data.totalAmount) || 0,
        subtotal: Number(data.totalAmount) || 0,
        created_at: data.createdAt || new Date().toISOString(),
        items: (data.seats ? String(data.seats).split(',') : ['VIP']).map((s: string) => ({
          item_type: 'ticket',
          unit_price: Math.round((Number(data.totalAmount) || 0) / Math.max(1, String(data.seats).split(',').length)),
          item_snapshot: {
            movieTitle: data.movieTitle,
            cinemaName: data.cinemaName,
            roomName: data.roomName,
            showTime: data.showtime,
            seatCode: s.trim()
          }
        }))
      };
      const idx = store.orders.findIndex((o: any) => o.id === orderItem.id || o.order_code === orderItem.order_code);
      if (idx >= 0) {
        store.orders[idx] = { ...store.orders[idx], ...orderItem };
      } else {
        store.orders.unshift(orderItem);
      }
      writeStoreFile(store);
      return NextResponse.json({ success: true, order: orderItem });
    }

    if (action === 'save_shift' || entity === 'shifts') {
      store.shifts = store.shifts || [];
      const shiftItem = {
        id: data.id || ('shift-' + Date.now()),
        pos_terminal: data.pos_terminal || data.posTerminal || 'POS-01',
        shift_type: String(data.shift_type || data.shiftType || 'MORNING').slice(0, 20),
        opened_at: data.opened_at || data.openedAt || new Date().toISOString(),
        opening_cash: Number(data.opening_cash || data.openingCash || 2000000),
        expected_cash: Number(data.expected_cash || data.expectedCash || 2000000),
        counted_cash: data.counted_cash != null ? Number(data.counted_cash) : (data.countedCash != null ? Number(data.countedCash) : null),
        variance_reason: data.variance_reason || data.varianceReason || null,
        status: data.status || 'open',
        closed_at: data.closed_at || (data.status !== 'open' ? new Date().toISOString() : null),
        staff_name: data.staff_name || data.staffName || 'Thu ngân'
      };
      const idx = store.shifts.findIndex((s: any) => s.id === shiftItem.id || (s.pos_terminal === shiftItem.pos_terminal && s.status === 'open'));
      if (idx >= 0) {
        store.shifts[idx] = { ...store.shifts[idx], ...shiftItem };
      } else {
        store.shifts.unshift(shiftItem);
      }
      writeStoreFile(store);
      syncToSupabaseIfConfigured('shifts', shiftItem).catch(() => {});
      return NextResponse.json({ success: true, shift: shiftItem });
    }

    if (entity && data) {
      (store as any)[entity] = data;
      writeStoreFile(store);
      syncToSupabaseIfConfigured(entity, data).catch(() => {});
      return NextResponse.json({ success: true, entity });
    }

    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
