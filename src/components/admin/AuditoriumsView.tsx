'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Armchair,
  Plus,
  Edit,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  X,
  Building2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Sliders,
  DollarSign,
  Tag
} from 'lucide-react';
import { Auditorium, Seat, SeatType, SeatStatus, ScreenType } from '@/lib/types-redesign';
import { AdminDataService } from '@/lib/services/admin-data.service';

const DEFAULT_CINEMAS = [
  {
    id: 'cin-01',
    name: 'CINEMAX Xuân Thủy',
    city: 'Hà Nội',
    address: '144 Xuân Thủy, Cầu Giấy, Hà Nội',
    hotline: '1900 1081'
  }
];

const SEAT_PRESETS = [
  { count: 40, label: '40 ghế', desc: '4 hàng x 10 cột (Phòng Mini)' },
  { count: 60, label: '60 ghế', desc: '6 hàng x 10 cột (Phòng Vừa)' },
  { count: 80, label: '80 ghế', desc: '8 hàng x 10 cột (Tiêu Chuẩn)' },
  { count: 100, label: '100 ghế', desc: '10 hàng x 10 cột (Phòng Lớn)' },
  { count: 120, label: '120 ghế', desc: '12 hàng x 10 cột (IMAX / VIP)' }
];

interface AuditoriumsViewProps {
  auditoriums: Auditorium[];
  seats: Seat[];
  onUpdateSeatStatus: (seatId: string, status: SeatStatus, blockReason?: string) => Promise<void>;
  onBatchUpdateSeats?: (seatIds: string[], updates: Partial<Seat>) => Promise<void>;
  onUpdateSeat?: (seatId: string, updates: Partial<Seat>) => Promise<void>;
  onDeleteSeat?: (seatId: string) => Promise<void>;
  onAddSeat?: (seat: Partial<Seat>) => Promise<void>;
  onSaveAuditorium: (aud: Partial<Auditorium>) => Promise<any>;
  onDeleteAuditorium?: (id: string) => Promise<void>;
  showToast: (msg: string) => void;
}

export default function AuditoriumsView({
  auditoriums,
  seats,
  onUpdateSeatStatus,
  onBatchUpdateSeats,
  onUpdateSeat,
  onDeleteSeat,
  onAddSeat,
  onSaveAuditorium,
  onDeleteAuditorium,
  showToast
}: AuditoriumsViewProps) {
  const [subTab, setSubTab] = useState<'THEATERS' | 'AUDITORIUMS'>('AUDITORIUMS');
  const [selectedAuditoriumId, setSelectedAuditoriumId] = useState<string>(
    auditoriums[0]?.id || ''
  );

  // Inspector & Batch states
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [seatPriceInput, setSeatPriceInput] = useState<number>(75000);
  const [blockReason, setBlockReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [batchPriceInput, setBatchPriceInput] = useState<number>(75000);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ type: 'THEATER' | 'AUDITORIUM'; id: string; name: string } | null>(null);

  // Phân trang phòng chiếu (7 phòng / trang: đúng 1 hàng duy nhất, từ phòng thứ 8 sang trang tiếp)
  const ROOMS_PER_PAGE = 7;
  const [roomPage, setRoomPage] = useState(1);
  const totalRoomPages = Math.ceil(auditoriums.length / ROOMS_PER_PAGE) || 1;

  // Tự động chuyển tới trang chứa phòng đang được chọn
  useEffect(() => {
    if (selectedAuditoriumId) {
      const idx = auditoriums.findIndex((a) => a.id === selectedAuditoriumId);
      if (idx !== -1) {
        const targetPage = Math.floor(idx / ROOMS_PER_PAGE) + 1;
        if (targetPage !== roomPage) {
          setRoomPage(targetPage);
        }
      }
    }
  }, [selectedAuditoriumId, auditoriums]);

  // Đảm bảo số trang hợp lệ khi danh sách phòng thay đổi
  useEffect(() => {
    if (roomPage > totalRoomPages) {
      setRoomPage(totalRoomPages);
    }
  }, [totalRoomPages, roomPage]);

  // Danh sách phòng trên trang hiện tại
  const pagedAuditoriums = useMemo(() => {
    const start = (roomPage - 1) * ROOMS_PER_PAGE;
    return auditoriums.slice(start, start + ROOMS_PER_PAGE);
  }, [auditoriums, roomPage]);

  // Tạo mảng số trang hiển thị chuẩn: < 1 2 3 4 ... 1042 >
  const roomPageNumbers = useMemo(() => {
    if (totalRoomPages <= 5) {
      return Array.from({ length: totalRoomPages }, (_, i) => i + 1);
    }
    if (roomPage <= 3) {
      return [1, 2, 3, 4, '...', totalRoomPages];
    }
    if (roomPage >= totalRoomPages - 2) {
      return [1, '...', totalRoomPages - 3, totalRoomPages - 2, totalRoomPages - 1, totalRoomPages];
    }
    return [1, '...', roomPage - 1, roomPage, roomPage + 1, '...', totalRoomPages];
  }, [totalRoomPages, roomPage]);

  // Sync selectedAuditoriumId if invalid
  useEffect(() => {
    if (auditoriums.length > 0) {
      const exists = auditoriums.some((a) => a.id === selectedAuditoriumId);
      if (!exists) {
        setSelectedAuditoriumId(auditoriums[0].id);
      }
    }
  }, [auditoriums, selectedAuditoriumId]);

  // Cinema theaters list with persistent storage and tombstone support
  const [cinemas, setCinemas] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const localDeleted: string[] = JSON.parse(localStorage.getItem('cinemax_deleted_ids') || '[]');
        const deletedSet = new Set(localDeleted);
        const storedCinemas = localStorage.getItem('cinemax_cinemas_list');
        if (storedCinemas) {
          const parsed = JSON.parse(storedCinemas);
          if (Array.isArray(parsed)) {
            return parsed.filter((c: any) => !deletedSet.has(c.id));
          }
        }
        return DEFAULT_CINEMAS.filter((c) => !deletedSet.has(c.id));
      } catch {}
    }
    return DEFAULT_CINEMAS;
  });

  useEffect(() => {
    const loadCinemas = async () => {
      try {
        const localDeleted: string[] = JSON.parse(localStorage.getItem('cinemax_deleted_ids') || '[]');
        const res = await fetch('/api/sync?entity=cinemas');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            const deletedSet = new Set(localDeleted);
            const filtered = json.data.filter((c: any) => !deletedSet.has(c.id));
            setCinemas(filtered);
            localStorage.setItem('cinemax_cinemas_list', JSON.stringify(filtered));
            return;
          }
        }
        const deletedSet = new Set(localDeleted);
        const stored = localStorage.getItem('cinemax_cinemas_list');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setCinemas(parsed.filter((c: any) => !deletedSet.has(c.id)));
          }
        }
      } catch {}
    };
    loadCinemas();
  }, []);

  // Modal for new theater
  const [newTheaterModalOpen, setNewTheaterModalOpen] = useState(false);
  const [editingTheater, setEditingTheater] = useState<any | null>(null);
  const [theaterForm, setTheaterForm] = useState({
    name: '',
    city: 'Hà Nội',
    address: '',
    hotline: '1900 1081'
  });

  // Modal for new room with custom seat count
  const [newAuditoriumModalOpen, setNewAuditoriumModalOpen] = useState(false);
  const [auditoriumForm, setAuditoriumForm] = useState({
    name: '',
    screen_type: '2D' as ScreenType,
    sound_system: 'Dolby 7.1',
    cleaning_buffer_minutes: 15,
    total_seats: 80
  });

  const currentAuditorium =
    auditoriums.find((a) => a.id === selectedAuditoriumId) || auditoriums[0];
  const currentSeats = seats.filter(
    (s) => s.auditorium_id === (currentAuditorium ? currentAuditorium.id : '')
  );

  // Dynamic rows and columns based on actual seats
  const { displayRows, maxColumns, isLargeRoom } = useMemo(() => {
    const ALL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P'];
    const rowSet = new Set(currentSeats.map((s) => s.row_label));
    let rList = Array.from(rowSet).sort();
    const isTargetLarge = (currentAuditorium?.total_seats || 80) >= 100;
    if (rList.length === 0) {
      rList = isTargetLarge ? ALL_LETTERS.slice(0, 10) : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    }
    const defaultCol = isTargetLarge ? 12 : 10;
    const maxCol = Math.max(defaultCol, ...currentSeats.map((s) => s.seat_number));
    const isLarge = (currentAuditorium?.total_seats || 0) >= 100 || rList.length > 8 || maxCol > 10;
    return {
      displayRows: rList,
      maxColumns: Array.from({ length: maxCol }, (_, i) => i + 1),
      isLargeRoom: isLarge
    };
  }, [currentSeats, currentAuditorium]);

  // Auto-heal seats for any empty auditorium (80 ghế: 8 hàng x 10 cột, 120 ghế: 10 hàng x 12 cột)
  useEffect(() => {
    if (currentAuditorium && currentSeats.length === 0 && onAddSeat) {
      const isTargetLarge = (currentAuditorium.total_seats || 80) >= 100;
      const rows = isTargetLarge
        ? ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
        : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const colLimit = isTargetLarge ? 12 : 10;
      const coupleRow = rows[rows.length - 1];

      rows.forEach((row, rIdx) => {
        for (let col = 1; col <= colLimit; col++) {
          let seatType: SeatType = 'STANDARD';
          let price = 75000;
          if (isTargetLarge) {
            if (['F', 'G', 'H', 'I'].includes(row)) {
              seatType = 'VIP';
              price = 95000;
            }
          } else {
            if (['E', 'F', 'G'].includes(row)) {
              seatType = 'VIP';
              price = 95000;
            }
          }
          if (row === coupleRow) {
            seatType = 'COUPLE';
            price = 160000;
          }
          onAddSeat({
            auditorium_id: currentAuditorium.id,
            row_label: row,
            seat_number: col,
            grid_row: rIdx + 1,
            grid_col: col,
            seat_type: seatType,
            status: 'ACTIVE',
            price
          });
        }
      });
    }
  }, [currentAuditorium?.id, currentSeats.length, currentAuditorium?.total_seats, onAddSeat]);

  // Keep selectedSeat synced
  useEffect(() => {
    if (selectedSeat) {
      const refreshed = currentSeats.find((s) => s.id === selectedSeat.id);
      if (refreshed) {
        setSelectedSeat(refreshed);
        setSeatPriceInput(refreshed.price || (refreshed.seat_type === 'COUPLE' ? 160000 : refreshed.seat_type === 'VIP' ? 95000 : 75000));
        setBlockReason(refreshed.block_reason || '');
      } else {
        setSelectedSeat(null);
      }
    }
  }, [currentSeats]);

  // Metrics
  const totalSeatsCount = currentSeats.length;
  const activeSeatsCount = currentSeats.filter((s) => s.status === 'ACTIVE').length;
  const blockedSeatsCount = currentSeats.filter((s) => s.status === 'BLOCKED').length;
  const vipSeatsCount = currentSeats.filter((s) => s.seat_type === 'VIP').length;
  const coupleSeatsCount = currentSeats.filter((s) => s.seat_type === 'COUPLE').length;
  const availabilityRate =
    totalSeatsCount > 0 ? Math.round((activeSeatsCount / totalSeatsCount) * 100) : 100;

  const handleSeatClick = (seat: Seat) => {
    if (batchMode) {
      setSelectedSeatIds((prev) =>
        prev.includes(seat.id) ? prev.filter((id) => id !== seat.id) : [...prev, seat.id]
      );
      return;
    }
    setSelectedSeat(seat);
    setSeatPriceInput(seat.price || (seat.seat_type === 'COUPLE' ? 160000 : seat.seat_type === 'VIP' ? 95000 : 75000));
    setBlockReason(seat.block_reason || '');
  };

  // Change single seat type
  const handleChangeSeatType = async (type: SeatType) => {
    if (!selectedSeat) return;
    let suggestedPrice = selectedSeat.price;
    if (type === 'STANDARD') suggestedPrice = 75000;
    else if (type === 'VIP') suggestedPrice = 95000;
    else if (type === 'COUPLE') suggestedPrice = 160000;

    try {
      setIsUpdating(true);
      if (onUpdateSeat) {
        await onUpdateSeat(selectedSeat.id, { seat_type: type, price: suggestedPrice });
      } else if (onBatchUpdateSeats) {
        await onBatchUpdateSeats([selectedSeat.id], { seat_type: type, price: suggestedPrice });
      }
      setSeatPriceInput(suggestedPrice || 75000);
      showToast(`Đã đổi ghế ${selectedSeat.row_label}${selectedSeat.seat_number} sang ${type}!`);
    } catch {
      showToast('Lỗi cập nhật loại ghế!');
    } finally {
      setIsUpdating(false);
    }
  };

  // Update single seat price
  const handleSaveSeatPrice = async () => {
    if (!selectedSeat) return;
    try {
      setIsUpdating(true);
      if (onUpdateSeat) {
        await onUpdateSeat(selectedSeat.id, { price: Number(seatPriceInput) });
      } else if (onBatchUpdateSeats) {
        await onBatchUpdateSeats([selectedSeat.id], { price: Number(seatPriceInput) });
      }
      showToast(`Đã cập nhật giá ghế ${selectedSeat.row_label}${selectedSeat.seat_number} thành ${Number(seatPriceInput).toLocaleString('vi-VN')}đ!`);
    } catch {
      showToast('Lỗi cập nhật giá ghế!');
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete single seat
  const handleDeleteCurrentSeat = async () => {
    if (!selectedSeat) return;
    const label = `${selectedSeat.row_label}${selectedSeat.seat_number}`;
    try {
      setIsUpdating(true);
      if (onDeleteSeat) {
        await onDeleteSeat(selectedSeat.id);
      }
      setSelectedSeat(null);
      showToast(`Đã xóa ghế ${label} khỏi sơ đồ!`);
    } catch {
      showToast('Lỗi khi xóa ghế!');
    } finally {
      setIsUpdating(false);
    }
  };

  // Restore/Add a seat at empty spot
  const handleAddSeatAtSpot = async (row: string, col: number) => {
    if (!currentAuditorium) return;
    let seatType: SeatType = 'STANDARD';
    let price = 75000;
    if (['E', 'F', 'G'].includes(row)) {
      seatType = 'VIP';
      price = 95000;
    }
    if (row === 'H') {
      seatType = 'COUPLE';
      price = 160000;
    }

    try {
      if (onAddSeat) {
        await onAddSeat({
          auditorium_id: currentAuditorium.id,
          row_label: row,
          seat_number: col,
          grid_row: displayRows.indexOf(row) + 1,
          grid_col: col,
          seat_type: seatType,
          status: 'ACTIVE',
          price
        });
        showToast(`Đã khôi phục ghế ${row}${col}!`);
      }
    } catch {
      showToast('Lỗi thêm ghế!');
    }
  };

  // Toggle Maintenance block
  const handleToggleBlock = async () => {
    if (!selectedSeat) return;
    const newStatus: SeatStatus = selectedSeat.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';

    try {
      setIsUpdating(true);
      await onUpdateSeatStatus(
        selectedSeat.id,
        newStatus,
        newStatus === 'BLOCKED' ? blockReason : undefined
      );
      showToast(
        newStatus === 'BLOCKED'
          ? `Đã khóa ghế ${selectedSeat.row_label}${selectedSeat.seat_number} để bảo trì!`
          : `Đã mở lại ghế ${selectedSeat.row_label}${selectedSeat.seat_number}!`
      );
    } catch (err: any) {
      showToast('Lỗi cập nhật ghế: ' + (err.message || 'Thử lại'));
    } finally {
      setIsUpdating(false);
    }
  };

  // Batch actions
  const handleBatchSetType = async (type: SeatType) => {
    if (selectedSeatIds.length === 0 || !onBatchUpdateSeats) return;
    let price = 75000;
    if (type === 'VIP') price = 95000;
    if (type === 'COUPLE') price = 160000;

    await onBatchUpdateSeats(selectedSeatIds, { seat_type: type, price });
    showToast(`Đã chuyển ${selectedSeatIds.length} ghế sang ${type}!`);
  };

  const handleBatchSetPrice = async () => {
    if (selectedSeatIds.length === 0 || !onBatchUpdateSeats) return;
    await onBatchUpdateSeats(selectedSeatIds, { price: Number(batchPriceInput) });
    showToast(`Đã áp dụng giá ${Number(batchPriceInput).toLocaleString('vi-VN')}đ cho ${selectedSeatIds.length} ghế!`);
  };

  const handleBatchDelete = async () => {
    if (selectedSeatIds.length === 0) return;
    try {
      if (onDeleteSeat) {
        for (const id of selectedSeatIds) {
          await onDeleteSeat(id);
        }
      }
      setSelectedSeatIds([]);
      showToast(`Đã xóa ${selectedSeatIds.length} ghế đã chọn!`);
    } catch {
      showToast('Lỗi khi xóa hàng loạt!');
    }
  };

  const handleSelectRow = (rowLabel: string) => {
    const rowSeatIds = currentSeats
      .filter((s) => s.row_label === rowLabel)
      .map((s) => s.id);
    setSelectedSeatIds((prev) => {
      const allSelected = rowSeatIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !rowSeatIds.includes(id));
      } else {
        return Array.from(new Set([...prev, ...rowSeatIds]));
      }
    });
  };

  const handleCreateTheater = (e: React.FormEvent) => {
    e.preventDefault();
    if (!theaterForm.name.trim()) return;

    let updatedList: any[] = [];
    if (editingTheater) {
      updatedList = cinemas.map((c) => (c.id === editingTheater.id ? { ...c, ...theaterForm } : c));
      setCinemas(updatedList);
      showToast(`Đã cập nhật cụm rạp "${theaterForm.name}" thành công!`);
    } else {
      const created = {
        id: 'cin-' + Date.now(),
        ...theaterForm
      };
      updatedList = [...cinemas, created];
      setCinemas(updatedList);
      showToast(`Đã thêm cụm rạp "${theaterForm.name}" thành công!`);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cinemax_cinemas_list', JSON.stringify(updatedList));

        // Sync to cinemax_cinemas_v2 so User and Staff views update live
        const mappedV2 = updatedList.map((c, idx) => ({
          id: idx + 1,
          name: c.name,
          address: c.address,
          city: c.city,
          district: c.city,
          phone: c.hotline || '1900 1234',
          is_active: true
        }));
        localStorage.setItem('cinemax_cinemas_v2', JSON.stringify(mappedV2));

        window.dispatchEvent(
          new CustomEvent('cinemax_db_updated', { detail: { cinemas: mappedV2 } })
        );
        window.dispatchEvent(
          new CustomEvent('cinemax_data_updated', { detail: { cinemas: mappedV2 } })
        );

        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity: 'cinemas', data: updatedList })
        }).catch(() => {});

        // Sync full cinemas list and primary info to Supabase cinema_settings
        AdminDataService.saveCinemasList(updatedList).catch(() => {});

        // Broadcast cross-tab
        try {
          const bc = new BroadcastChannel('cinemax_sync_channel');
          bc.postMessage({ type: 'cinemas_updated', cinemas: mappedV2 });
          bc.close();
        } catch {}
        localStorage.setItem('cinemax_sync_timestamp', Date.now().toString());
      } catch {}
    }

    setNewTheaterModalOpen(false);
    setEditingTheater(null);
    setTheaterForm({ name: '', city: 'Hà Nội', address: '', hotline: '1900 1081' });
  };

  const handleCreateAuditoriumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditoriumForm.name.trim()) return;

    try {
      const targetSeats = Number(auditoriumForm.total_seats) || 80;
      const saved = await onSaveAuditorium({
        name: auditoriumForm.name.trim(),
        screen_type: auditoriumForm.screen_type,
        sound_system: auditoriumForm.sound_system,
        total_seats: targetSeats,
        cleaning_buffer_minutes: Number(auditoriumForm.cleaning_buffer_minutes) || 15,
        status: 'active'
      });
      if (saved && saved.id) {
        setSelectedAuditoriumId(saved.id);
      }
      setNewAuditoriumModalOpen(false);
      showToast(`Đã tạo phòng "${auditoriumForm.name}" với ${targetSeats} ghế thành công!`);
    } catch (err: any) {
      showToast('Lỗi tạo phòng: ' + (err.message || 'Thử lại'));
    }
  };

  const handleDeleteTheater = (id: string, name: string) => {
    setDeleteConfirmItem({ type: 'THEATER', id, name });
  };

  return (
    <div className="space-y-2.5 animate-in fade-in duration-200">
      {/* Top Bar Gọn Gàng: Gom sub-tabs và nút thêm lên 1 hàng duy nhất (Không có tiêu đề to thừa thãi) */}
      <div className="flex items-center justify-between gap-4 border-b border-[#1E2636] pb-2">
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            onClick={() => setSubTab('AUDITORIUMS')}
            className={`flex items-center gap-2 pb-1 text-xs font-bold transition-all cursor-pointer relative ${
              subTab === 'AUDITORIUMS'
                ? 'text-[#E50914]'
                : 'text-[#8E9AAF] hover:text-white'
            }`}
          >
            <Armchair className="w-3.5 h-3.5" />
            <span>Phòng Chiếu & Sơ Đồ Ghế ({auditoriums.length})</span>
            {subTab === 'AUDITORIUMS' && (
              <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#E50914] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setSubTab('THEATERS')}
            className={`flex items-center gap-2 pb-1 text-xs font-bold transition-all cursor-pointer relative ${
              subTab === 'THEATERS'
                ? 'text-[#E50914]'
                : 'text-[#8E9AAF] hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Danh Sách Rạp Phim ({cinemas.length})</span>
            {subTab === 'THEATERS' && (
              <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#E50914] rounded-full" />
            )}
          </button>
        </div>

        {/* Nút Thêm DUY NHẤT */}
        <button
          onClick={() => {
            if (subTab === 'THEATERS') {
              setNewTheaterModalOpen(true);
            } else {
              setAuditoriumForm({
                name: `Phòng ${auditoriums.length + 1} (${auditoriums.length % 2 === 0 ? 'IMAX Laser' : '2D Digital'})`,
                screen_type: auditoriums.length % 2 === 0 ? 'IMAX' : '2D',
                sound_system: auditoriums.length % 2 === 0 ? 'Dolby Atmos' : 'Dolby 7.1',
                cleaning_buffer_minutes: 15,
                total_seats: 80
              });
              setNewAuditoriumModalOpen(true);
            }
          }}
          className="px-3.5 py-1.5 rounded-xl bg-[#E50914] hover:bg-[#D40813] text-white text-xs font-bold shadow-md shadow-[#E50914]/20 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{subTab === 'THEATERS' ? 'Thêm Rạp mới' : 'Thêm Phòng mới'}</span>
        </button>
      </div>

      {/* SUB-TAB 1: QUẢN LÝ PHÒNG CHIẾU & SƠ ĐỒ GHẾ (Gói gọn 1 cửa sổ, không cần cuộn) */}
      {subTab === 'AUDITORIUMS' && (
        <div className="space-y-2.5">
          {/* DÒNG 1: Danh sách các phòng chiếu (Chuẩn 1 hàng 7 phòng, từ phòng thứ 8 sang trang tiếp) */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {pagedAuditoriums.map((aud) => {
                // Rút gọn tên hiển thị: ví dụ "Phòng 1 (2D Tiêu Chuẩn)" -> "Phòng 1"
                const shortName = aud.name.replace(/\s*\([^)]*\)/g, '').trim() || aud.name;
                const isSelected = selectedAuditoriumId === aud.id;
                const audSeatsCount = seats.filter((s) => s.auditorium_id === aud.id).length || aud.total_seats || 80;

                return (
                  <button
                    key={aud.id}
                    onClick={() => {
                      setSelectedAuditoriumId(aud.id);
                      setSelectedSeat(null);
                      setSelectedSeatIds([]);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between gap-2 text-left ${
                      isSelected
                        ? 'bg-[#E50914] text-white shadow-md ring-2 ring-[#E50914]/40 scale-[1.02]'
                        : 'bg-[#121724] text-[#8E9AAF] hover:text-white border border-[#1E2638] hover:border-[#2D3A50]'
                    }`}
                    title={`${aud.name} (${aud.screen_type} • ${audSeatsCount} ghế)`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-black/20 text-white' : 'bg-[#182030] text-[#06B6D4]'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                      </div>

                      {/* Tên phòng ở trên, thông số loại phòng & ghế xuống dòng */}
                      <div className="flex flex-col min-w-0">
                        <span className="font-extrabold text-xs text-white truncate leading-tight">
                          {shortName}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 leading-tight">
                          <span
                            className={`px-1 py-0.2 rounded text-[9px] font-black uppercase ${
                              aud.screen_type === 'IMAX'
                                ? isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-[#FABF2E]/20 text-[#FABF2E] border border-[#FABF2E]/30'
                                : aud.screen_type === '3D'
                                ? isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/30'
                                : isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30'
                            }`}
                          >
                            {aud.screen_type}
                          </span>
                          <span className={`text-[10px] font-mono ${isSelected ? 'text-white/85' : 'text-[#8E9AAF]'}`}>
                            {audSeatsCount} ghế
                          </span>
                        </div>
                      </div>
                    </div>

                    {auditoriums.length > 1 && onDeleteAuditorium && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmItem({ type: 'AUDITORIUM', id: aud.id, name: aud.name });
                        }}
                        title="Xóa phòng chiếu này"
                        className="p-1 rounded-lg hover:bg-black/40 text-white/50 hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DÒNG 2: DÒNG RIÊNG CHO TỔNG GHẾ & THỐNG KÊ KPI (KÈM PHÂN TRANG NẾU CÓ) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#0C1019] border border-[#192130] text-[11px]">
            {/* Phân trang phòng chiếu (nếu > 7 phòng) hoặc Tiêu đề rạp */}
            <div className="flex items-center gap-2">
              {totalRoomPages > 1 ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#141A26] border border-[#222E42]">
                  <span className="text-[#8E9AAF] text-[10px] font-bold mr-0.5">Trang:</span>
                  <button
                    type="button"
                    onClick={() => setRoomPage((p) => Math.max(1, p - 1))}
                    disabled={roomPage <= 1}
                    className="w-5 h-5 rounded-full bg-[#1A2234] hover:bg-[#2A3750] text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Trang phòng trước"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>

                  {roomPageNumbers.map((p, idx) => {
                    if (p === '...') {
                      return (
                        <span key={`dots-${idx}`} className="text-[#8E9AAF] font-bold px-0.5 select-none text-[10px]">
                          ...
                        </span>
                      );
                    }
                    const pageNum = p as number;
                    const isActive = roomPage === pageNum;
                    return (
                      <button
                        key={`page-${pageNum}`}
                        type="button"
                        onClick={() => setRoomPage(pageNum)}
                        className={`w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#FF7A00] text-white shadow-md shadow-[#FF7A00]/40 font-black scale-105'
                            : 'bg-[#1A2234] hover:bg-[#2A3750] text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setRoomPage((p) => Math.min(totalRoomPages, p + 1))}
                    disabled={roomPage >= totalRoomPages}
                    className="w-5 h-5 rounded-full bg-[#1A2234] hover:bg-[#2A3750] text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Trang phòng tiếp"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="text-[#8E9AAF] text-xs font-bold">
                  Sơ đồ bố trí chỗ ngồi: <strong className="text-white">{currentAuditorium?.name}</strong>
                </span>
              )}
            </div>

            {/* Dải Thống Kê Tổng Ghế KPI (Đúng 1 hàng riêng theo yêu cầu) */}
            <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto text-[11px] shrink-0">
              <div>
                <span className="text-[#8E9AAF]">Tổng ghế: </span>
                <strong className="text-white font-mono">{totalSeatsCount}</strong>
              </div>
              <div>
                <span className="text-[#22C55E]">Hoạt động: </span>
                <strong className="text-[#22C55E] font-mono">{activeSeatsCount}</strong>
              </div>
              <div>
                <span className="text-[#E50914]">Khóa bảo trì: </span>
                <strong className="text-[#E50914] font-mono">{blockedSeatsCount}</strong>
              </div>
              <div>
                <span className="text-[#FABF2E]">VIP: </span>
                <strong className="text-[#FABF2E] font-mono">{vipSeatsCount}</strong>
              </div>
              <div>
                <span className="text-[#E50914]">Couple: </span>
                <strong className="text-[#E50914] font-mono">{coupleSeatsCount}</strong>
              </div>
              <div className="pl-2 border-l border-[#1F2739]">
                <span className="text-[#06B6D4]">Sẵn sàng: </span>
                <strong className="text-[#06B6D4] font-mono font-bold">{availabilityRate}%</strong>
              </div>
            </div>
          </div>

          {/* Sơ Đồ Ghế Co Giãn - Phòng 80 ghế to hơn, 120 ghế bé hơn, chiều cao cố định để thanh dưới cùng không bị dịch chuyển */}
          <div className="bg-[#0C1019] border border-[#192130] rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between h-[365px] sm:h-[375px]">
            {/* Screen Line */}
            <div className="relative w-full max-w-sm mx-auto text-center space-y-0.5 shrink-0">
              <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#E50914] to-transparent rounded-full shadow" />
              <div className="text-[8px] font-bold tracking-widest text-[#5C677D] uppercase">
                MÀN HÌNH CHIẾU ({currentAuditorium?.screen_type || '2D'})
              </div>
            </div>

            {/* Matrix Canvas (Tự động căn giữa, co giãn kích thước ghế theo phòng 80 hay 120) */}
            <div className={`mx-auto flex flex-col justify-center items-center overflow-hidden flex-1 ${isLargeRoom ? 'space-y-0.5 max-w-3xl' : 'space-y-1 max-w-2xl'}`}>
              {displayRows.map((rowLabel) => {
                const isRowCouple = rowLabel === displayRows[displayRows.length - 1];

                return (
                  <div key={rowLabel} className={`flex items-center justify-center ${isLargeRoom ? 'gap-0.5 sm:gap-1' : 'gap-1 sm:gap-1.5'}`}>
                    <button
                      type="button"
                      onClick={() => batchMode && handleSelectRow(rowLabel)}
                      title={batchMode ? `Chọn cả hàng ${rowLabel}` : `Hàng ${rowLabel}`}
                      className={`text-center font-bold font-mono transition-colors ${
                        isLargeRoom ? 'w-4 text-[9px]' : 'w-5 text-[11px]'
                      } ${
                        batchMode ? 'text-[#FABF2E] hover:underline cursor-pointer' : 'text-[#5C677D]'
                      }`}
                    >
                      {rowLabel}
                    </button>

                    <div className={`flex items-center ${isLargeRoom ? 'gap-0.5 sm:gap-1' : 'gap-1 sm:gap-1.5'}`}>
                      {maxColumns.map((colIdx) => {
                        const seat = currentSeats.find(
                          (s) => s.row_label === rowLabel && s.seat_number === colIdx
                        );

                        // Empty spot (Deleted)
                        if (!seat) {
                          return (
                            <button
                              key={`empty-${rowLabel}-${colIdx}`}
                              onClick={() => handleAddSeatAtSpot(rowLabel, colIdx)}
                              title={`Ô trống ${rowLabel}${colIdx} (Bấm để thêm lại ghế)`}
                              className={`${
                                isRowCouple
                                  ? isLargeRoom ? 'w-8 sm:w-8.5' : 'w-9 sm:w-10'
                                  : isLargeRoom ? 'w-5 sm:w-5.5' : 'w-6 sm:w-6.5'
                              } ${
                                isLargeRoom ? 'h-4.5 sm:h-5 text-[8px]' : 'h-6 sm:h-6.5 text-[9px]'
                              } rounded border border-dashed border-[#232F45] hover:border-[#E50914] text-[#34425A] hover:text-[#E50914] flex items-center justify-center transition-all cursor-pointer`}
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          );
                        }

                        const isVip = seat.seat_type === 'VIP';
                        const isCouple = seat.seat_type === 'COUPLE';
                        const isBlocked = seat.status === 'BLOCKED';
                        const isSelected = batchMode
                          ? selectedSeatIds.includes(seat.id)
                          : selectedSeat?.id === seat.id;

                        const seatPrice = seat.price || (isCouple ? 160000 : isVip ? 95000 : 75000);

                        return (
                          <button
                            key={seat.id}
                            onClick={() => handleSeatClick(seat)}
                            title={`Ghế ${seat.row_label}${seat.seat_number} • ${seat.seat_type} • ${seatPrice.toLocaleString('vi-VN')}đ`}
                            className={`transition-all rounded flex items-center justify-center font-mono font-bold cursor-pointer relative ${
                              isCouple
                                ? isLargeRoom ? 'w-8 sm:w-8.5 text-[7.5px]' : 'w-9 sm:w-10 text-[8.5px]'
                                : isLargeRoom ? 'w-5 sm:w-5.5 text-[8px]' : 'w-6 sm:w-6.5 text-[9.5px]'
                            } ${
                              isLargeRoom ? 'h-4.5 sm:h-5' : 'h-6 sm:h-6.5'
                            } ${
                              isSelected
                                ? 'ring-2 ring-white scale-110 shadow-lg z-10'
                                : 'hover:scale-105'
                            } ${
                              isBlocked
                                ? 'bg-[#3B191C] border border-[#E50914] text-[#E50914]'
                                : isCouple
                                ? 'bg-[#E50914] text-white shadow-sm'
                                : isVip
                                ? 'bg-[#FABF2E] text-black shadow-sm'
                                : 'bg-[#1E2738] text-white hover:bg-[#2C384F]'
                            }`}
                          >
                            {isBlocked ? (
                              <Lock className="w-2 h-2" />
                            ) : (
                              `${seat.row_label}${seat.seat_number}`
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => batchMode && handleSelectRow(rowLabel)}
                      className={`text-center font-bold font-mono transition-colors ${
                        isLargeRoom ? 'w-4 text-[9px]' : 'w-5 text-[11px]'
                      } ${
                        batchMode ? 'text-[#FABF2E] hover:underline cursor-pointer' : 'text-[#5C677D]'
                      }`}
                    >
                      {rowLabel}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Chú thích màu sắc nhỏ gọn */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-1 border-t border-[#192130] text-[9px] sm:text-[9.5px] text-[#8E9AAF] shrink-0">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-[#1E2738] border border-[#2D3A50]" />
                <span>Thường (75k)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-[#FABF2E]" />
                <span>VIP (95k)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3.5 h-2 rounded bg-[#E50914]" />
                <span>Couple (160k)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-[#3B191C] border border-[#E50914] flex items-center justify-center text-[#E50914]">
                  <Lock className="w-1.5 h-1.5" />
                </div>
                <span>Bảo Trì</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded border border-dashed border-[#232F45] flex items-center justify-center text-[#5C677D]">
                  <Plus className="w-1.5 h-1.5" />
                </div>
                <span>Ô Trống (Lối đi)</span>
              </div>
            </div>
          </div>

          {/* DÒNG DƯỚI CÙNG: THANH CHỈNH SỬA CỐ ĐỊNH Ở ĐÁY (KHÔNG DỊCH CHUYỂN, ĐÃ BỎ MÔ TẢ) */}
          <div className="min-h-[44px] h-[44px] shrink-0 flex items-center">
            {batchMode ? (
              /* TRẠNG THÁI 1: ĐANG BẬT CHẾ ĐỘ CHỈNH SỬA HÀNG LOẠT (KHÔNG CÓ MÔ TẢ) */
              <div className="w-full h-full px-2.5 rounded-xl bg-[#141A29] border-2 border-[#FABF2E] shadow-xl flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBatchMode(false);
                      setSelectedSeatIds([]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#FABF2E] text-black font-black text-xs flex items-center gap-1.5 shadow cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Đang Bật Hàng Loạt ({selectedSeatIds.length} ghế)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSeatIds(currentSeats.map((s) => s.id))}
                    className="px-2 py-1 rounded-lg bg-[#1F2739] hover:bg-[#2B374E] text-white text-[11px] font-bold cursor-pointer"
                  >
                    Chọn cả phòng ({currentSeats.length})
                  </button>

                  {selectedSeatIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSeatIds([])}
                      className="px-2 py-1 rounded-lg bg-[#2A1619] hover:bg-[#3E1E22] text-[#EF4444] text-[11px] font-bold cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  )}
                </div>

                {selectedSeatIds.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#8E9AAF] text-[11px] font-bold mr-1">Đổi loại:</span>
                    <button
                      type="button"
                      onClick={() => handleBatchSetType('STANDARD')}
                      className="px-2 py-1 rounded bg-[#1E2738] hover:bg-[#2C384F] text-white font-bold cursor-pointer text-[11px] border border-[#2D3A50]"
                    >
                      Thường (75k)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchSetType('VIP')}
                      className="px-2 py-1 rounded bg-[#FABF2E] hover:bg-[#E5AC25] text-black font-bold cursor-pointer text-[11px]"
                    >
                      VIP (95k)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchSetType('COUPLE')}
                      className="px-2 py-1 rounded bg-[#E50914] hover:bg-[#D40813] text-white font-bold cursor-pointer text-[11px]"
                    >
                      Couple (160k)
                    </button>

                    <div className="flex items-center gap-1 pl-1.5 border-l border-[#243048]">
                      <input
                        type="number"
                        step={5000}
                        value={batchPriceInput}
                        onChange={(e) => setBatchPriceInput(Number(e.target.value))}
                        className="w-18 bg-[#0C1019] border border-[#2B3850] rounded px-1.5 py-0.5 text-white text-[11px] font-mono focus:border-[#FABF2E] focus:outline-none"
                        placeholder="Giá tiền"
                      />
                      <button
                        type="button"
                        onClick={handleBatchSetPrice}
                        className="px-2 py-0.5 rounded bg-[#06B6D4] hover:bg-[#0891B2] text-black font-bold cursor-pointer text-[11px]"
                      >
                        Gán Giá
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleBatchDelete}
                      className="px-2 py-1 rounded bg-[#EF4444]/20 hover:bg-[#EF4444]/40 text-[#EF4444] font-bold flex items-center gap-1 cursor-pointer text-[11px] ml-1 border border-[#EF4444]/30"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Xóa</span>
                    </button>
                  </div>
                )}
              </div>
            ) : selectedSeat ? (
              /* TRẠNG THÁI 2: ĐANG CHỌN 1 GHẾ (SEAT INSPECTOR CỐ ĐỊNH Ở ĐÁY) */
              <div className="w-full h-full px-2.5 rounded-xl bg-[#121724] border-2 border-[#3B82F6] shadow-xl flex items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
                {/* Badge Ghế */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs shadow ${
                      selectedSeat.seat_type === 'COUPLE'
                        ? 'bg-[#E50914] text-white'
                        : selectedSeat.seat_type === 'VIP'
                        ? 'bg-[#FABF2E] text-black'
                        : 'bg-[#1E2738] text-white border border-[#3B4861]'
                    }`}
                  >
                    {selectedSeat.row_label}{selectedSeat.seat_number}
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5 leading-tight">
                      <span>Ghế {selectedSeat.row_label}{selectedSeat.seat_number}</span>
                      <span className="text-[10px] text-[#8E9AAF]">({selectedSeat.seat_type})</span>
                    </div>
                    <div className="text-[9px] text-[#8E9AAF]">
                      {selectedSeat.status === 'BLOCKED' ? (
                        <span className="text-[#E50914] font-bold">Đang khóa bảo trì</span>
                      ) : (
                        <span className="text-[#22C55E]">Đang hoạt động</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nhóm Đổi Loại Ghế */}
                <div className="flex items-center gap-1 bg-[#0C1019] p-0.5 rounded-lg border border-[#1A2335]">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleChangeSeatType('STANDARD')}
                    className={`py-0.5 px-2 rounded font-bold transition-all cursor-pointer text-[11px] ${
                      selectedSeat.seat_type === 'STANDARD'
                        ? 'bg-white text-black shadow'
                        : 'text-[#8E9AAF] hover:text-white'
                    }`}
                  >
                    Thường
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleChangeSeatType('VIP')}
                    className={`py-0.5 px-2 rounded font-bold transition-all cursor-pointer text-[11px] ${
                      selectedSeat.seat_type === 'VIP'
                        ? 'bg-[#FABF2E] text-black shadow font-black'
                        : 'text-[#8E9AAF] hover:text-white'
                    }`}
                  >
                    VIP
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleChangeSeatType('COUPLE')}
                    className={`py-0.5 px-2 rounded font-bold transition-all cursor-pointer text-[11px] ${
                      selectedSeat.seat_type === 'COUPLE'
                        ? 'bg-[#E50914] text-white shadow'
                        : 'text-[#8E9AAF] hover:text-white'
                    }`}
                  >
                    Couple
                  </button>
                </div>

                {/* Nhóm Sửa Giá Ghế */}
                <div className="flex items-center gap-1.5 bg-[#0C1019] p-0.5 px-1.5 rounded-lg border border-[#1A2335]">
                  <DollarSign className="w-3 h-3 text-[#22C55E]" />
                  <input
                    type="number"
                    step={5000}
                    value={seatPriceInput}
                    onChange={(e) => setSeatPriceInput(Number(e.target.value))}
                    className="w-18 bg-transparent text-white font-mono text-xs focus:outline-none"
                    placeholder="Giá vé"
                  />
                  <button
                    type="button"
                    onClick={handleSaveSeatPrice}
                    disabled={isUpdating}
                    className="px-2 py-0.5 rounded bg-[#22C55E] hover:bg-[#1CA34D] text-black font-bold text-[10px] cursor-pointer"
                  >
                    Lưu
                  </button>
                </div>

                {/* Nhóm Thao Tác Bảo Trì & Xóa */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleToggleBlock}
                    disabled={isUpdating}
                    className={`py-1 px-2 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                      selectedSeat.status === 'BLOCKED'
                        ? 'bg-[#22C55E] text-black'
                        : 'bg-[#3B191C] text-[#EF4444] border border-[#EF4444]/40'
                    }`}
                  >
                    {selectedSeat.status === 'BLOCKED' ? (
                      <>
                        <Unlock className="w-2.5 h-2.5" />
                        <span>Mở</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-2.5 h-2.5" />
                        <span>Khóa</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteCurrentSeat}
                    disabled={isUpdating}
                    title="Xóa ghế để tạo lối đi"
                    className="py-1 px-2 rounded-lg bg-[#1C2230] hover:bg-[#EF4444] text-[#8E9AAF] hover:text-white text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                    <span>Xóa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSeat(null)}
                    className="p-1 rounded text-[#8E9AAF] hover:text-white hover:bg-white/10 cursor-pointer ml-0.5"
                    title="Đóng bảng chỉnh sửa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* TRẠNG THÁI 3: BÌNH THƯỜNG (CỐ ĐỊNH Ở ĐÁY, ĐÃ BỎ MỌI MÔ TẢ CHỈNH SỬA) */
              <div className="w-full h-full px-3 rounded-xl bg-[#0C1019] border border-[#192130] flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setBatchMode(true);
                    setSelectedSeat(null);
                    setSelectedSeatIds([]);
                  }}
                  className="px-3 py-1 rounded-xl bg-[#151C2B] hover:bg-[#FABF2E] text-[#8E9AAF] hover:text-black hover:font-black border border-[#232F45] hover:border-[#FABF2E] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Chỉnh Sửa Hàng Loạt</span>
                </button>

                <div className="text-[11px] text-[#5C677D] font-mono">
                  {currentAuditorium?.name} • {currentAuditorium?.screen_type || '2D'} • {totalSeatsCount} ghế
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: QUẢN LÝ DANH SÁCH RẠP PHIM */}
      {subTab === 'THEATERS' && (
        <div className="bg-[#0C1019] border border-[#192130] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#121724] text-[#8E9AAF] border-b border-[#1E2638]">
                <tr>
                  <th className="py-3 px-4 font-bold">Tên rạp</th>
                  <th className="py-3 px-4 font-bold">Thành phố</th>
                  <th className="py-3 px-4 font-bold">Địa chỉ</th>
                  <th className="py-3 px-4 font-bold">Hotline</th>
                  <th className="py-3 px-4 font-bold text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#171E2D]">
                {cinemas.map((c) => (
                  <tr key={c.id} className="hover:bg-[#141B29] transition-colors">
                    <td className="py-3 px-4 font-bold text-white">{c.name}</td>
                    <td className="py-3 px-4 text-[#8E9AAF]">{c.city}</td>
                    <td className="py-3 px-4 text-[#8E9AAF] max-w-xs truncate">{c.address}</td>
                    <td className="py-3 px-4 text-[#8E9AAF] font-mono">{c.hotline}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingTheater(c);
                            setTheaterForm({ name: c.name, city: c.city, address: c.address, hotline: c.hotline });
                            setNewTheaterModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-[#8E9AAF] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                          title="Sửa"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTheater(c.id, c.name)}
                          className="p-1.5 rounded-lg text-[#8E9AAF] hover:text-[#E50914] hover:bg-white/5 transition-colors cursor-pointer"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Thêm Rạp Mới */}
      {newTheaterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0C1019] border border-[#1E2638] rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1A2233] pb-2.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#E50914]" />
                <span>{editingTheater ? 'Cập Nhật Cụm Rạp' : 'Thêm Cụm Rạp Mới'}</span>
              </h3>
              <button
                onClick={() => {
                  setNewTheaterModalOpen(false);
                  setEditingTheater(null);
                }}
                className="w-7 h-7 rounded-lg bg-[#141A26] text-[#8E9AAF] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateTheater} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Tên cụm rạp *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: CINEMAX Cầu Giấy"
                  value={theaterForm.name}
                  onChange={(e) => setTheaterForm({ ...theaterForm, name: e.target.value })}
                  className="w-full bg-[#121724] border border-[#1E2638] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Thành phố *</label>
                <select
                  value={theaterForm.city}
                  onChange={(e) => setTheaterForm({ ...theaterForm, city: e.target.value })}
                  className="w-full bg-[#121724] border border-[#1E2638] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                >
                  <option value="Hà Nội">Hà Nội</option>
                  <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                  <option value="Đà Nẵng">Đà Nẵng</option>
                  <option value="Hải Phòng">Hải Phòng</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Địa chỉ chi tiết *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Tầng 3 TTTM Discovery Complex..."
                  value={theaterForm.address}
                  onChange={(e) => setTheaterForm({ ...theaterForm, address: e.target.value })}
                  className="w-full bg-[#121724] border border-[#1E2638] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Hotline</label>
                <input
                  type="text"
                  value={theaterForm.hotline}
                  onChange={(e) => setTheaterForm({ ...theaterForm, hotline: e.target.value })}
                  className="w-full bg-[#121724] border border-[#1E2638] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#E50914]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1A2233]">
                <button
                  type="button"
                  onClick={() => {
                    setNewTheaterModalOpen(false);
                    setEditingTheater(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#141A26] text-[#8E9AAF] font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#E50914] hover:bg-[#D40813] text-white font-bold cursor-pointer shadow-md shadow-[#E50914]/20"
                >
                  {editingTheater ? 'Lưu' : 'Tạo Rạp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Thêm Phòng Chiếu & Chọn Số Lượng Ghế */}
      {newAuditoriumModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0C1019] border border-[#1E2638] rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1A2233] pb-2.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#E50914]" />
                <span>Thêm Phòng Chiếu & Khởi Tạo Sơ Đồ Ghế</span>
              </h3>
              <button
                onClick={() => setNewAuditoriumModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-[#141A26] text-[#8E9AAF] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateAuditoriumSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Tên phòng chiếu *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Phòng 3 (IMAX Laser)"
                  value={auditoriumForm.name}
                  onChange={(e) => setAuditoriumForm({ ...auditoriumForm, name: e.target.value })}
                  className="w-full bg-[#121724] border border-[#1E2638] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                />
              </div>

              {/* MỤC MỚI: CHỌN SỐ LƯỢNG GHẾ */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[#8E9AAF] font-semibold">Số lượng ghế khởi tạo *</label>
                  <span className="text-[#FABF2E] font-bold font-mono text-[11px]">
                    {auditoriumForm.total_seats} ghế ({Math.ceil(auditoriumForm.total_seats / 10)} hàng x 10 cột)
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {SEAT_PRESETS.map((p) => (
                    <button
                      key={p.count}
                      type="button"
                      onClick={() => setAuditoriumForm({ ...auditoriumForm, total_seats: p.count })}
                      className={`py-1.5 px-1 rounded-lg text-center font-bold text-[10px] transition-all cursor-pointer ${
                        auditoriumForm.total_seats === p.count
                          ? 'bg-[#E50914] text-white shadow-md'
                          : 'bg-[#151C2B] text-[#8E9AAF] hover:text-white border border-[#232F45]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-[#5C677D]">Hoặc tự nhập:</span>
                  <input
                    type="number"
                    min={20}
                    max={180}
                    step={10}
                    value={auditoriumForm.total_seats}
                    onChange={(e) => setAuditoriumForm({ ...auditoriumForm, total_seats: Number(e.target.value) })}
                    className="w-20 bg-[#121724] border border-[#1E2638] rounded-lg px-2 py-1 text-white font-mono text-[11px] focus:outline-none focus:border-[#E50914]"
                  />
                  <span className="text-[10px] text-[#5C677D]">ghế</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[#8E9AAF] font-semibold">Công nghệ màn hình</label>
                  <select
                    value={auditoriumForm.screen_type}
                    onChange={(e) => setAuditoriumForm({ ...auditoriumForm, screen_type: e.target.value as ScreenType })}
                    className="w-full bg-[#121724] border border-[#1E2638] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                  >
                    <option value="2D">2D Digital</option>
                    <option value="3D">3D RealD</option>
                    <option value="IMAX">IMAX Laser</option>
                    <option value="4DX">4DX Motion</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[#8E9AAF] font-semibold">Hệ thống âm thanh</label>
                  <select
                    value={auditoriumForm.sound_system}
                    onChange={(e) => setAuditoriumForm({ ...auditoriumForm, sound_system: e.target.value })}
                    className="w-full bg-[#121724] border border-[#1E2638] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                  >
                    <option value="Dolby 7.1">Dolby 7.1</option>
                    <option value="Dolby Atmos">Dolby Atmos</option>
                    <option value="IMAX 12-channel">IMAX 12-channel</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Thời gian đệm dọn rạp (phút)</label>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={auditoriumForm.cleaning_buffer_minutes}
                  onChange={(e) => setAuditoriumForm({ ...auditoriumForm, cleaning_buffer_minutes: Number(e.target.value) })}
                  className="w-full bg-[#121724] border border-[#1E2638] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#E50914]"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-[#161D2B] border border-[#232F45] text-[10px] text-[#8E9AAF]">
                Hệ thống sẽ <strong className="text-white">tự động sinh {auditoriumForm.total_seats} ghế</strong> (gồm Thường 75k, VIP 95k và Couple 160k ở hàng cuối) ngay khi tạo phòng.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1A2233]">
                <button
                  type="button"
                  onClick={() => setNewAuditoriumModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-[#141A26] text-[#8E9AAF] font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#E50914] hover:bg-[#D40813] text-white font-bold cursor-pointer shadow-md shadow-[#E50914]/20"
                >
                  Tạo Phòng & Sơ Đồ Ghế
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#2E1F24] rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#3B191C] text-[#EF4444] flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">
                  {deleteConfirmItem.type === 'THEATER' ? 'Xác Nhận Xóa Cụm Rạp' : 'Xác Nhận Xóa Phòng Chiếu'}
                </h3>
                <p className="text-[11px] text-[#8E9AAF]">
                  {deleteConfirmItem.type === 'THEATER'
                    ? 'Cụm rạp sẽ bị gỡ khỏi hệ thống.'
                    : 'Phòng chiếu và sơ đồ ghế sẽ bị xóa.'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#1A1F2C] border border-[#263147] text-xs text-white">
              Bạn có chắc chắn muốn xóa:{' '}
              <strong className="text-[#FABF2E]">{deleteConfirmItem.name}</strong>?
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="px-3.5 py-2 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white font-bold cursor-pointer text-xs"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  const item = deleteConfirmItem;
                  setDeleteConfirmItem(null);
                  if (item.type === 'THEATER') {
                    const nextCinemas = cinemas.filter((c) => c.id !== item.id);
                    setCinemas(nextCinemas);
                    if (typeof window !== 'undefined') {
                      try {
                        const localDeleted = JSON.parse(localStorage.getItem('cinemax_deleted_ids') || '[]');
                        if (!localDeleted.includes(item.id)) {
                          localDeleted.push(item.id);
                          localStorage.setItem('cinemax_deleted_ids', JSON.stringify(localDeleted));
                        }
                        localStorage.setItem('cinemax_cinemas_list', JSON.stringify(nextCinemas));
                        const mappedV2 = nextCinemas.map((c, idx) => ({
                          id: idx + 1,
                          name: c.name,
                          address: c.address,
                          city: c.city,
                          district: c.city,
                          phone: c.hotline || '1900 1234',
                          is_active: true
                        }));
                        localStorage.setItem('cinemax_cinemas_v2', JSON.stringify(mappedV2));
                        window.dispatchEvent(
                          new CustomEvent('cinemax_db_updated', { detail: { cinemas: mappedV2 } })
                        );
                        window.dispatchEvent(
                          new CustomEvent('cinemax_data_updated', { detail: { cinemas: mappedV2 } })
                        );
                        fetch('/api/sync', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ entity: 'cinemas', data: nextCinemas })
                        }).catch(() => {});

                        // Sync updated list to Supabase cinema_settings
                        AdminDataService.saveCinemasList(nextCinemas).catch(() => {});

                        // Broadcast cross-tab
                        try {
                          const bc = new BroadcastChannel('cinemax_sync_channel');
                          bc.postMessage({ type: 'cinemas_updated', cinemas: mappedV2 });
                          bc.close();
                        } catch {}
                        localStorage.setItem('cinemax_sync_timestamp', Date.now().toString());
                      } catch {}
                    }
                    showToast(`Đã xóa cụm rạp "${item.name}"!`);
                  } else if (item.type === 'AUDITORIUM') {
                    if (onDeleteAuditorium) {
                      await onDeleteAuditorium(item.id);
                    }
                    showToast(`Đã xóa phòng "${item.name}"!`);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold shadow-md shadow-[#EF4444]/20 cursor-pointer text-xs"
              >
                Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
