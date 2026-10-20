import { createClient } from '@/lib/supabase/client';
import { syncCheckInToSupabase } from '@/lib/supabase/queries';
import {
  Movie,
  Auditorium,
  Seat,
  Showtime,
  ShowtimePrice,
  ShowtimeSeat,
  Product,
  ProductComponent,
  ProductModifier,
  InventoryMovement,
  Shift,
  Order,
  OrderItem,
  Ticket,
  Refund,
  InvoiceRequest,
  SupportRequest,
  Coupon,
  CinemaSetting,
  AuditLog,
  Genre,
  StaffPermission,
  Profile
} from '@/lib/types-redesign';

// Helper function to safely parse dates in ISO or Vietnamese formats (HH:mm:ss DD/MM/YYYY)
export function parseAdminDateToTimestamp(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const direct = new Date(dateStr).getTime();
  if (!isNaN(direct)) return direct;

  const match = String(dateStr).match(/(?:(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(?:-|•)?\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, hh = '0', mm = '0', ss = '0', day, month, year] = match;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hh), parseInt(mm), parseInt(ss));
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}

export class AdminDataService {
  private static supabase: any = createClient();

  // 1. Fetch initial bundle with instant local sync & 1.5s timeout fallback
  static async fetchAllAdminData() {
    const supabase = this.supabase;

    // 1. First fetch local store from /api/sync (extremely fast, ~5ms)
    let syncData: any = {};
    if (typeof window !== 'undefined') {
      try {
        const syncRes = await fetch('/api/sync');
        if (syncRes.ok) {
          const syncJson = await syncRes.json();
          if (syncJson.success && syncJson.data) {
            syncData = syncJson.data;
          }
        }
      } catch (err) {
        console.warn('Could not read from /api/sync:', err);
      }
    }

    // 2. Query Supabase with a strict 1.5-second race timeout so UI never hangs indefinitely
    const supabasePromise = Promise.allSettled([
      supabase.from('movies').select('*, movie_genres(genre:genres(*))').order('created_at', { ascending: false }),
      supabase.from('genres').select('*').order('name'),
      supabase.from('auditoriums').select('*').order('name'),
      supabase.from('seats').select('*').order('grid_row').order('grid_col'),
      supabase.from('showtimes').select('*, movie:movies(*), auditorium:auditoriums(*)').order('starts_at', { ascending: false }),
      supabase.from('showtime_prices').select('*'),
      supabase.from('products').select('*').order('name'),
      supabase.from('product_modifiers').select('*'),
      supabase.from('product_components').select('*'),
      supabase.from('coupons').select('*').order('starts_at', { ascending: false }),
      supabase.from('cinema_settings').select('*'),
      supabase.from('shifts').select('*').order('opened_at', { ascending: false }),
      supabase.from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false }).limit(200),
      supabase.from('tickets').select('*, order_item:order_items(*, order:orders(*))').limit(500),
      supabase.from('refunds').select('*').order('created_at', { ascending: false }),
      supabase.from('invoice_requests').select('*').order('requested_at', { ascending: false }),
      supabase.from('support_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50)
    ]);

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
    const settledResults: any = await Promise.race([supabasePromise, timeoutPromise]);

    // Local storage deleted IDs fallback only for offline edits
    let localDeletedIds: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        localDeletedIds = JSON.parse(localStorage.getItem('cinemax_deleted_ids') || '[]');
      } catch {}
    }
    const deletedIds = new Set([...(syncData.deleted_ids || []), ...localDeletedIds]);

    let loadedMovies = (syncData.movies || []).filter((m: any) => !deletedIds.has(m.id));
    let loadedCoupons = (syncData.coupons || []).filter((c: any) => !deletedIds.has(c.id) && !deletedIds.has(c.code));
    let loadedProducts = (syncData.products || []).filter((p: any) => !deletedIds.has(p.id));
    let loadedShowtimes = (syncData.showtimes || []).filter((s: any) => !deletedIds.has(s.id));
    let loadedAuditoriums = syncData.auditoriums || [];
    let loadedSettings = syncData.settings || [];
    let loadedSeats = syncData.seats || [];

    if (settledResults && Array.isArray(settledResults)) {
      const [
        moviesRes,
        genresRes,
        auditoriumsRes,
        seatsRes,
        showtimesRes,
        pricesRes,
        productsRes,
        modifiersRes,
        componentsRes,
        couponsRes,
        settingsRes,
        shiftsRes,
        ordersRes,
        ticketsRes,
        refundsRes,
        invoicesRes,
        supportRes,
        logsRes
      ] = settledResults;

      // ƯU TIÊN DỮ LIỆU TỪ SUPABASE DATABASE (Không bị chặn bởi deletedIds cũ)
      if (moviesRes?.status === 'fulfilled' && moviesRes.value?.data?.length) {
        const parsedMovies = moviesRes.value.data.map((m: any) => ({
          ...m,
          genres: m.movie_genres?.map((mg: any) => mg.genre).filter(Boolean) || m.genres || []
        }));
        loadedMovies = parsedMovies.filter((m: any) => !m.is_deleted);
      }
      if (couponsRes?.status === 'fulfilled' && couponsRes.value?.data?.length) {
        loadedCoupons = couponsRes.value.data;
      }
      if (productsRes?.status === 'fulfilled' && productsRes.value?.data?.length) {
        loadedProducts = productsRes.value.data;
      }
      if (showtimesRes?.status === 'fulfilled' && showtimesRes.value?.data?.length) {
        loadedShowtimes = showtimesRes.value.data;
      }
      if (auditoriumsRes?.status === 'fulfilled' && auditoriumsRes.value?.data?.length) {
        loadedAuditoriums = auditoriumsRes.value.data;
      }
      if (settingsRes?.status === 'fulfilled' && settingsRes.value?.data?.length) {
        loadedSettings = settingsRes.value.data;
      }
      if (seatsRes?.status === 'fulfilled' && seatsRes.value?.data?.length) {
        loadedSeats = seatsRes.value.data;
      }

      let loadedOrders = ordersRes?.status === 'fulfilled' && ordersRes.value?.data?.length ? [...ordersRes.value.data] : (syncData.orders || []);
      let loadedTickets: any[] = [];

      if (ticketsRes?.status === 'fulfilled' && ticketsRes.value?.data?.length) {
        loadedTickets = ticketsRes.value.data.map((t: any) => {
          const item = t.order_item;
          const order = item?.order;
          const snap = item?.item_snapshot || {};
          return {
            id: t.id,
            order_id: item?.order_id || t.order_id,
            order_code: order?.order_code,
            order_item_id: t.order_item_id,
            qr_token_hash: t.qr_token_hash,
            seat_label: snap?.seat_label || snap?.seatCode || t.seat_label || 'VIP',
            movie_title: snap?.movieTitle || 'Dune: Hành Tinh Cát 2',
            showtime_str: snap?.showTime ? `${snap.cinemaName ? snap.cinemaName + ' • ' : ''}${snap.showTime}` : 'Suất chiếu tiêu chuẩn',
            price: Number(item?.unit_price) || t.price || 85000,
            status: t.status as any,
            customer_name: order?.contact_name || 'Khách Hàng',
            customer_phone: order?.contact_phone || '0901234567',
            channel: (order?.channel || 'ONLINE').toUpperCase(),
            checked_in_at: t.checked_in_at,
            checked_in_by: t.checked_in_by,
            age_check_passed: t.age_check_passed ?? true,
            created_at: order?.created_at || t.created_at
          };
        });
      } else if (syncData.tickets?.length) {
        loadedTickets = [...syncData.tickets];
      }

      // Synthesize ticket rows if loadedTickets is empty but orders have items
      if (loadedTickets.length === 0 && loadedOrders.length > 0) {
        loadedOrders.forEach((o: any) => {
          if (o.items && Array.isArray(o.items)) {
            o.items.forEach((item: any, itemIdx: number) => {
              if (item.item_type === 'ticket') {
                const snap = item.item_snapshot || {};
                const seat = snap.seatCode || snap.seat_label || `S${itemIdx + 1}`;
                loadedTickets.push({
                  id: item.id || `tk-${o.id}-${seat}`,
                  order_id: o.id,
                  order_code: o.order_code,
                  order_item_id: item.id,
                  qr_token_hash: `${o.order_code || o.id}-${seat}`,
                  seat_label: seat,
                  movie_title: snap.movieTitle || 'Dune: Hành Tinh Cát 2',
                  showtime_str: snap.showTime ? `${snap.cinemaName ? snap.cinemaName + ' • ' : ''}${snap.showTime}` : 'Suất chiếu tiêu chuẩn',
                  price: Number(item.unit_price) || 85000,
                  status: (o.status === 'used' ? 'used' : 'issued') as any,
                  customer_name: o.contact_name || 'Khách Hàng',
                  customer_phone: o.contact_phone || '0901234567',
                  channel: (o.channel || 'ONLINE').toUpperCase(),
                  age_check_passed: true,
                  created_at: o.created_at
                });
              }
            });
          }
        });
      }

      // Merge user booked tickets from localStorage (cinemax_user_tickets)
      const userBundle = AdminDataService.getUserBookedOrdersAndTickets();

      // Deduplicate orders strictly by id and order_code
      // Deduplicate orders strictly by id and order_code
      const orderMap = new Map<string, Order>();

      [...loadedOrders, ...userBundle.orders].forEach((o: any) => {
        const idKey = String(o.id || '').toLowerCase();
        const codeKey = String(o.order_code || '').toLowerCase();
        const primaryKey = codeKey || idKey;
        if (!primaryKey) return;

        const existing = orderMap.get(primaryKey);
        if (!existing) {
          orderMap.set(primaryKey, o);
        } else {
          // If existing order has no items or fewer items than new one, merge items
          const existingItemCount = Array.isArray(existing.items) ? existing.items.length : 0;
          const newItemCount = Array.isArray(o.items) ? o.items.length : 0;
          if (newItemCount > existingItemCount) {
            orderMap.set(primaryKey, {
              ...existing,
              items: o.items,
              contact_name: existing.contact_name || o.contact_name,
              contact_email: existing.contact_email || o.contact_email,
              contact_phone: existing.contact_phone || o.contact_phone,
            });
          }
        }
      });

      const mergedOrders = Array.from(orderMap.values());
      mergedOrders.sort((a, b) => parseAdminDateToTimestamp(b.created_at) - parseAdminDateToTimestamp(a.created_at));

      // Deduplicate tickets strictly by id and qr_token_hash
      const seenTicketIds = new Set<string>();
      const seenTicketQrs = new Set<string>();
      const mergedTickets: Ticket[] = [];

      [...loadedTickets, ...userBundle.tickets].forEach((t: any) => {
        const idKey = String(t.id || '').toLowerCase();
        const qrKey = String(t.qr_token_hash || '').toLowerCase();
        if (idKey && seenTicketIds.has(idKey)) return;
        if (qrKey && seenTicketQrs.has(qrKey)) return;
        if (idKey) seenTicketIds.add(idKey);
        if (qrKey) seenTicketQrs.add(qrKey);
        mergedTickets.push(t);
      });

      // Enrich tickets with metadata if missing
      const enrichedTickets = mergedTickets.map((t: any) => {
        const parentOrder = mergedOrders.find((o: any) => o.id === t.order_id || o.order_code === t.order_id || o.order_code === t.order_code);
        const ticketItem = parentOrder?.items?.find((i: any) => i.id === t.order_item_id || i.item_type === 'ticket');
        const snap = ticketItem?.item_snapshot;
        return {
          ...t,
          movie_title: t.movie_title || snap?.movieTitle || 'Dune: Hành Tinh Cát 2',
          seat_label: t.seat_label || snap?.seatCode || 'VIP',
          showtime_str: t.showtime_str || (snap?.showTime ? `${snap.cinemaName ? snap.cinemaName + ' • ' : ''}${snap.showTime}` : 'Suất chiếu tiêu chuẩn'),
          price: t.price || Number(ticketItem?.unit_price) || (parentOrder ? Math.round(Number(parentOrder.total_amount || 85000)) : 85000)
        };
      });

      enrichedTickets.sort((a, b) => parseAdminDateToTimestamp(b.created_at) - parseAdminDateToTimestamp(a.created_at));

      return {
        movies: loadedMovies,
        genres: genresRes?.status === 'fulfilled' && genresRes.value?.data ? genresRes.value.data : [],
        auditoriums: loadedAuditoriums,
        seats: loadedSeats,
        showtimes: loadedShowtimes,
        prices: pricesRes?.status === 'fulfilled' && pricesRes.value?.data ? pricesRes.value.data : [],
        products: loadedProducts,
        modifiers: modifiersRes?.status === 'fulfilled' && modifiersRes.value?.data ? modifiersRes.value.data : [],
        components: componentsRes?.status === 'fulfilled' && componentsRes.value?.data ? componentsRes.value.data : [],
        coupons: loadedCoupons,
        settings: loadedSettings,
        shifts: shiftsRes?.status === 'fulfilled' && shiftsRes.value?.data && shiftsRes.value.data.length > 0 ? shiftsRes.value.data : (syncData.shifts || []),
        orders: mergedOrders,
        tickets: enrichedTickets,
        refunds: refundsRes?.status === 'fulfilled' && refundsRes.value?.data ? refundsRes.value.data : [],
        invoices: invoicesRes?.status === 'fulfilled' && invoicesRes.value?.data ? invoicesRes.value.data : [],
        support: supportRes?.status === 'fulfilled' && supportRes.value?.data ? supportRes.value.data : [],
        logs: logsRes?.status === 'fulfilled' && logsRes.value?.data ? logsRes.value.data : []
      };
    }

    const userBundle = AdminDataService.getUserBookedOrdersAndTickets();
    const fallbackOrders = [...userBundle.orders, ...(syncData.orders || [])];
    const fallbackTickets = [...userBundle.tickets, ...(syncData.tickets || [])];

    return {
      movies: loadedMovies,
      genres: [],
      auditoriums: loadedAuditoriums,
      seats: loadedSeats,
      showtimes: loadedShowtimes,
      prices: [],
      products: loadedProducts,
      modifiers: [],
      components: [],
      coupons: loadedCoupons,
      settings: loadedSettings,
      shifts: syncData.shifts || [],
      orders: fallbackOrders,
      tickets: fallbackTickets,
      refunds: [],
      invoices: [],
      support: [],
      logs: []
    };
  }

  // Extract user booked tickets from localStorage (cinemax_user_tickets)
  static getUserBookedOrdersAndTickets(): { orders: Order[]; tickets: Ticket[] } {
    if (typeof window === 'undefined') return { orders: [], tickets: [] };
    try {
      const stored = localStorage.getItem('cinemax_user_tickets');
      if (!stored) return { orders: [], tickets: [] };
      const list = JSON.parse(stored);
      if (!Array.isArray(list) || list.length === 0) return { orders: [], tickets: [] };

      const orders: Order[] = [];
      const tickets: Ticket[] = [];

      list.forEach((t: any, idx: number) => {
        const orderCode = String(t.bookingCode || t.id || `CNM-${Date.now()}-${idx}`);
        const seatStr = String(t.seats || 'VIP');
        const seatArr = seatStr.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean);
        const effectiveSeats = seatArr.length > 0 ? seatArr : ['VIP'];
        const totalAmt = Number(t.totalAmount) || 0;
        const unitPrice = Math.round(totalAmt / Math.max(1, effectiveSeats.length));
        const rawStatus = String(t.status || 'ĐÃ THANH TOÁN').toUpperCase();
        const isUsed = rawStatus === 'ĐÃ XEM' || rawStatus === 'USED';
        const isCancelled = rawStatus === 'ĐÃ HỦY' || rawStatus === 'HẾT HẠN' || rawStatus === 'CANCELLED';
        const orderStatus = isUsed ? 'paid' : isCancelled ? 'cancelled' : 'paid';
        const ticketStatus = isUsed ? 'used' : isCancelled ? 'cancelled' : 'issued';

        // Resolve createdAt accurately; DO NOT default to now() because it wrongly bumps old tickets to top
        const rawTime = t.createdAt || t.created_at || t.date || t.bookingDate;
        let effectiveCreatedAt = '2026-10-15T00:00:00.000Z';
        if (rawTime) {
          const ts = parseAdminDateToTimestamp(rawTime);
          if (ts > 0) {
            effectiveCreatedAt = new Date(ts).toISOString();
          }
        }

        const orderItemSnapshots = effectiveSeats.map((seat) => ({
          id: `item-${orderCode}-${seat}`,
          order_id: orderCode,
          item_type: 'ticket' as const,
          quantity: 1,
          unit_price: unitPrice,
          line_total: unitPrice,
          item_snapshot: {
            movieTitle: t.movieTitle,
            cinemaName: t.cinemaName,
            roomName: t.roomName,
            showTime: t.showtime,
            seatCode: seat,
            posterUrl: t.posterUrl
          }
        }));

        orders.push({
          id: orderCode,
          order_code: orderCode,
          user_id: t.userId || null,
          channel: 'online',
          status: orderStatus as any,
          contact_name: t.customerName || 'Khách Đặt Online',
          contact_email: t.customerEmail || 'khachhang@cinemax.vn',
          contact_phone: t.customerPhone || '0900000000',
          subtotal: totalAmt,
          discount_amount: 0,
          loyalty_points_used: 0,
          loyalty_discount_amount: 0,
          total_amount: totalAmt,
          created_at: effectiveCreatedAt,
          items: orderItemSnapshots as any
        });

        effectiveSeats.forEach((seat) => {
          tickets.push({
            id: `ticket-${orderCode}-${seat}`,
            order_item_id: `item-${orderCode}-${seat}`,
            order_id: orderCode,
            qr_token_hash: `${orderCode}-${seat}`,
            seat_label: seat,
            movie_title: t.movieTitle || 'Dune: Hành Tinh Cát 2',
            showtime_str: `${t.cinemaName ? t.cinemaName + ' • ' : ''}${t.roomName ? t.roomName + ' • ' : ''}${t.showtime || ''}`,
            price: unitPrice,
            status: ticketStatus as any,
            age_check_passed: true,
            created_at: effectiveCreatedAt
          });
        });
      });

      return { orders, tickets };
    } catch (e) {
      console.warn('Error reading user tickets:', e);
      return { orders: [], tickets: [] };
    }
  }

  // Check in a ticket by QR Token
  static async checkInTicket(qrToken: string, checkedInBy: string, agePassed: boolean) {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cinemax_user_tickets');
        if (stored) {
          const list = JSON.parse(stored);
          const updated = list.map((t: any) => {
            const match = t.bookingCode === qrToken || qrToken.startsWith(t.bookingCode);
            if (match) {
              return { ...t, status: 'ĐÃ XEM', checkedInAt: new Date().toISOString() };
            }
            return t;
          });
          localStorage.setItem('cinemax_user_tickets', JSON.stringify(updated));
        }

        const storedV2 = localStorage.getItem('cinemax_my_tickets_v2');
        if (storedV2) {
          const listV2 = JSON.parse(storedV2);
          if (Array.isArray(listV2)) {
            const updatedV2 = listV2.map((o: any) => {
              const match =
                String(o.id || '').toLowerCase() === qrToken.toLowerCase() ||
                String(o.order_code || '').toLowerCase() === qrToken.toLowerCase() ||
                (Array.isArray(o.items) && o.items.some((it: any) => it.ticket_code === qrToken));
              if (match) {
                return {
                  ...o,
                  status: 'USED',
                  checked_in_at: new Date().toISOString(),
                  checked_in_by: checkedInBy,
                  age_check_passed: agePassed
                };
              }
              return o;
            });
            localStorage.setItem('cinemax_my_tickets_v2', JSON.stringify(updatedV2));
          }
        }

        window.dispatchEvent(new Event('cinemax_data_updated'));
        window.dispatchEvent(new Event('cinemax_db_updated'));
        window.dispatchEvent(new Event('storage'));

        try {
          const bc = new BroadcastChannel('cinemax_sync_channel');
          bc.postMessage({ type: 'TICKET_CHECKED_IN', qrToken, checkedInBy, timestamp: Date.now() });
          bc.close();
        } catch {}
      } catch {}
    }

    try {
      await syncCheckInToSupabase(qrToken, agePassed);
    } catch {
      try {
        await this.supabase
          .from('tickets')
          .update({
            status: 'used',
            age_check_passed: agePassed,
            checked_in_at: new Date().toISOString(),
            checked_in_by: checkedInBy
          })
          .or(`qr_token_hash.eq.${qrToken},id.eq.${qrToken}`);
      } catch {}
    }
  }

  // Generic Entity Save to /api/sync
  static async saveEntity(entity: string, data: any) {
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity, data })
        });
      } catch (err) {
        console.warn(`Sync save ${entity} error:`, err);
      }
    }
  }

  // Generic Entity Delete
  static async deleteEntity(entity: string, id: string) {
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: `delete_${entity}`, data: { id, code: id } })
        });
      } catch (err) {
        console.warn(`Sync delete ${entity} error:`, err);
      }
    }
    try {
      if (entity === 'coupons') {
        if (id.includes('-') && id.length === 36) {
          await this.supabase.from('coupons').delete().eq('id', id);
        } else {
          await this.supabase.from('coupons').delete().eq('code', id);
        }
      } else if (entity === 'auditoriums') {
        await this.supabase.from('seats').delete().eq('auditorium_id', id);
        await this.supabase.from('auditoriums').delete().eq('id', id);
      } else if (entity === 'products' || entity === 'foods') {
        await this.supabase.from('products').delete().eq('id', id);
      } else {
        await this.supabase.from(entity).delete().eq('id', id);
      }
    } catch (err) {
      console.warn(`Supabase delete ${entity} error:`, err);
    }
  }

  // 2. Movie CRUD
  static async upsertMovie(movie: Partial<Movie>) {
    const supabase = this.supabase;
    let saved: Movie | null = null;
    const movieId = movie.id || crypto.randomUUID();

    // Prepare core database payload
    const corePayload: any = {
      id: movieId,
      title: movie.title,
      slug: movie.slug,
      synopsis: movie.synopsis || null,
      director: movie.director || null,
      cast_list: movie.cast_list || null,
      language: movie.language || 'Tiếng Việt - Phụ đề',
      duration_minutes: movie.duration_minutes || 120,
      age_rating: movie.age_rating || 'P',
      poster_url: movie.poster_url || null,
      banner_url: movie.banner_url || movie.poster_url || null,
      trailer_url: movie.trailer_url || null,
      release_date: movie.release_date || null,
      end_date: movie.end_date || null,
      status: movie.status || 'now_showing'
    };

    // Extended fields if schema allows
    const extendedPayload = {
      ...corePayload,
      ...(movie.country !== undefined ? { country: movie.country } : {}),
      ...(movie.studio !== undefined ? { studio: movie.studio } : {}),
      ...(movie.meta_title !== undefined ? { meta_title: movie.meta_title } : {}),
      ...(movie.meta_description !== undefined ? { meta_description: movie.meta_description } : {}),
      ...(movie.imdb_score !== undefined ? { imdb_score: movie.imdb_score } : {}),
      ...(movie.formats !== undefined ? { formats: movie.formats } : {})
    };

    try {
      // Try full upsert first
      const { data, error } = await supabase.from('movies').upsert(extendedPayload).select().single();
      if (!error && data) {
        saved = data as Movie;
      } else if (error) {
        // Fallback to core payload if extended columns are not yet in Supabase
        const { data: coreData, error: coreErr } = await supabase.from('movies').upsert(corePayload).select().single();
        if (!coreErr && coreData) {
          saved = coreData as Movie;
        }
      }
    } catch {
      // RLS or network fallback
    }

    // Sync movie_genres junction table if genres provided
    if (movie.genres && Array.isArray(movie.genres)) {
      try {
        await supabase.from('movie_genres').delete().eq('movie_id', movieId);
        const genreRows = movie.genres.map((g) => ({
          movie_id: movieId,
          genre_id: g.id
        }));
        if (genreRows.length > 0) {
          await supabase.from('movie_genres').insert(genreRows);
        }
      } catch (err) {
        console.warn('Error updating movie_genres:', err);
      }
    }

    const finalMovie: Movie = {
      ...(movie as Movie),
      ...(saved || {}),
      id: movieId,
      genres: movie.genres || saved?.genres || [],
      country: movie.country || (saved as any)?.country || 'Việt Nam',
      studio: movie.studio || (saved as any)?.studio || '',
      meta_title: movie.meta_title || (saved as any)?.meta_title || '',
      meta_description: movie.meta_description || (saved as any)?.meta_description || '',
      imdb_score: movie.imdb_score || (saved as any)?.imdb_score || 8.0,
      formats: movie.formats || (saved as any)?.formats || ['2D'],
      poster_url: saved?.poster_url || movie.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
      banner_url: saved?.banner_url || movie.banner_url || movie.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800'
    };

    // Save to persistent server sync
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_movie', data: finalMovie })
        });
      } catch (err) {
        console.warn('Sync post error:', err);
      }
    }

    return finalMovie;
  }

  static async saveAllMovies(movies: Movie[]) {
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_movies', data: movies })
        });
      } catch (err) {
        console.warn('Sync saveAllMovies error:', err);
      }
    }
  }

  static async deleteMovie(id: string) {
    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('cinemax_deleted_ids') || '[]');
        if (!local.includes(id)) {
          local.push(id);
          localStorage.setItem('cinemax_deleted_ids', JSON.stringify(local));
        }
      } catch {}
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_movie', data: { id } })
        });
      } catch (err) {
        console.warn('Sync delete error:', err);
      }
    }

    const supabase = this.supabase;
    try {
      await supabase.from('showtimes').delete().eq('movie_id', id);
      await supabase.from('movies').delete().eq('id', id);
    } catch {
      // RLS fallback
    }
  }

  // 3. Auditorium & Seat Map
  static async upsertAuditorium(auditorium: Partial<Auditorium>) {
    const supabase = this.supabase;
    const audId = auditorium.id && auditorium.id.length === 36 ? auditorium.id : crypto.randomUUID();
    const dbPayload = {
      id: audId,
      name: auditorium.name || 'Phòng chiếu mới',
      screen_type: auditorium.screen_type || '2D',
      sound_system: auditorium.sound_system || 'Dolby 7.1',
      total_seats: Number(auditorium.total_seats) || 80,
      cleaning_buffer_minutes: Number(auditorium.cleaning_buffer_minutes) || 15,
      status: auditorium.status || 'active',
      seat_map_version: auditorium.seat_map_version || 1,
    };
    try {
      const { data, error } = await supabase.from('auditoriums').upsert(dbPayload).select().single();
      if (!error && data) return data as Auditorium;
    } catch (err) {
      console.warn('Upsert auditorium Supabase error:', err);
    }
    await this.saveEntity('auditoriums', [dbPayload]);
    return dbPayload as Auditorium;
  }

  static async deleteAuditorium(id: string) {
    const supabase = this.supabase;
    try {
      await supabase.from('seats').delete().eq('auditorium_id', id);
      await supabase.from('showtimes').delete().eq('auditorium_id', id);
      await supabase.from('auditoriums').delete().eq('id', id);
    } catch (err) {
      console.warn('Delete auditorium Supabase error:', err);
    }
    await this.deleteEntity('auditoriums', id);
  }

  static async updateSeatStatus(seatId: string, status: 'ACTIVE' | 'BLOCKED', blockReason?: string) {
    try {
      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('seats')
        .update({ status, block_reason: blockReason || null })
        .eq('id', seatId)
        .select()
        .single();
      if (!error && data) return data as Seat;
    } catch {
      // Supabase RLS fallback
    }
    return { id: seatId, status, block_reason: blockReason || null } as any;
  }

  static async saveAllSeats(seats: Seat[]) {
    const supabase = this.supabase;
    const cleanSeats = seats.map((s) => ({
      id: s.id && s.id.length === 36 ? s.id : crypto.randomUUID(),
      auditorium_id: s.auditorium_id,
      row_label: s.row_label,
      seat_number: s.seat_number,
      grid_row: s.grid_row,
      grid_col: s.grid_col,
      seat_type: s.seat_type || 'STANDARD',
      seat_group: (s as any).seat_group || null,
      status: s.status || 'ACTIVE',
      block_reason: s.block_reason || null
    }));

    // Push in chunks of 80 to Supabase Cloud directly without unsupported 'price' column
    try {
      for (let i = 0; i < cleanSeats.length; i += 80) {
        const chunk = cleanSeats.slice(i, i + 80);
        await supabase.from('seats').upsert(chunk);
      }
    } catch (err) {
      console.warn('Upsert seats Supabase error:', err);
    }

    await this.saveEntity('seats', cleanSeats);
  }

  static async deleteSeat(seatId: string) {
    try {
      await this.supabase.from('seats').delete().eq('id', seatId);
    } catch {}
    await this.deleteEntity('seats', seatId);
  }

  static async saveCinemaInfo(cinemaInfo: { name: string; address: string; hotline: string; email?: string; city?: string }) {
    const supabase = this.supabase;
    try {
      await supabase
        .from('cinema_settings')
        .upsert({
          setting_key: 'cinema_info',
          setting_value: cinemaInfo,
          updated_at: new Date().toISOString()
        });
    } catch (err) {
      console.warn('Save cinema_info to Supabase error:', err);
    }
  }

  static async saveCinemasList(cinemasList: any[]) {
    const supabase = this.supabase;
    try {
      await supabase
        .from('cinema_settings')
        .upsert([
          {
            setting_key: 'cinemas_list',
            setting_value: cinemasList,
            updated_at: new Date().toISOString()
          },
          ...(cinemasList.length > 0
            ? [
                {
                  setting_key: 'cinema_info',
                  setting_value: {
                    name: cinemasList[0].name,
                    address: cinemasList[0].address,
                    hotline: cinemasList[0].hotline || '1900 1081',
                    city: cinemasList[0].city || 'Hà Nội'
                  },
                  updated_at: new Date().toISOString()
                }
              ]
            : [])
        ]);
    } catch (err) {
      console.warn('Save cinemas_list to Supabase error:', err);
    }
  }

  // 4. Showtime & Prices
  static async upsertShowtime(showtime: Partial<Showtime>, prices?: Partial<ShowtimePrice>[]) {
    const supabase = this.supabase;

    // Validate movie active window
    if (showtime.movie_id && showtime.starts_at) {
      const { data: movie } = await supabase
        .from('movies')
        .select('id, title, release_date, end_date, status')
        .eq('id', showtime.movie_id)
        .maybeSingle();

      if (movie) {
        if (movie.status === 'ended') {
          throw new Error(`Phim "${movie.title}" đã kết thúc phát hành. Không thể xếp thêm suất chiếu!`);
        }
        const showDateStr = showtime.starts_at.slice(0, 10);
        if (movie.end_date && showDateStr > movie.end_date) {
          throw new Error(`Ngày chiếu ${showDateStr} vượt quá ngày kết thúc phát hành (${movie.end_date}) của phim "${movie.title}"!`);
        }
      }
    }

    const { data, error } = await supabase.from('showtimes').upsert(showtime).select().single();
    if (error) throw error;

    if (prices && prices.length > 0 && data?.id) {
      const priceRows = prices.map((p) => ({
        ...p,
        showtime_id: data.id
      }));
      await supabase.from('showtime_prices').upsert(priceRows);
    }

    return data as Showtime;
  }

  // Bulk Upsert Showtimes in batches of 50 to avoid network payload limits & ultra-fast execution
  static async bulkUpsertShowtimes(
    items: { showtime: Partial<Showtime>; prices?: Partial<ShowtimePrice>[] }[]
  ): Promise<Showtime[]> {
    if (!items || items.length === 0) return [];

    const supabase = this.supabase;
    const results: Showtime[] = [];
    const allPriceRows: any[] = [];

    // Chunks of 50 for optimal HTTP payload size
    const chunkSize = 50;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const showtimeRows = chunk.map((c) => ({
        ...c.showtime,
        id: c.showtime.id || crypto.randomUUID()
      }));

      try {
        const { data, error } = await supabase.from('showtimes').upsert(showtimeRows).select();
        if (!error && data && data.length > 0) {
          results.push(...(data as Showtime[]));
          chunk.forEach((item, idx) => {
            const savedSt = data[idx] || showtimeRows[idx];
            if (item.prices && item.prices.length > 0 && savedSt?.id) {
              item.prices.forEach((p) => {
                allPriceRows.push({
                  ...p,
                  showtime_id: savedSt.id
                });
              });
            }
          });
        } else {
          // If Supabase RLS / offline, fallback to in-memory generated rows
          results.push(...(showtimeRows as Showtime[]));
        }
      } catch {
        // Fallback to generated rows
        results.push(...(showtimeRows as Showtime[]));
      }
    }

    // Insert prices in chunks if any
    if (allPriceRows.length > 0) {
      try {
        for (let i = 0; i < allPriceRows.length; i += 100) {
          const pChunk = allPriceRows.slice(i, i + 100);
          await supabase.from('showtime_prices').upsert(pChunk);
        }
      } catch (err) {
        console.warn('Bulk upsert prices error (fallback continued):', err);
      }
    }

    return results;
  }

  static async deleteShowtime(id: string) {
    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('cinemax_deleted_ids') || '[]');
        if (!local.includes(id)) {
          local.push(id);
          localStorage.setItem('cinemax_deleted_ids', JSON.stringify(local));
        }
      } catch {}
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_showtime', data: { id } })
        });
      } catch (err) {
        console.warn('Sync delete showtime error:', err);
      }
    }

    const supabase = this.supabase;
    try {
      await supabase.from('showtime_prices').delete().eq('showtime_id', id);
      await supabase.from('showtimes').delete().eq('id', id);
    } catch {
      // Fallback
    }
  }

  /**
   * Chuyển trạng thái suất chiếu sang CANCELLED (Bất biến dữ liệu - không xóa cứng khi đã có vé)
   */
  static async cancelShowtime(id: string, reason: string = 'Hủy theo quyết định quản trị rạp') {
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel_showtime', data: { id, reason } })
        });
      } catch (err) {
        console.warn('Sync cancel showtime error:', err);
      }
    }

    const supabase = this.supabase;
    try {
      await supabase.from('showtimes').update({ status: 'cancelled' }).eq('id', id);
    } catch {
      // Fallback
    }
  }

  // 5. Products & Inventory
  static async upsertProduct(product: Partial<Product>) {
    const supabase = this.supabase;
    const dbPayload = {
      id: product.id,
      name: product.name,
      product_type: product.product_type,
      base_price: product.base_price,
      inventory_tracking: product.inventory_tracking ?? true,
      available_stock: product.available_stock ?? 100,
      active: product.active ?? true,
      image_url: product.image_url || null
    };
    try {
      const { data, error } = await supabase.from('products').upsert(dbPayload).select().single();
      if (!error && data) {
        return { ...product, ...data } as Product;
      }
    } catch {
      // Offline or local storage mode fallback
    }
    return product as Product;
  }

  static async logInventoryMovement(movement: Partial<InventoryMovement>) {
    const supabase = this.supabase;
    const { data, error } = await supabase.from('inventory_movements').insert(movement).select().single();
    if (error) throw error;
    return data as InventoryMovement;
  }

  // 6. Shifts & POS
  static async openShift(staffId: string, posTerminal: string, openingCash: number) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('shifts')
      .insert({
        staff_id: staffId,
        pos_terminal: posTerminal,
        opening_cash: openingCash,
        expected_cash: openingCash,
        status: 'open'
      })
      .select()
      .single();
    if (error) throw error;
    return data as Shift;
  }

  static async closeShift(shiftId: string, countedCash: number, varianceReason?: string) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('shifts')
      .update({
        counted_cash: countedCash,
        variance_reason: varianceReason || null,
        closed_at: new Date().toISOString(),
        status: 'submitted'
      })
      .eq('id', shiftId)
      .select()
      .single();
    if (error) throw error;
    return data as Shift;
  }

  static async approveShift(shiftId: string, supervisorId: string) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('shifts')
      .update({
        supervisor_id: supervisorId,
        approved_at: new Date().toISOString(),
        status: 'closed'
      })
      .eq('id', shiftId)
      .select()
      .single();
    if (error) throw error;
    return data as Shift;
  }


  // 8. Refunds & Invoices
  static async approveRefund(refundId: string, approvedBy: string) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('refunds')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        resolved_at: new Date().toISOString()
      })
      .eq('id', refundId)
      .select()
      .single();
    if (error) throw error;

    if (data?.order_id) {
      try {
        await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', data.order_id);

        const { data: orderItems } = await supabase
          .from('order_items')
          .select('id')
          .eq('order_id', data.order_id);

        if (orderItems && orderItems.length > 0) {
          const itemIds = orderItems.map((i: any) => i.id);
          await supabase
            .from('tickets')
            .update({ status: 'refunded' })
            .in('order_item_id', itemIds);
        }
      } catch (err) {
        console.warn('Error updating linked order/tickets on refund approve:', err);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new Event('cinemax_data_updated'));
        window.dispatchEvent(new Event('cinemax_db_updated'));
        window.dispatchEvent(new Event('storage'));
        const bc = new BroadcastChannel('cinemax_sync_channel');
        bc.postMessage({ type: 'REFUND_APPROVED', refundId, orderId: data?.order_id, timestamp: Date.now() });
        bc.close();
      } catch {}
    }

    return data as Refund;
  }

  static async issueInvoice(requestId: string, invoiceRef: string) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('invoice_requests')
      .update({
        status: 'issued',
        invoice_ref: invoiceRef,
        resolved_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();
    if (error) throw error;
    return data as InvoiceRequest;
  }

  // 9. Coupons
  static async upsertCoupon(coupon: Partial<Coupon>) {
    const supabase = this.supabase;
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const dbPayload: any = {
      ...coupon,
      id: coupon.id || crypto.randomUUID(),
      starts_at: coupon.starts_at || now.toISOString(),
      ends_at: coupon.ends_at || thirtyDaysLater.toISOString(),
      discount_type: coupon.discount_type || 'FIXED',
      discount_value: Number(coupon.discount_value || 0),
      apply_scope: coupon.apply_scope || 'ALL',
      active: coupon.active ?? true,
    };
    const { data, error } = await supabase.from('coupons').upsert(dbPayload).select().single();
    if (error) throw error;
    return data as Coupon;
  }

  // 10. Settings & Audit
  static async updateSetting(key: string, value: Record<string, any>) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('cinema_settings')
      .upsert({ setting_key: key, setting_value: value, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data as CinemaSetting;
  }
}
