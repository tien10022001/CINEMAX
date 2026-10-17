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
      await supabase.from('showtimes').upsert(data);
    } else if (entityOrAction === 'delete_showtime' && data?.id) {
      await supabase.from('showtime_prices').delete().eq('showtime_id', data.id);
      await supabase.from('showtimes').delete().eq('id', data.id);
    } else if ((entityOrAction === 'products' || entityOrAction === 'foods') && Array.isArray(data)) {
      await supabase.from('products').upsert(data);
    } else if ((entityOrAction === 'delete_product' || entityOrAction === 'delete_food') && data?.id) {
      await supabase.from('products').delete().eq('id', data.id);
    } else if ((entityOrAction === 'coupons' || entityOrAction === 'promotions') && Array.isArray(data)) {
      await supabase.from('coupons').upsert(data);
    } else if ((entityOrAction === 'delete_coupon' || entityOrAction === 'delete_promotion') && (data?.id || data?.code)) {
      if (data?.id) await supabase.from('coupons').delete().eq('id', data.id);
      if (data?.code) await supabase.from('coupons').delete().eq('code', data.code);
    } else if (entityOrAction === 'auditoriums' && Array.isArray(data)) {
      await supabase.from('auditoriums').upsert(data);
    } else if (entityOrAction === 'delete_auditorium' && data?.id) {
      await supabase.from('seats').delete().eq('auditorium_id', data.id);
      await supabase.from('auditoriums').delete().eq('id', data.id);
    } else if (entityOrAction === 'settings' && Array.isArray(data)) {
      await supabase.from('cinema_settings').upsert(data);
    } else if (entityOrAction === 'seats' && Array.isArray(data)) {
      await supabase.from('seats').upsert(data);
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

    if (action && action.startsWith('delete_')) {
      const deleteId = data?.id;
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
