import { NextResponse } from 'next/server';

interface MovieSEOPayload {
  title: string;
  original_title?: string;
  genres?: string[];
  formats?: string[];
  duration_minutes?: number;
  director?: string;
  cast_list?: string;
  synopsis?: string;
}

// Fallback intelligent Sales Copywriting Generator if Gemini API key is not configured or fails
function generateLocalSalesCopy(data: MovieSEOPayload) {
  const title = (data.title || 'Phim Mới').trim();
  const genreList = data.genres && data.genres.length > 0 ? data.genres.join(', ') : 'Điện Ảnh Đặc Sắc';
  const formatList = data.formats && data.formats.length > 0 ? data.formats.join('/') : '2D/IMAX';
  const synopsisClean = (data.synopsis || '').trim();
  const cast = (data.cast_list || '').trim();

  // Meta Title: Chuẩn SEO < 60 ký tự, đậm chất Sale kích thích click
  let meta_title = `${title} | Đặt Vé Rạp CINEMAX Chiếu ${formatList}`;
  if (meta_title.length > 60) {
    meta_title = `${title} | Đặt Vé Online Rạp CINEMAX`;
  }
  if (meta_title.length > 60) {
    meta_title = `${title.slice(0, 35)} | Lịch Chiếu CINEMAX`;
  }

  // Meta Description: 130 - 155 ký tự chuẩn Sale AIDA (Attention -> Interest -> Desire -> Action)
  let meta_description = '';
  if (synopsisClean) {
    const brief = synopsisClean.slice(0, 75).trim().replace(/[.,;:!?]+$/, '');
    meta_description = `Thưởng thức ${title} (${formatList}) - ${brief}... Trải nghiệm màn ảnh cực đại, âm thanh đỉnh cao cùng ngập tràn ưu đãi tại cụm rạp CINEMAX. Đặt vé ngay!`;
  } else {
    meta_description = `Siêu phẩm ${title} (${genreList}) chính thức đổ bộ cụm rạp CINEMAX với chuẩn ${formatList} bùng nổ mọi giác quan. Xem lịch chiếu, chọn ghế đẹp và săn vé online ngay!`;
  }

  // Đảm bảo không vượt quá 160 ký tự
  if (meta_description.length > 158) {
    meta_description = meta_description.slice(0, 155) + '... Đặt vé ngay!';
  }

  return { meta_title, meta_description, source: 'sales_engine' };
}

export async function POST(req: Request) {
  try {
    const body: MovieSEOPayload = await req.json();
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      // Return high-converting sales copy directly
      const fallback = generateLocalSalesCopy(body);
      return NextResponse.json({ success: true, ...fallback, note: 'Tạo bằng Thuật toán Copywriting Chuẩn Sale (Chưa cấu hình GEMINI_API_KEY)' });
    }

    const title = body.title || 'Phim Chiếu Rạp';
    const genres = body.genres?.join(', ') || 'Đặc sắc';
    const formats = body.formats?.join(', ') || '2D, IMAX';
    const director = body.director || 'Đang cập nhật';
    const cast = body.cast_list || 'Dàn sao nổi tiếng';
    const synopsis = body.synopsis || 'Bộ phim hấp dẫn không thể bỏ lỡ tại phòng vé.';

    const systemPrompt = `Bạn là Chuyên gia Copywriting & Sale Marketing hàng đầu của hệ thống cụm rạp chiếu phim hiện đại CINEMAX.
Nhiệm vụ của bạn là viết Meta Title và Meta Description chuẩn SEO Google và Chuẩn SALE phòng vé, kích thích khán giả ra quyết định đặt vé xem phim ngay lập tức.

YÊU CẦU BẮT BUỘC:
1. meta_title: Độ dài từ 45 đến 58 ký tự. Phải chứa Tên Phim, tên thương hiệu CINEMAX, và lời kêu gọi hành động hoặc công nghệ phòng chiếu nổi bật (IMAX / Đặt Vé).
2. meta_description: Độ dài chuẩn từ 130 đến 155 ký tự. Văn phong kích thích tò mò, giật gân hoặc truyền cảm hứng mạnh mẽ theo công thức Sale AIDA, nêu bật trải nghiệm rạp sống động và thôi thúc đặt vé online tại CINEMAX để nhận ưu đãi.
3. Chỉ trả về duy nhất định dạng JSON thuần không có markdown code block: {"meta_title": "...", "meta_description": "..."}`;

    const userMessage = `Thông tin phim:
- Tên phim: ${title}
- Thể loại: ${genres}
- Định dạng chiếu: ${formats}
- Đạo diễn: ${director}
- Diễn viên: ${cast}
- Tóm tắt cốt truyện: ${synopsis}

Hãy viết Meta Title và Meta Description chuẩn Sale rạp chiếu phim CINEMAX cho phim này.`;

    // Call Gemini API (gemini-1.5-flash)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userMessage}` }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!geminiRes.ok) {
      console.warn('Gemini API call failed, using sales engine fallback');
      const fallback = generateLocalSalesCopy(body);
      return NextResponse.json({ success: true, ...fallback, note: 'Fallback chuẩn sale (Gemini API trả lời lỗi)' });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      const fallback = generateLocalSalesCopy(body);
      return NextResponse.json({ success: true, ...fallback });
    }

    // Clean JSON response
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return NextResponse.json({
      success: true,
      meta_title: parsed.meta_title || `${title} | Đặt Vé Xem Phim Rạp CINEMAX`,
      meta_description: parsed.meta_description,
      source: 'gemini_ai'
    });
  } catch (error: any) {
    console.error('Error generating AI SEO:', error);
    // Even if complete failure, always return sales copy
    const fallback = generateLocalSalesCopy({ title: 'Phim Mới' });
    return NextResponse.json({ success: true, ...fallback, note: 'Fallback chuẩn sale' });
  }
}
