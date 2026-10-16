'use client';

import React, { useState } from 'react';
import {
  Coffee,
  ShoppingBag,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  FileText,
  X,
  ScanLine,
  Sliders
} from 'lucide-react';
import {
  Product,
  ProductModifier,
  ProductComponent,
  InventoryMovement,
  ProductType,
  MovementType
} from '@/lib/types-redesign';

interface ConcessionViewProps {
  products: Product[];
  modifiers: ProductModifier[];
  components: ProductComponent[];
  onSaveProduct: (product: Partial<Product>) => Promise<void>;
  onDeleteProduct?: (id: string) => Promise<void>;
  onLogMovement: (movement: Partial<InventoryMovement>) => Promise<void>;
  showToast: (msg: string) => void;
}

export default function ConcessionView({
  products,
  modifiers,
  components,
  onSaveProduct,
  onDeleteProduct,
  onLogMovement,
  showToast
}: ConcessionViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'MENU' | 'MODIFIERS' | 'INVENTORY' | 'KDS'>('MENU');
  const [searchTerm, setSearchTerm] = useState('');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<{ id: string; name: string } | null>(null);

  // Inventory movement modal
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementForm, setMovementForm] = useState({
    product_id: products[0]?.id || '',
    movement_type: 'IMPORT' as MovementType,
    quantity: 50,
    reason: 'Nhập kho định kỳ từ nhà cung cấp'
  });

  // Product Form
  const [productForm, setProductForm] = useState<{
    id?: string;
    name: string;
    product_type: ProductType;
    base_price: number;
    available_stock: number;
    inventory_tracking: boolean;
    active: boolean;
    image_url: string;
  }>({
    name: '',
    product_type: 'FOOD',
    base_price: 45000,
    available_stock: 100,
    inventory_tracking: true,
    active: true,
    image_url: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=600'
  });

  // Mock local inventory movements log if empty
  const [inventoryLogs, setInventoryLogs] = useState<Partial<InventoryMovement>[]>([
    {
      id: 'mov-1',
      product_id: products[0]?.id,
      movement_type: 'IMPORT',
      quantity: 200,
      reason: 'Nhập kho đầu ca nguyên liệu bắp hạt & bơ',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      id: 'mov-2',
      product_id: products[1]?.id,
      movement_type: 'IMPORT',
      quantity: 300,
      reason: 'Nhập xi-rô nước ngọt Coca & Sprite',
      created_at: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
      id: 'mov-3',
      product_id: products[0]?.id,
      movement_type: 'SALE',
      quantity: -48,
      reason: 'Bán hàng tự động theo đơn vé',
      created_at: new Date(Date.now() - 3600000).toISOString()
    }
  ]);

  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      product_type: 'FOOD',
      base_price: 45000,
      available_stock: 100,
      inventory_tracking: true,
      active: true,
      image_url: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=600'
    });
    setProductModalOpen(true);
  };

  const openEditProductModal = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      id: p.id,
      name: p.name,
      product_type: p.product_type,
      base_price: p.base_price,
      available_stock: p.available_stock,
      inventory_tracking: p.inventory_tracking,
      active: p.active,
      image_url: p.image_url || ''
    });
    setProductModalOpen(true);
  };

  const handleSaveProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;

    try {
      await onSaveProduct(productForm);
      showToast(`Đã lưu sản phẩm "${productForm.name}" thành công!`);
      setProductModalOpen(false);
    } catch (err: any) {
      showToast('Lỗi lưu sản phẩm: ' + err.message);
    }
  };

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === movementForm.product_id);
    if (!prod) return;

    try {
      await onLogMovement({
        product_id: prod.id,
        movement_type: movementForm.movement_type,
        quantity:
          movementForm.movement_type === 'LOSS' ? -Math.abs(movementForm.quantity) : movementForm.quantity,
        reason: movementForm.reason
      });

      setInventoryLogs((prev) => [
        {
          id: 'mov-' + Date.now(),
          product_id: prod.id,
          movement_type: movementForm.movement_type,
          quantity:
            movementForm.movement_type === 'LOSS' ? -Math.abs(movementForm.quantity) : movementForm.quantity,
          reason: movementForm.reason,
          created_at: new Date().toISOString()
        },
        ...prev
      ]);

      showToast(`Đã ghi nhận phiếu ${movementForm.movement_type} cho ${prod.name}!`);
      setMovementModalOpen(false);
    } catch (err: any) {
      showToast('Lỗi ghi nhận sổ kho: ' + err.message);
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* Compact Top Bar: Sub Tabs + Action Buttons on single row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#222B3D] pb-2">
        {/* Sub Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          {[
            { id: 'MENU', label: 'Thực Đơn F&B', icon: Coffee },
            { id: 'MODIFIERS', label: 'Tùy Chọn Đổi Vị / Size', icon: Sliders },
            { id: 'INVENTORY', label: 'Sổ Biến Động Kho', icon: FileText },
            { id: 'KDS', label: 'Trả Món (KDS)', icon: ScanLine }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#FABF2E] text-black shadow-md'
                    : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setMovementModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-[#1F2739] hover:bg-[#28324A] text-white text-xs font-bold border border-[#303B52] flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#FABF2E]" />
            <span>Phiếu Kho</span>
          </button>

          <button
            onClick={openAddProductModal}
            className="px-3.5 py-1.5 rounded-xl bg-[#E63845] hover:bg-[#D42B38] text-white text-xs font-bold shadow-md shadow-[#E63845]/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Món</span>
          </button>
        </div>
      </div>


      {/* TAB 1: MENU PRODUCTS & COMBOS */}
      {activeSubTab === 'MENU' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((product) => {
            const isCombo = product.product_type === 'COMBO';
            const comboComps = components.filter((c) => c.combo_id === product.id);

            return (
              <div
                key={product.id}
                className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 flex gap-4 hover:border-[#384663] transition-all group"
              >
                <div className="w-20 h-24 rounded-xl bg-[#1A1F2C] border border-[#263147] overflow-hidden shrink-0">
                  <img
                    src={product.image_url || 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=600'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-bold text-white text-sm truncate" title={product.name}>
                        {product.name}
                      </h3>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                          isCombo ? 'bg-[#E63845] text-white' : 'bg-[#1F2739] text-[#FABF2E]'
                        }`}
                      >
                        {product.product_type}
                      </span>
                    </div>

                    <div className="text-base font-black text-white font-mono">
                      {product.base_price.toLocaleString('vi-VN')} đ
                    </div>

                    {isCombo && comboComps.length > 0 && (
                      <div className="text-[10px] text-[#8E9AAF] bg-[#161C2A] p-1.5 rounded-lg border border-[#222B3D]">
                        <span className="text-[#FABF2E] font-bold">Định lượng:</span>{' '}
                        {comboComps.map((c) => `${c.quantity}x ${c.component?.name || 'Món'}`).join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#1F2739] flex items-center justify-between text-xs">
                    <div className="text-[11px]">
                      <span className="text-[#5C677D]">Tồn khả dụng: </span>
                      <span
                        className={`font-mono font-bold ${
                          product.available_stock < 50 ? 'text-[#EF4444]' : 'text-[#22C55E]'
                        }`}
                      >
                        {product.available_stock}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditProductModal(product)}
                        title="Chỉnh sửa món"
                        className="p-1.5 rounded-lg bg-[#1A202E] hover:bg-[#28324A] text-[#8E9AAF] hover:text-white transition-all cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {onDeleteProduct && (
                        <button
                          onClick={() => setDeleteConfirmProduct({ id: product.id, name: product.name })}
                          title="Xóa món"
                          className="p-1.5 rounded-lg bg-[#1A202E] hover:bg-[#EF4444]/20 text-[#8E9AAF] hover:text-[#EF4444] transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: MODIFIERS (TÙY CHỌN ĐỔI VỊ / SIZE) */}
      {activeSubTab === 'MODIFIERS' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#222B3D] pb-2 text-xs">
            <span className="font-bold text-white">Danh Sách Biến Thể & Phụ Phí</span>
            <span className="text-[#8E9AAF]">{modifiers.length} tùy chọn khả dụng</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modifiers.map((mod) => (
              <div
                key={mod.id}
                className="p-4 rounded-2xl bg-[#161D2B] border border-[#26324A] flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1E273A] text-[#FABF2E] border border-[#FABF2E]/30 uppercase">
                    {mod.modifier_group}
                  </span>
                  <div className="font-bold text-white text-sm mt-1.5">{mod.option_name}</div>
                  <div className="text-[11px] text-[#22C55E] font-mono mt-0.5">
                    {mod.extra_price > 0 ? `+${mod.extra_price.toLocaleString('vi-VN')} đ` : 'Mặc định (Miễn phí)'}
                  </div>
                </div>

                <span
                  className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    mod.active ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-[#EF4444]/15 text-[#EF4444]'
                  }`}
                >
                  {mod.active ? 'Kích hoạt' : 'Tạm ẩn'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY MOVEMENTS (SỔ KHO) */}
      {activeSubTab === 'INVENTORY' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#222B3D] pb-2 text-xs">
            <span className="font-bold text-white">Sổ Biến Động Kho Hàng</span>

            <button
              onClick={() => setMovementModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#FABF2E] text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo Phiếu Kho</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222B3D] text-[#8E9AAF]">
                  <th className="py-2.5 px-3 font-bold">Thời Gian</th>
                  <th className="py-2.5 px-3 font-bold">Sản Phẩm</th>
                  <th className="py-2.5 px-3 font-bold">Loại Phiếu</th>
                  <th className="py-2.5 px-3 font-bold text-right">Biến Động</th>
                  <th className="py-2.5 px-3 font-bold">Lý Do / Diễn Giải</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D2536]">
                {inventoryLogs.map((log) => {
                  const prod = products.find((p) => p.id === log.product_id);
                  const isPositive = (log.quantity || 0) > 0;

                  return (
                    <tr key={log.id} className="hover:bg-[#161C2A]">
                      <td className="py-3 px-3 text-[#8E9AAF] font-mono">
                        {new Date(log.created_at || '').toLocaleTimeString('vi-VN')} •{' '}
                        {new Date(log.created_at || '').toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3 px-3 font-bold text-white">{prod?.name || 'Nguyên liệu'}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            log.movement_type === 'IMPORT'
                              ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                              : log.movement_type === 'SALE'
                              ? 'bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/30'
                              : 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                          }`}
                        >
                          {log.movement_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-sm">
                        <span className={isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                          {isPositive ? `+${log.quantity}` : log.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#8E9AAF]">{log.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: KDS FULFILLMENT SCREEN */}
      {activeSubTab === 'KDS' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-[#222B3D] pb-2 text-xs">
            <span className="font-bold text-white flex items-center gap-2">
              <ScanLine className="w-3.5 h-3.5 text-[#FABF2E]" />
              <span>Màn Hình Trả Bắp Nước Tại Quầy (KDS)</span>
            </span>
            <span className="text-[#22C55E] flex items-center gap-1.5 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span>Đang kết nối thời gian thực</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#161D2B] border border-[#26324A] space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono font-bold text-white">ĐƠN #CMX-8921</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FABF2E] text-black">
                  CHỜ GIAO
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-[#8E9AAF]">
                <div className="text-white font-bold text-sm">1x Combo Solo Bắp Nước</div>
                <div>• Vị bắp: <strong className="text-[#FABF2E]">Phô Mai Lắc (+10k)</strong></div>
                <div>• Loại nước: <strong className="text-[#06B6D4]">Coca-Cola Tươi (L)</strong></div>
              </div>
              <button
                onClick={() => showToast('Đã xác nhận bàn giao combo đơn #CMX-8921 cho khách!')}
                className="w-full py-2.5 rounded-xl bg-[#22C55E] hover:bg-[#1CA34D] text-black font-black text-xs transition-all cursor-pointer shadow-md"
              >
                Xác Nhận Đã Trả Hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Log Inventory Movement */}
      {movementModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#FABF2E]" />
                <span>Tạo Phiếu Biến Động Kho</span>
              </h3>
              <button
                onClick={() => setMovementModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#1A202E] text-[#8E9AAF] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMovement} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Sản phẩm / Nguyên liệu *</label>
                <select
                  required
                  value={movementForm.product_id}
                  onChange={(e) => setMovementForm({ ...movementForm, product_id: e.target.value })}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FABF2E]"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Tồn hiện tại: {p.available_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Loại nghiệp vụ kho *</label>
                <select
                  value={movementForm.movement_type}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, movement_type: e.target.value as MovementType })
                  }
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FABF2E]"
                >
                  <option value="IMPORT">IMPORT - Nhập kho từ nhà cung cấp (+)</option>
                  <option value="LOSS">LOSS - Hủy hỏng / Hao hụt (-)</option>
                  <option value="ADJUSTMENT">ADJUSTMENT - Điều chỉnh sau kiểm kê</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Số lượng thay đổi *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={movementForm.quantity}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, quantity: Number(e.target.value) })
                  }
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#FABF2E]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Lý do / Số hóa đơn đính kèm</label>
                <input
                  type="text"
                  required
                  value={movementForm.reason}
                  onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                  placeholder="Vd: Nhập kho theo phiếu giao nhận 829"
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FABF2E]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222B3D]">
                <button
                  type="button"
                  onClick={() => setMovementModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#1A202E] text-[#8E9AAF] font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black font-black cursor-pointer shadow-lg"
                >
                  Xác Nhận Lưu Kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Product */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <h3 className="font-bold text-white text-base">
                {editingProduct ? 'Chỉnh Sửa Sản Phẩm F&B' : 'Thêm Món / Combo Mới'}
              </h3>
              <button
                onClick={() => setProductModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#1A202E] text-[#8E9AAF] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProductSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Tên món bắp nước / Combo *</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="Vd: Combo Siêu Sao 1 Bắp 2 Nước"
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[#8E9AAF] font-semibold">Phân loại *</label>
                  <select
                    value={productForm.product_type}
                    onChange={(e) =>
                      setProductForm({ ...productForm, product_type: e.target.value as ProductType })
                    }
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#E63845]"
                  >
                    <option value="FOOD">FOOD (Bắp rang, Snack)</option>
                    <option value="BEVERAGE">BEVERAGE (Nước ngọt, Trà)</option>
                    <option value="COMBO">COMBO (Nhiều món gom lại)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[#8E9AAF] font-semibold">Giá bán cơ bản (VND) *</label>
                  <input
                    type="number"
                    step={1000}
                    required
                    value={productForm.base_price}
                    onChange={(e) =>
                      setProductForm({ ...productForm, base_price: Number(e.target.value) })
                    }
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#E63845]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">URL hình ảnh món</label>
                <input
                  type="text"
                  value={productForm.image_url}
                  onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#222B3D]">
                {editingProduct && onDeleteProduct ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmProduct({ id: editingProduct.id, name: editingProduct.name });
                      setProductModalOpen(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#3B191C] hover:bg-[#EF4444] text-[#EF4444] hover:text-white font-bold transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa Món</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setProductModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-[#1A202E] text-[#8E9AAF] font-bold cursor-pointer hover:text-white"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#E63845] hover:bg-[#D42B38] text-white font-bold cursor-pointer shadow-lg shadow-[#E63845]/30"
                  >
                    {editingProduct ? 'Lưu Thay Đổi' : 'Lưu Sản Phẩm'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Product Delete Confirmation Modal */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#2E1F24] rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#3B191C] text-[#EF4444] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Xác Nhận Xóa Món F&B</h3>
                <p className="text-xs text-[#8E9AAF]">Món ăn/nước uống này sẽ bị gỡ khỏi thực đơn bắp nước.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#1A1F2C] border border-[#263147] text-xs text-white">
              Bạn có chắc chắn muốn xóa: <strong className="text-[#FABF2E]">{deleteConfirmProduct.name}</strong>?
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white font-bold transition-all cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteConfirmProduct.id;
                  setDeleteConfirmProduct(null);
                  if (onDeleteProduct) {
                    await onDeleteProduct(id);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold transition-all shadow-lg shadow-[#EF4444]/30 cursor-pointer"
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
