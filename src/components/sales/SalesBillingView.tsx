import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  DollarSign,
  Download,
  Share2,
  Printer,
  CheckCircle,
  Clock,
  AlertCircle,
  Truck,
  RotateCcw,
  Calendar,
  Building,
  User,
  ArrowRight,
  ChevronDown,
  Eye,
  FileCheck2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GSTInvoice, GSTInvoiceItem, DeliveryChallan, CreditNote } from '../../types';
import {
  loadInvoices,
  saveInvoices,
  loadChallans,
  saveChallans,
  loadCreditNotes,
  saveCreditNotes,
  loadCompanySettings,
  calculateGstSplits,
  loadTransactions,
  saveTransactions,
} from '../../services/accountingService';

export const SalesBillingView: React.FC = () => {
  const { customers, customerPOs, customerQuotations, requirements } = useApp();
  const company = loadCompanySettings();

  const [activeTab, setActiveTab] = useState<'INVOICES' | 'CHALLANS' | 'CREDIT_NOTES'>('INVOICES');
  const [invoices, setInvoices] = useState<GSTInvoice[]>(() => {
    const saved = loadInvoices();
    if (saved.length > 0) return saved;

    // Seed realistic initial invoice if empty
    const initial: GSTInvoice[] = [
      {
        id: 'INV-2026-00001',
        invoiceNumber: 'INV-2026-00001',
        invoiceDate: '2026-10-10',
        dueDate: '2026-11-09',
        customerId: 'CUST-001',
        customerName: 'Tata Motors Limited',
        customerGstin: '24AAACT1234F1Z5',
        billingAddress: 'Sanand Industrial Park, Plot 1, Ahmedabad, Gujarat - 382170',
        shippingAddress: 'Gate No. 2 Central Stores, Tata Motors Ltd, Sanand, Gujarat',
        placeOfSupply: 'Gujarat (24)',
        isInterState: false,
        customerPoId: 'CPO-2026-00001',
        requirementId: 'REQ-2026-00001',
        items: [
          {
            id: 'INV-ITM-1',
            itemName: 'Deep Groove Ball Bearing 6206-2RS-C3 (SKF)',
            hsnCode: '84821011',
            quantity: 50,
            uom: 'NOS',
            unitPrice: 380,
            discountPercent: 0,
            taxableAmount: 19000,
            gstRate: 18,
            cgstAmount: 1710,
            sgstAmount: 1710,
            igstAmount: 0,
            totalAmount: 22420,
          },
        ],
        subtotal: 19000,
        cgstTotal: 1710,
        sgstTotal: 1710,
        igstTotal: 0,
        totalTax: 3420,
        roundOff: 0,
        grandTotal: 22420,
        paidAmount: 22420,
        balanceDue: 0,
        status: 'PAID',
        paymentTerms: '30 Days Net from Delivery',
        notes: 'Material delivered and inspected at Sanand Stores.',
        createdAt: '2026-10-10T11:00:00Z',
      },
    ];
    saveInvoices(initial);
    return initial;
  });

  const [challans, setChallans] = useState<DeliveryChallan[]>(() => loadChallans());
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() => loadCreditNotes());
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    const handleUpdate = () => {
      setInvoices(loadInvoices());
      setChallans(loadChallans());
      setCreditNotes(loadCreditNotes());
    };
    window.addEventListener('mro_accounting_updated', handleUpdate);
    return () => window.removeEventListener('mro_accounting_updated', handleUpdate);
  }, []);

  // Modals state
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<GSTInvoice | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<GSTInvoice | null>(null);
  const [payAmountInput, setPayAmountInput] = useState<number>(0);
  const [payModeInput, setPayModeInput] = useState<'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CASH'>('BANK_TRANSFER');
  const [payRefInput, setPayRefInput] = useState('');

  // New Invoice Form State
  const [selectedCustId, setSelectedCustId] = useState(customers[0]?.id || '');
  const [linkedCpoId, setLinkedCpoId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [isInterState, setIsInterState] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<GSTInvoiceItem[]>([
    {
      id: 'ITM-1',
      itemName: 'Industrial Spares / Bearings',
      hsnCode: '848210',
      quantity: 10,
      uom: 'NOS',
      unitPrice: 1200,
      discountPercent: 0,
      taxableAmount: 12000,
      gstRate: 18,
      cgstAmount: 1080,
      sgstAmount: 1080,
      igstAmount: 0,
      totalAmount: 14160,
    },
  ]);
  const [paymentTerms, setPaymentTerms] = useState('30 Days Net');
  const [notes, setNotes] = useState('Payment by RTGS/NEFT or Cheque in favor of MRO PROCUREMENT SOLUTION.');

  // Calculate live totals for new invoice
  const subtotal = invoiceItems.reduce((acc, i) => acc + i.taxableAmount, 0);
  const cgstTotal = isInterState ? 0 : invoiceItems.reduce((acc, i) => acc + i.cgstAmount, 0);
  const sgstTotal = isInterState ? 0 : invoiceItems.reduce((acc, i) => acc + i.sgstAmount, 0);
  const igstTotal = isInterState ? invoiceItems.reduce((acc, i) => acc + (i.taxableAmount * i.gstRate) / 100, 0) : 0;
  const totalTax = cgstTotal + sgstTotal + igstTotal;
  const grandTotal = Math.round(subtotal + totalTax);

  const handleItemFieldChange = (index: number, field: keyof GSTInvoiceItem, val: any) => {
    setInvoiceItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: val };

      const qty = field === 'quantity' ? parseFloat(val) || 0 : item.quantity;
      const rate = field === 'unitPrice' ? parseFloat(val) || 0 : item.unitPrice;
      const disc = field === 'discountPercent' ? parseFloat(val) || 0 : item.discountPercent;
      const gstRate = field === 'gstRate' ? parseFloat(val) || 0 : item.gstRate;

      const baseAmount = qty * rate;
      const taxable = baseAmount - (baseAmount * disc) / 100;
      const splits = calculateGstSplits(taxable, gstRate, isInterState);

      item.quantity = qty;
      item.unitPrice = rate;
      item.discountPercent = disc;
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
    setInvoiceItems((prev) => [
      ...prev,
      {
        id: `ITM-${Date.now()}`,
        itemName: '',
        hsnCode: '8482',
        quantity: 1,
        uom: 'NOS',
        unitPrice: 0,
        discountPercent: 0,
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
    if (invoiceItems.length <= 1) return;
    setInvoiceItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === selectedCustId);
    if (!cust) {
      alert('Please select a valid customer.');
      return;
    }

    const year = new Date().getFullYear();
    const count = invoices.length + 1;
    const invNumber = `${company.invoicePrefix || `INV-${year}-`}${String(count).padStart(5, '0')}`;

    const newInv: GSTInvoice = {
      id: invNumber,
      invoiceNumber: invNumber,
      invoiceDate,
      dueDate,
      customerId: cust.id,
      customerName: cust.companyName,
      customerGstin: cust.gstin,
      billingAddress: cust.address,
      shippingAddress: cust.deliveryAddress || cust.address,
      placeOfSupply: `${cust.state || 'Gujarat'} (${isInterState ? 'Inter-state' : company.stateCode})`,
      isInterState,
      customerPoId: linkedCpoId || undefined,
      items: invoiceItems,
      subtotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      totalTax,
      roundOff: grandTotal - (subtotal + totalTax),
      grandTotal,
      paidAmount: 0,
      balanceDue: grandTotal,
      status: 'UNPAID',
      paymentTerms,
      notes,
      createdAt: new Date().toISOString(),
    };

    const updated = [newInv, ...invoices];
    setInvoices(updated);
    saveInvoices(updated);

    setIsNewInvoiceOpen(false);
    setSelectedInvoiceForPrint(newInv);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;

    const amt = parseFloat(payAmountInput.toString()) || 0;
    if (amt <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    const newPaid = paymentModalInvoice.paidAmount + amt;
    const newBal = Math.max(0, paymentModalInvoice.grandTotal - newPaid);
    const newStatus: GSTInvoice['status'] = newBal === 0 ? 'PAID' : 'PARTIALLY_PAID';

    const updated = invoices.map((inv) =>
      inv.id === paymentModalInvoice.id
        ? {
            ...inv,
            paidAmount: newPaid,
            balanceDue: newBal,
            status: newStatus,
          }
        : inv
    );

    setInvoices(updated);
    saveInvoices(updated);

    // Record Accounting Transaction (Payment In)
    const txns = loadTransactions();
    const newTxn = {
      id: `TXN-${Date.now().toString().slice(-5)}`,
      voucherNumber: `RCPT-${Date.now().toString().slice(-4)}`,
      type: 'PAYMENT_IN' as const,
      partyType: 'CUSTOMER' as const,
      partyId: paymentModalInvoice.customerId,
      partyName: paymentModalInvoice.customerName,
      date: new Date().toISOString().split('T')[0],
      amount: amt,
      paymentMode: payModeInput,
      bankAccountId: 'BANK-01',
      bankAccountName: 'HDFC Bank - Current A/c',
      referenceNumber: payRefInput || `UTR-${Date.now()}`,
      linkedDocType: 'INVOICE' as const,
      linkedDocId: paymentModalInvoice.id,
      remarks: `Payment In against Invoice ${paymentModalInvoice.invoiceNumber}`,
      status: 'CLEARED' as const,
      reconciled: true,
      createdAt: new Date().toISOString(),
    };
    saveTransactions([newTxn, ...txns]);

    setPaymentModalInvoice(null);
    alert(`Payment of ₹${amt.toLocaleString('en-IN')} recorded successfully against Invoice ${paymentModalInvoice.invoiceNumber}.`);
  };

  const totalReceivables = invoices.reduce((acc, i) => acc + (i.status !== 'CANCELLED' ? i.balanceDue : 0), 0);
  const totalBilled = invoices.reduce((acc, i) => acc + (i.status !== 'CANCELLED' ? i.grandTotal : 0), 0);
  const totalCollected = invoices.reduce((acc, i) => acc + (i.status !== 'CANCELLED' ? i.paidAmount : 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Sales & GST Invoicing</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Vyapar Business Billing
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                GST Tax Invoices, Delivery Challans, Credit Notes, Customer Receipts & Outstanding Receivables
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsNewInvoiceOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Create GST Tax Invoice</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sales Billed</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
            ₹{totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{invoices.length} invoices generated</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/30">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Payments Collected</div>
          <div className="text-xl font-extrabold text-emerald-800 mt-1 font-mono">
            ₹{totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Realized in bank & cash accounts</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/30">
          <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Outstanding Receivables</div>
          <div className="text-xl font-extrabold text-rose-800 mt-1 font-mono">
            ₹{totalReceivables.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-rose-600 mt-0.5">Pending collection from customers</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'INVOICES' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          GST Tax Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab('CHALLANS')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'CHALLANS' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Delivery Challans ({challans.length})
        </button>
        <button
          onClick={() => setActiveTab('CREDIT_NOTES')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'CREDIT_NOTES' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Credit Notes / Returns ({creditNotes.length})
        </button>
      </div>

      {/* Table: GST Invoices */}
      {activeTab === 'INVOICES' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Customer Name</th>
                  <th className="py-3 px-3 font-mono text-right">Taxable (₹)</th>
                  <th className="py-3 px-3 font-mono text-right">GST (₹)</th>
                  <th className="py-3 px-3 font-mono text-right">Grand Total (₹)</th>
                  <th className="py-3 px-3 font-mono text-right">Balance Due (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No GST invoices created yet. Click "Create GST Tax Invoice" to bill an order.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-blue-700">
                        {inv.invoiceNumber}
                        {inv.customerPoId && (
                          <div className="text-[10px] text-slate-400 font-normal">PO: {inv.customerPoId}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                        {inv.invoiceDate}
                        <div className="text-[10px] text-slate-400">Due: {inv.dueDate}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {inv.customerName}
                        {inv.customerGstin && (
                          <div className="text-[10px] text-slate-400 font-mono font-normal">GSTIN: {inv.customerGstin}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-right">
                        ₹{inv.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 font-mono text-right text-slate-600">
                        ₹{inv.totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 text-right">
                        ₹{inv.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-right text-rose-700">
                        ₹{inv.balanceDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : inv.status === 'PARTIALLY_PAID'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {inv.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={() => setSelectedInvoiceForPrint(inv)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Print / View Tax Invoice"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {inv.balanceDue > 0 && (
                          <button
                            onClick={() => {
                              setPaymentModalInvoice(inv);
                              setPayAmountInput(inv.balanceDue);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
                            title="Record Customer Payment Receipt"
                          >
                            Payment In
                          </button>
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

      {/* CREATE NEW TAX INVOICE MODAL */}
      {isNewInvoiceOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-lg text-white">Generate Official GST Tax Invoice</h3>
                <p className="text-xs text-slate-400">
                  Compliant with Section 31 of CGST Act • Auto CGST/SGST vs IGST calculation
                </p>
              </div>
              <button onClick={() => setIsNewInvoiceOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvoiceSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Customer & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Customer</label>
                  <select
                    value={selectedCustId}
                    onChange={(e) => {
                      setSelectedCustId(e.target.value);
                      const c = customers.find((cust) => cust.id === e.target.value);
                      if (c) {
                        setIsInterState(c.state ? !c.state.toLowerCase().includes('gujarat') : false);
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.id} • {c.state || 'Gujarat'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    required
                  />
                </div>
              </div>

              {/* Tax Supply Toggle */}
              <div className="flex items-center gap-3 p-3 bg-blue-50/70 rounded-xl border border-blue-200">
                <input
                  type="checkbox"
                  id="interstate-check"
                  checked={isInterState}
                  onChange={(e) => setIsInterState(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <label htmlFor="interstate-check" className="font-bold text-slate-800 text-xs">
                  Inter-State Supply (IGST Applicable)
                </label>
                <span className="text-[11px] text-slate-500">
                  {isInterState ? 'Billing to outside home state (Full IGST)' : 'Intra-state supply (CGST 50% + SGST 50%)'}
                </span>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-slate-900">Tax Invoice Line Items ({invoiceItems.length})</h4>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="flex items-center gap-1 text-xs text-blue-600 font-bold hover:text-blue-800"
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
                        <th className="py-2.5 px-2">HSN/SAC</th>
                        <th className="py-2.5 px-2 text-center">Qty</th>
                        <th className="py-2.5 px-2">UOM</th>
                        <th className="py-2.5 px-2 text-right">Rate (₹)</th>
                        <th className="py-2.5 px-2 text-center">GST %</th>
                        <th className="py-2.5 px-2 text-right">Taxable (₹)</th>
                        <th className="py-2.5 px-2 text-right">Total (₹)</th>
                        <th className="py-2.5 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoiceItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => handleItemFieldChange(idx, 'itemName', e.target.value)}
                              placeholder="Item description"
                              className="w-full p-1 border rounded text-xs font-bold"
                              required
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.hsnCode}
                              onChange={(e) => handleItemFieldChange(idx, 'hsnCode', e.target.value)}
                              className="w-20 p-1 border rounded text-xs font-mono"
                              placeholder="8482"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemFieldChange(idx, 'quantity', e.target.value)}
                              className="w-14 p-1 border rounded text-center text-xs font-bold"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={item.uom}
                              onChange={(e) => handleItemFieldChange(idx, 'uom', e.target.value)}
                              className="p-1 border rounded text-xs bg-white"
                            >
                              <option value="NOS">NOS</option>
                              <option value="SET">SET</option>
                              <option value="MTR">MTR</option>
                              <option value="KG">KG</option>
                            </select>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => handleItemFieldChange(idx, 'unitPrice', e.target.value)}
                              className="w-24 p-1 border rounded text-right text-xs font-mono font-bold"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <select
                              value={item.gstRate}
                              onChange={(e) => handleItemFieldChange(idx, 'gstRate', e.target.value)}
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
                            {invoiceItems.length > 1 && (
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

              {/* Totals Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 space-y-1">
                  <div>Company GSTIN: <strong className="text-slate-800">{company.gstin}</strong></div>
                  <div>Place of Supply: <strong className="text-slate-800">{company.state} (Code 24)</strong></div>
                </div>

                <div className="w-full sm:w-64 space-y-1.5 text-xs text-right font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Taxable Subtotal:</span>
                    <span className="font-bold">₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  {!isInterState ? (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST:</span>
                        <span>₹{cgstTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST:</span>
                        <span>₹{sgstTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST:</span>
                      <span>₹{igstTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t text-sm font-extrabold text-slate-900">
                    <span>Invoice Grand Total:</span>
                    <span className="text-blue-700">₹{grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewInvoiceOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20"
                >
                  Generate & Save Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE GST INVOICE MODAL */}
      {selectedInvoiceForPrint && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Action Bar */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0 print:hidden">
              <span className="font-bold text-sm text-white">GST Tax Invoice Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Tax Invoice</span>
                </button>
                <button
                  onClick={() => setSelectedInvoiceForPrint(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Invoice Container */}
            <div className="p-8 overflow-y-auto space-y-6 flex-1 text-xs text-slate-800 bg-white">
              {/* Header */}
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">{company.companyName}</h2>
                  <p className="text-[11px] text-slate-500">{company.tagline}</p>
                  <p className="text-xs text-slate-600 mt-1">{company.address}, {company.city}, {company.state} - {company.pincode}</p>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">
                    GSTIN: <span className="font-mono text-blue-700">{company.gstin}</span> • PAN: <span className="font-mono">{company.pan}</span>
                  </p>
                  <p className="text-xs text-slate-600">Email: {company.email} • Ph: {company.phone}</p>
                </div>

                <div className="text-right">
                  <div className="text-lg font-black tracking-wider uppercase text-blue-900">TAX INVOICE</div>
                  <div className="font-mono font-bold text-sm text-slate-900 mt-1">{selectedInvoiceForPrint.invoiceNumber}</div>
                  <div className="text-xs text-slate-500 mt-1">Date: <strong>{selectedInvoiceForPrint.invoiceDate}</strong></div>
                  <div className="text-xs text-slate-500">Due: <strong>{selectedInvoiceForPrint.dueDate}</strong></div>
                </div>
              </div>

              {/* Bill To & Ship To */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Billed To (Customer):</div>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedInvoiceForPrint.customerName}</div>
                  <div className="text-xs text-slate-600 mt-1 whitespace-pre-line">{selectedInvoiceForPrint.billingAddress}</div>
                  <div className="text-xs font-mono font-bold text-slate-700 mt-1">
                    GSTIN: {selectedInvoiceForPrint.customerGstin || 'Unregistered'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Shipped To:</div>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedInvoiceForPrint.customerName}</div>
                  <div className="text-xs text-slate-600 mt-1 whitespace-pre-line">{selectedInvoiceForPrint.shippingAddress}</div>
                  <div className="text-xs text-slate-600 mt-1">Place of Supply: <strong>{selectedInvoiceForPrint.placeOfSupply}</strong></div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-700 uppercase border-b">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-2">HSN</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-2 text-right">Rate</th>
                      <th className="py-2.5 px-2 text-center">GST</th>
                      <th className="py-2.5 px-3 text-right">Taxable</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {selectedInvoiceForPrint.items.map((it, idx) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{it.itemName}</td>
                        <td className="py-2 px-2 font-mono text-slate-500">{it.hsnCode}</td>
                        <td className="py-2 px-2 text-center font-bold">{it.quantity} {it.uom}</td>
                        <td className="py-2 px-2 text-right font-mono">₹{it.unitPrice.toLocaleString('en-IN')}</td>
                        <td className="py-2 px-2 text-center font-bold text-slate-600">{it.gstRate}%</td>
                        <td className="py-2 px-3 text-right font-mono">₹{it.taxableAmount.toLocaleString('en-IN')}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">₹{it.totalAmount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bank & Totals */}
              <div className="grid grid-cols-2 gap-6 pt-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1">
                  <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Bank Payment Details:</div>
                  <div>Bank: <strong>{company.bankAccounts[0]?.bankName}</strong></div>
                  <div>A/c No: <strong className="font-mono">{company.bankAccounts[0]?.accountNumber}</strong></div>
                  <div>IFSC: <strong className="font-mono">{company.bankAccounts[0]?.ifscCode}</strong></div>
                  <div>UPI: <strong className="font-mono text-blue-700">{company.bankAccounts[0]?.upiId}</strong></div>
                </div>

                <div className="space-y-1.5 text-xs text-right font-mono">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Amount:</span>
                    <span>₹{selectedInvoiceForPrint.subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {!selectedInvoiceForPrint.isInterState ? (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST:</span>
                        <span>₹{selectedInvoiceForPrint.cgstTotal.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST:</span>
                        <span>₹{selectedInvoiceForPrint.sgstTotal.toLocaleString('en-IN')}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST:</span>
                      <span>₹{selectedInvoiceForPrint.igstTotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t font-black text-sm text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-blue-700">₹{selectedInvoiceForPrint.grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 flex justify-between items-end border-t border-slate-200 text-xs">
                <div className="text-slate-500">
                  <p>Declaration: This is an authentic GST computer generated invoice.</p>
                  <p>Terms: Subject to Ahmedabad jurisdiction.</p>
                </div>
                <div className="text-center font-bold text-slate-900">
                  <div className="h-10"></div>
                  <p>For {company.companyName}</p>
                  <p className="text-[10px] text-slate-400 font-normal">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT IN MODAL */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4.5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">Record Customer Payment In</h3>
                <p className="text-[11px] text-slate-400">Against Invoice #{paymentModalInvoice.invoiceNumber}</p>
              </div>
              <button onClick={() => setPaymentModalInvoice(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer</label>
                <input
                  type="text"
                  readOnly
                  value={paymentModalInvoice.customerName}
                  className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Outstanding Due</label>
                  <input
                    type="text"
                    readOnly
                    value={`₹${paymentModalInvoice.balanceDue.toLocaleString('en-IN')}`}
                    className="w-full p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount Received (₹)</label>
                  <input
                    type="number"
                    min="1"
                    max={paymentModalInvoice.balanceDue}
                    value={payAmountInput}
                    onChange={(e) => setPayAmountInput(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-blue-300 rounded-lg font-mono font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={payModeInput}
                  onChange={(e) => setPayModeInput(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CHEQUE">Bank Cheque</option>
                  <option value="CASH">Cash in Hand</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">UTR / Ref # / Cheque No.</label>
                <input
                  type="text"
                  value={payRefInput}
                  onChange={(e) => setPayRefInput(e.target.value)}
                  placeholder="e.g. UTR-HDFC-9988112"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
                  className="px-4 py-2 border rounded-xl font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20"
                >
                  Confirm Payment In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
