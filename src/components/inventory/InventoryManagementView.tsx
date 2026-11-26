import React, { useState } from 'react';
import {
  Package,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Sliders,
  AlertTriangle,
  Search,
  Filter,
  Building2,
  Plus,
  Download,
  CheckCircle2,
  RotateCcw,
  Tag,
  DollarSign,
  TrendingUp,
  Warehouse,
  History,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProductItem, StockMovement } from '../../types';

const STOCK_MOVEMENTS_KEY = 'mro_stock_movements';

export const InventoryManagementView: React.FC = () => {
  const { products, updateProduct } = useApp();

  const [activeTab, setActiveTab] = useState<'STOCK_SUMMARY' | 'MOVEMENTS' | 'WAREHOUSES' | 'LOW_STOCK'>('STOCK_SUMMARY');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'STOCK_MANAGED' | 'DIRECT_PROCUREMENT'>('ALL');

  // Stock movements log
  const [movements, setMovements] = useState<StockMovement[]>(() => {
    try {
      const raw = localStorage.getItem(STOCK_MOVEMENTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}

    return [
      {
        id: 'STK-MOV-0001',
        date: '2026-10-10',
        productId: 'PRD-001',
        productName: 'Deep Groove Ball Bearing 6206-2RS-C3',
        type: 'PURCHASE_RECEIPT',
        quantity: 100,
        balanceAfter: 150,
        unitCost: 290,
        totalValue: 29000,
        referenceType: 'VENDOR_PO',
        referenceId: 'VPO-2026-00001',
        notes: 'Received batch from Apex Industrial Solutions',
      },
      {
        id: 'STK-MOV-0002',
        date: '2026-10-11',
        productId: 'PRD-001',
        productName: 'Deep Groove Ball Bearing 6206-2RS-C3',
        type: 'SALES_ISSUE',
        quantity: 50,
        balanceAfter: 100,
        unitCost: 290,
        totalValue: 14500,
        referenceType: 'INVOICE',
        referenceId: 'INV-2026-00001',
        notes: 'Issued to Tata Motors Sanand Plant consignment',
      },
      {
        id: 'STK-MOV-0003',
        date: '2026-10-12',
        productId: 'PRD-002',
        productName: 'High Performance Timing Belt HTD 1440-8M-50',
        type: 'PURCHASE_RECEIPT',
        quantity: 30,
        balanceAfter: 45,
        unitCost: 1150,
        totalValue: 34500,
        referenceType: 'VENDOR_PO',
        referenceId: 'VPO-2026-00002',
        notes: 'Fenner timing belts stock replenish',
      },
    ];
  });

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [adjustType, setAdjustType] = useState<'PURCHASE_RECEIPT' | 'SALES_ISSUE' | 'MANUAL_ADJUSTMENT' | 'DAMAGE'>('MANUAL_ADJUSTMENT');
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [adjustUnitCost, setAdjustUnitCost] = useState<number>(300);
  const [adjustNotes, setAdjustNotes] = useState('');

  const warehouses = [
    { id: 'WH-01', name: 'Central Stores - Vatva GIDC', city: 'Ahmedabad, Gujarat', capacity: '15,000 sq ft', manager: 'Manoj Patel' },
    { id: 'WH-02', name: 'Sanand Transit Depot', city: 'Sanand, Gujarat', capacity: '5,000 sq ft', manager: 'Vikas Sharma' },
    { id: 'WH-03', name: 'Jamshedpur Heavy Spares Yard', city: 'Jamshedpur, Jharkhand', capacity: '8,000 sq ft', manager: 'Amitabh Sen' },
  ];

  // Calculations
  const stockManagedProducts = products.filter((p) => p.isStockManaged !== false);
  const directProcurementProducts = products.filter((p) => p.isStockManaged === false);

  const totalStockValuation = stockManagedProducts.reduce((sum, p) => {
    const qty = p.stockQty || 0;
    const rate = p.costPrice || p.approxRate || 350;
    return sum + qty * rate;
  }, 0);

  const lowStockCount = stockManagedProducts.filter((p) => {
    const qty = p.stockQty || 0;
    const min = p.minStockLevel || 15;
    return qty <= min;
  }).length;

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.itemName.toLowerCase().includes(q) ||
      p.partNumber.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      (p.hsnCode && p.hsnCode.includes(q));

    const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesWh = warehouseFilter === 'ALL' || (p.warehouse || 'Central Stores - Vatva GIDC').includes(warehouseFilter);
    const matchesType =
      typeFilter === 'ALL' ||
      (typeFilter === 'STOCK_MANAGED' && p.isStockManaged !== false) ||
      (typeFilter === 'DIRECT_PROCUREMENT' && p.isStockManaged === false);

    return matchesSearch && matchesCat && matchesWh && matchesType;
  });

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const currentQty = selectedProduct.stockQty || 0;
    let newQty = currentQty;

    if (adjustType === 'PURCHASE_RECEIPT') {
      newQty = currentQty + adjustQty;
    } else if (adjustType === 'SALES_ISSUE' || adjustType === 'DAMAGE') {
      newQty = Math.max(0, currentQty - adjustQty);
    } else {
      // Manual adjustment sets exact or delta
      newQty = adjustQty;
    }

    // Update Product Stock
    updateProduct({
      ...selectedProduct,
      stockQty: newQty,
      costPrice: adjustUnitCost || selectedProduct.costPrice,
    });

    // Record movement
    const newMov: StockMovement = {
      id: `STK-MOV-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      productId: selectedProduct.id,
      productName: selectedProduct.itemName,
      type: adjustType,
      quantity: adjustQty,
      balanceAfter: newQty,
      unitCost: adjustUnitCost,
      totalValue: adjustQty * adjustUnitCost,
      notes: adjustNotes || 'Manual stock update',
    };

    const updated = [newMov, ...movements];
    setMovements(updated);
    localStorage.setItem(STOCK_MOVEMENTS_KEY, JSON.stringify(updated));

    setIsAdjustModalOpen(false);
    setSelectedProduct(null);
  };

  const handleToggleStockManaged = (prod: ProductItem) => {
    const current = prod.isStockManaged !== false;
    updateProduct({
      ...prod,
      isStockManaged: !current,
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Inventory & Material Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Vyapar Stock System
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time stock valuation, multi-warehouse tracking, stock movements, and low-stock alerts
          </p>
        </div>

        {/* Action Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
          {[
            { id: 'STOCK_SUMMARY', label: 'Stock Summary', icon: Package },
            { id: 'MOVEMENTS', label: 'Stock In/Out Log', icon: History, count: movements.length },
            { id: 'LOW_STOCK', label: 'Low Stock Alerts', icon: AlertTriangle, count: lowStockCount },
            { id: 'WAREHOUSES', label: 'Warehouses', icon: Warehouse, count: warehouses.length },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{t.label}</span>
                {typeof t.count === 'number' && t.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      t.id === 'LOW_STOCK' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase">
            <span>Total Stock Valuation</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            ₹{totalStockValuation.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            Across {stockManagedProducts.length} Stock-Managed SKUs
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase">
            <span>Total Catalog Items</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            {products.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {stockManagedProducts.length} In-Stock • {directProcurementProducts.length} Direct Sourcing
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase">
            <span>Low Stock Items</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1 font-mono">
            {lowStockCount}
          </div>
          <div className="text-[11px] text-rose-700 font-semibold mt-1">
            Requires Reorder / Replenishment
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase">
            <span>Active Warehouses</span>
            <Warehouse className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            {warehouses.length}
          </div>
          <div className="text-[11px] text-indigo-600 font-semibold mt-1">
            Gujarat & Jharkhand Locations
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'STOCK_SUMMARY' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search items by name, part number, brand, HSN code..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 font-medium">Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="p-2 border border-slate-200 rounded-lg bg-white font-medium"
                >
                  <option value="ALL">All Items</option>
                  <option value="STOCK_MANAGED">Stock-Managed (Warehouse)</option>
                  <option value="DIRECT_PROCUREMENT">Direct Procurement (Non-Stock)</option>
                </select>
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="p-2 border border-slate-200 rounded-lg bg-white font-medium"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Item & Specification</th>
                    <th className="py-3 px-3">Category & Brand</th>
                    <th className="py-3 px-3">HSN / GST</th>
                    <th className="py-3 px-3 text-center">Procurement Workflow</th>
                    <th className="py-3 px-3 text-right">Cost Price</th>
                    <th className="py-3 px-3 text-right">Selling Price</th>
                    <th className="py-3 px-3 text-center">Current Stock</th>
                    <th className="py-3 px-3 text-right">Stock Value</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredProducts.map((p) => {
                    const isManaged = p.isStockManaged !== false;
                    const stock = p.stockQty || 0;
                    const minStock = p.minStockLevel || 15;
                    const isLow = isManaged && stock <= minStock;
                    const cost = p.costPrice || p.approxRate || 350;
                    const selling = p.salesPrice || Math.round(cost * 1.25);
                    const stockVal = stock * cost;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-bold text-slate-900">{p.itemName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Part: {p.partNumber || '-'} {p.modelNumber ? `• Model: ${p.modelNumber}` : ''}
                          </div>
                          {p.specification && (
                            <div className="text-[10px] text-slate-400 truncate max-w-xs">{p.specification}</div>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                            {p.category}
                          </span>
                          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{p.brand}</div>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px]">
                          <div>{p.hsnCode || '84821010'}</div>
                          <div className="text-slate-400 text-[10px] font-sans">{p.gstRate || 18}% GST</div>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleToggleStockManaged(p)}
                            className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                              isManaged
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            }`}
                            title="Click to toggle between Stock-Managed inventory and Direct-to-Customer procurement"
                          >
                            {isManaged ? '📦 Warehouse Stock' : '⚡ Direct Procurement'}
                          </button>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                          ₹{cost.toLocaleString('en-IN')}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{selling.toLocaleString('en-IN')}
                        </td>

                        <td className="py-3 px-3 text-center">
                          {isManaged ? (
                            <div>
                              <span
                                className={`font-mono font-bold px-2 py-0.5 rounded ${
                                  isLow ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {stock} {p.uom || 'NOS'}
                              </span>
                              {isLow && (
                                <div className="text-[9px] text-rose-600 font-bold mt-0.5">
                                  Min: {minStock} (Low!)
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Against Order</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {isManaged ? `₹${stockVal.toLocaleString('en-IN')}` : '-'}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedProduct(p);
                              setAdjustQty(p.stockQty || 10);
                              setAdjustUnitCost(p.costPrice || p.approxRate || 350);
                              setIsAdjustModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 text-[11px] transition-colors"
                          >
                            Adjust Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Movements Tab */}
      {activeTab === 'MOVEMENTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Stock Movements & Audit Log</h3>
              <p className="text-xs text-slate-500">History of receipts, dispatches, adjustments, and returns</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[11px] font-bold text-slate-500 uppercase">
                <tr>
                  <th className="py-3 px-4">Movement ID</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3">Movement Type</th>
                  <th className="py-3 px-3 text-center">Quantity</th>
                  <th className="py-3 px-3 text-center">Balance After</th>
                  <th className="py-3 px-3 text-right">Unit Cost</th>
                  <th className="py-3 px-3 text-right">Total Value</th>
                  <th className="py-3 px-4">Reference & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{m.id}</td>
                    <td className="py-3 px-3 text-slate-500">{m.date}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{m.productName}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.type === 'PURCHASE_RECEIPT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.type === 'SALES_ISSUE'
                            ? 'bg-blue-100 text-blue-800'
                            : m.type === 'DAMAGE'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {m.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold">
                      {m.type === 'SALES_ISSUE' || m.type === 'DAMAGE' ? `-${m.quantity}` : `+${m.quantity}`}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">{m.balanceAfter}</td>
                    <td className="py-3 px-3 text-right font-mono">₹{m.unitCost.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">₹{m.totalValue.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {m.referenceId && <strong className="text-slate-700">{m.referenceId}: </strong>}
                      {m.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Low Stock Tab */}
      {activeTab === 'LOW_STOCK' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-rose-50/60 border-b border-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <div>
                <h3 className="font-bold text-sm text-rose-950">Low Stock Reorder Alerts</h3>
                <p className="text-xs text-rose-700">Materials currently at or below minimum buffer stock</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                <tr>
                  <th className="py-3 px-4">Material / Item</th>
                  <th className="py-3 px-3">Brand & Category</th>
                  <th className="py-3 px-3 text-center">Current Stock</th>
                  <th className="py-3 px-3 text-center">Min Buffer Stock</th>
                  <th className="py-3 px-3 text-center">Shortage</th>
                  <th className="py-3 px-3 text-center">Suggested PO Qty</th>
                  <th className="py-3 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {stockManagedProducts
                  .filter((p) => (p.stockQty || 0) <= (p.minStockLevel || 15))
                  .map((p) => {
                    const current = p.stockQty || 0;
                    const min = p.minStockLevel || 15;
                    const shortage = min - current;
                    const suggested = shortage + 25;

                    return (
                      <tr key={p.id} className="hover:bg-rose-50/30">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{p.itemName}</td>
                        <td className="py-3 px-3 text-slate-600">{p.brand} ({p.category})</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-rose-700">{current}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-600">{min}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-rose-600">-{shortage}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">+{suggested}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedProduct(p);
                              setAdjustType('PURCHASE_RECEIPT');
                              setAdjustQty(suggested);
                              setAdjustUnitCost(p.costPrice || p.approxRate || 350);
                              setIsAdjustModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs"
                          >
                            Receive Goods
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warehouses Tab */}
      {activeTab === 'WAREHOUSES' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {warehouses.map((wh) => (
            <div key={wh.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-700">{wh.id}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Operational
                </span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{wh.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{wh.city}</p>
              </div>
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <div>Capacity: <strong>{wh.capacity}</strong></div>
                <div>Store In-Charge: <strong>{wh.manager}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adjustment Modal */}
      {isAdjustModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">Stock Adjustment & Receipt</h3>
                <p className="text-xs text-slate-400">{selectedProduct.itemName}</p>
              </div>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Adjustment Action</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="PURCHASE_RECEIPT">Receive Goods into Stock (+) </option>
                  <option value="SALES_ISSUE">Issue to Customer Order (-)</option>
                  <option value="MANUAL_ADJUSTMENT">Physical Stock Reconciliation (=)</option>
                  <option value="DAMAGE">Write Off Damaged Material (-)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantity ({selectedProduct.uom || 'NOS'})</label>
                  <input
                    type="number"
                    min="1"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={adjustUnitCost}
                    onChange={(e) => setAdjustUnitCost(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks & Reason</label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Physical inventory count verification"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
                >
                  Save Stock Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
