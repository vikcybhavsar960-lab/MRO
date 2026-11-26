import * as XLSX from 'xlsx';
import { CustomerRequirement, MaterialCategory, RequirementItem, Vendor } from '../types';
import { recommendCategoryForRequirement, recommendVendorsForRequirement } from './categoryMatchingService';
import { downloadSampleVendorExcel } from './dataExportService';

export interface ParsedRequirementRow {
  rowNumber: number;
  itemName: string;
  description: string;
  specification: string;
  quantity: number;
  uom: string;
  requiredDate: string;
  priority: 'High' | 'Medium' | 'Low';
  remarks: string;
  recommendedCategory: string;
  subCategory?: string;
  confidenceScore: number;
  recommendedVendorCount: number;
  recommendedVendorNames: string[];
  isDuplicate: boolean;
  errors: string[];
  isValid: boolean;
}

export interface BulkImportAnalysisResult {
  totalRows: number;
  validRows: ParsedRequirementRow[];
  invalidRows: ParsedRequirementRow[];
  readyCount: number;
  errorCount: number;
  duplicateCount: number;
}

/**
 * Parses an Excel or CSV file buffer/arrayBuffer into validated Requirement Rows
 */
export async function parseRequirementExcelFile(
  file: File,
  categories: MaterialCategory[],
  vendors: Vendor[],
  existingRequirements: CustomerRequirement[]
): Promise<BulkImportAnalysisResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to JSON with headers
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  return analyzeRequirementRows(rawRows, categories, vendors, existingRequirements);
}

/**
 * Parses raw text (CSV or Tab Delimited)
 */
export function parseRequirementCSVText(
  csvText: string,
  categories: MaterialCategory[],
  vendors: Vendor[],
  existingRequirements: CustomerRequirement[]
): BulkImportAnalysisResult {
  const workbook = XLSX.read(csvText, { type: 'string' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  return analyzeRequirementRows(rawRows, categories, vendors, existingRequirements);
}

function analyzeRequirementRows(
  rawRows: Record<string, any>[],
  categories: MaterialCategory[],
  vendors: Vendor[],
  existingRequirements: CustomerRequirement[]
): BulkImportAnalysisResult {
  const validRows: ParsedRequirementRow[] = [];
  const invalidRows: ParsedRequirementRow[] = [];

  // Index existing items for duplicate detection
  const existingItemNames = new Set(
    existingRequirements.flatMap((req) => req.items.map((i) => i.itemName.toLowerCase().trim()))
  );

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // header is row 1
    const errors: string[] = [];

    // Find columns flexibly (case-insensitive keys)
    const findVal = (keys: string[]): string => {
      for (const k of Object.keys(row)) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const target of keys) {
          if (cleanK === target.toLowerCase().replace(/[^a-z0-9]/g, '')) {
            return String(row[k]).trim();
          }
        }
      }
      return '';
    };

    const itemName = findVal(['item name', 'item', 'part name', 'material description', 'itemname']);
    const description = findVal(['description', 'desc', 'item description']);
    const specification = findVal(['specification', 'spec', 'make', 'brand', 'technical specification']);
    const rawQty = findVal(['quantity', 'qty', 'order qty', 'units']);
    const rawUom = findVal(['uom', 'unit', 'unit of measure']);
    const rawDate = findVal(['required date', 'delivery date', 'date', 'req date', 'need by date']);
    const rawPriority = findVal(['priority', 'urgency']);
    const remarks = findVal(['remarks', 'notes', 'comment']);

    // Validations
    if (!itemName) {
      errors.push('Item Name is required');
    }

    const quantity = parseFloat(rawQty);
    if (isNaN(quantity) || quantity <= 0) {
      errors.push('Quantity must be a positive number');
    }

    const uom = rawUom.toUpperCase() || 'NOS';
    const standardUoms = ['NOS', 'SET', 'MTR', 'KG', 'LTR', 'PKT', 'BOX', 'PCS', 'ROLL', 'BAG', 'PAIR'];
    if (rawUom && !standardUoms.includes(uom)) {
      errors.push(`Unrecognized UOM: "${rawUom}". Recommended: NOS, SET, MTR, KG, LTR, PKT, BOX`);
    }

    // Date formatting / defaulting
    let requiredDate = rawDate;
    if (!requiredDate) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      requiredDate = d.toISOString().split('T')[0];
    } else {
      // Normalize if in DD-MM-YYYY format
      if (/^\d{2}-\d{2}-\d{4}$/.test(requiredDate)) {
        const [day, month, year] = requiredDate.split('-');
        requiredDate = `${year}-${month}-${day}`;
      }
    }

    // Priority formatting
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';
    const pUpper = rawPriority.toUpperCase();
    if (pUpper.includes('HIGH') || pUpper === 'URGENT' || pUpper === 'CRITICAL') {
      priority = 'High';
    } else if (pUpper.includes('LOW')) {
      priority = 'Low';
    }

    // Duplicate detection
    const isDuplicate = existingItemNames.has(itemName.toLowerCase());
    if (isDuplicate) {
      errors.push(`Duplicate alert: An open requirement with item "${itemName}" already exists`);
    }

    // Intelligent Category Recommendation for this row
    const catMatch = recommendCategoryForRequirement(
      {
        itemName,
        description,
        specification,
      },
      categories
    );

    // Vendor matching for this row
    const vendorMatches = recommendVendorsForRequirement(
      {
        category: catMatch.category,
        subCategory: catMatch.subCategory,
        itemName,
        description,
      },
      vendors
    );

    const parsed: ParsedRequirementRow = {
      rowNumber,
      itemName,
      description: description || itemName,
      specification: specification || 'Standard Industrial Grade',
      quantity: isNaN(quantity) ? 1 : quantity,
      uom: uom || 'NOS',
      requiredDate,
      priority,
      remarks,
      recommendedCategory: catMatch.category,
      subCategory: catMatch.subCategory,
      confidenceScore: catMatch.confidence,
      recommendedVendorCount: vendorMatches.length,
      recommendedVendorNames: vendorMatches.slice(0, 3).map((v) => v.vendorName),
      isDuplicate,
      errors,
      isValid: errors.filter((e) => !e.includes('Duplicate alert')).length === 0, // duplicates warn, but don't strictly invalidate
    };

    if (parsed.isValid) {
      validRows.push(parsed);
    } else {
      invalidRows.push(parsed);
    }
  });

  return {
    totalRows: rawRows.length,
    validRows,
    invalidRows,
    readyCount: validRows.length,
    errorCount: invalidRows.length,
    duplicateCount: validRows.filter((r) => r.isDuplicate).length,
  };
}

/**
 * Generates an Excel (.xlsx) file download for Requirement Bulk Import Template
 */
export function downloadRequirementExcelTemplate() {
  const sampleData = [
    {
      'Item Name': '6206 2RS Bearing',
      Description: 'Deep Groove Ball Bearing',
      Specification: 'SKF / FAG Standard Clearance C3',
      Quantity: 20,
      UOM: 'NOS',
      'Required Date': '2026-10-05',
      Priority: 'High',
      Remarks: 'Critical for Line 2 Main Motor',
    },
    {
      'Item Name': 'Timing Belt HTD 424-8M',
      Description: 'High Torque Drive Timing Belt',
      Specification: 'Pitch 8mm, Width 20mm, Length 424mm',
      Quantity: 10,
      UOM: 'NOS',
      'Required Date': '2026-10-06',
      Priority: 'Medium',
      Remarks: 'Spares for Packaging Conveyor',
    },
    {
      'Item Name': 'Siemens 5A Fuse',
      Description: 'HRC Fuse Link',
      Specification: 'Siemens 3NA3805-2C 500V 5A',
      Quantity: 25,
      UOM: 'NOS',
      'Required Date': '2026-10-07',
      Priority: 'High',
      Remarks: 'Main Control Panel Protection',
    },
    {
      'Item Name': 'PLC S7-1200 CPU 1214C',
      Description: 'Siemens Compact CPU Module',
      Specification: 'DC/DC/DC 14 DI / 10 DO / 2 AI',
      Quantity: 2,
      UOM: 'NOS',
      'Required Date': '2026-10-10',
      Priority: 'High',
      Remarks: 'Automation Upgrade Project',
    },
    {
      'Item Name': 'MOSIL FG800 Grease',
      Description: 'Food Grade Synthetic Bearing Grease',
      Specification: 'NLGI Grade 2, 1kg Container',
      Quantity: 15,
      UOM: 'KG',
      'Required Date': '2026-10-08',
      Priority: 'Medium',
      Remarks: 'Monthly PM Lubrication Schedule',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  // Auto-fit column widths
  ws['!cols'] = [
    { wch: 26 }, // Item Name
    { wch: 32 }, // Description
    { wch: 35 }, // Specification
    { wch: 12 }, // Quantity
    { wch: 10 }, // UOM
    { wch: 15 }, // Required Date
    { wch: 12 }, // Priority
    { wch: 35 }, // Remarks
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Requirements_Template');
  XLSX.writeFile(wb, 'ProcureMRO_Requirements_Import_Template.xlsx');
}

/**
 * Generates an Excel (.xlsx) file download for Vendor Master Template with Product Modules & Brand Auto-Enrichment
 */
export function downloadVendorMasterTemplate() {
  downloadSampleVendorExcel();
}


/**
 * Exports filtered requirement line items to an Excel dashboard file (.xlsx)
 */
export function exportBulkRequirementsToExcel(
  items: Array<{
    requirementId: string;
    customerName: string;
    itemName: string;
    description: string;
    category: string;
    subCategory?: string;
    quantity: number;
    uom: string;
    requiredDate: string;
    priority: string;
    status: string;
    recommendedVendorCount: number;
    selectedVendor: string;
    rfqStatus: string;
    remarks: string;
  }>,
  fileName: string = 'ProcureMRO_Bulk_Requirements_Dashboard.xlsx'
) {
  const exportRows = items.map((r) => ({
    'Requirement ID': r.requirementId,
    'Customer Name': r.customerName,
    'Item Name': r.itemName,
    'Description / Spec': r.description,
    'Material Category': r.category,
    'Sub-Category': r.subCategory || '-',
    'Quantity': r.quantity,
    'UOM': r.uom,
    'Received Requirement Date': r.requiredDate,
    'Expected Delivery Date': (r as any).expectedDeliveryDate || '-',
    'Priority': r.priority,
    'Requirement Status': r.status.replace(/_/g, ' '),
    'Recommended Vendors Count': r.recommendedVendorCount,
    'Selected Vendor': r.selectedVendor,
    'RFQ / Quotation Status': r.rfqStatus,
    'Remarks': r.remarks || '',
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 30 },
    { wch: 35 },
    { wch: 24 },
    { wch: 22 },
    { wch: 10 },
    { wch: 8 },
    { wch: 14 },
    { wch: 10 },
    { wch: 20 },
    { wch: 22 },
    { wch: 28 },
    { wch: 22 },
    { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Requirements_Dashboard');
  XLSX.writeFile(wb, fileName);
}
