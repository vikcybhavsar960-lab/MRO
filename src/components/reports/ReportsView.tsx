import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  Filter,
  DollarSign,
  TrendingUp,
  Share2,
  Calendar,
  Building,
  CheckCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { exportToCsv, syncToGoogleSheetsAPI, SheetExportRow } from '../../services/googleSheetsService';
import {
  loadInvoices,
  loadVendorBills,
  loadExpenses,
  loadCompanySettings,
} from '../../services/accountingService';
import { CompanyExecutiveReportsView } from './CompanyExecutiveReportsView';
import { VendorProductMappingReports } from './VendorProductMappingReports';

export const ReportsView: React.FC = () => {
  const { requirements, customerQuotations, customerPOs, vendorPOs, proformaInvoices, payments, dispatches, currentUser, customers, vendors } = useApp();

  const [activeReportTab, setActiveReportTab] = useState<'SALES' | 'PURCHASE' | 'PROFIT' | 'GST_SUMMARY' | 'RECEIVABLES_PAYABLES' | 'CUSTOMER_WISE' | 'PENDING' | 'COMPANY_EXECUTIVE_REPORTS' | 'VENDOR_PRODUCT_MAPPINGS'>('VENDOR_PRODUCT_MAPPINGS');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; message?: string; url?: string }>({
    loading: false,
  });

  const [, setAccountingTick] = useState(0);
  useEffect(() => {
    const handleUpdate = () => setAccountingTick((t) => t + 1);
    window.addEventListener('mro_accounting_updated', handleUpdate);
    return () => window.removeEventListener('mro_accounting_updated', handleUpdate);
  }, []);

  const invoices = loadInvoices();
  const vendorBills = loadVendorBills();
  const expenses = loadExpenses();
  const company = loadCompanySettings();

  const canSeeMargins =
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'ACCOUNTS_USER' ||
    currentUser.role === 'PROCUREMENT_EMPLOYEE';

  // Construct tabular data rows
  const reportRows: SheetExportRow[] = requirements.map((req) => {
    const qtn = customerQuotations.find((q) => q.requirementId === req.id);
    const cpo = customerPOs.find((c) => c.requirementId === req.id);
    const vpo = vendorPOs.find((v) => v.requirementId === req.id);
    const pi = proformaInvoices.find((p) => p.requirementId === req.id);
    const dsp = dispatches.find((d) => d.requirementId === req.id);

    const selling = qtn?.grandTotal || (cpo ? cpo.poAmount : 0);
    const purchase = vpo?.totalAmount || (pi ? pi.totalAmount : 0);
    const margin = selling > 0 && purchase > 0 ? selling - purchase : 0;
    const marginPct = selling > 0 ? (margin / selling) * 100 : 0;

    return {
      requirementId: req.id,
      customerName: req.customerName,
      status: req.status,
      itemsSummary: req.items.map((i) => `${i.itemName} (${i.quantity} ${i.uom})`).join(', '),
      quotationId: qtn?.id,
      customerPoId: cpo?.customerPoNumber || cpo?.id,
      vendorPoId: vpo?.id,
      vendorName: vpo?.vendorName,
      sellingValue: selling,
      purchaseValue: purchase,
      grossMargin: margin,
      marginPercent: marginPct,
      date: req.requirementDate,
    };
  });

  const filteredRows = reportRows.filter((r) => {
    const matchesCustomer = customerFilter === 'ALL' || r.customerName === customerFilter;
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesCustomer && matchesStatus;
  });

  const totalSales = filteredRows.reduce((acc, r) => acc + r.sellingValue, 0);
  const totalPurchase = filteredRows.reduce((acc, r) => acc + r.purchaseValue, 0);
  const totalMargin = totalSales - totalPurchase;
  const overallMarginPct = totalSales > 0 ? (totalMargin / totalSales) * 100 : 0;

  // Google Sheets Export
  const handleExportGoogleSheets = async () => {
    setSyncStatus({ loading: true });
    const result = await syncToGoogleSheetsAPI(filteredRows);
    setSyncStatus({
      loading: false,
      message: result.message,
      url: result.spreadsheetUrl,
    });
  };

  const handleExportCSV = () => {
    exportToCsv(filteredRows, `ProcureMRO_${activeReportTab}_Report.csv`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span>Financial Reports & Google Sheets Sync</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Stage 12: Sales ledger, purchase commitments, profitability analysis, and live cloud spreadsheet synchronization
          </p>
        </div>

        {activeReportTab !== 'VENDOR_PRODUCT_MAPPINGS' && activeReportTab !== 'COMPANY_EXECUTIVE_REPORTS' && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV / Excel</span>
            </button>

            <button
              onClick={handleExportGoogleSheets}
              disabled={syncStatus.loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
            >
              {syncStatus.loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              <span>Export to Google Sheets</span>
            </button>
          </div>
        )}
      </div>

      {/* Sync Status Banner */}
      {syncStatus.message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncStatus.message}</span>
          </div>
          {syncStatus.url && (
            <a
              href={syncStatus.url}
              target="_blank"
              rel="noreferrer"
              className="font-bold underline text-emerald-700 hover:text-emerald-900 flex items-center gap-1 ml-3"
            >
              <span>Open in Google Sheets</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Financial KPIs Banner */}
      {canSeeMargins && activeReportTab !== 'VENDOR_PRODUCT_MAPPINGS' && activeReportTab !== 'COMPANY_EXECUTIVE_REPORTS' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Sales Quoted</span>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-1">
              ₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Vendor Purchases</span>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-1">
              ₹{totalPurchase.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Gross Profit (INR)</span>
            <div className="text-xl font-extrabold text-emerald-600 font-mono mt-1">
              ₹{totalMargin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Weighted Margin %</span>
            <div className="text-xl font-extrabold text-blue-700 font-mono mt-1">
              {overallMarginPct.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Report Categories Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-bold gap-4 overflow-x-auto pb-1">
        {[
          { id: 'VENDOR_PRODUCT_MAPPINGS', label: 'Vendor Products & Coverage' },
          { id: 'COMPANY_EXECUTIVE_REPORTS', label: 'Company & Executive Reports' },
          { id: 'SALES', label: 'Sales Report' },
          { id: 'PURCHASE', label: 'Purchase Report' },
          { id: 'PROFIT', label: 'Profit & Loss (P&L)' },
          { id: 'GST_SUMMARY', label: 'GST Summary (GSTR-1 & 3B)' },
          { id: 'RECEIVABLES_PAYABLES', label: 'Receivables & Payables' },
          { id: 'CUSTOMER_WISE', label: 'Customer Performance' },
          { id: 'PENDING', label: 'Pending Dispatch / Payment' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReportTab(tab.id as any)}
            className={`pb-2.5 px-2 border-b-2 shrink-0 transition-colors ${
              activeReportTab === tab.id
                ? 'border-blue-600 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Specialized View: Vendor Products & Coverage Reports */}
      {activeReportTab === 'VENDOR_PRODUCT_MAPPINGS' && (
        <VendorProductMappingReports />
      )}

      {/* Specialized View: Company & Purchase Executive Management Reports */}
      {activeReportTab === 'COMPANY_EXECUTIVE_REPORTS' && (
        <CompanyExecutiveReportsView />
      )}

      {/* Specialized View: GST Summary (GSTR-1 & 3B) */}
      {activeReportTab === 'GST_SUMMARY' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Outward Taxable Value</span>
              <div className="text-xl font-black text-slate-900 font-mono mt-1">
                ₹{invoices.reduce((acc, i) => acc + i.subtotal, 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">GSTR-1 Sales Base</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Output GST</span>
              <div className="text-xl font-black text-blue-700 font-mono mt-1">
                ₹{invoices.reduce((acc, i) => acc + i.totalTax, 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-blue-600 mt-1">Collected from Customers</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Eligible ITC (Purchase Tax)</span>
              <div className="text-xl font-black text-emerald-600 font-mono mt-1">
                ₹{vendorBills.reduce((acc, b) => acc + b.totalTax, 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-emerald-600 mt-1">GSTR-3B Input Tax Credit</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Net GST Payable</span>
              <div className="text-xl font-black text-amber-700 font-mono mt-1">
                ₹{Math.max(
                  0,
                  invoices.reduce((acc, i) => acc + i.totalTax, 0) -
                    vendorBills.reduce((acc, b) => acc + b.totalTax, 0)
                ).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">After ITC Set-off</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">GSTR-1 Outward Supplies (GST Invoices)</h3>
                <p className="text-xs text-slate-500">B2B taxable sales transactions for GST audit and CA filing review</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-[11px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4">Customer & GSTIN</th>
                    <th className="py-3 px-3 text-right">Taxable Val</th>
                    <th className="py-3 px-3 text-right">CGST</th>
                    <th className="py-3 px-3 text-right">SGST</th>
                    <th className="py-3 px-3 text-right">IGST</th>
                    <th className="py-3 px-4 text-right">Invoice Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3 text-slate-500">{inv.invoiceDate}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{inv.customerName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{inv.customerGstin || 'Unregistered'}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">₹{inv.subtotal.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">₹{inv.cgstTotal.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">₹{inv.sgstTotal.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">₹{inv.igstTotal.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">₹{inv.grandTotal.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Specialized View: Receivables & Payables */}
      {activeReportTab === 'RECEIVABLES_PAYABLES' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Receivables */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-emerald-50/70 border-b border-emerald-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-emerald-950">Accounts Receivable (Customer Dues)</h3>
                <p className="text-xs text-emerald-700">Pending collections and overdue customer invoices</p>
              </div>
              <span className="font-mono font-bold text-emerald-800 text-sm">
                ₹{invoices.reduce((acc, i) => acc + (i.balanceDue || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-3">Invoice #</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-3 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{inv.customerName}</td>
                      <td className="py-3 px-3 font-mono text-blue-700">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3 text-slate-500">{inv.dueDate}</td>
                      <td className="py-3 px-3 text-right font-mono">₹{inv.grandTotal.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                        ₹{inv.balanceDue.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Supplier Payables */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-blue-50/70 border-b border-blue-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-blue-950">Accounts Payable (Supplier Dues)</h3>
                <p className="text-xs text-blue-700">Vendor purchase bills awaiting payment clearance</p>
              </div>
              <span className="font-mono font-bold text-blue-800 text-sm">
                ₹{vendorBills.reduce((acc, b) => acc + (b.balanceDue || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-3">Bill #</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-3 text-right">Bill Total</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {vendorBills.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{b.vendorName}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{b.billNumber}</td>
                      <td className="py-3 px-3 text-slate-500">{b.dueDate}</td>
                      <td className="py-3 px-3 text-right font-mono">₹{b.grandTotal.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                        ₹{b.balanceDue.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Standard Orders & Pipeline Report Table */}
      {activeReportTab !== 'GST_SUMMARY' &&
        activeReportTab !== 'RECEIVABLES_PAYABLES' &&
        activeReportTab !== 'COMPANY_EXECUTIVE_REPORTS' &&
        activeReportTab !== 'VENDOR_PRODUCT_MAPPINGS' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Req Number</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4">Quotation / PO Ref</th>
                  <th className="py-3 px-4">Assigned Vendor</th>
                  <th className="py-3 px-4 text-right">Selling Value</th>
                  {canSeeMargins && (
                    <>
                      <th className="py-3 px-4 text-right">Purchase Value</th>
                      <th className="py-3 px-4 text-right">Gross Margin</th>
                      <th className="py-3 px-4 text-right">Margin %</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{r.requirementId}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{r.customerName}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {r.quotationId || r.customerPoId || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{r.vendorName || '-'}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right">
                      {r.sellingValue > 0 ? `₹${r.sellingValue.toLocaleString('en-IN')}` : '-'}
                    </td>
                    {canSeeMargins && (
                      <>
                        <td className="py-3.5 px-4 font-mono text-slate-600 text-right">
                          {r.purchaseValue > 0 ? `₹${r.purchaseValue.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 text-right">
                          {r.grossMargin > 0 ? `₹${r.grossMargin.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700 text-right">
                          {r.sellingValue > 0 ? `${r.marginPercent.toFixed(1)}%` : '-'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
