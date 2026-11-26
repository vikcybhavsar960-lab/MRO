import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { Customer, Vendor, ProductItem, ParsedVendorProduct } from '../types';
import { parseVendorProductString, getBrandEnrichment, cleanBrandKey, MRO_BRAND_KNOWLEDGE } from '../utils/brandAutoEnrichment';

/**
 * Utility to trigger browser file download for text/blob content
 */
export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Format CSV cell escaping quotes and commas
 */
const escapeCSV = (val: any): string => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

/**
 * Export Customer list to CSV (Excel compatible with UTF-8 BOM)
 */
export const exportCustomersToCSV = (
  customers: Customer[],
  fields?: (keyof Customer | 'fullAddress')[],
  filename = 'ProcureMRO_Customers_Export.csv'
) => {
  const defaultHeaders = [
    'Customer ID',
    'Company Name',
    'Contact Person',
    'Mobile',
    'Email',
    'GSTIN',
    'PAN',
    'Payment Terms',
    'City',
    'State',
    'Pincode',
    'Registered Address',
    'Delivery Address',
    'Remarks',
    'Created Date',
  ];

  const rows: string[] = [];
  rows.push(defaultHeaders.map(escapeCSV).join(','));

  customers.forEach((c) => {
    const row = [
      c.id,
      c.companyName,
      c.contactPerson,
      c.mobile,
      c.email,
      c.gstin,
      c.pan,
      c.paymentTerms,
      c.city,
      c.state,
      c.pincode,
      c.address,
      c.deliveryAddress,
      c.remarks || '',
      c.createdAt || '',
    ];
    rows.push(row.map(escapeCSV).join(','));
  });

  // \uFEFF BOM ensures Excel properly recognizes UTF-8 (e.g., currency symbols, names)
  const csvContent = '\uFEFF' + rows.join('\r\n');
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
};

export interface VendorExportOptions {
  filename?: string;
  includeBankDetails?: boolean;
  selectedColumns?: string[];
  brandFilter?: string[];
  categoryFilter?: string[];
  cityFilter?: string;
  activeOnly?: boolean;
}

export const VENDOR_EXPORT_COLUMNS = [
  { key: 'srNo', label: 'Sr. No.', width: 8, required: true },
  { key: 'vendorId', label: 'Vendor ID', width: 14, required: true },
  { key: 'vendorName', label: 'Vendor Name', width: 34, required: true },
  { key: 'contactPerson', label: 'Contact Person', width: 22, required: true },
  { key: 'mobile', label: 'Mobile Number', width: 18, required: true },
  { key: 'alternateMobile', label: 'Alternate Mobile Number', width: 22, required: false },
  { key: 'email', label: 'Email Address', width: 28, required: true },
  { key: 'address', label: 'Company Address', width: 36, required: true },
  { key: 'city', label: 'City', width: 16, required: true },
  { key: 'state', label: 'State', width: 16, required: true },
  { key: 'pincode', label: 'PIN Code', width: 12, required: false },
  { key: 'gstin', label: 'GSTIN', width: 20, required: true },
  { key: 'pan', label: 'PAN', width: 14, required: false },
  { key: 'materialCategories', label: 'Material Categories', width: 34, required: true },
  { key: 'brandsSupplied', label: 'Brands Supplied', width: 36, required: true },
  { key: 'paymentTerms', label: 'Payment Terms', width: 24, required: true },
  { key: 'creditPeriod', label: 'Credit Period', width: 16, required: false },
  { key: 'bankDetails', label: 'Bank Details', width: 36, required: false, isSensitive: true },
  { key: 'status', label: 'Vendor Status', width: 16, required: true },
  { key: 'createdAt', label: 'Created Date', width: 14, required: true },
  { key: 'remarks', label: 'Remarks', width: 30, required: false },
];

/**
 * Filter vendor list based on options
 */
export const filterVendorsForExport = (vendors: Vendor[], options?: VendorExportOptions): Vendor[] => {
  let list = [...vendors];
  if (options?.activeOnly) {
    list = list.filter((v) => !v.status || v.status === 'ACTIVE');
  }
  if (options?.cityFilter && options.cityFilter !== 'ALL') {
    list = list.filter((v) => v.city.toLowerCase() === options.cityFilter!.toLowerCase());
  }
  if (options?.brandFilter && options.brandFilter.length > 0 && !options.brandFilter.includes('ALL')) {
    list = list.filter((v) =>
      (v.brandsSupplied || []).some((b) => options.brandFilter!.some((ob) => ob.toLowerCase() === b.toLowerCase()))
    );
  }
  if (options?.categoryFilter && options.categoryFilter.length > 0 && !options.categoryFilter.includes('ALL')) {
    list = list.filter((v) => {
      const cats = v.materialCategories && v.materialCategories.length > 0 ? v.materialCategories : v.productCategories || [];
      return cats.some((c) => options.categoryFilter!.some((oc) => oc.toLowerCase() === c.toLowerCase()));
    });
  }
  return list;
};

/**
 * Export Vendor list to formatted Microsoft Excel (.xlsx)
 * - Includes all 21 standard columns
 * - Bold header row, autofilter, frozen top row
 * - All brands comma-separated in single cell (e.g. SKF, FAG, Timken, Bosch)
 * - All material categories comma-separated in single cell
 * - Text formatting preserved for mobile, gstin, pincode, vendorId
 */
export const exportVendorsToExcel = (
  vendors: Vendor[],
  options?: VendorExportOptions
) => {
  const filteredList = filterVendorsForExport(vendors, options);
  const includeBank = Boolean(options?.includeBankDetails);

  // Selected or all columns
  let activeCols = VENDOR_EXPORT_COLUMNS.filter((col) => {
    if (col.key === 'bankDetails' && !includeBank) return false;
    if (options?.selectedColumns && options.selectedColumns.length > 0) {
      return options.selectedColumns.includes(col.key);
    }
    return true;
  });

  // If no columns match, fallback to default non-sensitive columns
  if (activeCols.length === 0) {
    activeCols = VENDOR_EXPORT_COLUMNS.filter((c) => !c.isSensitive || includeBank);
  }

  // Construct tabular data rows (one row per vendor)
  const dataRows = filteredList.map((v, index) => {
    const cats = v.materialCategories && v.materialCategories.length > 0 ? v.materialCategories : v.productCategories || [];
    const brands = v.brandsSupplied || [];
    const bankStr = v.bankDetails && v.bankDetails.bankName
      ? `${v.bankDetails.bankName} - A/C: ${v.bankDetails.accountNumber || ''} (IFSC: ${v.bankDetails.ifscCode || ''}, Branch: ${v.bankDetails.branch || ''})`.trim()
      : '';

    const rowObj: Record<string, any> = {};
    activeCols.forEach((col) => {
      switch (col.key) {
        case 'srNo':
          rowObj[col.label] = index + 1;
          break;
        case 'vendorId':
          rowObj[col.label] = v.id || '';
          break;
        case 'vendorName':
          rowObj[col.label] = v.companyName || v.vendorName || '';
          break;
        case 'contactPerson':
          rowObj[col.label] = v.contactPerson || '';
          break;
        case 'mobile':
          rowObj[col.label] = v.mobile || '';
          break;
        case 'alternateMobile':
          rowObj[col.label] = v.alternateMobile || '';
          break;
        case 'email':
          rowObj[col.label] = v.email || '';
          break;
        case 'address':
          rowObj[col.label] = v.address || '';
          break;
        case 'city':
          rowObj[col.label] = v.city || '';
          break;
        case 'state':
          rowObj[col.label] = v.state || '';
          break;
        case 'pincode':
          rowObj[col.label] = v.pincode || '';
          break;
        case 'gstin':
          rowObj[col.label] = v.gstin || '';
          break;
        case 'pan':
          rowObj[col.label] = v.pan || '';
          break;
        case 'materialCategories':
          rowObj[col.label] = cats.join(', ');
          break;
        case 'brandsSupplied':
          rowObj[col.label] = brands.join(', ');
          break;
        case 'paymentTerms':
          rowObj[col.label] = v.paymentTerms || '';
          break;
        case 'creditPeriod':
          rowObj[col.label] = v.creditPeriod || (v.paymentTerms.toLowerCase().includes('day') ? v.paymentTerms : '30 Days');
          break;
        case 'bankDetails':
          rowObj[col.label] = bankStr;
          break;
        case 'status':
          rowObj[col.label] = v.status || 'ACTIVE';
          break;
        case 'createdAt':
          rowObj[col.label] = v.createdAt || '';
          break;
        case 'remarks':
          rowObj[col.label] = v.remarks || '';
          break;
        default:
          rowObj[col.label] = '';
      }
    });
    return rowObj;
  });

  const ws = XLSX.utils.json_to_sheet(dataRows);

  // Set column widths
  ws['!cols'] = activeCols.map((c) => ({ wch: c.width }));

  // Autofilter and Freeze top row
  if (ws['!ref']) {
    ws['!autofilter'] = { ref: ws['!ref'] };
    ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }];

    // Format text types for sensitive identifiers and codes
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellRef];
        if (cell && (cell.v !== undefined && cell.v !== null)) {
          const colKey = activeCols[C]?.key;
          if (['vendorId', 'mobile', 'alternateMobile', 'pincode', 'gstin', 'pan'].includes(colKey)) {
            cell.t = 's';
            cell.v = String(cell.v);
          }
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vendors_Directory');

  const filename = options?.filename || `MRO_Vendors_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
};

/**
 * Export Vendor list to CSV (Excel compatible with UTF-8 BOM)
 * Matches standard export columns with comma-separated brands and categories
 */
export const exportVendorsToCSV = (
  vendors: Vendor[],
  filename = 'MRO_Vendors_Export.csv',
  options?: VendorExportOptions
) => {
  const filteredList = filterVendorsForExport(vendors, options);
  const includeBank = Boolean(options?.includeBankDetails);

  let activeCols = VENDOR_EXPORT_COLUMNS.filter((col) => {
    if (col.key === 'bankDetails' && !includeBank) return false;
    if (options?.selectedColumns && options.selectedColumns.length > 0) {
      return options.selectedColumns.includes(col.key);
    }
    return true;
  });

  if (activeCols.length === 0) {
    activeCols = VENDOR_EXPORT_COLUMNS.filter((c) => !c.isSensitive || includeBank);
  }

  const headers = activeCols.map((c) => c.label);
  const rows: string[] = [];
  rows.push(headers.map(escapeCSV).join(','));

  filteredList.forEach((v, index) => {
    const cats = v.materialCategories && v.materialCategories.length > 0 ? v.materialCategories : v.productCategories || [];
    const brands = v.brandsSupplied || [];
    const bankStr = v.bankDetails && v.bankDetails.bankName
      ? `${v.bankDetails.bankName} - A/C: ${v.bankDetails.accountNumber || ''} (IFSC: ${v.bankDetails.ifscCode || ''}, Branch: ${v.bankDetails.branch || ''})`.trim()
      : '';

    const row = activeCols.map((col) => {
      switch (col.key) {
        case 'srNo':
          return index + 1;
        case 'vendorId':
          return v.id || '';
        case 'vendorName':
          return v.companyName || v.vendorName || '';
        case 'contactPerson':
          return v.contactPerson || '';
        case 'mobile':
          return v.mobile || '';
        case 'alternateMobile':
          return v.alternateMobile || '';
        case 'email':
          return v.email || '';
        case 'address':
          return v.address || '';
        case 'city':
          return v.city || '';
        case 'state':
          return v.state || '';
        case 'pincode':
          return v.pincode || '';
        case 'gstin':
          return v.gstin || '';
        case 'pan':
          return v.pan || '';
        case 'materialCategories':
          return cats.join(', ');
        case 'brandsSupplied':
          return brands.join(', ');
        case 'paymentTerms':
          return v.paymentTerms || '';
        case 'creditPeriod':
          return v.creditPeriod || (v.paymentTerms.toLowerCase().includes('day') ? v.paymentTerms : '30 Days');
        case 'bankDetails':
          return bankStr;
        case 'status':
          return v.status || 'ACTIVE';
        case 'createdAt':
          return v.createdAt || '';
        case 'remarks':
          return v.remarks || '';
        default:
          return '';
      }
    });

    rows.push(row.map(escapeCSV).join(','));
  });

  const csvContent = '\uFEFF' + rows.join('\r\n');
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
};

/**
 * Export any dataset to formatted JSON
 */
export const exportDataToJSON = (data: any, filename: string) => {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
};

/**
 * Generate Customer Directory PDF
 */
export const generateCustomerDirectoryPDF = (customers: Customer[], modeTitle = 'Enterprise Directory') => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ProcureMRO - Customer Master Directory', 14, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${modeTitle} • Total Active Clients: ${customers.length} • Generated on ${new Date().toLocaleDateString('en-IN')}`, 14, 20);

  // Table Headers
  let y = 34;
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(14, y, 269, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('#', 17, y + 5.5);
  doc.text('ID', 26, y + 5.5);
  doc.text('Customer Company Name', 46, y + 5.5);
  doc.text('Contact Person & Mobile', 105, y + 5.5);
  doc.text('Email', 160, y + 5.5);
  doc.text('GSTIN', 205, y + 5.5);
  doc.text('City / State', 242, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  customers.forEach((c, idx) => {
    // Check if new page needed
    if (y > 185) {
      doc.addPage('a4', 'landscape');
      y = 18;
      // Repeat header
      doc.setFillColor(37, 99, 235);
      doc.rect(14, y, 269, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('#', 17, y + 5.5);
      doc.text('ID', 26, y + 5.5);
      doc.text('Customer Company Name', 46, y + 5.5);
      doc.text('Contact Person & Mobile', 105, y + 5.5);
      doc.text('Email', 160, y + 5.5);
      doc.text('GSTIN', 205, y + 5.5);
      doc.text('City / State', 242, y + 5.5);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
    }

    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 269, 8, 'F');
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(14, y + 8, 283, y + 8);

    doc.setFontSize(7.5);
    doc.text(`${idx + 1}`, 17, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(c.id, 26, y + 5.5);
    doc.text(c.companyName.substring(0, 32), 46, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${c.contactPerson} (${c.mobile})`.substring(0, 30), 105, y + 5.5);
    doc.text(c.email.substring(0, 25), 160, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(c.gstin, 205, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${c.city}, ${c.state}`.substring(0, 20), 242, y + 5.5);

    y += 8;
  });

  doc.save(`Customer_Directory_${Date.now()}.pdf`);
};

/**
 * Generate Individual Customer Profile Dossier PDF
 */
export const generateSingleCustomerDossierPDF = (
  customer: Customer,
  stats?: { totalOrders: number; totalValue: number }
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ProcureMRO - Customer Dossier', 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Official Corporate Profile Record • ID: ${customer.id}`, 14, 25);
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, 14, 30);

  // Customer Badge
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(145, 10, 52, 18, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(customer.id, 153, 18);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('VERIFIED CLIENT', 153, 24);

  // Main Card
  let y = 44;
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 30, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, 182, 30, 'S');

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(customer.companyName, 20, y + 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Remarks: ${customer.remarks || 'Standard MRO Corporate Client'}`, 20, y + 17);
  doc.text(`Registration Date: ${customer.createdAt || 'N/A'}`, 20, y + 23);

  if (stats) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(`Lifetime Business: Rs ${stats.totalValue.toLocaleString('en-IN')}`, 120, y + 17);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Orders Logged: ${stats.totalOrders}`, 120, y + 23);
  }

  // Two Column Information
  y = 82;
  const colW = 88;

  // Left Column: Contact & Location
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, colW, 70, 'S');

  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, colW, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CONTACT & LOCATION', 18, y + 5.5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  let cy = y + 16;

  doc.text('Key Contact Person:', 18, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(customer.contactPerson, 18, cy + 5);

  cy += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Mobile Number:', 18, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(customer.mobile, 18, cy + 5);

  cy += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Work Email:', 18, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(customer.email, 18, cy + 5);

  cy += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('City & State:', 18, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${customer.city}, ${customer.state} - ${customer.pincode}`, 18, cy + 5);

  // Right Column: Tax & Commercials
  doc.rect(108, y, colW, 70, 'S');
  doc.setFillColor(241, 245, 249);
  doc.rect(108, y, colW, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('STATUTORY & COMMERCIAL TERMS', 112, y + 5.5);

  cy = y + 16;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('GSTIN Number:', 112, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(customer.gstin, 112, cy + 5);

  cy += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('PAN Number:', 112, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(customer.pan, 112, cy + 5);

  cy += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Agreed Credit & Payment Terms:', 112, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(customer.paymentTerms, 112, cy + 5);

  // Address Section
  y = 158;
  doc.rect(14, y, 182, 38, 'S');
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('OFFICIAL BILLING & DISPATCH DESTINATIONS', 18, y + 5.5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Billing Address:', 18, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(customer.address, 18, y + 20, { maxWidth: 174 });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Default Delivery Address:', 18, y + 27);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(customer.deliveryAddress || customer.address, 18, y + 32, { maxWidth: 174 });

  // Footer Disclaimer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('ProcureMRO Supply Chain ERP • Confidential Master Record', 14, 280);

  doc.save(`Customer_${customer.id}_Dossier.pdf`);
};

/**
 * Generate Vendor Directory PDF
 */
export const generateVendorDirectoryPDF = (vendors: Vendor[], modeTitle = 'Enterprise Directory') => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ProcureMRO - Vendor & Supplier Directory', 14, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${modeTitle} • Total Certified Vendors: ${vendors.length} • Generated on ${new Date().toLocaleDateString('en-IN')}`, 14, 20);

  // Table Headers
  let y = 34;
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(14, y, 269, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('#', 17, y + 5.5);
  doc.text('ID', 26, y + 5.5);
  doc.text('Vendor Company Name', 46, y + 5.5);
  doc.text('Rating', 105, y + 5.5);
  doc.text('Brands Supplied', 120, y + 5.5);
  doc.text('Key Contact & Mobile', 180, y + 5.5);
  doc.text('GSTIN', 225, y + 5.5);
  doc.text('City', 260, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  vendors.forEach((v, idx) => {
    if (y > 185) {
      doc.addPage('a4', 'landscape');
      y = 18;
      doc.setFillColor(79, 70, 229);
      doc.rect(14, y, 269, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('#', 17, y + 5.5);
      doc.text('ID', 26, y + 5.5);
      doc.text('Vendor Company Name', 46, y + 5.5);
      doc.text('Rating', 105, y + 5.5);
      doc.text('Brands Supplied', 120, y + 5.5);
      doc.text('Key Contact & Mobile', 180, y + 5.5);
      doc.text('GSTIN', 225, y + 5.5);
      doc.text('City', 260, y + 5.5);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
    }

    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 269, 8, 'F');
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(14, y + 8, 283, y + 8);

    doc.setFontSize(7.5);
    doc.text(`${idx + 1}`, 17, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(v.id, 26, y + 5.5);
    doc.text(v.companyName.substring(0, 30), 46, y + 5.5);
    doc.text(`★ ${v.rating}`, 105, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.text((v.brandsSupplied || []).join(', ').substring(0, 32), 120, y + 5.5);
    doc.text(`${v.contactPerson} (${v.mobile})`.substring(0, 24), 180, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(v.gstin, 225, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(v.city.substring(0, 16), 260, y + 5.5);

    y += 8;
  });

  doc.save(`Vendor_Directory_${Date.now()}.pdf`);
};

/**
 * Generate Individual Vendor Dossier PDF
 */
export const generateSingleVendorDossierPDF = (
  vendor: Vendor,
  stats?: { totalOrders: number; totalCommitment: number }
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ProcureMRO - Vendor Supplier Dossier', 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Certified Distributor & OEM Partner Record • ID: ${vendor.id}`, 14, 25);
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, 14, 30);

  // Badge
  doc.setFillColor(79, 70, 229);
  doc.roundedRect(145, 10, 52, 18, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(vendor.id, 153, 18);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`RATING: ★ ${vendor.rating} / 5.0`, 153, 24);

  // Main Card
  let y = 44;
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 30, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, 182, 30, 'S');

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(vendor.companyName, 20, y + 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Location: ${vendor.city}, ${vendor.state} | Registered: ${vendor.createdAt || 'N/A'}`, 20, y + 17);
  doc.text(`Brands: ${(vendor.brandsSupplied || []).join(', ')}`, 20, y + 23);

  if (stats) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text(`Total POs: Rs ${stats.totalCommitment.toLocaleString('en-IN')}`, 120, y + 17);
    doc.setTextColor(71, 85, 105);
    doc.text(`Orders Awarded: ${stats.totalOrders}`, 120, y + 23);
  }

  // Two Column Information
  y = 82;
  const colW = 88;

  // Left Column
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, colW, 70, 'S');
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, colW, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('KEY CONTACT & LOGISTICS', 18, y + 5.5);

  let cy = y + 16;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Contact Person:', 18, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(vendor.contactPerson, 18, cy + 5);

  cy += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Mobile Number:', 18, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(vendor.mobile, 18, cy + 5);

  cy += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Email Address:', 18, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(vendor.email, 18, cy + 5);

  cy += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Delivery Terms:', 18, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(vendor.deliveryTerms || 'Door Delivery / Ex-Works', 18, cy + 5);

  // Right Column: Banking & Tax
  doc.rect(108, y, colW, 70, 'S');
  doc.setFillColor(241, 245, 249);
  doc.rect(108, y, colW, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('BANKING & STATUTORY DETAILS', 112, y + 5.5);

  cy = y + 16;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('GSTIN & PAN:', 112, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`GST: ${vendor.gstin} | PAN: ${vendor.pan}`, 112, cy + 5);

  cy += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Bank Name & A/C:', 112, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${vendor.bankDetails?.bankName} - ${vendor.bankDetails?.accountNumber}`, 112, cy + 5);

  cy += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('IFSC Code & Branch:', 112, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${vendor.bankDetails?.ifscCode} (${vendor.bankDetails?.branch || vendor.city})`, 112, cy + 5);

  cy += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Standard Payment Terms:', 112, cy);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(vendor.paymentTerms, 112, cy + 5);

  // Address Section
  y = 158;
  doc.rect(14, y, 182, 28, 'S');
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('REGISTERED WAREHOUSE / DISPATCH OFFICE', 18, y + 5.5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${vendor.address}, ${vendor.city}, ${vendor.state}`, 18, y + 16, { maxWidth: 174 });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('ProcureMRO Supply Chain ERP • Confidential Supplier Record', 14, 280);

  doc.save(`Vendor_${vendor.id}_Dossier.pdf`);
};

/**
 * CSV Import Parsers
 */
export const parseCSVToRows = (csvText: string): string[][] => {
  const clean = csvText.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r\n|\n|\r/);
  return lines.map((line) => {
    const row: string[] = [];
    let insideQuote = false;
    let entry = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    return row;
  });
};

export const parseCustomersCSV = (csvText: string): Omit<Customer, 'id' | 'createdAt'>[] => {
  const rows = parseCSVToRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const companyIdx = headers.findIndex((h) => h.includes('company') || h.includes('customer name') || h.includes('name'));
  const contactIdx = headers.findIndex((h) => h.includes('contact'));
  const mobileIdx = headers.findIndex((h) => h.includes('mobile') || h.includes('phone'));
  const emailIdx = headers.findIndex((h) => h.includes('email'));
  const gstinIdx = headers.findIndex((h) => h.includes('gst') || h.includes('gstin'));
  const panIdx = headers.findIndex((h) => h.includes('pan'));
  const termsIdx = headers.findIndex((h) => h.includes('terms') || h.includes('payment'));
  const cityIdx = headers.findIndex((h) => h.includes('city'));
  const stateIdx = headers.findIndex((h) => h.includes('state'));
  const pincodeIdx = headers.findIndex((h) => h.includes('pin') || h.includes('zip') || h.includes('postal'));
  const addressIdx = headers.findIndex((h) => h.includes('address'));
  const deliveryIdx = headers.findIndex((h) => h.includes('delivery'));

  const parsed: Omit<Customer, 'id' | 'createdAt'>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[0]) continue;

    const companyName = companyIdx !== -1 ? row[companyIdx] : row[1] || row[0];
    if (!companyName || companyName.trim() === '') continue;

    parsed.push({
      companyName: companyName.trim(),
      contactPerson: (contactIdx !== -1 ? row[contactIdx] : row[2]) || 'Procurement Officer',
      mobile: (mobileIdx !== -1 ? row[mobileIdx] : row[3]) || '',
      email: (emailIdx !== -1 ? row[emailIdx] : row[4]) || '',
      gstin: gstinIdx !== -1 && row[gstinIdx] ? row[gstinIdx].trim().toUpperCase() : '',
      pan: panIdx !== -1 && row[panIdx] ? row[panIdx].trim().toUpperCase() : '',
      paymentTerms: (termsIdx !== -1 ? row[termsIdx] : row[7]) || '30 Days Net',
      city: (cityIdx !== -1 ? row[cityIdx] : row[8]) || '',
      state: (stateIdx !== -1 ? row[stateIdx] : row[9]) || '',
      pincode: pincodeIdx !== -1 ? row[pincodeIdx] : '',
      address: (addressIdx !== -1 ? row[addressIdx] : row[10]) || '',
      deliveryAddress: (deliveryIdx !== -1 ? row[deliveryIdx] : (addressIdx !== -1 ? row[addressIdx] : row[10])) || '',
      remarks: 'Imported via CSV Data Exchange',
    });
  }

  return parsed;
};

export const parseVendorsCSV = (csvText: string): (Omit<Vendor, 'id' | 'createdAt'> & { parsedProducts?: ParsedVendorProduct[] })[] => {
  const rows = parseCSVToRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const companyIdx = headers.findIndex((h) => h.includes('company') || h.includes('vendor') || h.includes('name'));
  const contactIdx = headers.findIndex((h) => h.includes('contact'));
  const mobileIdx = headers.findIndex((h) => (h.includes('mobile') || h.includes('phone')) && !h.includes('alt'));
  const altMobileIdx = headers.findIndex((h) => h.includes('alternate') || h.includes('alt'));
  const emailIdx = headers.findIndex((h) => h.includes('email'));
  const gstinIdx = headers.findIndex((h) => h.includes('gst') || h.includes('gstin'));
  const panIdx = headers.findIndex((h) => h.includes('pan'));
  const ratingIdx = headers.findIndex((h) => h.includes('rating'));
  const termsIdx = headers.findIndex((h) => (h.includes('terms') || h.includes('payment')) && !h.includes('credit'));
  const creditIdx = headers.findIndex((h) => h.includes('credit'));
  const brandsIdx = headers.findIndex((h) => h.includes('brand') || h.includes('make') || h.includes('oem'));
  const categoriesIdx = headers.findIndex((h) => h.includes('category') || h.includes('categories'));
  const cityIdx = headers.findIndex((h) => h.includes('city'));
  const stateIdx = headers.findIndex((h) => h.includes('state'));
  const pincodeIdx = headers.findIndex((h) => h.includes('pin') || h.includes('postal'));
  const addressIdx = headers.findIndex((h) => h.includes('address'));
  const statusIdx = headers.findIndex((h) => h.includes('status'));
  const remarksIdx = headers.findIndex((h) => h.includes('remark'));

  // Product Detection Headers (Multi-item list OR itemized row)
  const productsIdx = headers.findIndex(
    (h) =>
      h.includes('product') ||
      h.includes('item') ||
      h.includes('catalog') ||
      h.includes('material') ||
      h.includes('dealt in')
  );
  const partNumberIdx = headers.findIndex((h) => h.includes('part') || h.includes('sku') || h.includes('model'));
  const rateIdx = headers.findIndex((h) => h.includes('rate') || h.includes('price') || h.includes('cost') || h.includes('mrp'));
  const uomIdx = headers.findIndex((h) => h.includes('uom') || h.includes('unit'));
  const hsnIdx = headers.findIndex((h) => h.includes('hsn'));
  const gstIdx = headers.findIndex((h) => h.includes('gst') || h.includes('tax'));
  const specIdx = headers.findIndex((h) => h.includes('spec') || h.includes('dimension') || h.includes('description'));

  const parsedMap = new Map<string, Omit<Vendor, 'id' | 'createdAt'> & { parsedProducts: ParsedVendorProduct[] }>();
  let lastVendorKey = '';

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[0]) continue;

    let companyName = companyIdx !== -1 ? row[companyIdx] : row[1] || row[0];
    companyName = (companyName || '').trim();

    // If companyName is blank but we have a previous vendor and row has product info, attach to previous vendor
    if (!companyName && lastVendorKey && (productsIdx !== -1 || partNumberIdx !== -1)) {
      companyName = lastVendorKey;
    }

    if (!companyName) continue;
    lastVendorKey = companyName;

    const brandsStr = brandsIdx !== -1 ? row[brandsIdx] : '';
    const rawBrands = brandsStr ? brandsStr.split(/[;,]/).map((b) => b.trim()).filter(Boolean) : [];
    
    // Auto-enrich brand details
    const primaryBrand = rawBrands[0] || 'Standard OEM';
    const brandEnrichment = getBrandEnrichment(primaryBrand);

    const catsStr = categoriesIdx !== -1 ? row[categoriesIdx] : '';
    const rawCats = catsStr ? catsStr.split(/[;,]/).map((c) => c.trim()).filter(Boolean) : [];
    // If no category explicitly specified in CSV, auto-add as per brand!
    const effectiveCats = rawCats.length > 0 ? rawCats : [brandEnrichment.category];

    const parsedStatus = statusIdx !== -1 && row[statusIdx]
      ? (row[statusIdx].toUpperCase().includes('INACT') ? 'INACTIVE' : row[statusIdx].toUpperCase().includes('BLOCK') ? 'BLOCKED' : 'ACTIVE')
      : 'ACTIVE';

    // Parse products for this row
    const rowProducts: ParsedVendorProduct[] = [];
    
    if (productsIdx !== -1 && row[productsIdx] && row[productsIdx].trim()) {
      const cellVal = row[productsIdx].trim();
      const extracted = parseVendorProductString(cellVal, rawBrands.length > 0 ? rawBrands : [brandEnrichment.canonicalName], effectiveCats);
      rowProducts.push(...extracted);
    }

    // Also check if this row has an itemized product (e.g. part number or rate provided directly)
    if (partNumberIdx !== -1 && row[partNumberIdx] && row[partNumberIdx].trim()) {
      const partNum = row[partNumberIdx].trim();
      const rateVal = rateIdx !== -1 && !isNaN(parseFloat(row[rateIdx].replace(/[^0-9.]/g, '')))
        ? parseFloat(row[rateIdx].replace(/[^0-9.]/g, ''))
        : undefined;

      const matchedExisting = rowProducts.find(
        (p) =>
          (p.partNumber && p.partNumber.toLowerCase() === partNum.toLowerCase()) ||
          (productsIdx !== -1 && row[productsIdx] && p.productName.toLowerCase().trim() === row[productsIdx].toLowerCase().trim())
      );

      if (matchedExisting) {
        matchedExisting.partNumber = partNum;
        if (rateVal !== undefined) matchedExisting.approxRate = rateVal;
        if (uomIdx !== -1 && row[uomIdx]) matchedExisting.uom = row[uomIdx];
        if (hsnIdx !== -1 && row[hsnIdx]) matchedExisting.hsnCode = row[hsnIdx];
      } else {
        const itemName = (productsIdx !== -1 && row[productsIdx] ? row[productsIdx].trim() : '') || `${brandEnrichment.canonicalName} Item ${partNum}`;
        rowProducts.push({
          productName: itemName,
          category: effectiveCats[0] || brandEnrichment.category,
          brand: brandEnrichment.canonicalName,
          partNumber: partNum,
          modelNumber: partNum,
          specification: specIdx !== -1 && row[specIdx] ? row[specIdx] : `${brandEnrichment.canonicalName} standard technical specifications`,
          uom: uomIdx !== -1 && row[uomIdx] ? row[uomIdx] : brandEnrichment.defaultUom,
          approxRate: rateVal,
          hsnCode: hsnIdx !== -1 && row[hsnIdx] ? row[hsnIdx] : brandEnrichment.defaultHsn,
          gstRate: gstIdx !== -1 && !isNaN(parseFloat(row[gstIdx])) ? parseFloat(row[gstIdx]) : brandEnrichment.defaultGst,
          stockQty: 50,
          description: `${brandEnrichment.canonicalName} genuine industrial component`,
        });
      }
    }

    // Auto-accumulate any brand mentioned in parsed products into vendor brandsSupplied
    const allRowBrands = Array.from(
      new Set([
        ...rawBrands,
        brandEnrichment.canonicalName,
        ...rowProducts.map((p) => p.brand).filter(Boolean) as string[],
      ])
    ).filter(Boolean);

    // Auto-accumulate categories as per brand and product
    const allRowCats = Array.from(
      new Set([
        ...effectiveCats,
        brandEnrichment.category,
        ...rowProducts.map((p) => p.category).filter(Boolean) as string[],
      ])
    ).filter(Boolean);

    const mapKey = companyName.toLowerCase();
    if (parsedMap.has(mapKey)) {
      // Merge products and brands into existing vendor
      const existing = parsedMap.get(mapKey)!;
      rowProducts.forEach((rp) => {
        const dup = existing.parsedProducts.some(
          (ep) =>
            ep.productName.toLowerCase() === rp.productName.toLowerCase() ||
            (ep.partNumber && rp.partNumber && ep.partNumber.toLowerCase() === rp.partNumber.toLowerCase())
        );
        if (!dup) existing.parsedProducts.push(rp);
      });
      allRowBrands.forEach((b) => {
        if (!existing.brandsSupplied.includes(b)) existing.brandsSupplied.push(b);
      });
      allRowCats.forEach((c) => {
        if (!existing.materialCategories?.includes(c)) existing.materialCategories?.push(c);
        if (!existing.productCategories.includes(c)) existing.productCategories.push(c);
      });
    } else {
      parsedMap.set(mapKey, {
        companyName,
        contactPerson: (contactIdx !== -1 ? row[contactIdx] : row[2]) || 'Sales Manager',
        mobile: (mobileIdx !== -1 ? row[mobileIdx] : row[3]) || '',
        alternateMobile: altMobileIdx !== -1 ? row[altMobileIdx] : '',
        email: (emailIdx !== -1 ? row[emailIdx] : row[4]) || '',
        gstin: gstinIdx !== -1 && row[gstinIdx] ? row[gstinIdx].trim().toUpperCase() : '',
        pan: panIdx !== -1 && row[panIdx] ? row[panIdx].trim().toUpperCase() : '',
        rating: ratingIdx !== -1 && parseFloat(row[ratingIdx]) ? parseFloat(row[ratingIdx]) : 4.8,
        paymentTerms: (termsIdx !== -1 ? row[termsIdx] : row[8]) || '30 Days Net',
        creditPeriod: (creditIdx !== -1 ? row[creditIdx] : '') || '30 Days',
        deliveryTerms: 'Door Delivery / Ex-Works',
        brandsSupplied: allRowBrands.length > 0 ? allRowBrands : [brandEnrichment.canonicalName],
        productCategories: allRowCats,
        materialCategories: allRowCats,
        city: (cityIdx !== -1 ? row[cityIdx] : row[9]) || '',
        state: (stateIdx !== -1 ? row[stateIdx] : row[10]) || '',
        pincode: pincodeIdx !== -1 ? row[pincodeIdx] : '',
        address: (addressIdx !== -1 ? row[addressIdx] : row[11]) || '',
        status: parsedStatus as any,
        bankDetails: {
          accountName: companyName,
          accountNumber: '',
          bankName: '',
          ifscCode: '',
          branch: cityIdx !== -1 ? row[cityIdx] : '',
        },
        remarks: remarksIdx !== -1 ? row[remarksIdx] : 'Imported via Data Exchange with Products',
        parsedProducts: rowProducts,
      });
    }
  }

  return Array.from(parsedMap.values());
};

/**
 * Parse uploaded Excel workbook (.xlsx / .xls) for Vendor Master with Products
 */
export const parseVendorsExcel = (data: ArrayBuffer): (Omit<Vendor, 'id' | 'createdAt'> & { parsedProducts?: ParsedVendorProduct[] })[] => {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  if (!jsonRows || jsonRows.length === 0) return [];

  const parsedMap = new Map<string, Omit<Vendor, 'id' | 'createdAt'> & { parsedProducts: ParsedVendorProduct[] }>();
  let lastVendorKey = '';

  jsonRows.forEach((row) => {
    // Look up by multiple possible header permutations
    const getVal = (keys: string[]) => {
      for (const k of Object.keys(row)) {
        const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const target of keys) {
          if (clean.includes(target.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
            return String(row[k]).trim();
          }
        }
      }
      return '';
    };

    let companyName = getVal(['vendorname', 'companyname', 'company', 'vendor']);
    
    // Multi-row itemized fallback
    const productsStr = getVal(['products', 'productsdealtin', 'items', 'catalog', 'producttypes', 'materialsdealtin']);
    const partNum = getVal(['partnumber', 'partno', 'modelnumber', 'sku']);

    if (!companyName && lastVendorKey && (productsStr || partNum)) {
      companyName = lastVendorKey;
    }

    if (!companyName) return;
    lastVendorKey = companyName;

    const brandsStr = getVal(['brandssupplied', 'brands', 'brand', 'make', 'oem']);
    const rawBrands = brandsStr ? brandsStr.split(/[;,]/).map((b) => b.trim()).filter(Boolean) : [];
    
    // Auto-enrich other things as per brand!
    const primaryBrand = rawBrands[0] || 'Standard OEM';
    const brandEnrichment = getBrandEnrichment(primaryBrand);

    const catsStr = getVal(['materialcategories', 'categories', 'category', 'productcategories']);
    const rawCats = catsStr ? catsStr.split(/[;,]/).map((c) => c.trim()).filter(Boolean) : [];
    const effectiveCats = rawCats.length > 0 ? rawCats : [brandEnrichment.category];

    const statusStr = getVal(['vendorstatus', 'status']);
    const parsedStatus = statusStr.toUpperCase().includes('INACT')
      ? 'INACTIVE'
      : statusStr.toUpperCase().includes('BLOCK')
      ? 'BLOCKED'
      : 'ACTIVE';

    const rowProducts: ParsedVendorProduct[] = [];
    if (productsStr) {
      const extracted = parseVendorProductString(productsStr, rawBrands.length > 0 ? rawBrands : [brandEnrichment.canonicalName], effectiveCats);
      rowProducts.push(...extracted);
    }

    if (partNum) {
      const rateVal = parseFloat(getVal(['rate', 'price', 'indicativerate', 'cost'])) || undefined;
      const matchedExisting = rowProducts.find(
        (p) =>
          (p.partNumber && p.partNumber.toLowerCase() === partNum.toLowerCase()) ||
          (productsStr && p.productName.toLowerCase().trim() === productsStr.toLowerCase().trim())
      );

      if (matchedExisting) {
        matchedExisting.partNumber = partNum;
        if (rateVal !== undefined) matchedExisting.approxRate = rateVal;
        const uomVal = getVal(['uom', 'unit']);
        if (uomVal) matchedExisting.uom = uomVal;
        const hsnVal = getVal(['hsn', 'hsncode']);
        if (hsnVal) matchedExisting.hsnCode = hsnVal;
      } else {
        const itemName = getVal(['itemname', 'productname']) || `${brandEnrichment.canonicalName} Item ${partNum}`;
        rowProducts.push({
          productName: itemName,
          category: effectiveCats[0] || brandEnrichment.category,
          brand: brandEnrichment.canonicalName,
          partNumber: partNum,
          modelNumber: partNum,
          specification: getVal(['specification', 'spec']) || `${brandEnrichment.canonicalName} engineering specifications`,
          uom: getVal(['uom', 'unit']) || brandEnrichment.defaultUom,
          approxRate: rateVal,
          hsnCode: getVal(['hsn', 'hsncode']) || brandEnrichment.defaultHsn,
          gstRate: parseFloat(getVal(['gst', 'tax'])) || brandEnrichment.defaultGst,
          stockQty: 50,
          description: `${brandEnrichment.canonicalName} genuine industrial item`,
        });
      }
    }

    const allRowBrands = Array.from(
      new Set([
        ...rawBrands,
        brandEnrichment.canonicalName,
        ...rowProducts.map((p) => p.brand).filter(Boolean) as string[],
      ])
    ).filter(Boolean);

    const allRowCats = Array.from(
      new Set([
        ...effectiveCats,
        brandEnrichment.category,
        ...rowProducts.map((p) => p.category).filter(Boolean) as string[],
      ])
    ).filter(Boolean);

    const mapKey = companyName.toLowerCase();
    if (parsedMap.has(mapKey)) {
      const existing = parsedMap.get(mapKey)!;
      rowProducts.forEach((rp) => {
        const dup = existing.parsedProducts.some(
          (ep) =>
            ep.productName.toLowerCase() === rp.productName.toLowerCase() ||
            (ep.partNumber && rp.partNumber && ep.partNumber.toLowerCase() === rp.partNumber.toLowerCase())
        );
        if (!dup) existing.parsedProducts.push(rp);
      });
      allRowBrands.forEach((b) => {
        if (!existing.brandsSupplied.includes(b)) existing.brandsSupplied.push(b);
      });
      allRowCats.forEach((c) => {
        if (!existing.materialCategories?.includes(c)) existing.materialCategories?.push(c);
        if (!existing.productCategories.includes(c)) existing.productCategories.push(c);
      });
    } else {
      parsedMap.set(mapKey, {
        companyName,
        contactPerson: getVal(['contactperson', 'contact']) || 'Sales Manager',
        mobile: getVal(['mobilenumber', 'mobile', 'phone']) || '',
        alternateMobile: getVal(['alternatemobilenumber', 'alternatemobile', 'altmobile']),
        email: getVal(['emailaddress', 'email', 'mail']) || '',
        gstin: getVal(['gstin', 'gst']).toUpperCase().trim(),
        pan: getVal(['pan', 'pannumber']).toUpperCase().trim(),
        rating: parseFloat(getVal(['rating'])) || 4.8,
        paymentTerms: getVal(['paymentterms', 'terms']) || '30 Days Net',
        creditPeriod: getVal(['creditperiod', 'credit']) || '30 Days',
        deliveryTerms: 'Door Delivery / Ex-Works',
        brandsSupplied: allRowBrands.length > 0 ? allRowBrands : [brandEnrichment.canonicalName],
        productCategories: allRowCats,
        materialCategories: allRowCats,
        city: getVal(['city']) || '',
        state: getVal(['state']) || '',
        pincode: getVal(['pincode', 'pin', 'postalcode']) || '',
        address: getVal(['companyaddress', 'address']) || '',
        status: parsedStatus as any,
        bankDetails: {
          accountName: companyName,
          accountNumber: '',
          bankName: '',
          ifscCode: '',
          branch: getVal(['city']) || '',
        },
        remarks: getVal(['remarks', 'notes', 'remark']) || 'Imported via Excel Master Exchange with Products',
        parsedProducts: rowProducts,
      });
    }
  });

  return Array.from(parsedMap.values());
};

/**
 * Export Product Catalog to CSV
 */
export const exportProductsToCSV = (
  products: ProductItem[],
  filename = 'ProcureMRO_Product_Catalog.csv'
) => {
  const headers = [
    'Product ID',
    'Item Name',
    'Category',
    'Sub Category',
    'Brand',
    'Part Number / Model',
    'Specification',
    'UOM',
    'Indicative Rate (INR)',
    'HSN Code',
    'GST Rate (%)',
    'Stock Qty',
    'Description',
  ];

  const rows: string[] = [];
  rows.push(headers.map(escapeCSV).join(','));

  products.forEach((p) => {
    const row = [
      p.id,
      p.itemName,
      p.category,
      p.subCategory || '',
      p.brand,
      p.partNumber || p.modelNumber,
      p.specification,
      p.uom,
      p.approxRate ?? '',
      p.hsnCode || '8482',
      p.gstRate ?? 18,
      p.stockQty ?? 0,
      p.description || '',
    ];
    rows.push(row.map(escapeCSV).join(','));
  });

  const csvContent = '\uFEFF' + rows.join('\r\n');
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
};

/**
 * Parse Product Catalog CSV for bulk import
 */
export const parseProductsCSV = (csvText: string): Omit<ProductItem, 'id'>[] => {
  const rows = parseCSVToRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const nameIdx = headers.findIndex((h) => h.includes('item') || h.includes('name') || h.includes('product') || h.includes('title'));
  const catIdx = headers.findIndex((h) => h.includes('category') && !h.includes('sub'));
  const subCatIdx = headers.findIndex((h) => h.includes('sub') && h.includes('cat'));
  const brandIdx = headers.findIndex((h) => h.includes('brand') || h.includes('make') || h.includes('oem'));
  const partIdx = headers.findIndex((h) => h.includes('part') || h.includes('sku') || h.includes('code'));
  const modelIdx = headers.findIndex((h) => h.includes('model'));
  const specIdx = headers.findIndex((h) => h.includes('spec'));
  const uomIdx = headers.findIndex((h) => h.includes('uom') || h.includes('unit'));
  const rateIdx = headers.findIndex((h) => h.includes('rate') || h.includes('price') || h.includes('cost') || h.includes('mrp'));
  const hsnIdx = headers.findIndex((h) => h.includes('hsn'));
  const gstIdx = headers.findIndex((h) => h.includes('gst') || h.includes('tax'));
  const stockIdx = headers.findIndex((h) => h.includes('stock') || h.includes('qty'));
  const descIdx = headers.findIndex((h) => h.includes('desc'));

  const parsed: Omit<ProductItem, 'id'>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[0]) continue;

    const itemName = nameIdx !== -1 ? row[nameIdx] : row[1] || row[0];
    if (!itemName || itemName.trim() === '') continue;

    const approxRate = rateIdx !== -1 && !isNaN(parseFloat(row[rateIdx].replace(/[^0-9.]/g, '')))
      ? parseFloat(row[rateIdx].replace(/[^0-9.]/g, ''))
      : undefined;

    const stockQty = stockIdx !== -1 && !isNaN(parseInt(row[stockIdx].replace(/[^0-9]/g, ''), 10))
      ? parseInt(row[stockIdx].replace(/[^0-9]/g, ''), 10)
      : undefined;

    const gstRate = gstIdx !== -1 && !isNaN(parseFloat(row[gstIdx].replace(/[^0-9.]/g, '')))
      ? parseFloat(row[gstIdx].replace(/[^0-9.]/g, ''))
      : 18;

    parsed.push({
      itemName: itemName.trim(),
      category: (catIdx !== -1 ? row[catIdx] : row[2]) || 'Industrial consumable',
      subCategory: subCatIdx !== -1 ? row[subCatIdx] : undefined,
      brand: (brandIdx !== -1 ? row[brandIdx] : row[4]) || 'Standard OEM',
      partNumber: (partIdx !== -1 ? row[partIdx] : row[5]) || `PN-${String(i + 1).padStart(4, '0')}`,
      modelNumber: modelIdx !== -1 ? row[modelIdx] : (partIdx !== -1 ? row[partIdx] : 'STD'),
      specification: (specIdx !== -1 ? row[specIdx] : row[6]) || 'Standard industrial specifications',
      uom: (uomIdx !== -1 ? row[uomIdx] : row[7]) || 'NOS',
      description: (descIdx !== -1 ? row[descIdx] : row[8]) || 'MRO catalog standard specification item',
      approxRate,
      hsnCode: hsnIdx !== -1 ? row[hsnIdx] : '8482',
      gstRate,
      stockQty,
    });
  }

  return parsed;
};

/**
 * Parse uploaded Excel workbook (.xlsx / .xls) for Product Master
 */
export const parseProductsExcel = (data: ArrayBuffer): Omit<ProductItem, 'id'>[] => {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  if (!jsonRows || jsonRows.length === 0) return [];

  const parsed: Omit<ProductItem, 'id'>[] = [];

  jsonRows.forEach((row, rowIdx) => {
    const getVal = (keys: string[]) => {
      for (const k of Object.keys(row)) {
        const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const target of keys) {
          if (clean.includes(target.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
            return String(row[k]).trim();
          }
        }
      }
      return '';
    };

    const itemName = getVal(['itemname', 'productname', 'item', 'product', 'name', 'description', 'title', 'material']);
    if (!itemName) return;

    const brand = getVal(['brand', 'make', 'oem', 'manufacturer']) || 'Standard OEM';
    const category = getVal(['category', 'materialcategory', 'productcategory']) || 'General MRO';
    const subCategory = getVal(['subcategory', 'subcat']) || undefined;
    const partNumber = getVal(['partnumber', 'partno', 'sku', 'itemcode', 'code']) || `PN-${String(rowIdx + 1).padStart(4, '0')}-${Math.floor(Math.random() * 900 + 100)}`;
    const modelNumber = getVal(['modelnumber', 'model', 'partnumber']) || 'STD';
    const specification = getVal(['specification', 'specs', 'technicalspec']) || itemName;
    const uom = getVal(['uom', 'unit', 'unitofmeasure']) || 'NOS';
    const description = getVal(['description', 'details', 'remarks']) || itemName;

    const mrpStr = getVal(['mrp', 'maximumretailprice', 'listprice']);
    const mrp = mrpStr && !isNaN(parseFloat(mrpStr.replace(/[^0-9.]/g, '')))
      ? parseFloat(mrpStr.replace(/[^0-9.]/g, ''))
      : undefined;

    const discountStr = getVal(['discountpercentage', 'discountpercent', 'discount', 'disc']);
    const discountPercentage = discountStr && !isNaN(parseFloat(discountStr.replace(/[^0-9.]/g, '')))
      ? parseFloat(discountStr.replace(/[^0-9.]/g, ''))
      : undefined;

    const rateStr = getVal(['approxrate', 'rate', 'price', 'unitprice', 'cost', 'netpurchaserate', 'netrate']);
    let approxRate = rateStr && !isNaN(parseFloat(rateStr.replace(/[^0-9.]/g, '')))
      ? parseFloat(rateStr.replace(/[^0-9.]/g, ''))
      : undefined;

    // Calculation rule: Net Purchase Rate = MRP - (MRP * Discount % / 100)
    let netPurchaseRate = approxRate;
    if (mrp && discountPercentage) {
      netPurchaseRate = Math.round(mrp * (1 - discountPercentage / 100));
      if (!approxRate) approxRate = netPurchaseRate;
    }

    const manufacturerCode = getVal(['manufacturercode', 'mfgcode', 'oemcode']) || undefined;

    const stockStr = getVal(['stockqty', 'stock', 'quantity', 'qty']);
    const stockQty = stockStr && !isNaN(parseInt(stockStr.replace(/[^0-9]/g, ''), 10))
      ? parseInt(stockStr.replace(/[^0-9]/g, ''), 10)
      : undefined;

    const gstStr = getVal(['gstrate', 'gst', 'tax', 'taxrate']);
    const gstRate = gstStr && !isNaN(parseFloat(gstStr.replace(/[^0-9.]/g, '')))
      ? parseFloat(gstStr.replace(/[^0-9.]/g, ''))
      : 18;

    const hsnCode = getVal(['hsncode', 'hsn', 'sac']) || '8482';

    parsed.push({
      itemName,
      category,
      subCategory,
      brand,
      partNumber,
      modelNumber,
      manufacturerCode,
      specification,
      uom,
      description,
      mrp,
      discountPercentage,
      discountType: discountPercentage ? 'PERCENTAGE' : 'DIRECT',
      netPurchaseRate,
      approxRate,
      hsnCode,
      gstRate,
      stockQty,
      status: 'ACTIVE',
    });
  });

  return parsed;
};

/**
 * Parse uploaded Excel workbook (.xlsx / .xls) for Customer Master
 */
export const parseCustomersExcel = (data: ArrayBuffer): Omit<Customer, 'id' | 'createdAt'>[] => {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  if (!jsonRows || jsonRows.length === 0) return [];

  const parsed: Omit<Customer, 'id' | 'createdAt'>[] = [];

  jsonRows.forEach((row) => {
    const getVal = (keys: string[]) => {
      for (const k of Object.keys(row)) {
        const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const target of keys) {
          if (clean.includes(target.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
            return String(row[k]).trim();
          }
        }
      }
      return '';
    };

    const companyName = getVal(['companyname', 'customername', 'company', 'client', 'customer']);
    if (!companyName) return;

    parsed.push({
      companyName,
      contactPerson: getVal(['contactperson', 'contact', 'person', 'lead']) || 'Procurement Incharge',
      mobile: getVal(['mobile', 'phone', 'contactnumber']) || '+91 98000 00000',
      email: getVal(['email', 'mail']) || `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`,
      address: getVal(['address', 'registeredaddress', 'location']) || 'Industrial Area',
      city: getVal(['city']) || 'Mumbai',
      state: getVal(['state']) || 'Maharashtra',
      pincode: getVal(['pincode', 'pin', 'zip']) || '400001',
      gstin: getVal(['gstin', 'gst', 'gstnumber']) || '',
      pan: getVal(['pan', 'pannumber']) || '',
      paymentTerms: getVal(['paymentterms', 'terms', 'creditperiod']) || '30 Days Net',
      deliveryAddress: getVal(['deliveryaddress', 'plantaddress']) || '',
      remarks: getVal(['remarks', 'notes']) || 'Imported via Excel workbook',
    });
  });

  return parsed;
};

/**
 * Generate Sample CSV Template for Customers
 */
export const downloadSampleCustomerCSV = () => {
  const content = `\uFEFF"Customer ID","Company Name","Contact Person","Mobile","Email","GSTIN","PAN","Payment Terms","City","State","Pincode","Registered Address","Delivery Address","Remarks"
"CUST-SAMPLE-1","Larsen & Toubro Heavy Engineering","Rajesh Deshmukh (Procurement Lead)","+91 98200 11223","rajesh.deshmukh@larsentoubro.com","27AAACL1234F1Z1","AAACL1234F","45 Days Net","Mumbai","Maharashtra","400072","L&T Gate 3, Powai Campus","Stores Dept, Gate 5, Powai, Mumbai","Key EPC account"
"CUST-SAMPLE-2","Mahindra & Mahindra Automotive Ltd","Anjali Mehra (Stores Head)","+91 97110 44556","anjali.mehra@mahindra.com","27AAACM5678G1Z2","AAACM5678G","30 Days Net","Pune","Maharashtra","411018","Akurdi Plant, Pune","Chakan Auto Component Receiving Dock, Pune","Tier 1 OEM"`;
  downloadFile(content, 'Sample_Customer_Import_Template.csv', 'text/csv;charset=utf-8;');
};

/**
 * Generate Sample CSV Template for Vendors with Products & Brands
 */
export const downloadSampleVendorCSV = () => {
  const content = `\uFEFF"Company Name","Contact Person","Mobile","Email","City","State","Address","GSTIN","PAN","Brands Supplied","Material Categories (Comma-separated)","Products / Items Dealt In","Part Number","Indicative Rate (INR)","HSN Code","UOM","GST Rate (%)","Payment Terms","MSME Status","Status","Remarks"
"Apex Industrial Bearings & Spares Pvt Ltd","Rajesh Kulkarni","+91 98220 99887","sales@apexindustrial.com","Pune","Maharashtra","Plot W-42, MIDC Bhosari Industrial Area","27AABCA1234F1Z8","AABCA1234F","SKF, Timken, FAG","Bearings, Mechanical Spare Parts, Seals / O-Rings","Deep Groove Ball Bearing 6205-2RSH; Spherical Roller Bearing 22212; Pillow Block UCF 205; Tapered Roller Bearing 30205","6205-2RSH","485.00","84821010","NOS","18","30 Days Net","Small","ACTIVE","Authorized SKF Distributor - Products & Brand Auto-Enriched"
"Siemens & Schneider Automation Hub","Amitabh Roy","+91 98301 77665","orders@automationhub.in","Kolkata","West Bengal","Sector V, Salt Lake Electronic Complex","19AAACG5544K1ZR","AAACG5544K","Siemens, Schneider, ABB","Automation / PLC / HMI, Electrical, Switchgear","3-Phase Induction Motor 5.5kW IE3; Low Voltage AC Drive ACS580 11kW; Air Circuit Breaker 1600A","ACS580-01-026A-4","38500.00","85044090","SET","18","50% Advance, Balance on Dispatch","Medium","ACTIVE","System Integrator & Automation Spares Stockist"
"Festo & SMC Pneumatic Flow Systems","Sunil Nair","+91 98205 11223","sales@festosmcflow.in","Chennai","Tamil Nadu","Ambattur Industrial Estate, 3rd Main Road","33AAACF8899P1Z4","AAACF8899P","Festo, SMC, Janatics","Pneumatics & Cylinders, Valves, Fittings","Double Acting Cylinder DNC-40-100; Solenoid Valve 5/2 Way 24V DC; Polyurethane Tubing PU-8x5.5; FRL Unit 1/2 Inch","DNC-40-100-PPV-A","4200.00","84123100","NOS","18","30 Days Net","Small","ACTIVE","Auto-fills HSN 84123100 & 18% GST as per Brand"
"Omron Industrial Automation & Sensors","Vikram Patil","+91 98450 33441","info@omronsensors.co.in","Bengaluru","Karnataka","Peenya 2nd Stage, Industrial Area","29AAACO1122M1Z5","AAACO1122M","Omron","Sensors, Automation / PLC / HMI","Inductive Proximity Sensor E2E-X5ME1","E2E-X5ME1","1850.00","85365090","NOS","18","30 Days Net","Small","ACTIVE","Multi-row Itemized Example - Product 1"
"Omron Industrial Automation & Sensors","Vikram Patil","+91 98450 33441","info@omronsensors.co.in","Bengaluru","Karnataka","Peenya 2nd Stage, Industrial Area","29AAACO1122M1Z5","AAACO1122M","Omron","Sensors, Automation / PLC / HMI","Photoelectric Sensor E3Z-T61 2M","E3Z-T61","2650.00","85365090","NOS","18","30 Days Net","Small","ACTIVE","Multi-row Itemized Example - Product 2"`;
  downloadFile(content, 'ProcureMRO_Vendor_With_Products_Template.csv', 'text/csv;charset=utf-8;');
};

export const downloadSampleVendorWithProductsCSV = downloadSampleVendorCSV;

/**
 * Generate Multi-Sheet Excel (.xlsx) Template for Vendors with Product Module & Brand Auto-Enrichment Guide
 */
export const downloadSampleVendorExcel = () => {
  // Sheet 1: Vendor & Product Master Template Data
  const sampleVendorsWithProducts = [
    {
      'Company Name': 'Apex Industrial Bearings & Spares Pvt Ltd',
      'Contact Person': 'Rajesh Kulkarni',
      Mobile: '+91 98220 99887',
      Email: 'sales@apexindustrial.com',
      City: 'Pune',
      State: 'Maharashtra',
      Address: 'Plot W-42, MIDC Bhosari Industrial Area',
      GSTIN: '27AABCA1234F1Z8',
      PAN: 'AABCA1234F',
      'Brands Supplied': 'SKF, Timken, FAG',
      'Material Categories (Comma-separated)': 'Bearings, Mechanical Spare Parts, Seals / O-Rings',
      'Products / Items Dealt In': 'Deep Groove Ball Bearing 6205-2RSH; Spherical Roller Bearing 22212; Pillow Block UCF 205; Tapered Roller Bearing 30205',
      'Part Number': '6205-2RSH',
      'Indicative Rate (INR)': 485.00,
      'HSN Code': '84821010',
      'UOM': 'NOS',
      'GST Rate (%)': 18,
      'Payment Terms': '30 Days Net',
      'MSME Status': 'Small',
      Status: 'ACTIVE',
      Remarks: 'Authorized SKF Distributor - Products auto-extracted & linked to vendor',
    },
    {
      'Company Name': 'Siemens & Schneider Automation Hub',
      'Contact Person': 'Amitabh Roy',
      Mobile: '+91 98301 77665',
      Email: 'orders@automationhub.in',
      City: 'Kolkata',
      State: 'West Bengal',
      Address: 'Sector V, Salt Lake Electronic Complex',
      GSTIN: '19AAACG5544K1ZR',
      PAN: 'AAACG5544K',
      'Brands Supplied': 'Siemens, Schneider, ABB',
      'Material Categories (Comma-separated)': 'Automation / PLC / HMI, Electrical, Switchgear',
      'Products / Items Dealt In': '3-Phase Induction Motor 5.5kW IE3; Low Voltage AC Drive ACS580 11kW; Air Circuit Breaker 1600A',
      'Part Number': 'ACS580-01-026A-4',
      'Indicative Rate (INR)': 38500.00,
      'HSN Code': '85044090',
      'UOM': 'SET',
      'GST Rate (%)': 18,
      'Payment Terms': '50% Advance, Balance on Dispatch',
      'MSME Status': 'Medium',
      Status: 'ACTIVE',
      Remarks: 'System Integrator & Automation Spares Stockist',
    },
    {
      'Company Name': 'Festo & SMC Pneumatic Flow Systems',
      'Contact Person': 'Sunil Nair',
      Mobile: '+91 98205 11223',
      Email: 'sales@festosmcflow.in',
      City: 'Chennai',
      State: 'Tamil Nadu',
      Address: 'Ambattur Industrial Estate, 3rd Main Road',
      GSTIN: '33AAACF8899P1Z4',
      PAN: 'AAACF8899P',
      'Brands Supplied': 'Festo, SMC, Janatics',
      'Material Categories (Comma-separated)': 'Pneumatics & Cylinders, Valves, Fittings',
      'Products / Items Dealt In': 'Double Acting Cylinder DNC-40-100; Solenoid Valve 5/2 Way 24V DC; Polyurethane Tubing PU-8x5.5; FRL Unit 1/2 Inch',
      'Part Number': 'DNC-40-100-PPV-A',
      'Indicative Rate (INR)': 4200.00,
      'HSN Code': '84123100',
      'UOM': 'NOS',
      'GST Rate (%)': 18,
      'Payment Terms': '30 Days Net',
      'MSME Status': 'Small',
      Status: 'ACTIVE',
      Remarks: 'Auto-fills HSN 84123100 & 18% GST as per Brand',
    },
    {
      'Company Name': 'Omron Industrial Automation & Sensors',
      'Contact Person': 'Vikram Patil',
      Mobile: '+91 98450 33441',
      Email: 'info@omronsensors.co.in',
      City: 'Bengaluru',
      State: 'Karnataka',
      Address: 'Peenya 2nd Stage, Industrial Area',
      GSTIN: '29AAACO1122M1Z5',
      PAN: 'AAACO1122M',
      'Brands Supplied': 'Omron',
      'Material Categories (Comma-separated)': 'Sensors, Automation / PLC / HMI',
      'Products / Items Dealt In': 'Inductive Proximity Sensor E2E-X5ME1',
      'Part Number': 'E2E-X5ME1',
      'Indicative Rate (INR)': 1850.00,
      'HSN Code': '85365090',
      'UOM': 'NOS',
      'GST Rate (%)': 18,
      'Payment Terms': '30 Days Net',
      'MSME Status': 'Small',
      Status: 'ACTIVE',
      Remarks: 'Itemized Multi-Row Format (Row 1 of 2)',
    },
    {
      'Company Name': 'Omron Industrial Automation & Sensors',
      'Contact Person': 'Vikram Patil',
      Mobile: '+91 98450 33441',
      Email: 'info@omronsensors.co.in',
      City: 'Bengaluru',
      State: 'Karnataka',
      Address: 'Peenya 2nd Stage, Industrial Area',
      GSTIN: '29AAACO1122M1Z5',
      PAN: 'AAACO1122M',
      'Brands Supplied': 'Omron',
      'Material Categories (Comma-separated)': 'Sensors, Automation / PLC / HMI',
      'Products / Items Dealt In': 'Photoelectric Sensor E3Z-T61 2M',
      'Part Number': 'E3Z-T61',
      'Indicative Rate (INR)': 2650.00,
      'HSN Code': '85365090',
      'UOM': 'NOS',
      'GST Rate (%)': 18,
      'Payment Terms': '30 Days Net',
      'MSME Status': 'Small',
      Status: 'ACTIVE',
      Remarks: 'Itemized Multi-Row Format (Row 2 of 2, same vendor)',
    },
  ];

  const wsVendors = XLSX.utils.json_to_sheet(sampleVendorsWithProducts);
  wsVendors['!cols'] = [
    { wch: 38 }, // Company Name
    { wch: 18 }, // Contact Person
    { wch: 16 }, // Mobile
    { wch: 26 }, // Email
    { wch: 14 }, // City
    { wch: 16 }, // State
    { wch: 36 }, // Address
    { wch: 18 }, // GSTIN
    { wch: 14 }, // PAN
    { wch: 24 }, // Brands Supplied
    { wch: 36 }, // Material Categories
    { wch: 55 }, // Products / Items Dealt In
    { wch: 20 }, // Part Number
    { wch: 18 }, // Indicative Rate (INR)
    { wch: 14 }, // HSN Code
    { wch: 10 }, // UOM
    { wch: 12 }, // GST Rate (%)
    { wch: 24 }, // Payment Terms
    { wch: 14 }, // MSME Status
    { wch: 12 }, // Status
    { wch: 36 }, // Remarks
  ];

  // Sheet 2: Brand Auto-Enrichment Knowledge Index
  const brandEntries = Object.values(MRO_BRAND_KNOWLEDGE).map((b) => ({
    'OEM Brand Name': b.canonicalName,
    'Auto-Enriched Category': b.category,
    'Default HSN Code': b.defaultHsn,
    'Standard GST (%)': b.defaultGst,
    'Standard UOM': b.defaultUom,
    'Origin Country': b.country,
    'Sample Products Auto-Linked': b.sampleProducts.join('; '),
    'Auto-Enrichment Behavior': 'When you supply this brand, Category, HSN Code, UOM, and GST are automatically filled by the system without manual input.',
  }));

  const wsBrands = XLSX.utils.json_to_sheet(brandEntries);
  wsBrands['!cols'] = [
    { wch: 20 },
    { wch: 24 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 60 },
    { wch: 65 },
  ];

  // Sheet 3: Format Instructions
  const instructions = [
    {
      'Topic / Feature': '1. How to add Product Data in Vendor Import',
      'Format & Guidance': 'Simply enter the products supplied by the vendor in the "Products / Items Dealt In" column, separated by semicolons (;) or commas. No need to manually fill Part Numbers, HSN codes, UOM, or rates!',
    },
    {
      'Topic / Feature': '2. Automatic Brand Auto-Enrichment Engine',
      'Format & Guidance': 'When you enter known industrial brands (like SKF, Festo, ABB, Siemens, Schneider, SMC, Omron, Danfoss, Timken, etc.), the system automatically populates the Category, HSN Code, UOM, and 18% GST rate!',
    },
    {
      'Topic / Feature': '3. Semicolon-Delimited Products Syntax',
      'Format & Guidance': 'Example: "Deep Groove Ball Bearing 6205-2RSH; Spherical Roller Bearing 22212; Pillow Block UCF 205". Each product will be parsed, enriched, and linked to the vendor catalog.',
    },
    {
      'Topic / Feature': '4. Multi-Row Vendor Itemization',
      'Format & Guidance': 'If you repeat the same Company Name across multiple rows, the system groups all rows under a single Vendor and attaches every line item to that vendor catalog.',
    },
    {
      'Topic / Feature': '5. Automatic Master Catalog Synchronization',
      'Format & Guidance': 'All products imported through this template are automatically registered in the Global Product Master and mapped to the vendor for 1-click RFQ matching.',
    },
  ];

  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 35 }, { wch: 95 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsVendors, 'Vendors_&_Products_Template');
  XLSX.utils.book_append_sheet(wb, wsBrands, 'Brand_Auto_Enrichment_Index');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Import_Instructions');

  XLSX.writeFile(wb, 'ProcureMRO_Vendor_Master_With_Products_Template.xlsx');
};


/**
 * Generate Sample CSV Template for Products
 */
export const downloadSampleProductCSV = () => {
  const content = `\uFEFF"Item Name","Category","Sub Category","Brand","Part Number","Model Number","Specification","UOM","Indicative Rate (INR)","HSN Code","GST Rate (%)","Stock Qty","Description"
"Deep Groove Ball Bearing 6205-2RSH","Bearing","Deep Groove","SKF","6205-2RSH","6205-2RSH/C3","d=25mm, D=52mm, B=15mm, Rubber seals both sides, C3 clearance","NOS","485.00","84821010","18","120","SKF original standard industrial ball bearing"
"3-Phase Squirrel Cage Induction Motor 5.5kW","Motor","Induction","ABB","M2BAX 132SMB4","132SMB4","5.5kW / 7.5HP, 1450 RPM, 415V 50Hz, Foot Mounted B3, IP55","NOS","32500.00","85015210","18","8","ABB high efficiency IE3 motor"
"Flange Mounted Flexible Coupling FCL 140","Machine spare","Coupling","Fenner","FCL-140-PB","FCL 140","Max bore 42mm, Nominal torque 160 Nm, Nitrile rubber bush set","SET","2150.00","84836090","18","25","Fenner industrial pin bush coupling"`;
  downloadFile(content, 'Sample_Product_Import_Template.csv', 'text/csv;charset=utf-8;');
};

/**
 * Generate Product Catalog PDF
 */
export const generateProductCatalogPDF = (products: ProductItem[], catalogTitle = 'Master Product Catalog') => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ProcureMRO - Master Product & Catalog Registry', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `${catalogTitle} | Total Items: ${products.length} | Generated: ${new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`,
    14,
    18
  );

  // Table Column Headers
  const tableStartY = 30;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(14, tableStartY, pageWidth - 28, 8, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, tableStartY, pageWidth - 28, 8, 'S');

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');

  doc.text('SKU / ID', 16, tableStartY + 5.5);
  doc.text('Item Description & Specification', 42, tableStartY + 5.5);
  doc.text('Category', 125, tableStartY + 5.5);
  doc.text('Brand / OEM', 165, tableStartY + 5.5);
  doc.text('Part Number', 200, tableStartY + 5.5);
  doc.text('UOM', 235, tableStartY + 5.5);
  doc.text('Approx Rate (INR)', 255, tableStartY + 5.5);

  let currentY = tableStartY + 8;

  products.forEach((p, idx) => {
    if (currentY > pageHeight - 16) {
      doc.addPage();
      currentY = 20;
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, currentY, pageWidth - 28, 9, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(14, currentY + 9, pageWidth - 14, currentY + 9);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(p.id, 16, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const itemNameTrunc = p.itemName.length > 45 ? p.itemName.substring(0, 42) + '...' : p.itemName;
    doc.text(itemNameTrunc, 42, currentY + 4);

    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const specTrunc = (p.specification || p.description || '').substring(0, 55);
    doc.text(specTrunc, 42, currentY + 7.5);

    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(p.category, 125, currentY + 6);
    doc.text(p.brand, 165, currentY + 6);
    doc.text(p.partNumber || p.modelNumber || '-', 200, currentY + 6);
    doc.text(p.uom, 235, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    const rateStr = p.approxRate ? `₹${p.approxRate.toLocaleString('en-IN')}` : '-';
    doc.text(rateStr, 255, currentY + 6);

    currentY += 9;
  });

  return doc;
};
