import React, { useState, useMemo } from 'react';
import {
  Building2,
  Users,
  Calendar,
  Download,
  FileSpreadsheet,
  Clock,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  FileText,
  DollarSign,
  ChevronRight,
  Sparkles,
  Layers,
  Phone,
  Mail,
  Shield,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CustomerRequirement, PurchaseExecutive, Company } from '../../types';
import * as XLSX from 'xlsx';

export const CompanyExecutiveReportsView: React.FC = () => {
  const {
    companies,
    purchaseExecutives,
    requirements,
    customerQuotations,
    customerPOs,
    categories,
    setSelectedOrderId,
  } = useApp();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<
    | 'COMPANY_REQUIREMENTS'
    | 'EXECUTIVE_REQUIREMENTS'
    | 'COMPANY_RFQ_HISTORY'
    | 'EXECUTIVE_ENQUIRY_HISTORY'
    | 'PENDING_QUOTATION_SUMMARY'
  >('COMPANY_REQUIREMENTS');

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('ALL');
  const [selectedExecutiveId, setSelectedExecutiveId] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter requirements by date range
  const dateFilteredRequirements = useMemo(() => {
    return requirements.filter((req) => {
      const reqDate = req.requirementDate || req.receivedRequirementDate || req.requiredDeliveryDate || '';
      if (startDate && reqDate && reqDate < startDate) return false;
      if (endDate && reqDate && reqDate > endDate) return false;
      return true;
    });
  }, [requirements, startDate, endDate]);

  // =========================================================================
  // REPORT 1: Company-wise Total Requirements
  // =========================================================================
  const companyWiseData = useMemo(() => {
    return companies.map((comp) => {
      const compReqs = dateFilteredRequirements.filter(
        (r) => r.companyId === comp.id || r.customerId === comp.id || r.companyName === comp.companyName
      );

      const totalItems = compReqs.reduce((sum, r) => sum + r.items.length, 0);

      const linkedQtns = customerQuotations.filter(
        (q) => q.customerId === comp.id || compReqs.some((r) => r.id === q.requirementId)
      );
      const totalQuotedValue = linkedQtns.reduce((sum, q) => sum + (q.grandTotal || 0), 0);

      const statusCount = {
        NEW_REQUIREMENT: compReqs.filter((r) => r.status === 'NEW_REQUIREMENT').length,
        ENQUIRY_SENT: compReqs.filter((r) => r.status === 'ENQUIRY_SENT').length,
        RATE_RECEIVED: compReqs.filter((r) => r.status === 'RATE_RECEIVED').length,
        QUOTATION_SENT: compReqs.filter((r) => r.status === 'QUOTATION_SENT').length,
        ORDER_CLOSED: compReqs.filter((r) => r.status === 'ORDER_CLOSED').length,
      };

      const mappedExecs = purchaseExecutives.filter((pe) => pe.companyId === comp.id);

      return {
        companyId: comp.id,
        companyCode: comp.companyCode || comp.id,
        companyName: comp.companyName,
        gstin: comp.gstin || (comp as any).gstNumber || 'N/A',
        city: comp.city || '-',
        state: comp.state || '-',
        mappedExecCount: mappedExecs.length,
        totalRequirements: compReqs.length,
        totalItems,
        totalQuotedValue,
        statusCount,
        status: comp.status,
      };
    });
  }, [companies, dateFilteredRequirements, customerQuotations, purchaseExecutives]);

  // Export Report 1 to Excel
  const handleExportCompanyWise = () => {
    const data = companyWiseData.map((row, idx) => ({
      'Sr. No.': idx + 1,
      'Company Code': row.companyCode,
      'Company Name': row.companyName,
      'GSTIN': row.gstin,
      'City': row.city,
      'State': row.state,
      'Purchase Executives Mapped': row.mappedExecCount,
      'Total Requirements': row.totalRequirements,
      'Total Line Items': row.totalItems,
      'Quoted Value (INR)': row.totalQuotedValue,
      'New Enquiries': row.statusCount.NEW_REQUIREMENT,
      'Vendor Enquiries Sent': row.statusCount.ENQUIRY_SENT,
      'Rates Received': row.statusCount.RATE_RECEIVED,
      'Quotations Sent': row.statusCount.QUOTATION_SENT,
      'Closed Orders': row.statusCount.ORDER_CLOSED,
      'Status': row.status,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Company Requirements');
    XLSX.writeFile(wb, `Company_Wise_Requirements_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // =========================================================================
  // REPORT 2: Purchase Executive-wise Total Requirements
  // =========================================================================
  const executiveWiseData = useMemo(() => {
    return purchaseExecutives
      .filter((pe) => selectedCompanyId === 'ALL' || pe.companyId === selectedCompanyId)
      .map((pe) => {
        const peReqs = dateFilteredRequirements.filter(
          (r) =>
            r.purchaseExecutiveId === pe.id ||
            r.purchaseExecutiveName?.toLowerCase() === pe.name.toLowerCase() ||
            (r.companyId === pe.companyId && r.contactPerson.toLowerCase() === pe.name.toLowerCase())
        );

        const totalItems = peReqs.reduce((sum, r) => sum + r.items.length, 0);

        const dates = peReqs
          .map((r) => r.requirementDate || r.receivedRequirementDate || r.createdAt)
          .filter(Boolean)
          .sort();
        const lastActiveDate = dates.length > 0 ? dates[dates.length - 1] : '-';

        return {
          id: pe.id,
          name: pe.name,
          companyId: pe.companyId,
          companyName: pe.companyName,
          designation: pe.designation,
          department: pe.department,
          mobile: pe.mobile,
          email: pe.email || 'N/A',
          status: pe.status,
          totalRequirements: peReqs.length,
          totalItems,
          lastActiveDate,
        };
      });
  }, [purchaseExecutives, dateFilteredRequirements, selectedCompanyId]);

  // Export Report 2 to Excel
  const handleExportExecutiveWise = () => {
    const data = executiveWiseData.map((row, idx) => ({
      'Sr. No.': idx + 1,
      'Executive ID': row.id,
      'Executive Name': row.name,
      'Company Name': row.companyName,
      'Designation': row.designation,
      'Department': row.department,
      'Mobile Number': row.mobile,
      'Email Address': row.email,
      'Status': row.status,
      'Total Requirements Handled': row.totalRequirements,
      'Total Line Items': row.totalItems,
      'Last Active Date': row.lastActiveDate,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Executive Requirements');
    XLSX.writeFile(wb, `Purchase_Executive_Wise_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // =========================================================================
  // REPORT 3: Company-wise RFQ History
  // =========================================================================
  const companyRfqHistoryData = useMemo(() => {
    return dateFilteredRequirements
      .filter((r) => {
        if (selectedCompanyId !== 'ALL' && r.companyId !== selectedCompanyId && r.customerId !== selectedCompanyId) {
          return false;
        }
        if (searchTerm.trim() !== '') {
          const q = searchTerm.toLowerCase();
          const match =
            r.id.toLowerCase().includes(q) ||
            (r.rfqNumber || '').toLowerCase().includes(q) ||
            (r.companyName || r.customerName).toLowerCase().includes(q) ||
            (r.purchaseExecutiveName || r.contactPerson).toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .map((r) => ({
        rfqNumber: r.rfqNumber || r.id,
        requirementId: r.id,
        date: r.requirementDate || r.receivedRequirementDate || r.requiredDeliveryDate || '-',
        companyName: r.companyName || r.customerName,
        purchaseExecutive: r.purchaseExecutiveName || r.contactPerson,
        executiveDesignation: r.purchaseExecutiveDesignation || 'Purchase Executive',
        source: r.requirementSource || 'Email',
        referenceNumber: r.referenceNumber || '-',
        itemsCount: r.items.length,
        itemsSummary: r.items.map((i) => i.itemName).slice(0, 2).join(', ') + (r.items.length > 2 ? ` (+${r.items.length - 2} more)` : ''),
        status: r.status,
      }));
  }, [dateFilteredRequirements, selectedCompanyId, searchTerm]);

  // Export Report 3 to Excel
  const handleExportCompanyRfqHistory = () => {
    const data = companyRfqHistoryData.map((row, idx) => ({
      'Sr. No.': idx + 1,
      'RFQ Number': row.rfqNumber,
      'Requirement ID': row.requirementId,
      'Requirement Date': row.date,
      'Company Name': row.companyName,
      'Purchase Executive': row.purchaseExecutive,
      'Executive Designation': row.executiveDesignation,
      'Requirement Source': row.source,
      'Reference Number': row.referenceNumber,
      'Total Items': row.itemsCount,
      'Items Summary': row.itemsSummary,
      'RFQ Status': row.status,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Company RFQ History');
    XLSX.writeFile(wb, `Company_RFQ_History_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // =========================================================================
  // REPORT 4: Purchase Executive-wise Material Enquiry History
  // =========================================================================
  const executiveEnquiryHistoryData = useMemo(() => {
    const rows: Array<{
      executiveName: string;
      companyName: string;
      rfqNumber: string;
      requirementId: string;
      date: string;
      itemName: string;
      category: string;
      brand: string;
      quantity: number;
      uom: string;
      targetPrice: number;
      assignedVendor: string;
      status: string;
    }> = [];

    dateFilteredRequirements.forEach((req) => {
      if (selectedCompanyId !== 'ALL' && req.companyId !== selectedCompanyId && req.customerId !== selectedCompanyId) {
        return;
      }
      if (
        selectedExecutiveId !== 'ALL' &&
        req.purchaseExecutiveId !== selectedExecutiveId &&
        req.purchaseExecutiveName !== purchaseExecutives.find((e) => e.id === selectedExecutiveId)?.name
      ) {
        return;
      }

      req.items.forEach((item) => {
        const rowExec = item.purchaseExecutiveName || req.purchaseExecutiveName || req.contactPerson;
        if (
          searchTerm.trim() !== '' &&
          !rowExec.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !item.category.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          return;
        }

        rows.push({
          executiveName: rowExec,
          companyName: req.companyName || req.customerName,
          rfqNumber: req.rfqNumber || req.id,
          requirementId: req.id,
          date: req.requirementDate || req.receivedRequirementDate || '-',
          itemName: item.itemName,
          category: item.category || 'Bearings',
          brand: item.brand || '-',
          quantity: item.quantity,
          uom: item.uom,
          targetPrice: item.targetPrice || 0,
          assignedVendor: item.selectedVendorName || 'Pending Assignment',
          status: req.status,
        });
      });
    });

    return rows;
  }, [dateFilteredRequirements, selectedCompanyId, selectedExecutiveId, purchaseExecutives, searchTerm]);

  // Export Report 4 to Excel
  const handleExportExecutiveEnquiryHistory = () => {
    const data = executiveEnquiryHistoryData.map((row, idx) => ({
      'Sr. No.': idx + 1,
      'Purchase Executive': row.executiveName,
      'Company Name': row.companyName,
      'RFQ Number': row.rfqNumber,
      'Requirement ID': row.requirementId,
      'Enquiry Date': row.date,
      'Item Description': row.itemName,
      'Category': row.category,
      'Brand / Make': row.brand,
      'Quantity': row.quantity,
      'UOM': row.uom,
      'Target Price (INR)': row.targetPrice,
      'Assigned Supplier': row.assignedVendor,
      'Status': row.status,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Executive Material Enquiries');
    XLSX.writeFile(wb, `Executive_Material_Enquiry_History_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // =========================================================================
  // REPORT 5: Pending Quotation Summary by Company & Executive
  // =========================================================================
  const pendingQuotationData = useMemo(() => {
    return dateFilteredRequirements
      .filter((req) => {
        // Pending quotations are those not yet converted to closed order or PO
        const isPending =
          req.status === 'NEW_REQUIREMENT' ||
          req.status === 'ENQUIRY_SENT' ||
          req.status === 'RATE_RECEIVED' ||
          req.status === 'QUOTATION_SENT';

        if (!isPending) return false;

        if (selectedCompanyId !== 'ALL' && req.companyId !== selectedCompanyId && req.customerId !== selectedCompanyId) {
          return false;
        }

        if (
          selectedExecutiveId !== 'ALL' &&
          req.purchaseExecutiveId !== selectedExecutiveId &&
          req.purchaseExecutiveName !== purchaseExecutives.find((e) => e.id === selectedExecutiveId)?.name
        ) {
          return false;
        }

        return true;
      })
      .map((req) => {
        const reqDateStr = req.requirementDate || req.receivedRequirementDate || req.createdAt.split('T')[0];
        const reqDate = new Date(reqDateStr);
        const today = new Date();
        const diffDays = Math.max(0, Math.floor((today.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24)));

        const quotedVendors = req.items.filter((i) => i.selectedVendorName).length;

        return {
          rfqNumber: req.rfqNumber || req.id,
          requirementId: req.id,
          requirementDate: reqDateStr,
          companyName: req.companyName || req.customerName,
          companyCode: req.companyCode || req.companyId || req.customerId,
          purchaseExecutive: req.purchaseExecutiveName || req.contactPerson,
          executiveDesignation: req.purchaseExecutiveDesignation || 'Purchase Executive',
          executiveMobile: req.purchaseExecutiveMobile || req.customerMobile || '',
          executiveEmail: req.purchaseExecutiveEmail || req.customerEmail || '',
          totalItems: req.items.length,
          daysPending: diffDays,
          status: req.status,
          quotedVendorsCount: quotedVendors,
        };
      })
      .sort((a, b) => b.daysPending - a.daysPending);
  }, [dateFilteredRequirements, selectedCompanyId, selectedExecutiveId, purchaseExecutives]);

  // Export Report 5 to Excel
  const handleExportPendingQuotations = () => {
    const data = pendingQuotationData.map((row, idx) => ({
      'Sr. No.': idx + 1,
      'RFQ Number': row.rfqNumber,
      'Requirement ID': row.requirementId,
      'Requirement Date': row.requirementDate,
      'Company Name': row.companyName,
      'Company Code': row.companyCode,
      'Purchase Executive': row.purchaseExecutive,
      'Executive Designation': row.executiveDesignation,
      'Mobile Number': row.executiveMobile,
      'Email Address': row.executiveEmail,
      'Total Items': row.totalItems,
      'Ageing (Days Pending)': row.daysPending,
      'Workflow Stage': row.status,
      'Quoted Vendors Count': row.quotedVendorsCount,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pending Quotations');
    XLSX.writeFile(wb, `Pending_Quotation_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tabs Navigation for all 5 requested reports */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-1.5 text-xs font-bold">
        {[
          { id: 'COMPANY_REQUIREMENTS', label: '1. Company-wise Requirements', icon: Building2 },
          { id: 'EXECUTIVE_REQUIREMENTS', label: '2. Executive-wise Requirements', icon: Users },
          { id: 'COMPANY_RFQ_HISTORY', label: '3. Company RFQ History', icon: Clock },
          { id: 'EXECUTIVE_ENQUIRY_HISTORY', label: '4. Executive Material Enquiries', icon: Layers },
          { id: 'PENDING_QUOTATION_SUMMARY', label: '5. Pending Quotation Summary', icon: AlertCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Unified Date Range & Filter Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date range filter */}
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-1.5 border border-slate-300 rounded-lg text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-1.5 border border-slate-300 rounded-lg text-xs"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[11px] font-bold text-rose-600 hover:underline ml-1"
              >
                Clear Dates
              </button>
            )}
          </div>

          {/* Company Filter (for reports 2, 3, 4, 5) */}
          {activeTab !== 'COMPANY_REQUIREMENTS' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 font-medium">Company:</span>
              <select
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value);
                  setSelectedExecutiveId('ALL');
                }}
                className="p-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
              >
                <option value="ALL">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Executive Filter (for reports 4 & 5) */}
          {(activeTab === 'EXECUTIVE_ENQUIRY_HISTORY' || activeTab === 'PENDING_QUOTATION_SUMMARY') && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 font-medium">Executive:</span>
              <select
                value={selectedExecutiveId}
                onChange={(e) => setSelectedExecutiveId(e.target.value)}
                className="p-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
              >
                <option value="ALL">All Executives</option>
                {purchaseExecutives
                  .filter((pe) => selectedCompanyId === 'ALL' || pe.companyId === selectedCompanyId)
                  .map((pe) => (
                    <option key={pe.id} value={pe.id}>
                      {pe.name} ({pe.companyName ? pe.companyName.substring(0, 15) : pe.designation})
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Export to Excel Button */}
        <div>
          <button
            onClick={() => {
              if (activeTab === 'COMPANY_REQUIREMENTS') handleExportCompanyWise();
              else if (activeTab === 'EXECUTIVE_REQUIREMENTS') handleExportExecutiveWise();
              else if (activeTab === 'COMPANY_RFQ_HISTORY') handleExportCompanyRfqHistory();
              else if (activeTab === 'EXECUTIVE_ENQUIRY_HISTORY') handleExportExecutiveEnquiryHistory();
              else if (activeTab === 'PENDING_QUOTATION_SUMMARY') handleExportPendingQuotations();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report to Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. COMPANY-WISE TOTAL REQUIREMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'COMPANY_REQUIREMENTS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Customer Companies</span>
              <div className="text-2xl font-bold font-mono text-slate-800 mt-1">{companies.length}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Total Requirements</span>
              <div className="text-2xl font-bold font-mono text-blue-700 mt-1">
                {companyWiseData.reduce((s, r) => s + r.totalRequirements, 0)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Line Items Tracked</span>
              <div className="text-2xl font-bold font-mono text-indigo-700 mt-1">
                {companyWiseData.reduce((s, r) => s + r.totalItems, 0)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Total Quoted Pipeline</span>
              <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                ₹{companyWiseData.reduce((s, r) => s + r.totalQuotedValue, 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-200 uppercase font-bold text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Company Details</th>
                    <th className="py-3 px-4">Location & GST</th>
                    <th className="py-3 px-4 text-center">Mapped Executives</th>
                    <th className="py-3 px-4 text-center">Requirements</th>
                    <th className="py-3 px-4 text-center">Total Items</th>
                    <th className="py-3 px-4">Quoted Value</th>
                    <th className="py-3 px-4">Status Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companyWiseData.map((row) => (
                    <tr key={row.companyId} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{row.companyName}</div>
                        <span className="text-[10px] text-slate-400 font-mono">Code: {row.companyCode}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{row.city}, {row.state}</div>
                        <span className="text-[10px] text-slate-400 font-mono">GST: {row.gstin}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-700">
                        {row.mappedExecCount} executive(s)
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-blue-700">
                        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                          {row.totalRequirements}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {row.totalItems}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        ₹{row.totalQuotedValue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                            {row.statusCount.NEW_REQUIREMENT} New
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            {row.statusCount.ENQUIRY_SENT} RFQ
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                            {row.statusCount.RATE_RECEIVED} Quoted
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {row.statusCount.ORDER_CLOSED} Closed
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PURCHASE EXECUTIVE-WISE TOTAL REQUIREMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'EXECUTIVE_REQUIREMENTS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Purchase Executives</span>
              <div className="text-2xl font-bold font-mono text-slate-800 mt-1">{executiveWiseData.length}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Total Requirements Mapped</span>
              <div className="text-2xl font-bold font-mono text-indigo-700 mt-1">
                {executiveWiseData.reduce((s, r) => s + r.totalRequirements, 0)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Total Items Handled</span>
              <div className="text-2xl font-bold font-mono text-blue-700 mt-1">
                {executiveWiseData.reduce((s, r) => s + r.totalItems, 0)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-200 uppercase font-bold text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Purchase Executive</th>
                    <th className="py-3 px-4">Company Name</th>
                    <th className="py-3 px-4">Designation & Department</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-center">Total RFQs</th>
                    <th className="py-3 px-4 text-center">Items Handled</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {executiveWiseData.map((exec) => (
                    <tr key={exec.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{exec.name}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{exec.id}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-blue-700">
                        {exec.companyName}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div className="font-medium text-slate-800">{exec.designation}</div>
                        <span className="text-[10px] text-slate-400">{exec.department}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        <div>{exec.mobile}</div>
                        <span className="text-[10px] text-slate-400 font-sans">{exec.email}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-700">
                        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                          {exec.totalRequirements}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold font-mono text-slate-800">
                        {exec.totalItems}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {exec.lastActiveDate}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exec.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {exec.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. COMPANY-WISE RFQ HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'COMPANY_RFQ_HISTORY' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                RFQ Timeline & History ({companyRfqHistoryData.length} entries)
              </span>
              <span className="text-xs text-slate-500">
                Sorted by requirement sequence
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-200 uppercase font-bold text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">RFQ / Req Number</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Company Name</th>
                    <th className="py-3 px-4">Purchase Executive</th>
                    <th className="py-3 px-4">Source & Ref</th>
                    <th className="py-3 px-4">Items Summary</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companyRfqHistoryData.map((row) => (
                    <tr key={row.requirementId} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {row.rfqNumber}
                        <span className="text-[10px] text-slate-400 block font-sans">
                          {row.requirementId}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {row.companyName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-indigo-950">{row.purchaseExecutive}</div>
                        <span className="text-[10px] text-indigo-600">{row.executiveDesignation}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{row.source}</div>
                        {row.referenceNumber !== '-' && (
                          <span className="text-[10px] font-mono text-slate-500">
                            Ref: {row.referenceNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="font-bold">{row.itemsCount} items:</span>{' '}
                        <span className="text-slate-500">{row.itemsSummary}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                          {row.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedOrderId(row.requirementId)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-black text-white text-[10px] font-bold rounded-md"
                        >
                          Trace
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PURCHASE EXECUTIVE-WISE MATERIAL ENQUIRY HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'EXECUTIVE_ENQUIRY_HISTORY' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Material Enquiries Raised by Executives ({executiveEnquiryHistoryData.length} line items)
              </span>
              <span className="text-xs text-slate-500">
                Detailed item-by-item requisition breakdown
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-200 uppercase font-bold text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Purchase Executive</th>
                    <th className="py-3 px-4">Company Name</th>
                    <th className="py-3 px-4">RFQ Number & Date</th>
                    <th className="py-3 px-4">Material Description</th>
                    <th className="py-3 px-4">Category & Make</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4">Target Rate</th>
                    <th className="py-3 px-4">Assigned Supplier</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {executiveEnquiryHistoryData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-indigo-950">
                        {row.executiveName}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {row.companyName}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-blue-700">{row.rfqNumber}</div>
                        <span className="text-[10px] text-slate-400">{row.date}</span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 max-w-xs">
                        {row.itemName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-700">
                          {row.category}
                        </span>
                        {row.brand !== '-' && (
                          <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
                            Make: {row.brand}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">
                        {row.quantity} {row.uom}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {row.targetPrice ? `₹${row.targetPrice.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-emerald-700 font-semibold text-[11px]">
                        {row.assignedVendor}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {row.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. PENDING QUOTATION SUMMARY BY COMPANY & EXECUTIVE */}
      {/* ========================================================================= */}
      {activeTab === 'PENDING_QUOTATION_SUMMARY' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-600 uppercase flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Pending RFQs</span>
              </span>
              <div className="text-2xl font-bold font-mono text-amber-700 mt-1">
                {pendingQuotationData.length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Pending Items</span>
              <div className="text-2xl font-bold font-mono text-slate-800 mt-1">
                {pendingQuotationData.reduce((s, r) => s + r.totalItems, 0)} items
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Average Ageing</span>
              <div className="text-2xl font-bold font-mono text-rose-700 mt-1">
                {pendingQuotationData.length > 0
                  ? Math.round(
                      pendingQuotationData.reduce((s, r) => s + r.daysPending, 0) /
                        pendingQuotationData.length
                    )
                  : 0}{' '}
                days
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Supplier Quotes Ready</span>
              <div className="text-2xl font-bold font-mono text-purple-700 mt-1">
                {pendingQuotationData.filter((r) => r.status === 'RATE_RECEIVED').length} ready
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Pending Quotations by Customer Company & Executive
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Requirements awaiting quotation compilation, supplier rate confirmations, or customer approval
                </p>
              </div>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                Action Required
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-200 uppercase font-bold text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">RFQ / Req Number</th>
                    <th className="py-3 px-4">Requirement Date</th>
                    <th className="py-3 px-4">Company Name</th>
                    <th className="py-3 px-4">Purchase Executive</th>
                    <th className="py-3 px-4">Executive Contact</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4 text-center">Ageing</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingQuotationData.map((row) => (
                    <tr key={row.requirementId} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {row.rfqNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {row.requirementDate}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {row.companyName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-indigo-950">{row.purchaseExecutive}</div>
                        <span className="text-[10px] text-indigo-600">{row.executiveDesignation}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                        <div>{row.executiveMobile}</div>
                        <span className="text-[10px] text-slate-400 font-sans">{row.executiveEmail}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold font-mono">
                        {row.totalItems}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.daysPending > 14
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : row.daysPending > 7
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {row.daysPending} days
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          {row.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedOrderId(row.requirementId)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold shadow-xs"
                        >
                          Process RFQ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
