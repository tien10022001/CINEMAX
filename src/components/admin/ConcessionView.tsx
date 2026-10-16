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
  Sliders,
  Sparkles,
  Check,
  Package,
  Gift,
  Tag,
  Layers,
  RefreshCw
} from 'lucide-react';
import {
  Product,
  ProductModifier,
  ProductComponent,
  InventoryMovement,
  ProductType,
  MovementType,
  ComboDetails
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

// Danh mục chuẩn rạp chiếu phim
const POPCORN_SIZES = ['Nhỏ (45oz)', 'Vừa (64oz)', 'Lớn (85oz)', 'Khổng lồ (120oz)'];
const POPCORN_FLAVORS = [
  'Bơ truyền thống',
  'Phô mai lắc',
  'Caramel ngọt đậm',
  'Socola đậm đà',
  'Rang muối biển',
  'Rong biển cay'
];

const DRINK_SIZES = ['Nhỏ (16oz)', 'Tiêu chuẩn (22oz)', 'Lớn (32oz)', 'Chai đóng sẵn (500ml)'];
const DRINK_TYPES = [
  'Coca-Cola Original',
  'Coca-Cola Zero (Không đường)',
  'Sprite Chanh Bạc Hà',
  'Fanta Hương Cam',
  'Trà Đào Hạt Chia',
  'Trà Chanh Sả',
  'Nước Khoáng Dasani'
];

const PRESET_IMAGES = [
  { label: 'Combo Solo 1 Bắp 1 Nước', url: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=600' },
  { label: 'Combo Couple 1 Bắp 2 Nước', url: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=600' },
  { label: 'Combo Family Nhiều Món', url: 'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?w=600' },
  { label: 'Bắp Rang Bơ Vàng', url: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=600' },
  { label: 'Bắp Phô Mai / Caramel', url: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=600' },
  { label: 'Nước Ngọt Coca / Sprite', url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=600' },
  { label: 'Trà Đào / Nước Ép', url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600' }
];

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
  const [menuFilter, setMenuFilter] = useState<'ALL' | 'COMBO' | 'FOOD' | 'BEVERAGE'>('ALL');
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

  // Product Form State mở rộng quản lý chi tiết Bắp & Nước
  const [productForm, setProductForm] = useState<{
    id?: string;
    name: string;
    product_type: ProductType;
    sub_category: string;
    base_price: number;
    available_stock: number;
    inventory_tracking: boolean;
    active: boolean;
    image_url: string;
    description: string;
    size: string;
    flavors: string[];
    default_flavor: string;
    combo_details: {
      has_popcorn: boolean;
      popcorn_quantity: number;
      popcorn_size: string;
      popcorn_flavors: string[];
      has_drink: boolean;
      drink_quantity: number;
      drink_size: string;
      drink_types: string[];
      extra_items: string;
    };
  }>({
    name: '',
    product_type: 'COMBO',
    sub_category: 'POPCORN',
    base_price: 79000,
    available_stock: 120,
    inventory_tracking: true,
    active: true,
    image_url: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=600',
    description: '1 Bắp lớn 85oz (Bơ/Phô mai) + 2 Ly nước ngọt 32oz (Coca/Sprite)',
    size: 'Lớn (85oz)',
    flavors: ['Bơ truyền thống', 'Phô mai lắc'],
    default_flavor: 'Bơ truyền thống',
    combo_details: {
      has_popcorn: true,
      popcorn_quantity: 1,
      popcorn_size: 'Lớn (85oz)',
      popcorn_flavors: ['Bơ truyền thống', 'Phô mai lắc', 'Caramel ngọt đậm'],
      has_drink: true,
      drink_quantity: 2,
      drink_size: 'Lớn (32oz)',
      drink_types: ['Coca-Cola Original', 'Coca-Cola Zero (Không đường)', 'Sprite Chanh Bạc Hà'],
      extra_items: ''
    }
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

  // Helper sinh mô tả tự động chuẩn cinema
  const autoGenerateDescription = () => {
    let desc = '';
    if (productForm.product_type === 'COMBO') {
      const cd = productForm.combo_details;
      const parts: string[] = [];
      if (cd.has_popcorn && cd.popcorn_quantity > 0) {
        const pFlavors = cd.popcorn_flavors.length > 0 ? ` (Vị: ${cd.popcorn_flavors.join('/')})` : '';
        parts.push(`${cd.popcorn_quantity} Bắp ${cd.popcorn_size}${pFlavors}`);
      }
      if (cd.has_drink && cd.drink_quantity > 0) {
        const dTypes = cd.drink_types.length > 0 ? ` (${cd.drink_types.join('/')})` : '';
        parts.push(`${cd.drink_quantity} Ly nước ${cd.drink_size}${dTypes}`);
      }
      if (cd.extra_items.trim()) {
        parts.push(cd.extra_items.trim());
      }
      desc = parts.join(' + ');
    } else if (productForm.product_type === 'FOOD') {
      const fFlavors = productForm.flavors.length > 0 ? ` • Tùy chọn vị: ${productForm.flavors.join(', ')}` : '';
      desc = `Phần bắp ${productForm.size} vàng óng giòn rụm thơm lừng${fFlavors}.`;
    } else {
      const dFlavors = productForm.flavors.length > 0 ? ` • Vị/Loại: ${productForm.flavors.join(', ')}` : '';
      desc = `Nước giải khát mát lạnh sảng khoái ly ${productForm.size}${dFlavors}.`;
    }
    setProductForm((prev) => ({ ...prev, description: desc }));
    showToast('Đã tự động tạo mô tả chuẩn theo cấu hình bắp nước!');
  };

  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      product_type: 'COMBO',
      sub_category: 'POPCORN',
      base_price: 79000,
      available_stock: 120,
      inventory_tracking: true,
      active: true,
      image_url: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=600',
      description: '1 Bắp lớn 85oz (Bơ/Phô mai) + 2 Ly nước ngọt 32oz (Coca/Sprite)',
      size: 'Lớn (85oz)',
      flavors: ['Bơ truyền thống', 'Phô mai lắc'],
      default_flavor: 'Bơ truyền thống',
      combo_details: {
        has_popcorn: true,
        popcorn_quantity: 1,
        popcorn_size: 'Lớn (85oz)',
        popcorn_flavors: ['Bơ truyền thống', 'Phô mai lắc', 'Caramel ngọt đậm'],
        has_drink: true,
        drink_quantity: 2,
        drink_size: 'Lớn (32oz)',
        drink_types: ['Coca-Cola Original', 'Coca-Cola Zero (Không đường)', 'Sprite Chanh Bạc Hà'],
        extra_items: ''
      }
    });
    setProductModalOpen(true);
  };

  const openEditProductModal = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      id: p.id,
      name: p.name,
      product_type: p.product_type,
      sub_category: p.sub_category || (p.product_type === 'BEVERAGE' ? 'CARBONATED_DRINK' : 'POPCORN'),
      base_price: p.base_price,
      available_stock: p.available_stock,
      inventory_tracking: p.inventory_tracking,
      active: p.active !== false,
      image_url: p.image_url || '',
      description: p.description || '',
      size: p.size || (p.product_type === 'BEVERAGE' ? 'Lớn (32oz)' : 'Lớn (85oz)'),
      flavors: p.flavors && p.flavors.length > 0 ? p.flavors : ['Bơ truyền thống', 'Phô mai lắc'],
      default_flavor: p.default_flavor || 'Bơ truyền thống',
      combo_details: {
        has_popcorn: p.combo_details?.has_popcorn !== false,
        popcorn_quantity: p.combo_details?.popcorn_quantity ?? 1,
        popcorn_size: p.combo_details?.popcorn_size || 'Lớn (85oz)',
        popcorn_flavors: p.combo_details?.popcorn_flavors?.length
          ? p.combo_details.popcorn_flavors
          : ['Bơ truyền thống', 'Phô mai lắc'],
        has_drink: p.combo_details?.has_drink !== false,
        drink_quantity: p.combo_details?.drink_quantity ?? 2,
        drink_size: p.combo_details?.drink_size || 'Lớn (32oz)',
        drink_types: p.combo_details?.drink_types?.length
          ? p.combo_details.drink_types
          : ['Coca-Cola Original', 'Sprite Chanh Bạc Hà'],
        extra_items: p.combo_details?.extra_items || ''
      }
    });
    setProductModalOpen(true);
  };

  const handleSaveProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      showToast('Vui lòng nhập tên món!');
      return;
    }

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

  // Lọc sản phẩm theo Tab và từ khóa tìm kiếm
  const filteredProducts = products.filter((p) => {
    if (menuFilter === 'COMBO' && p.product_type !== 'COMBO') return false;
    if (menuFilter === 'FOOD' && p.product_type !== 'FOOD') return false;
    if (menuFilter === 'BEVERAGE' && p.product_type !== 'BEVERAGE') return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q);
      const matchFlavors = p.flavors?.some((f) => f.toLowerCase().includes(q));
      const matchDrinkTypes = p.combo_details?.drink_types?.some((d) => d.toLowerCase().includes(q));
      const matchPopcornFlavors = p.combo_details?.popcorn_flavors?.some((pf) => pf.toLowerCase().includes(q));
      return matchName || matchDesc || matchFlavors || matchDrinkTypes || matchPopcornFlavors;
    }
    return true;
  });

  const comboCount = products.filter((p) => p.product_type === 'COMBO').length;
  const foodCount = products.filter((p) => p.product_type === 'FOOD').length;
  const bevCount = products.filter((p) => p.product_type === 'BEVERAGE').length;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Bar: Sub Tabs + Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#222B3D] pb-3">
        {/* Sub Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          {[
            { id: 'MENU', label: 'Thực Đơn Bắp Nước (F&B)', icon: Coffee, count: products.length },
            { id: 'MODIFIERS', label: 'Tùy Chọn Đổi Vị / Size', icon: Sliders, count: modifiers.length },
            { id: 'INVENTORY', label: 'Sổ Biến Động Kho', icon: FileText },
            { id: 'KDS', label: 'Màn Hình Trả Món (KDS)', icon: ScanLine }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#FABF2E] text-black shadow-md shadow-[#FABF2E]/20'
                    : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isActive ? 'bg-black/20 text-black' : 'bg-[#1F2739] text-[#8E9AAF]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setMovementModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-[#1F2739] hover:bg-[#28324A] text-white text-xs font-bold border border-[#303B52] flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#FABF2E]" />
            <span>Phiếu Kho</span>
          </button>

          <button
            onClick={openAddProductModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#E63845] to-[#F43F5E] hover:from-[#D42B38] hover:to-[#E11D48] text-white text-xs font-bold shadow-lg shadow-[#E63845]/25 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Món / Combo Mới</span>
          </button>
        </div>
      </div>

      {/* TAB 1: MENU PRODUCTS & COMBOS */}
      {activeSubTab === 'MENU' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0E121B] border border-[#20293B] p-2.5 rounded-2xl">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'ALL', label: 'Tất Cả', count: products.length },
                { id: 'COMBO', label: '🍿 Combo Bắp Nước', count: comboCount },
                { id: 'FOOD', label: '🍿 Bắp Rang (Popcorn)', count: foodCount },
                { id: 'BEVERAGE', label: '🥤 Nước Uống (Drink)', count: bevCount }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setMenuFilter(btn.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    menuFilter === btn.id
                      ? 'bg-[#E63845] text-white shadow-md shadow-[#E63845]/25'
                      : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
                  }`}
                >
                  <span>{btn.label}</span>
                  <span className="ml-1.5 text-[10px] opacity-75">({btn.count})</span>
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E9AAF]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm món, vị bắp, loại nước..."
                className="w-full bg-[#141924] border border-[#222B3D] focus:border-[#06B6D4] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#5C677D] focus:outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E9AAF] hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center bg-[#121622] border border-[#222B3D] rounded-3xl space-y-3">
              <ShoppingBag className="w-10 h-10 text-[#5C677D] mx-auto" />
              <p className="text-sm font-bold text-white">Không tìm thấy sản phẩm bắp nước nào phù hợp!</p>
              <p className="text-xs text-[#8E9AAF]">Thử đổi từ khóa tìm kiếm hoặc bấm Thêm Món Mới để bổ sung.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const isCombo = product.product_type === 'COMBO';
                const isFood = product.product_type === 'FOOD';
                const isBev = product.product_type === 'BEVERAGE';
                const cd = product.combo_details;

                return (
                  <div
                    key={product.id}
                    className="bg-[#121622] border border-[#222B3D] hover:border-[#384663] rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm hover:shadow-xl"
                  >
                    <div>
                      {/* Top Header: Image, Title, Price, Type Badge */}
                      <div className="flex gap-3.5">
                        <div className="w-20 h-24 rounded-xl bg-[#1A1F2C] border border-[#263147] overflow-hidden shrink-0 relative">
                          <img
                            src={product.image_url || 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=600'}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <span
                            className={`absolute top-1 left-1 px-1.5 py-0.2 rounded text-[8px] font-black uppercase shadow-md ${
                              isCombo
                                ? 'bg-[#E63845] text-white'
                                : isFood
                                ? 'bg-[#FABF2E] text-black'
                                : 'bg-[#06B6D4] text-black'
                            }`}
                          >
                            {product.product_type}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <h3 className="font-bold text-white text-sm truncate" title={product.name}>
                            {product.name}
                          </h3>
                          <div className="text-base font-black text-[#FABF2E] font-mono">
                            {product.base_price.toLocaleString('vi-VN')} đ
                          </div>
                          {product.description && (
                            <p className="text-[11px] text-[#8E9AAF] line-clamp-2 leading-relaxed">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Detailed Breakdown Badges: Nước là gì, số lượng, bắp gì, vị gì */}
                      <div className="mt-3 pt-2.5 border-t border-[#1C2434] space-y-2 text-xs">
                        {/* Chi tiết cho Combo */}
                        {isCombo && (
                          <div className="space-y-1.5 bg-[#0D121B] p-2.5 rounded-xl border border-[#1E2638]">
                            {/* Phần Bắp */}
                            {cd?.has_popcorn !== false && (
                              <div className="flex items-start gap-1.5 text-[11px]">
                                <span className="font-bold text-[#FABF2E] shrink-0">🍿 Bắp:</span>
                                <div className="text-[#E2E8F0] leading-tight">
                                  <span className="font-semibold text-white">
                                    {cd?.popcorn_quantity || 1}x {cd?.popcorn_size || 'Lớn (85oz)'}
                                  </span>
                                  {cd?.popcorn_flavors && cd.popcorn_flavors.length > 0 && (
                                    <span className="text-[#8E9AAF] ml-1">
                                      (Vị: {cd.popcorn_flavors.join(', ')})
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Phần Nước */}
                            {cd?.has_drink !== false && (
                              <div className="flex items-start gap-1.5 text-[11px]">
                                <span className="font-bold text-[#06B6D4] shrink-0">🥤 Nước:</span>
                                <div className="text-[#E2E8F0] leading-tight">
                                  <span className="font-semibold text-white">
                                    {cd?.drink_quantity || 2}x {cd?.drink_size || 'Lớn (32oz)'}
                                  </span>
                                  {cd?.drink_types && cd.drink_types.length > 0 && (
                                    <span className="text-[#8E9AAF] ml-1">
                                      ({cd.drink_types.join(', ')})
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Quà / Món kèm */}
                            {cd?.extra_items && (
                              <div className="flex items-start gap-1.5 text-[11px]">
                                <span className="font-bold text-[#A855F7] shrink-0">🎁 Kèm:</span>
                                <span className="text-white font-medium">{cd.extra_items}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Chi tiết cho Món Lẻ Bắp Rang */}
                        {isFood && (
                          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-[#1A2232] text-[#FABF2E] font-medium border border-[#2B3952]">
                              🍿 Cỡ: {product.size || 'Lớn (85oz)'}
                            </span>
                            {product.flavors && product.flavors.length > 0 && (
                              <span className="px-2 py-0.5 rounded bg-[#1A2232] text-[#E2E8F0] font-medium border border-[#2B3952]">
                                🧂 Vị: {product.flavors.join(', ')}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Chi tiết cho Món Lẻ Nước Uống */}
                        {isBev && (
                          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-[#1A2232] text-[#06B6D4] font-medium border border-[#2B3952]">
                              🥤 Cỡ ly: {product.size || 'Lớn (32oz)'}
                            </span>
                            {product.flavors && product.flavors.length > 0 && (
                              <span className="px-2 py-0.5 rounded bg-[#1A2232] text-[#E2E8F0] font-medium border border-[#2B3952]">
                                🧊 Loại: {product.flavors.join(', ')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Status & Actions */}
                    <div className="mt-3 pt-2.5 border-t border-[#1F2739] flex items-center justify-between text-xs">
                      {/* Tồn kho */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#5C677D] text-[11px]">Tồn:</span>
                        <span
                          className={`font-mono font-bold text-xs ${
                            product.available_stock < 20
                              ? 'text-[#EF4444]'
                              : product.available_stock < 50
                              ? 'text-[#FABF2E]'
                              : 'text-[#22C55E]'
                          }`}
                        >
                          {product.available_stock} phần
                        </span>
                        {product.active !== false ? (
                          <span className="w-2 h-2 rounded-full bg-[#22C55E] ml-1" title="Đang kinh doanh" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-[#EF4444] ml-1" title="Tạm ngưng" />
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditProductModal(product)}
                          title="Chỉnh sửa chi tiết bắp nước"
                          className="px-2.5 py-1.5 rounded-lg bg-[#1A202E] hover:bg-[#28324A] text-[#8E9AAF] hover:text-white transition-all cursor-pointer flex items-center gap-1 font-semibold text-[11px]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Sửa</span>
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
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MODIFIERS (TÙY CHỌN ĐỔI VỊ / SIZE) */}
      {activeSubTab === 'MODIFIERS' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#222B3D] pb-2 text-xs">
            <span className="font-bold text-white">Danh Sách Biến Thể & Phụ Phí Đổi Vị</span>
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
                              ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#222B3D]'
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

      {/* Modal: Thêm Món / Chỉnh Sửa Chi Tiết Sản Phẩm F&B (Chuyên nghiệp, chi tiết Bắp, Nước, Vị, Số Lượng) */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#121622] border border-[#26334D] rounded-3xl w-full max-w-2xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#222B3D] flex items-center justify-between bg-[#0E121B] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E63845] to-[#F43F5E] flex items-center justify-center text-white shadow-lg shadow-[#E63845]/25">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {editingProduct ? 'Chỉnh Sửa Sản Phẩm F&B' : 'Thêm Món / Combo Bắp Nước Mới'}
                  </h3>
                  <p className="text-xs text-[#8E9AAF]">
                    Cấu hình chi tiết bắp (vị, cỡ, số lượng) và nước (loại, cỡ ly, số lượng)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Scroll */}
            <form onSubmit={handleSaveProductSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs">
              {/* PHẦN 1: CHỌN LOẠI HÌNH SẢN PHẨM (3 THẺ LỰA CHỌN TRỰC QUAN) */}
              <div className="space-y-2">
                <label className="text-[#8E9AAF] font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#FABF2E]" />
                  <span>Phân loại sản phẩm *</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'COMBO',
                      title: 'Combo Bắp Nước',
                      desc: 'Gồm nhiều bắp + nhiều nước',
                      icon: '🍿🥤',
                      color: 'border-[#E63845] bg-[#E63845]/10 text-[#E63845]'
                    },
                    {
                      id: 'FOOD',
                      title: 'Bắp Rang / Đồ Ăn',
                      desc: 'Bắp rang lẻ, snack, món nóng',
                      icon: '🍿',
                      color: 'border-[#FABF2E] bg-[#FABF2E]/10 text-[#FABF2E]'
                    },
                    {
                      id: 'BEVERAGE',
                      title: 'Nước Uống / Trà',
                      desc: 'Nước ngọt có ga, trà, nước suối',
                      icon: '🥤',
                      color: 'border-[#06B6D4] bg-[#06B6D4]/10 text-[#06B6D4]'
                    }
                  ].map((cat) => {
                    const isSelected = productForm.product_type === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setProductForm((prev) => ({ ...prev, product_type: cat.id as any }));
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between select-none ${
                          isSelected
                            ? `${cat.color} ring-2 ring-current font-bold`
                            : 'bg-[#141924] border-[#222B3D] text-[#8E9AAF] hover:text-white hover:border-[#384663]'
                        }`}
                      >
                        <div className="text-xl mb-1">{cat.icon}</div>
                        <div className="font-bold text-xs text-white">{cat.title}</div>
                        <div className="text-[10px] opacity-75 mt-0.5">{cat.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PHẦN 2: THÔNG TIN CƠ BẢN (TÊN, GIÁ, TỒN KHO) */}
              <div className="p-4 rounded-2xl bg-[#0E121B] border border-[#1E2638] space-y-3.5">
                {/* Tên món */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-white font-bold text-xs">Tên món bắp nước / Combo *</label>
                    <span className="text-[10px] text-[#8E9AAF]">Gợi ý:</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Vd: Combo Couple Hẹn Hò (1 Bắp Lớn + 2 Nước)"
                    className="w-full bg-[#141924] border border-[#222B3D] focus:border-[#E63845] rounded-xl px-3.5 py-2.5 text-white font-medium text-xs focus:outline-none"
                  />
                  {/* Quick name chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {[
                      'Combo Solo (1 Bắp + 1 Nước)',
                      'Combo Couple (1 Bắp Lớn + 2 Nước)',
                      'Combo Family (2 Bắp + 3 Nước)',
                      'Bắp Rang Bơ Thượng Hạng',
                      'Bắp Phô Mai Lắc',
                      'Bắp Ngọt Caramel',
                      'Coca-Cola 32oz',
                      'Sprite Chanh 32oz',
                      'Trà Đào Hạt Chia'
                    ].map((nameSuggestion) => (
                      <button
                        key={nameSuggestion}
                        type="button"
                        onClick={() => setProductForm((prev) => ({ ...prev, name: nameSuggestion }))}
                        className="px-2 py-0.5 rounded-lg bg-[#182030] hover:bg-[#222D42] text-[10px] text-[#8E9AAF] hover:text-white border border-[#25324A] transition-colors cursor-pointer"
                      >
                        + {nameSuggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Giá bán, Tồn kho, Trạng thái */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[#8E9AAF] font-medium text-[11px]">Giá bán cơ bản (VND) *</label>
                    <input
                      type="number"
                      step={1000}
                      min={0}
                      required
                      value={productForm.base_price}
                      onChange={(e) =>
                        setProductForm({ ...productForm, base_price: Number(e.target.value) })
                      }
                      className="w-full bg-[#141924] border border-[#222B3D] focus:border-[#FABF2E] rounded-xl px-3 py-2 text-white font-mono font-bold text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#8E9AAF] font-medium text-[11px]">Tồn kho khả dụng (phần) *</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={productForm.available_stock}
                      onChange={(e) =>
                        setProductForm({ ...productForm, available_stock: Number(e.target.value) })
                      }
                      className="w-full bg-[#141924] border border-[#222B3D] focus:border-[#22C55E] rounded-xl px-3 py-2 text-white font-mono font-bold text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#8E9AAF] font-medium text-[11px]">Trạng thái kinh doanh</label>
                    <div className="flex items-center gap-2 bg-[#141924] border border-[#222B3D] rounded-xl px-2 py-1.5 h-[35px]">
                      <label className="flex items-center gap-1 text-white cursor-pointer select-none text-[11px] flex-1">
                        <input
                          type="radio"
                          name="productActiveRadio"
                          checked={productForm.active}
                          onChange={() => setProductForm({ ...productForm, active: true })}
                          className="w-3 h-3 accent-[#22C55E]"
                        />
                        <span className="text-[#22C55E] font-bold">Đang bán</span>
                      </label>
                      <label className="flex items-center gap-1 text-white cursor-pointer select-none text-[11px] flex-1">
                        <input
                          type="radio"
                          name="productActiveRadio"
                          checked={!productForm.active}
                          onChange={() => setProductForm({ ...productForm, active: false })}
                          className="w-3 h-3 accent-[#EF4444]"
                        />
                        <span className="text-[#EF4444] font-bold">Tạm ngưng</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* PHẦN 3: CẤU HÌNH CHI TIẾT BẮP, NƯỚC, VỊ & SỐ LƯỢNG (THEO PHÂN LOẠI) */}
              {/* TRƯỜNG HỢP 1: COMBO BẮP NƯỚC */}
              {productForm.product_type === 'COMBO' && (
                <div className="space-y-3 p-4 rounded-2xl bg-[#0E121B] border border-[#E63845]/30">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1E2638]">
                    <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#FABF2E]" />
                      <span>Cấu hình định lượng & Tùy chọn vị trong Combo</span>
                    </span>
                    <button
                      type="button"
                      onClick={autoGenerateDescription}
                      className="px-2.5 py-1 rounded-lg bg-[#E63845]/20 hover:bg-[#E63845] text-white font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Tự sinh mô tả chuẩn</span>
                    </button>
                  </div>

                  {/* KHUNG BẮP TRONG COMBO */}
                  <div className="p-3.5 rounded-xl bg-[#141926] border border-[#25324A] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-white font-bold text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={productForm.combo_details.has_popcorn}
                          onChange={(e) =>
                            setProductForm((prev) => ({
                              ...prev,
                              combo_details: { ...prev.combo_details, has_popcorn: e.target.checked }
                            }))
                          }
                          className="w-4 h-4 accent-[#FABF2E] rounded cursor-pointer"
                        />
                        <span className="text-[#FABF2E]">🍿 Bao gồm Bắp Rang trong Combo</span>
                      </label>
                    </div>

                    {productForm.combo_details.has_popcorn && (
                      <div className="space-y-3 pt-1 border-t border-[#1F293D] animate-in fade-in duration-150">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Số lượng bắp */}
                          <div className="space-y-1">
                            <label className="text-[#8E9AAF] text-[11px] font-medium">Số lượng phần bắp:</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={productForm.combo_details.popcorn_quantity}
                                onChange={(e) =>
                                  setProductForm((prev) => ({
                                    ...prev,
                                    combo_details: {
                                      ...prev.combo_details,
                                      popcorn_quantity: Math.max(1, Number(e.target.value))
                                    }
                                  }))
                                }
                                className="w-20 bg-[#0E121B] border border-[#222B3D] rounded-xl px-3 py-1.5 text-white font-mono font-bold text-xs text-center"
                              />
                              <span className="text-[#8E9AAF] text-xs">phần</span>
                            </div>
                          </div>

                          {/* Kích cỡ bắp */}
                          <div className="space-y-1">
                            <label className="text-[#8E9AAF] text-[11px] font-medium">Kích cỡ bắp:</label>
                            <select
                              value={productForm.combo_details.popcorn_size}
                              onChange={(e) =>
                                setProductForm((prev) => ({
                                  ...prev,
                                  combo_details: { ...prev.combo_details, popcorn_size: e.target.value }
                                }))
                              }
                              className="w-full bg-[#0E121B] border border-[#222B3D] rounded-xl px-3 py-1.5 text-white text-xs font-semibold focus:outline-none"
                            >
                              {POPCORN_SIZES.map((sz) => (
                                <option key={sz} value={sz}>
                                  {sz}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Các vị bắp cho phép khách chọn */}
                        <div className="space-y-1.5">
                          <label className="text-[#8E9AAF] text-[11px] font-medium">
                            Các vị bắp cho phép khách chọn trong combo:
                          </label>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {POPCORN_FLAVORS.map((flav) => {
                              const isChecked = productForm.combo_details.popcorn_flavors.includes(flav);
                              return (
                                <button
                                  key={flav}
                                  type="button"
                                  onClick={() => {
                                    setProductForm((prev) => {
                                      const current = prev.combo_details.popcorn_flavors;
                                      const next = isChecked
                                        ? current.filter((f) => f !== flav)
                                        : [...current, flav];
                                      return {
                                        ...prev,
                                        combo_details: { ...prev.combo_details, popcorn_flavors: next }
                                      };
                                    });
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                    isChecked
                                      ? 'bg-[#FABF2E] text-black border-[#FABF2E]'
                                      : 'bg-[#0E121B] text-[#8E9AAF] border-[#222B3D] hover:text-white'
                                  }`}
                                >
                                  {isChecked ? <Check className="w-3 h-3 stroke-[3]" /> : null}
                                  <span>{flav}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* KHUNG NƯỚC TRONG COMBO */}
                  <div className="p-3.5 rounded-xl bg-[#141926] border border-[#25324A] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-white font-bold text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={productForm.combo_details.has_drink}
                          onChange={(e) =>
                            setProductForm((prev) => ({
                              ...prev,
                              combo_details: { ...prev.combo_details, has_drink: e.target.checked }
                            }))
                          }
                          className="w-4 h-4 accent-[#06B6D4] rounded cursor-pointer"
                        />
                        <span className="text-[#06B6D4]">🥤 Bao gồm Nước Ngọt / Nước Uống trong Combo</span>
                      </label>
                    </div>

                    {productForm.combo_details.has_drink && (
                      <div className="space-y-3 pt-1 border-t border-[#1F293D] animate-in fade-in duration-150">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Số lượng nước */}
                          <div className="space-y-1">
                            <label className="text-[#8E9AAF] text-[11px] font-medium">Số lượng ly nước:</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={productForm.combo_details.drink_quantity}
                                onChange={(e) =>
                                  setProductForm((prev) => ({
                                    ...prev,
                                    combo_details: {
                                      ...prev.combo_details,
                                      drink_quantity: Math.max(1, Number(e.target.value))
                                    }
                                  }))
                                }
                                className="w-20 bg-[#0E121B] border border-[#222B3D] rounded-xl px-3 py-1.5 text-white font-mono font-bold text-xs text-center"
                              />
                              <span className="text-[#8E9AAF] text-xs">ly</span>
                            </div>
                          </div>

                          {/* Cỡ ly nước */}
                          <div className="space-y-1">
                            <label className="text-[#8E9AAF] text-[11px] font-medium">Cỡ ly nước:</label>
                            <select
                              value={productForm.combo_details.drink_size}
                              onChange={(e) =>
                                setProductForm((prev) => ({
                                  ...prev,
                                  combo_details: { ...prev.combo_details, drink_size: e.target.value }
                                }))
                              }
                              className="w-full bg-[#0E121B] border border-[#222B3D] rounded-xl px-3 py-1.5 text-white text-xs font-semibold focus:outline-none"
                            >
                              {DRINK_SIZES.map((sz) => (
                                <option key={sz} value={sz}>
                                  {sz}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Các loại nước cho phép khách chọn */}
                        <div className="space-y-1.5">
                          <label className="text-[#8E9AAF] text-[11px] font-medium">
                            Các loại nước cho phép khách chọn trong combo:
                          </label>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {DRINK_TYPES.map((dt) => {
                              const isChecked = productForm.combo_details.drink_types.includes(dt);
                              return (
                                <button
                                  key={dt}
                                  type="button"
                                  onClick={() => {
                                    setProductForm((prev) => {
                                      const current = prev.combo_details.drink_types;
                                      const next = isChecked
                                        ? current.filter((d) => d !== dt)
                                        : [...current, dt];
                                      return {
                                        ...prev,
                                        combo_details: { ...prev.combo_details, drink_types: next }
                                      };
                                    });
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                    isChecked
                                      ? 'bg-[#06B6D4] text-black border-[#06B6D4]'
                                      : 'bg-[#0E121B] text-[#8E9AAF] border-[#222B3D] hover:text-white'
                                  }`}
                                >
                                  {isChecked ? <Check className="w-3 h-3 stroke-[3]" /> : null}
                                  <span>{dt}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* KHUNG MÓN ĂN KÈM / QUÀ TẶNG */}
                  <div className="p-3.5 rounded-xl bg-[#141926] border border-[#25324A] space-y-1.5">
                    <label className="text-[#C4B5FD] font-bold text-xs flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-[#C4B5FD]" />
                      <span>Món ăn kèm / Quà tặng trong combo (Tùy chọn)</span>
                    </label>
                    <input
                      type="text"
                      value={productForm.combo_details.extra_items}
                      onChange={(e) =>
                        setProductForm((prev) => ({
                          ...prev,
                          combo_details: { ...prev.combo_details, extra_items: e.target.value }
                        }))
                      }
                      placeholder="Vd: 1 Xúc xích nướng phô mai, 1 Khoai tây lắc, hoặc 1 Ly Avatar Limited..."
                      className="w-full bg-[#0E121B] border border-[#222B3D] rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-[#C4B5FD]"
                    />
                  </div>
                </div>
              )}

              {/* TRƯỜNG HỢP 2: FOOD (BẮP RANG / SNACK ĐƠN LẺ) */}
              {productForm.product_type === 'FOOD' && (
                <div className="space-y-3.5 p-4 rounded-2xl bg-[#0E121B] border border-[#FABF2E]/30">
                  <div className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#FABF2E]" />
                    <span>Chi tiết Bắp Rang & Hương Vị</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[#8E9AAF] text-[11px] font-medium">Kích cỡ bắp / phần:</label>
                      <select
                        value={productForm.size}
                        onChange={(e) => setProductForm((prev) => ({ ...prev, size: e.target.value }))}
                        className="w-full bg-[#141924] border border-[#222B3D] rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none"
                      >
                        {POPCORN_SIZES.map((sz) => (
                          <option key={sz} value={sz}>
                            {sz}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[#8E9AAF] text-[11px] font-medium">Vị chính mặc định:</label>
                      <select
                        value={productForm.default_flavor}
                        onChange={(e) =>
                          setProductForm((prev) => ({ ...prev, default_flavor: e.target.value }))
                        }
                        className="w-full bg-[#141924] border border-[#222B3D] rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none"
                      >
                        {POPCORN_FLAVORS.map((fl) => (
                          <option key={fl} value={fl}>
                            {fl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Danh sách các vị hỗ trợ */}
                  <div className="space-y-1.5">
                    <label className="text-[#8E9AAF] text-[11px] font-medium">
                      Các vị hỗ trợ đổi vị / lắc thêm:
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {POPCORN_FLAVORS.map((flav) => {
                        const isChecked = productForm.flavors.includes(flav);
                        return (
                          <button
                            key={flav}
                            type="button"
                            onClick={() => {
                              setProductForm((prev) => {
                                const current = prev.flavors;
                                const next = isChecked
                                  ? current.filter((f) => f !== flav)
                                  : [...current, flav];
                                return { ...prev, flavors: next };
                              });
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              isChecked
                                ? 'bg-[#FABF2E] text-black border-[#FABF2E]'
                                : 'bg-[#141924] text-[#8E9AAF] border-[#222B3D] hover:text-white'
                            }`}
                          >
                            {isChecked ? <Check className="w-3 h-3 stroke-[3]" /> : null}
                            <span>{flav}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TRƯỜNG HỢP 3: BEVERAGE (NƯỚC UỐNG / TRÀ) */}
              {productForm.product_type === 'BEVERAGE' && (
                <div className="space-y-3.5 p-4 rounded-2xl bg-[#0E121B] border border-[#06B6D4]/30">
                  <div className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>Chi tiết Nước Uống & Cỡ Ly</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[#8E9AAF] text-[11px] font-medium">Cỡ ly / Dung tích:</label>
                      <select
                        value={productForm.size}
                        onChange={(e) => setProductForm((prev) => ({ ...prev, size: e.target.value }))}
                        className="w-full bg-[#141924] border border-[#222B3D] rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none"
                      >
                        {DRINK_SIZES.map((sz) => (
                          <option key={sz} value={sz}>
                            {sz}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[#8E9AAF] text-[11px] font-medium">Vị / Loại chính:</label>
                      <select
                        value={productForm.default_flavor}
                        onChange={(e) =>
                          setProductForm((prev) => ({ ...prev, default_flavor: e.target.value }))
                        }
                        className="w-full bg-[#141924] border border-[#222B3D] rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none"
                      >
                        {DRINK_TYPES.map((dt) => (
                          <option key={dt} value={dt}>
                            {dt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Danh sách các loại/vị nước hỗ trợ */}
                  <div className="space-y-1.5">
                    <label className="text-[#8E9AAF] text-[11px] font-medium">
                      Các loại nước khách có thể chọn:
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {DRINK_TYPES.map((dt) => {
                        const isChecked = productForm.flavors.includes(dt);
                        return (
                          <button
                            key={dt}
                            type="button"
                            onClick={() => {
                              setProductForm((prev) => {
                                const current = prev.flavors;
                                const next = isChecked
                                  ? current.filter((d) => d !== dt)
                                  : [...current, dt];
                                return { ...prev, flavors: next };
                              });
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              isChecked
                                ? 'bg-[#06B6D4] text-black border-[#06B6D4]'
                                : 'bg-[#141924] text-[#8E9AAF] border-[#222B3D] hover:text-white'
                            }`}
                          >
                            {isChecked ? <Check className="w-3 h-3 stroke-[3]" /> : null}
                            <span>{dt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* PHẦN 4: MÔ TẢ & HÌNH ẢNH MÓN */}
              <div className="p-4 rounded-2xl bg-[#0E121B] border border-[#1E2638] space-y-3.5">
                {/* Mô tả tóm tắt */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-white font-bold text-xs">Mô tả chi tiết hiển thị cho khách</label>
                    <button
                      type="button"
                      onClick={autoGenerateDescription}
                      className="text-[#06B6D4] hover:underline text-[11px] flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Tạo mô tả tự động</span>
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    placeholder="Vd: 1 Bắp lớn 85oz (Bơ/Phô mai) + 2 Ly nước ngọt 32oz (Coca/Sprite mát lạnh)"
                    className="w-full bg-[#141924] border border-[#222B3D] focus:border-[#E63845] rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* URL Hình ảnh & Thư viện preset ảnh rạp chiếu phim */}
                <div className="space-y-2">
                  <label className="text-white font-bold text-xs">Hình ảnh món bắp nước</label>
                  <input
                    type="text"
                    value={productForm.image_url}
                    onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-[#141924] border border-[#222B3D] focus:border-[#E63845] rounded-xl px-3.5 py-2 text-white font-mono text-[11px] focus:outline-none"
                  />

                  {/* Preset thumbnails */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#8E9AAF]">Chọn nhanh ảnh đẹp chuẩn rạp:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      {PRESET_IMAGES.map((img) => (
                        <button
                          key={img.label}
                          type="button"
                          onClick={() => setProductForm((prev) => ({ ...prev, image_url: img.url }))}
                          className={`flex items-center gap-2 p-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                            productForm.image_url === img.url
                              ? 'border-[#FABF2E] bg-[#FABF2E]/10 text-white font-bold'
                              : 'border-[#222B3D] bg-[#141924] text-[#8E9AAF] hover:text-white hover:border-[#384663]'
                          }`}
                        >
                          <img src={img.url} alt={img.label} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                          <span className="text-[10px] truncate">{img.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1E2638]">
                {editingProduct && onDeleteProduct ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmProduct({ id: editingProduct.id, name: editingProduct.name });
                      setProductModalOpen(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#3B191C] hover:bg-[#EF4444] text-[#EF4444] hover:text-white font-bold transition-all flex items-center gap-2 cursor-pointer text-xs"
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
                    className="px-4 py-2.5 rounded-xl bg-[#1A202E] text-[#8E9AAF] font-bold cursor-pointer hover:text-white transition-colors text-xs"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#E63845] to-[#F43F5E] hover:from-[#D42B38] hover:to-[#E11D48] text-white font-bold cursor-pointer shadow-lg shadow-[#E63845]/30 transition-all text-xs flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingProduct ? 'Lưu Thay Đổi' : 'Lưu & Đăng Bán'}</span>
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
                className="px-4 py-2.5 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white font-bold transition-all cursor-pointer text-xs"
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
                className="px-5 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold transition-all shadow-lg shadow-[#EF4444]/30 cursor-pointer text-xs"
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
