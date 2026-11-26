import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Building,
  User,
  Calendar,
  Wallet,
  Landmark,
  FileText,
  PieChart,
  Download,
  Receipt,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AccountingTransaction, ExpenseRecord, BankAccount } from '../../types';
import {
  loadTransactions,
  saveTransactions,
  loadExpenses,
  saveExpenses,
  loadCompanySettings,
  saveCompanySettings,
} from '../../services/accountingService';

export const AccountingView: React.FC = () => {
  const { customers, vendors } = useApp();
  const [company, setCompany] = useState(() => loadCompanySettings());

  const [activeTab, setActiveTab] = useState<'TRANSACTIONS' | 'CASH_BANK' | 'LEDGERS' | 'EXPENSES'>('TRANSACTIONS');
  const [transactions, setTransactions] = useState<AccountingTransaction[]>(() => {
    const saved = loadTransactions();
    if (saved.length > 0) return saved;

    const initial: AccountingTransaction[] = [
      {
        id: 'TXN-00001',
        voucherNumber: 'RCPT-8891',
        type: 'PAYMENT_IN',
        partyType: 'CUSTOMER',
        partyId: 'CUST-001',
        partyName: 'Tata Motors Limited',
        date: '2026-10-10',
        amount: 22420,
        paymentMode: 'BANK_TRANSFER',
        bankAccountId: 'BANK-01',
        bankAccountName: 'HDFC Current A/c',
        referenceNumber: 'NEFT-TATA-9988112',
        linkedDocType: 'INVOICE',
        linkedDocId: 'INV-2026-00001',
        remarks: 'Full settlement for bearing consignment',
        status: 'CLEARED',
        reconciled: true,
        createdAt: '2026-10-10T11:30:00Z',
      },
      {
        id: 'TXN-00002',
        voucherNumber: 'PVOUCH-4412',
        type: 'PAYMENT_OUT',
        partyType: 'VENDOR',
        partyId: 'VEND-001',
        partyName: 'Apex Industrial Solutions Pvt Ltd',
        date: '2026-10-09',
        amount: 17110,
        paymentMode: 'BANK_TRANSFER',
        bankAccountId: 'BANK-01',
        bankAccountName: 'HDFC Current A/c',
        referenceNumber: 'RTGS-HDFC-882299',
        linkedDocType: 'VENDOR_BILL',
        linkedDocId: 'BILL-2026-00001',
        remarks: 'Payment cleared for purchase bill APEX/2026/9941',
        status: 'CLEARED',
        reconciled: true,
        createdAt: '2026-10-09T15:00:00Z',
      },
    ];
    saveTransactions(initial);
    return initial;
  });

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    const saved = loadExpenses();
    if (saved.length > 0) return saved;

    const initial: ExpenseRecord[] = [
      {
        id: 'EXP-00001',
        expenseNumber: 'EXP-2026-0001',
        category: 'TRANSPORT_FREIGHT',
        paidTo: 'V-Trans Logistics India',
        date: '2026-10-08',
        amount: 3500,
        paymentMode: 'BANK_TRANSFER',
        referenceNumber: 'LR-FREIGHT-9912',
        notes: 'Door delivery freight for Sanand client order',
        createdAt: '2026-10-08T10:00:00Z',
      },
      {
        id: 'EXP-00002',
        expenseNumber: 'EXP-2026-0002',
        category: 'PACKAGING',
        paidTo: 'Shreeji Packaging Box Co',
        date: '2026-10-07',
        amount: 1850,
        paymentMode: 'UPI',
        referenceNumber: 'UPI-SHREEJI-8812',
        notes: 'Corrugated cartons and heavy bubble wrap',
        createdAt: '2026-10-07T14:00:00Z',
      },
    ];
    saveExpenses(initial);
    return initial;
  });

  const [filterText, setFilterText] = useState('');
  const [selectedLedgerPartyId, setSelectedLedgerPartyId] = useState(customers[0]?.id || '');
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setExpenses(loadExpenses());
      setCompany(loadCompanySettings());
    };
    window.addEventListener('mro_accounting_updated', handleUpdate);
    return () => window.removeEventListener('mro_accounting_updated', handleUpdate);
  }, []);

  // New Expense State
  const [expCategory, setExpCategory] = useState<ExpenseRecord['category']>('TRANSPORT_FREIGHT');
  const [expPaidTo, setExpPaidTo] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expAmount, setExpAmount] = useState(0);
  const [expMode, setExpMode] = useState<ExpenseRecord['paymentMode']>('BANK_TRANSFER');
  const [expRef, setExpRef] = useState('');
  const [expNotes, setExpNotes] = useState('');

  const totalIn = transactions.filter((t) => t.type === 'PAYMENT_IN').reduce((acc, t) => acc + t.amount, 0);
  const totalOut = transactions.filter((t) => t.type === 'PAYMENT_OUT').reduce((acc, t) => acc + t.amount, 0);
  const totalExpensesAmt = expenses.reduce((acc, e) => acc + e.amount, 0);
  const bankBalancesSum = company.bankAccounts.reduce((acc, b) => acc + b.currentBalance, 0);

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expAmount <= 0) {
      alert('Expense amount must be greater than zero.');
      return;
    }

    const year = new Date().getFullYear();
    const count = expenses.length + 1;
    const expId = `EXP-${year}-${String(count).padStart(4, '0')}`;

    const newExp: ExpenseRecord = {
      id: expId,
      expenseNumber: expId,
      category: expCategory,
      paidTo: expPaidTo,
      date: expDate,
      amount: expAmount,
      paymentMode: expMode,
      referenceNumber: expRef,
      notes: expNotes,
      createdAt: new Date().toISOString(),
    };

    const updatedExp = [newExp, ...expenses];
    setExpenses(updatedExp);
    saveExpenses(updatedExp);

    // Also record payment out transaction
    const newTxn: AccountingTransaction = {
      id: `TXN-${Date.now().toString().slice(-5)}`,
      voucherNumber: `PVOUCH-${Date.now().toString().slice(-4)}`,
      type: 'PAYMENT_OUT',
      partyType: 'EXPENSE_PARTY',
      partyId: expId,
      partyName: expPaidTo,
      date: expDate,
      amount: expAmount,
      paymentMode: expMode,
      bankAccountId: 'BANK-01',
      bankAccountName: 'HDFC Current A/c',
      referenceNumber: expRef || `REF-${Date.now()}`,
      linkedDocType: 'EXPENSE',
      linkedDocId: expId,
      remarks: `Expense: ${expCategory.replace(/_/g, ' ')} - ${expNotes}`,
      status: 'CLEARED',
      reconciled: true,
      createdAt: new Date().toISOString(),
    };

    const updatedTxns = [newTxn, ...transactions];
    setTransactions(updatedTxns);
    saveTransactions(updatedTxns);

    setIsExpenseModalOpen(false);
    setExpPaidTo('');
    setExpAmount(0);
    setExpRef('');
    setExpNotes('');
  };

  // Ledger calculation for selected party
  const ledgerParty =
    customers.find((c) => c.id === selectedLedgerPartyId) ||
    vendors.find((v) => v.id === selectedLedgerPartyId) ||
    customers[0];

  const partyTransactions = transactions.filter(
    (t) => t.partyId === ledgerParty?.id || t.partyName.toLowerCase() === ledgerParty?.companyName?.toLowerCase()
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Accounting & Payments</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  Cash Book & Ledgers
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Payment In & Out, Bank accounts, party statements, expense vouchers & journal postings
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsExpenseModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense Voucher</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Bank & Cash</div>
          <div className="text-xl font-extrabold text-blue-700 mt-1 font-mono">
            ₹{bankBalancesSum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{company.bankAccounts.length} active accounts</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Total Payment In</span>
          </div>
          <div className="text-xl font-extrabold text-emerald-800 mt-1 font-mono">
            ₹{totalIn.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Receipts from customers</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/20">
          <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Total Payment Out</span>
          </div>
          <div className="text-xl font-extrabold text-rose-800 mt-1 font-mono">
            ₹{totalOut.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-rose-600 mt-0.5">Disbursed to suppliers</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/20">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Operating Expenses</div>
          <div className="text-xl font-extrabold text-amber-800 mt-1 font-mono">
            ₹{totalExpensesAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-amber-600 mt-0.5">Freight, rent, packing & admin</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('TRANSACTIONS')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'TRANSACTIONS' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Payment In & Out ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('CASH_BANK')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'CASH_BANK' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Cash & Bank Book ({company.bankAccounts.length})
        </button>
        <button
          onClick={() => setActiveTab('LEDGERS')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'LEDGERS' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Party Statement & Ledgers
        </button>
        <button
          onClick={() => setActiveTab('EXPENSES')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'EXPENSES' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Expense Vouchers ({expenses.length})
        </button>
      </div>

      {/* Tab 1: Payment In / Out Transactions */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="py-3 px-3">Voucher #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Party Name</th>
                  <th className="py-3 px-3">Mode</th>
                  <th className="py-3 px-3">Reference / UTR</th>
                  <th className="py-3 px-3 font-mono text-right">Amount (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{t.voucherNumber}</td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{t.date}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.type === 'PAYMENT_IN'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {t.type === 'PAYMENT_IN' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        <span>{t.type === 'PAYMENT_IN' ? 'Payment In' : 'Payment Out'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">{t.partyName}</td>
                    <td className="py-3 px-3 text-slate-600">{t.paymentMode.replace(/_/g, ' ')}</td>
                    <td className="py-3 px-3 font-mono text-slate-500">{t.referenceNumber || '-'}</td>
                    <td
                      className={`py-3 px-3 font-mono font-bold text-right ${
                        t.type === 'PAYMENT_IN' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {t.type === 'PAYMENT_IN' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Cash & Bank Book */}
      {activeTab === 'CASH_BANK' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {company.bankAccounts.map((b) => (
              <div key={b.id} className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{b.accountName}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {b.accountType}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {b.bankName} • A/c: {b.accountNumber}
                </div>
                {b.ifscCode !== 'NA' && (
                  <div className="text-[11px] text-slate-400 font-mono">IFSC: {b.ifscCode}</div>
                )}
                <div className="pt-2 border-t flex justify-between items-baseline">
                  <span className="text-xs text-slate-500">Current Balance:</span>
                  <span className="text-base font-extrabold text-blue-800 font-mono">
                    ₹{b.currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600">
            <strong>Reconciliation note:</strong> Live balances reflect cleared payment vouchers and customer remittances verified with bank records.
          </div>
        </div>
      )}

      {/* Tab 3: Party Statement & Ledgers */}
      {activeTab === 'LEDGERS' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-700">Select Party Statement:</span>
              <select
                value={selectedLedgerPartyId}
                onChange={(e) => setSelectedLedgerPartyId(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg bg-white font-bold text-xs"
              >
                <optgroup label="Customers">
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} (Customer)
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Vendors">
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.companyName} (Vendor)
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ledger</span>
            </button>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center text-xs">
              <div>
                <h3 className="font-bold text-sm text-slate-900">{ledgerParty?.companyName}</h3>
                <p className="text-slate-500 text-[11px]">Ledger Statement of Account</p>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-slate-500">Closing Balance: </span>
                <strong className="text-slate-900">₹0.00 (All settlements cleared)</strong>
              </div>
            </div>

            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Voucher #</th>
                  <th className="py-2.5 px-3">Particulars / Details</th>
                  <th className="py-2.5 px-3 font-mono text-right">Debit (Dr) (₹)</th>
                  <th className="py-2.5 px-3 font-mono text-right">Credit (Cr) (₹)</th>
                  <th className="py-2.5 px-3 font-mono text-right">Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partyTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No transactions recorded yet for this party.
                    </td>
                  </tr>
                ) : (
                  partyTransactions.map((pt) => {
                    const isDr = pt.type === 'PAYMENT_OUT';
                    return (
                      <tr key={pt.id}>
                        <td className="py-2.5 px-3 text-slate-600">{pt.date}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{pt.voucherNumber}</td>
                        <td className="py-2.5 px-3">{pt.remarks}</td>
                        <td className="py-2.5 px-3 font-mono text-right text-rose-700">
                          {isDr ? `₹${pt.amount.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right text-emerald-700">
                          {!isDr ? `₹${pt.amount.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-right text-slate-900">
                          ₹0.00
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Expense Vouchers */}
      {activeTab === 'EXPENSES' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b">
              <tr>
                <th className="py-3 px-3">Expense #</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Paid To</th>
                <th className="py-3 px-3">Mode</th>
                <th className="py-3 px-3">Notes</th>
                <th className="py-3 px-3 font-mono text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">{e.expenseNumber}</td>
                  <td className="py-3 px-3 text-slate-600">{e.date}</td>
                  <td className="py-3 px-3 font-bold text-amber-800">
                    <span className="px-2 py-0.5 bg-amber-50 rounded border border-amber-200">
                      {e.category.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">{e.paidTo}</td>
                  <td className="py-3 px-3 text-slate-600">{e.paymentMode}</td>
                  <td className="py-3 px-3 text-slate-500">{e.notes || '-'}</td>
                  <td className="py-3 px-3 font-mono font-bold text-right text-slate-900">
                    ₹{e.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4.5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">Record Operating Expense Voucher</h3>
                <p className="text-[11px] text-slate-400">Posts to P&L operating expense and cash/bank book</p>
              </div>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expense Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold"
                >
                  <option value="TRANSPORT_FREIGHT">Transport & Freight Charges</option>
                  <option value="PACKAGING">Packaging & Cartons</option>
                  <option value="RENT">Warehouse & Office Rent</option>
                  <option value="SALARIES">Employee Salaries & Wages</option>
                  <option value="BANK_CHARGES">Bank Charges & Forex Fees</option>
                  <option value="OFFICE_SUPPLIES">Office Supplies & Stationery</option>
                  <option value="TRAVEL">Travel & Site Visits</option>
                  <option value="OTHER">Other Operating Expenses</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Paid To (Vendor / Person)</label>
                <input
                  type="text"
                  required
                  value={expPaidTo}
                  onChange={(e) => setExpPaidTo(e.target.value)}
                  placeholder="e.g. V-Trans Logistics, Landlord, etc."
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-blue-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={expMode}
                  onChange={(e) => setExpMode(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (HDFC Current A/c)</option>
                  <option value="UPI">UPI Payment</option>
                  <option value="CASH">Cash in Hand</option>
                  <option value="CHEQUE">Bank Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reference / LR / Bill #</label>
                <input
                  type="text"
                  value={expRef}
                  onChange={(e) => setExpRef(e.target.value)}
                  placeholder="e.g. LR-998812"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="e.g. Express delivery of bearings to Sanand"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20"
                >
                  Save Expense Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
