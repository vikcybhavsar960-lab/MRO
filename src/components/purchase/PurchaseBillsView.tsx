import React, { useState, useEffect } from 'react';
import {
  PackageCheck,
  Plus,
  Search,
  Filter,
  DollarSign,
  Printer,
  CheckCircle,
  Clock,
  AlertCircle,
  Building,
  RotateCcw,
  Calendar,
  CreditCard,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VendorBill, VendorBillItem, DebitNote } from '../../types';
import {
  loadVendorBills,
  saveVendorBills,
  loadDebitNotes,
  saveDebitNotes,
  loadTransactions,
  saveTransactions,
  calculateGstSplits,
  loadCompanySettings,
} from '../../services/accountingService';

export const PurchaseBillsView: React.FC = () => {
  const { vendors, vendorPOs } = useApp();
  const company = loadCompanySettings();

  const [activeTab, setActiveTab] = useState<'BILLS' | 'DEBIT_NOTES'>('BILLS');
  const [bills, setBills] = useState<VendorBill[]>(() => {
    const saved = loadVendorBills();
    if (saved.length > 0) return saved;

    // Initial realistic purchase bill
    const initial: VendorBill[] = [
      {
        id: 'BILL-2026-00001',
        billNumber: 'APEX/2026/9941',
        billDate: '2026-10-09',
        dueDate: '2026-11-08',
        vendorId: 'VEND-001',
        vendorName: 'Apex Industrial Solutions Pvt Ltd',
        vendorGstin: '24AAACA9921M1Z1',
        vendorPoId: 'VPO-2026-00001',
        requirementId: 'REQ-2026-00001',
        items: [
          {
            id: 'BILL-ITM-1',
            itemName: 'SKF 6206-2RS Ball Bearing',
            hsnCode: '84821011',
            quantity: 50,
            uom: 'NOS',
            unitRate: 290,
            taxableAmount: 14500,
            gstRate: 18,
            cgstAmount: 1305,
            sgstAmount: 1305,
            igstAmount: 0,
            totalAmount: 17110,
          },
        ],
        subtotal: 14500,
        totalTax: 2610,
        grandTotal: 17110,
        paidAmount: 17110,
        balanceDue: 0,
        status: 'PAID',
        paymentTerms: '30 Days Net',
        notes: 'Material received and verified at stores.',
        createdAt: '2026-10-09T14:30:00Z',
      },
    ];
    saveVendorBills(initial);
    return initial;
  });

  const [debitNotes, setDebitNotes] = useState<DebitNote[]>(() => loadDebitNotes());
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    const handleUpdate = () => {
      setBills(loadVendorBills());
      setDebitNotes(loadDebitNotes());
    };
    window.addEventListener('mro_accounting_updated', handleUpdate);
    return () => window.removeEventListener('mro_accounting_updated', handleUpdate);
  }, []);

  // New Bill Modal State
  const [isNewBillOpen, setIsNewBillOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState(vendors[0]?.id || '');
  const [billNumberInput, setBillNumberInput] = useState('');
  const [billDateInput, setBillDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [billDueDateInput, setBillDueDateInput] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [billItems, setBillItems] = useState<VendorBillItem[]>([
    {
      id: 'B-ITM-1',
      itemName: 'Industrial Bearings / Electrical Spares',
      hsnCode: '848210',
      quantity: 10,
      uom: 'NOS',
      unitRate: 850,
      taxableAmount: 8500,
      gstRate: 18,
      cgstAmount: 765,
      sgstAmount: 765,
      igstAmount: 0,
      totalAmount: 10030,
    },
  ]);

  // Payment Out Modal State
  const [payModalBill, setPayModalBill] = useState<VendorBill | null>(null);
  const [payOutAmount, setPayOutAmount] = useState(0);
  const [payOutMode, setPayOutMode] = useState<'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CASH'>('BANK_TRANSFER');
  const [payOutRef, setPayOutRef] = useState('');

  // Live totals
  const subtotal = billItems.reduce((acc, i) => acc + i.taxableAmount, 0);
  const totalTax = billItems.reduce((acc, i) => acc + (i.cgstAmount + i.sgstAmount + i.igstAmount), 0);
  const grandTotal = Math.round(subtotal + totalTax);

  const handleBillItemChange = (index: number, field: keyof VendorBillItem, val: any) => {
    setBillItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: val };

      const qty = field === 'quantity' ? parseFloat(val) || 0 : item.quantity;
      const rate = field === 'unitRate' ? parseFloat(val) || 0 : item.unitRate;
      const gstRate = field === 'gstRate' ? parseFloat(val) || 0 : item.gstRate;

      const taxable = qty * rate;
      const splits = calculateGstSplits(taxable, gstRate, false);

      item.quantity = qty;
      item.unitRate = rate;
      item.taxableAmount = taxable;
      item.gstRate = gstRate;
      item.cgstAmount = splits.cgstAmount;
      item.sgstAmount = splits.sgstAmount;
      item.igstAmount = splits.igstAmount;
      item.totalAmount = splits.totalAmount;

      copy[index] = item;
      return copy;
    });
  };

  const handleAddLineItem = () => {
    setBillItems((prev) => [
      ...prev,
      {
        id: `B-ITM-${Date.now()}`,
        itemName: '',
        hsnCode: '8482',
        quantity: 1,
        uom: 'NOS',
        unitRate: 0,
        taxableAmount: 0,
        gstRate: 18,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalAmount: 0,
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (billItems.length <= 1) return;
    setBillItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateBillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const vend = vendors.find((v) => v.id === selectedVendorId);
    if (!vend) {
      alert('Please select a valid vendor.');
      return;
    }

    const year = new Date().getFullYear();
    const count = bills.length + 1;
    const billId = `BILL-${year}-${String(count).padStart(5, '0')}`;

    const newBill: VendorBill = {
      id: billId,
      billNumber: billNumberInput || `VEND-INV-${Date.now().toString().slice(-4)}`,
      billDate: billDateInput,
      dueDate: billDueDateInput,
      vendorId: vend.id,
      vendorName: vend.companyName,
      vendorGstin: vend.gstin || '',
      items: billItems,
      subtotal,
      totalTax,
      grandTotal,
      paidAmount: 0,
      balanceDue: grandTotal,
      status: 'UNPAID',
      paymentTerms: '30 Days Net',
      createdAt: new Date().toISOString(),
    };

    const updated = [newBill, ...bills];
    setBills(updated);
    saveVendorBills(updated);

    setIsNewBillOpen(false);
    setBillNumberInput('');
  };

  const handleRecordPaymentOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalBill) return;

    const amt = parseFloat(payOutAmount.toString()) || 0;
    if (amt <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    const newPaid = payModalBill.paidAmount + amt;
    const newBal = Math.max(0, payModalBill.grandTotal - newPaid);
    const newStatus: VendorBill['status'] = newBal === 0 ? 'PAID' : 'PARTIALLY_PAID';

    const updated = bills.map((b) =>
      b.id === payModalBill.id
        ? {
            ...b,
            paidAmount: newPaid,
            balanceDue: newBal,
            status: newStatus,
          }
        : b
    );

    setBills(updated);
    saveVendorBills(updated);

    // Record Accounting Transaction (Payment Out)
    const txns = loadTransactions();
    const newTxn = {
      id: `TXN-${Date.now().toString().slice(-5)}`,
      voucherNumber: `PVOUCH-${Date.now().toString().slice(-4)}`,
      type: 'PAYMENT_OUT' as const,
      partyType: 'VENDOR' as const,
      partyId: payModalBill.vendorId,
      partyName: payModalBill.vendorName,
      date: new Date().toISOString().split('T')[0],
      amount: amt,
      paymentMode: payOutMode,
      bankAccountId: 'BANK-01',
      bankAccountName: 'HDFC Bank - Current A/c',
      referenceNumber: payOutRef || `NEFT-${Date.now()}`,
      linkedDocType: 'VENDOR_BILL' as const,
      linkedDocId: payModalBill.id,
      remarks: `Payment Out to ${payModalBill.vendorName} against Bill ${payModalBill.billNumber}`,
      status: 'CLEARED' as const,
      reconciled: true,
      createdAt: new Date().toISOString(),
    };
    saveTransactions([newTxn, ...txns]);

    setPayModalBill(null);
    alert(`Payment Out of ₹${amt.toLocaleString('en-IN')} disbursed to ${payModalBill.vendorName}.`);
  };

  const totalPurchases = bills.reduce((acc, b) => acc + b.grandTotal, 0);
  const totalPaid = bills.reduce((acc, b) => acc + b.paidAmount, 0);
  const totalPayables = bills.reduce((acc, b) => acc + b.balanceDue, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Purchase Bills & Vendor Payables</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Vyapar Supplier Invoicing
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Record supplier purchase bills, input GST credits, debit notes & disburse payments
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsNewBillOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Record Vendor Bill</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Purchases (Landed)</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
            ₹{totalPurchases.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{bills.length} vendor bills recorded</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/30">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Payments Disbursed</div>
          <div className="text-xl font-extrabold text-emerald-800 mt-1 font-mono">
            ₹{totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Cleared vendor liabilities</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/30">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Outstanding Payables</div>
          <div className="text-xl font-extrabold text-amber-800 mt-1 font-mono">
            ₹{totalPayables.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-amber-600 mt-0.5">Due to suppliers & vendors</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('BILLS')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'BILLS' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Vendor Purchase Bills ({bills.length})
        </button>
        <button
          onClick={() => setActiveTab('DEBIT_NOTES')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'DEBIT_NOTES' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Debit Notes / Returns ({debitNotes.length})
        </button>
      </div>

      {/* Bills Table */}
      {activeTab === 'BILLS' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="py-3 px-3">Bill #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Vendor / Supplier</th>
                  <th className="py-3 px-3 font-mono text-right">Taxable (₹)</th>
                  <th className="py-3 px-3 font-mono text-right">GST Input (₹)</th>
                  <th className="py-3 px-3 font-mono text-right">Bill Total (₹)</th>
                  <th className="py-3 px-3 font-mono text-right">Due Balance (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No vendor purchase bills recorded. Click "Record Vendor Bill" to log supplier invoices.
                    </td>
                  </tr>
                ) : (
                  bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                        {bill.billNumber}
                        <div className="text-[10px] text-slate-400 font-normal">{bill.id}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                        {bill.billDate}
                        <div className="text-[10px] text-slate-400">Due: {bill.dueDate}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {bill.vendorName}
                        {bill.vendorGstin && (
                          <div className="text-[10px] text-slate-400 font-mono font-normal">GSTIN: {bill.vendorGstin}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-right">
                        ₹{bill.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 font-mono text-right text-emerald-700">
                        ₹{bill.totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 text-right">
                        ₹{bill.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-right text-amber-700">
                        ₹{bill.balanceDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            bill.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : bill.status === 'PARTIALLY_PAID'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {bill.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {bill.balanceDue > 0 ? (
                          <button
                            onClick={() => {
                              setPayModalBill(bill);
                              setPayOutAmount(bill.balanceDue);
                            }}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
                          >
                            Payment Out
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-bold flex items-center justify-end gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Paid</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECORD VENDOR BILL MODAL */}
      {isNewBillOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-lg text-white">Record Supplier Purchase Bill</h3>
                <p className="text-xs text-slate-400">
                  Logs input tax credit for GSTR-2B matching and tracks vendor payables
                </p>
              </div>
              <button onClick={() => setIsNewBillOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateBillSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Supplier / Vendor</label>
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.companyName} ({v.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Bill / Invoice #</label>
                  <input
                    type="text"
                    required
                    value={billNumberInput}
                    onChange={(e) => setBillNumberInput(e.target.value)}
                    placeholder="e.g. APEX/2026/8891"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bill Date</label>
                  <input
                    type="date"
                    required
                    value={billDateInput}
                    onChange={(e) => setBillDateInput(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-slate-900">Purchased Line Items ({billItems.length})</h4>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="flex items-center gap-1 text-xs text-indigo-600 font-bold hover:text-indigo-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b">
                      <tr>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-2">HSN</th>
                        <th className="py-2.5 px-2 text-center">Qty</th>
                        <th className="py-2.5 px-2">UOM</th>
                        <th className="py-2.5 px-2 text-right">Unit Rate (₹)</th>
                        <th className="py-2.5 px-2 text-center">GST %</th>
                        <th className="py-2.5 px-2 text-right">Taxable (₹)</th>
                        <th className="py-2.5 px-2 text-right">Total (₹)</th>
                        <th className="py-2.5 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {billItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => handleBillItemChange(idx, 'itemName', e.target.value)}
                              placeholder="Item description"
                              className="w-full p-1 border rounded text-xs font-bold"
                              required
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.hsnCode}
                              onChange={(e) => handleBillItemChange(idx, 'hsnCode', e.target.value)}
                              className="w-20 p-1 border rounded text-xs font-mono"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleBillItemChange(idx, 'quantity', e.target.value)}
                              className="w-14 p-1 border rounded text-center text-xs font-bold"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={item.uom}
                              onChange={(e) => handleBillItemChange(idx, 'uom', e.target.value)}
                              className="p-1 border rounded text-xs bg-white"
                            >
                              <option value="NOS">NOS</option>
                              <option value="SET">SET</option>
                              <option value="KG">KG</option>
                              <option value="MTR">MTR</option>
                            </select>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.unitRate}
                              onChange={(e) => handleBillItemChange(idx, 'unitRate', e.target.value)}
                              className="w-24 p-1 border rounded text-right text-xs font-mono font-bold"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <select
                              value={item.gstRate}
                              onChange={(e) => handleBillItemChange(idx, 'gstRate', e.target.value)}
                              className="p-1 border rounded text-xs bg-white font-bold"
                            >
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-700">
                            ₹{item.taxableAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                            ₹{item.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {billItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(idx)}
                                className="text-red-500 hover:text-red-700"
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Calculation */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-500">GST Input Tax Credit automatically posted to purchase register</span>
                <div className="text-right space-y-1 font-mono">
                  <div>Taxable: <strong>₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></div>
                  <div>GST Total: <strong className="text-emerald-700">₹{totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></div>
                  <div className="text-sm font-extrabold text-indigo-900">Grand Total: ₹{grandTotal.toLocaleString('en-IN')}</div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewBillOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-500/20"
                >
                  Save Supplier Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT OUT MODAL */}
      {payModalBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4.5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">Record Vendor Payment Out</h3>
                <p className="text-[11px] text-slate-400">Disbursement against Bill #{payModalBill.billNumber}</p>
              </div>
              <button onClick={() => setPayModalBill(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRecordPaymentOut} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payee Vendor</label>
                <input
                  type="text"
                  readOnly
                  value={payModalBill.vendorName}
                  className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Total Bill Balance</label>
                  <input
                    type="text"
                    readOnly
                    value={`₹${payModalBill.balanceDue.toLocaleString('en-IN')}`}
                    className="w-full p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount to Pay (₹)</label>
                  <input
                    type="number"
                    min="1"
                    max={payModalBill.balanceDue}
                    value={payOutAmount}
                    onChange={(e) => setPayOutAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-indigo-300 rounded-lg font-mono font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payOutMode}
                  onChange={(e) => setPayOutMode(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS)</option>
                  <option value="UPI">UPI Transfer</option>
                  <option value="CHEQUE">Bank Cheque</option>
                  <option value="CASH">Cash in Hand</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bank Reference / UTR #</label>
                <input
                  type="text"
                  value={payOutRef}
                  onChange={(e) => setPayOutRef(e.target.value)}
                  placeholder="e.g. UTR-HDFC-882201"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayModalBill(null)}
                  className="px-4 py-2 border rounded-xl font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-500/20"
                >
                  Disburse Payment Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
