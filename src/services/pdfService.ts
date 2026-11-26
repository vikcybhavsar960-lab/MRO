import jsPDF from 'jspdf';
import { CustomerQuotation, VendorPO, ProformaInvoice, CustomerRequirement, VendorQuote } from '../types';

export const generateQuotationPDF = (quotation: CustomerQuotation, requirement?: CustomerRequirement) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 38, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('MRO PROCUREMENT SOLUTION', 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Industrial Spares, MRO Procurement & Engineering Supplies', 14, 25);
  doc.text('GSTIN: 27AABCP8921K1ZZ | CIN: U29100MH2026PTC109823 | Email: orders@mroprocure.com', 14, 30);

  // Document Title Badge
  doc.setFillColor(37, 99, 235); // blue-600
  doc.roundedRect(140, 10, 58, 20, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('QUOTATION', 148, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(quotation.id, 148, 25);

  // Meta details container
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(14, 44, 182, 36, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 44, 182, 36, 'S');

  // Customer / Quotation Info
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text('QUOTED TO:', 18, 50);
  doc.text('QUOTATION DETAILS:', 110, 50);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(quotation.customerName, 18, 56);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  if (requirement) {
    doc.text(`Attn: ${requirement.contactPerson}`, 18, 62);
    doc.text(`Email: ${requirement.customerEmail} | Phone: ${requirement.customerMobile}`, 18, 67);
    doc.text(`Ref Requirement: ${requirement.id}`, 18, 72);
  }

  doc.text(`Quotation Date: ${quotation.date}`, 110, 56);
  doc.text(`Valid Until: ${quotation.validityDate}`, 110, 62);
  doc.text(`Payment Terms: ${quotation.paymentTerms}`, 110, 67);
  doc.text(`Delivery Terms: ${quotation.deliveryTerms}`, 110, 72);

  // Items Table Header
  let y = 88;
  doc.setFillColor(30, 41, 59);
  doc.rect(14, y, 182, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('#', 17, y + 5.5);
  doc.text('Item Description & Part No.', 26, y + 5.5);
  doc.text('Qty', 105, y + 5.5);
  doc.text('Unit Rate (INR)', 125, y + 5.5);
  doc.text('GST %', 158, y + 5.5);
  doc.text('Amount (INR)', 175, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  quotation.items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 14, 'F');
    }
    doc.setDrawColor(241, 245, 249);
    doc.line(14, y + 14, 196, y + 14);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${index + 1}`, 17, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(item.itemName.substring(0, 45), 26, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Part #: ${item.partNumber}`, 26, y + 10);
    doc.setTextColor(15, 23, 42);

    doc.text(`${item.quantity} ${item.uom}`, 105, y + 6);
    doc.text(`Rs ${item.sellingUnitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 125, y + 6);
    doc.text(`${item.gstPercent}%`, 160, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs ${item.finalLineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 175, y + 6);

    y += 14;
  });

  // Totals Box
  y += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(115, y, 81, 28, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(115, y, 81, 28, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Taxable Subtotal:', 120, y + 6);
  doc.text(`Rs ${quotation.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, y + 6, { align: 'right' });

  doc.text('Estimated GST (Tax):', 120, y + 12);
  doc.text(`Rs ${quotation.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, y + 12, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(118, y + 16, 193, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Grand Total:', 120, y + 23);
  doc.setTextColor(37, 99, 235);
  doc.text(`Rs ${quotation.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, y + 23, { align: 'right' });

  // Terms and conditions
  y += 34;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Terms & Conditions:', 14, y);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`1. Delivery Period: ${quotation.deliveryPeriod}.`, 14, y + 6);
  doc.text(`2. Warranty: ${quotation.warranty || 'Manufacturer standard warranty applies.'}`, 14, y + 11);
  doc.text(`3. Payment Terms: ${quotation.paymentTerms}.`, 14, y + 16);
  doc.text(`4. Remarks: ${quotation.remarks || 'Offer subject to goods remaining unsold.'}`, 14, y + 21);

  // Signatures
  doc.setDrawColor(203, 213, 225);
  doc.line(135, y + 42, 190, y + 42);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Authorized Signatory', 143, y + 47);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('MRO PROCUREMENT SOLUTION', 135, y + 51);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('This is a computer-generated quotation generated via MRO PROCUREMENT SOLUTION Enterprise Platform.', 14, 288);

  return doc;
};

export const generateVendorPoPDF = (vendorPo: VendorPO) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('MRO PROCUREMENT SOLUTION', 14, 16);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Official Purchase Order - Engineering & Maintenance Supplies', 14, 23);
  doc.text('GSTIN: 27AABCP8921K1ZZ | Corporate Office: BKC, Mumbai 400051', 14, 28);

  // Badge
  doc.setFillColor(16, 185, 129); // green-500
  doc.roundedRect(138, 8, 60, 20, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('VENDOR PO', 146, 16);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(vendorPo.id, 146, 23);

  // Meta box
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 42, 182, 34, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 42, 182, 34, 'S');

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text('VENDOR / SUPPLIER:', 18, 48);
  doc.text('PO DISPATCH INSTRUCTIONS:', 110, 48);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(vendorPo.vendorName, 18, 54);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`PO Date: ${vendorPo.poDate}`, 18, 60);
  doc.text(`Linked Req: ${vendorPo.requirementId}`, 18, 65);
  doc.text(`Linked Customer PO: ${vendorPo.customerPoId}`, 18, 70);

  doc.text(`Deliver To: ${vendorPo.deliveryAddress.substring(0, 40)}`, 110, 54);
  doc.text(`Expected Date: ${vendorPo.deliveryDate}`, 110, 60);
  doc.text(`Payment: ${vendorPo.paymentTerms}`, 110, 65);

  // Table
  let y = 84;
  doc.setFillColor(15, 23, 42);
  doc.rect(14, y, 182, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('#', 17, y + 5.5);
  doc.text('Item Description & Specs', 26, y + 5.5);
  doc.text('Qty', 105, y + 5.5);
  doc.text('Agreed Rate', 125, y + 5.5);
  doc.text('GST %', 158, y + 5.5);
  doc.text('Total (INR)', 175, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  vendorPo.items.forEach((item, index) => {
    doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
    doc.rect(14, y, 182, 12, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(14, y + 12, 196, y + 12);

    doc.setFontSize(8);
    doc.text(`${index + 1}`, 17, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(item.itemName.substring(0, 45), 26, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Part #: ${item.partNumber}`, 26, y + 9);
    doc.setTextColor(15, 23, 42);

    doc.text(`${item.quantity} ${item.uom}`, 105, y + 6);
    doc.text(`Rs ${item.unitRate.toLocaleString('en-IN')}`, 125, y + 6);
    doc.text(`${item.gstPercent}%`, 160, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs ${item.totalAmount.toLocaleString('en-IN')}`, 175, y + 6);

    y += 12;
  });

  // Summary
  y += 6;
  doc.setFillColor(241, 245, 249);
  doc.rect(115, y, 81, 24, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(115, y, 81, 24, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal:', 120, y + 5);
  doc.text(`Rs ${vendorPo.subtotal.toLocaleString('en-IN')}`, 190, y + 5, { align: 'right' });

  doc.text('GST & Freight:', 120, y + 10);
  doc.text(`Rs ${(vendorPo.gstAmount + vendorPo.freight).toLocaleString('en-IN')}`, 190, y + 10, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Total PO Value:', 120, y + 18);
  doc.setTextColor(16, 185, 129);
  doc.text(`Rs ${vendorPo.totalAmount.toLocaleString('en-IN')}`, 190, y + 18, { align: 'right' });

  // Instructions
  y += 30;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Mandatory Supplier Conditions:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('1. Invoice must mention Purchase Order Number ' + vendorPo.id, 14, y + 5);
  doc.text('2. Manufacturer test certificate & warranty certificate must accompany shipment.', 14, y + 9);
  doc.text('3. Send Proforma Invoice (PI) and LR copy to accounts@procuremro.com.', 14, y + 13);

  return doc;
};

// WhatsApp Sharing text generator
export const generateWhatsAppShareUrl = (
  type: 'QUOTATION' | 'PO' | 'DISPATCH' | 'REQUIREMENT',
  details: {
    recipientName: string;
    docNumber: string;
    amount?: number;
    itemsSummary?: string;
    trackingInfo?: string;
    phone?: string;
  }
) => {
  let message = '';
  switch (type) {
    case 'QUOTATION':
      message = `*MRO PROCUREMENT SOLUTION*\n\nDear ${details.recipientName},\n\nPlease find your formal quotation *${details.docNumber}* for: ${details.itemsSummary || 'Industrial MRO Requirements'}.\n\n*Total Value:* Rs ${details.amount?.toLocaleString('en-IN')}\n\nYou can review, approve, and download the official PDF directly through your MRO PROCUREMENT SOLUTION portal.\n\nThank you for choosing MRO PROCUREMENT SOLUTION.`;
      break;
    case 'PO':
      message = `*MRO PROCUREMENT SOLUTION Purchase Order Notification*\n\nVendor: ${details.recipientName}\nOfficial PO: *${details.docNumber}*\nTotal Value: Rs ${details.amount?.toLocaleString('en-IN')}\n\nPlease issue Proforma Invoice (PI) and confirm dispatch date.`;
      break;
    case 'DISPATCH':
      message = `*MRO PROCUREMENT SOLUTION Dispatch & Tracking Update*\n\nDear ${details.recipientName},\nYour consignment for Order *${details.docNumber}* has been dispatched!\n${details.trackingInfo || ''}\n\nTrack real-time delivery via MRO PROCUREMENT SOLUTION Portal.`;
      break;
    case 'REQUIREMENT':
      message = `*MRO PROCUREMENT SOLUTION - New Requirement Logged*\n\nRequirement ID: *${details.docNumber}*\nCustomer: ${details.recipientName}\nItems: ${details.itemsSummary}\n\nProcurement team is requesting vendor quotations.`;
      break;
  }

  const encoded = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?text=${encoded}${details.phone ? `&phone=${details.phone.replace(/[^0-9]/g, '')}` : ''}`;
};

// Requirement Register PDF Generator
export const generateRequirementRegisterPDF = (
  requirements: CustomerRequirement[],
  filterSummary?: {
    companyName?: string;
    executiveName?: string;
    rfqNumber?: string;
    date?: string;
    category?: string;
    status?: string;
  }
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MRO PROCUREMENT SOLUTION ERP', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('CUSTOMER REQUIREMENT & RFQ REGISTER', 14, 18);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, 23);

  // Stats badge on right
  doc.setFillColor(37, 99, 235); // blue-600
  doc.roundedRect(pageWidth - 70, 7, 56, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Records: ${requirements.length}`, pageWidth - 65, 16);

  // Filter Summary Box
  let y = 34;
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, pageWidth - 28, 12, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, pageWidth - 28, 12, 'S');

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ACTIVE FILTERS:', 18, y + 7.5);

  doc.setFont('helvetica', 'normal');
  const filterParts = [];
  if (filterSummary?.companyName && filterSummary.companyName !== 'ALL') filterParts.push(`Company: ${filterSummary.companyName}`);
  if (filterSummary?.executiveName && filterSummary.executiveName !== 'ALL') filterParts.push(`Executive: ${filterSummary.executiveName}`);
  if (filterSummary?.rfqNumber) filterParts.push(`RFQ: ${filterSummary.rfqNumber}`);
  if (filterSummary?.date) filterParts.push(`Date: ${filterSummary.date}`);
  if (filterSummary?.category && filterSummary.category !== 'ALL') filterParts.push(`Category: ${filterSummary.category}`);
  if (filterSummary?.status && filterSummary.status !== 'ALL') filterParts.push(`Status: ${filterSummary.status}`);

  const filterText = filterParts.length > 0 ? filterParts.join('  |  ') : 'All Records (No Filters Applied)';
  doc.text(filterText, 50, y + 7.5);

  // Table Columns
  y += 16;
  const colX = {
    sr: 14,
    rfq: 24,
    date: 65,
    company: 92,
    executive: 162,
    items: 220,
    status: 242,
  };

  const drawTableHeader = (curY: number) => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(14, curY, pageWidth - 28, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('#', colX.sr + 2, curY + 6);
    doc.text('RFQ / Requirement #', colX.rfq, curY + 6);
    doc.text('Requirement Date', colX.date, curY + 6);
    doc.text('Company Name', colX.company, curY + 6);
    doc.text('Purchase Executive', colX.executive, curY + 6);
    doc.text('Items', colX.items, curY + 6);
    doc.text('Requirement Status', colX.status, curY + 6);
  };

  drawTableHeader(y);
  y += 9;

  let pageNum = 1;

  requirements.forEach((req, idx) => {
    // Check if page needs break
    if (y > pageHeight - 20) {
      // Footer on old page
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

      doc.addPage('a4', 'landscape');
      pageNum++;
      y = 15;
      drawTableHeader(y);
      y += 9;
    }

    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, pageWidth - 28, 8, 'F');
    }
    doc.setDrawColor(241, 245, 249);
    doc.line(14, y + 8, pageWidth - 14, y + 8);

    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(String(idx + 1), colX.sr + 2, y + 5.5);

    // RFQ / Req ID
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(req.rfqNumber || req.id, colX.rfq, y + 5.5);

    // Date
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(req.requirementDate || req.receivedRequirementDate || req.requiredDeliveryDate || '-', colX.date, y + 5.5);

    // Company
    const compName = (req.companyName || req.customerName || 'N/A').substring(0, 34);
    doc.text(compName, colX.company, y + 5.5);

    // Executive
    const execText = (req.purchaseExecutiveName || req.contactPerson || 'N/A').substring(0, 26);
    doc.text(execText, colX.executive, y + 5.5);

    // Items
    doc.setFont('helvetica', 'bold');
    doc.text(`${req.items.length} item(s)`, colX.items, y + 5.5);

    // Status
    doc.setFont('helvetica', 'normal');
    const st = req.status || 'NEW_REQUIREMENT';
    if (st === 'ORDER_CLOSED') {
      doc.setTextColor(22, 101, 52); // green
    } else if (st === 'NEW_REQUIREMENT') {
      doc.setTextColor(30, 64, 175); // blue
    } else {
      doc.setTextColor(146, 64, 14); // amber
    }
    doc.text(st.replace(/_/g, ' '), colX.status, y + 5.5);

    y += 8;
  });

  // Footer for last page
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

  doc.save(`Requirement_Register_${new Date().toISOString().split('T')[0]}.pdf`);
};
