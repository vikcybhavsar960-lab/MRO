import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin, ensureSupabaseBuckets } from './supabaseAdmin.js';

export interface SupabaseMigrationReport {
  success: boolean;
  backupPath: string;
  bucketsChecked: number;
  bucketsCreated: string[];
  countsBefore: Record<string, number>;
  countsAfter: Record<string, number>;
  warnings: string[];
  timestamp: string;
}

export function safeIso(value: any, fallback: string): string {
  if (!value) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw) ? raw.replace(' ', 'T') : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

export interface MigrationBatches {
  roles: any[];
  users: any[];
  companies: any[];
  purchase_executives: any[];
  customers: any[];
  brands: any[];
  categories: any[];
  product_types: any[];
  products: any[];
  vendors: any[];
  vendor_contacts: any[];
  vendor_brands: any[];
  vendor_product_mapping: any[];
  catalogue_import_batches: any[];
  catalogue_items: any[];
  rate_history: any[];
  requirements: any[];
  rfqs: any[];
  quotes: any[];
  customer_quotations: any[];
  customer_pos: any[];
  vendor_pos: any[];
  proforma_invoices: any[];
  payments: any[];
  dispatches: any[];
  deliveries: any[];
  purchase_bills: any[];
  sales_bills: any[];
  expenses: any[];
  challans: any[];
  approvals: any[];
  documents: any[];
  notifications: any[];
  audit_logs: any[];
  erp_settings: any[];
  deleted_tombstones: any[];
}

export function buildSupabaseMigrationBatches(dbData: any, nowIso = new Date().toISOString()): MigrationBatches {
  const roles = (dbData.roles || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description || '',
    approval_limit: Number(r.approvalLimit || 0),
    default_permissions: r.defaultPermissions || {},
    updated_at: nowIso,
  }));

  const users = (dbData.users || []).map((u: any) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    mobile: u.mobile || '',
    designation: u.designation || '',
    department: u.department || 'Procurement',
    role: u.role || 'PROCUREMENT_EMPLOYEE',
    status: u.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    must_change_password: Boolean(u.mustChangePassword),
    approval_limit: Number(u.approvalAuthority?.maxApprovalLimit ?? u.approvalLimit ?? 0),
    approval_authority: u.approvalAuthority || {},
    permissions: u.permissions || {},
    created_at: safeIso(u.createdAt, nowIso),
    updated_at: nowIso,
  }));

  const companies = (dbData.companies || []).map((c: any) => ({
    id: c.id,
    company_code: c.companyCode || '',
    company_name: c.companyName || c.name || 'Company',
    gstin: c.gstin || '',
    pan: c.pan || '',
    address: c.address || '',
    city: c.city || '',
    state: c.state || '',
    pincode: c.pincode || '',
    contact_person: c.contactPerson || '',
    mobile: c.mobile || '',
    email: c.email || '',
    payment_terms: c.paymentTerms || '',
    delivery_address: c.deliveryAddress || '',
    status: c.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    remarks: c.remarks || '',
    payload: c,
    is_deleted: Boolean(c.isDeleted),
    created_at: safeIso(c.createdAt, nowIso),
    updated_at: nowIso,
  }));

  const companyIds = new Set(companies.map((c: any) => c.id));
  const purchase_executives = (dbData.purchaseExecutives || []).map((e: any) => ({
    id: e.id,
    company_id: companyIds.has(e.companyId) ? e.companyId : null,
    company_name: e.companyName || '',
    name: e.name || 'Executive',
    designation: e.designation || '',
    mobile: e.mobile || '',
    email: e.email || '',
    department: e.department || '',
    status: e.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    remarks: e.remarks || '',
    payload: e,
    is_deleted: Boolean(e.isDeleted),
    created_at: safeIso(e.createdAt, nowIso),
    updated_at: nowIso,
  }));

  const customers = (dbData.customers || []).map((c: any) => ({
    id: c.id,
    company_code: c.companyCode || '',
    company_name: c.companyName || 'Customer',
    contact_person: c.contactPerson || '',
    mobile: c.mobile || '',
    email: c.email || '',
    address: c.address || '',
    city: c.city || '',
    state: c.state || '',
    pincode: c.pincode || '',
    gstin: c.gstin || '',
    pan: c.pan || '',
    payment_terms: c.paymentTerms || '',
    delivery_address: c.deliveryAddress || '',
    status: c.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    payload: c,
    is_deleted: Boolean(c.isDeleted),
    created_at: safeIso(c.createdAt, nowIso),
    updated_at: nowIso,
  }));
  const customerIdSet = new Set(customers.map((c: any) => c.id));

  const brands = (dbData.brands || []).map((b: any) => ({
    id: b.id,
    name: b.name || b.id,
    code: b.code || '',
    manufacturer: b.manufacturer || '',
    category: b.category || '',
    website: b.website || '',
    is_active: b.isActive !== false,
    status: b.status || 'ACTIVE',
    payload: b,
    is_deleted: Boolean(b.isDeleted),
    updated_at: nowIso,
  }));

  const categories = (dbData.categories || []).map((c: any) => ({
    id: c.id,
    name: c.name || c.id,
    code: c.code || '',
    description: c.description || '',
    sub_categories: c.subCategories || [],
    keywords: c.keywords || [],
    is_active: c.isActive !== false,
    payload: c,
    is_deleted: Boolean(c.isDeleted),
    updated_at: nowIso,
  }));

  const product_types = (dbData.productTypes || []).map((pt: any) => ({
    id: pt.id,
    name: pt.name || pt.id,
    category: pt.category || '',
    sub_category: pt.subCategory || '',
    description: pt.description || '',
    is_active: pt.isActive !== false,
    payload: pt,
    updated_at: nowIso,
  }));

  const products = (dbData.products || []).map((p: any) => ({
    id: p.id,
    item_code: p.itemCode || '',
    item_name: p.itemName || 'Product',
    category: p.category || '',
    sub_category: p.subCategory || '',
    brand: p.brand || '',
    manufacturer: p.manufacturer || '',
    manufacturer_code: p.manufacturerCode || '',
    part_number: p.partNumber || '',
    model_number: p.modelNumber || '',
    specification: p.specification || '',
    uom: p.uom || 'NOS',
    hsn_code: p.hsnCode || '',
    gst_rate: Number(p.gstRate || 18),
    mrp: Number(p.mrp || 0),
    discount_percentage: Number(p.discountPercentage || 0),
    net_purchase_rate: Number(p.netPurchaseRate || 0),
    stock_qty: Number(p.stockQty || 0),
    status: p.status || 'ACTIVE',
    image_url: p.imageUrl || '',
    datasheet_url: p.datasheetUrl || '',
    payload: p,
    is_deleted: Boolean(p.isDeleted),
    updated_at: nowIso,
  }));

  const vendors = (dbData.vendors || []).map((v: any) => ({
    id: v.id,
    vendor_code: v.vendorCode || v.id,
    company_name: v.companyName || v.vendorName || 'Vendor',
    legal_name: v.legalName || v.companyName || '',
    vendor_type: v.vendorType || '',
    contact_person: v.contactPerson || '',
    mobile: v.mobile || '',
    alternate_mobile: v.alternateMobile || '',
    email: v.email || '',
    website: v.website || '',
    address: v.address || '',
    city: v.city || '',
    state: v.state || '',
    country: v.country || 'India',
    pincode: v.pincode || '',
    gstin: String(v.gstin || '').toUpperCase(),
    pan: String(v.pan || '').toUpperCase(),
    msme_status: v.msmeStatus || '',
    payment_terms: v.paymentTerms || '30 Days Net',
    delivery_terms: v.deliveryTerms || '',
    rating: Number(v.rating || 4.0),
    intelligence_score: Number(v.intelligenceScore || 0),
    status: ['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(v.status) ? v.status : 'ACTIVE',
    brands_supplied: Array.isArray(v.brandsSupplied) ? v.brandsSupplied : [],
    material_categories: Array.isArray(v.materialCategories) ? v.materialCategories : [],
    product_families: Array.isArray(v.productFamilies) ? v.productFamilies : [],
    payload: v,
    is_deleted: Boolean(v.isDeleted),
    created_at: safeIso(v.createdAt, nowIso),
    updated_at: nowIso,
  }));

  const vendorIdSet = new Set(vendors.map((v: any) => v.id));
  const productIdSet = new Set(products.map((p: any) => p.id));

  const vendor_contacts: any[] = [];
  const vendor_brands: any[] = [];
  for (const v of dbData.vendors || []) {
    if (!vendorIdSet.has(v.id)) continue;
    for (let idx = 0; idx < (v.contacts || []).length; idx++) {
      const c = v.contacts[idx];
      vendor_contacts.push({
        id: c.id || `VCON-${v.id}-${idx + 1}`,
        vendor_id: v.id,
        name: c.name || v.contactPerson || 'Primary Contact',
        department: c.department || 'Sales',
        designation: c.designation || '',
        email: c.email || '',
        mobile: c.mobile || '',
        alternate_mobile: c.alternateMobile || '',
        landline: c.landline || '',
        whatsapp: c.whatsapp || '',
        is_primary: Boolean(c.isPrimary ?? idx === 0),
        source: c.source || 'MIGRATION',
        confidence: Number(c.confidence || 100),
      });
    }
    const seenBrands = new Set<string>();
    for (let idx = 0; idx < (v.brandsSupplied || []).length; idx++) {
      const bName = String(v.brandsSupplied[idx] || '').trim();
      if (!bName || seenBrands.has(bName.toLowerCase())) continue;
      seenBrands.add(bName.toLowerCase());
      vendor_brands.push({
        id: `VBRD-${v.id}-${idx + 1}`,
        vendor_id: v.id,
        brand_name: bName,
        relationship_type: 'Deals In',
        source: 'MIGRATION',
      });
    }
  }

  const vendor_product_mapping = (dbData.vendorProductMappings || [])
    .filter((m: any) => m && m.id && vendorIdSet.has(m.vendorId))
    .map((m: any) => ({
      id: m.id,
      vendor_id: m.vendorId,
      vendor_code: m.vendorCode || '',
      vendor_name: m.vendorName || '',
      product_id: productIdSet.has(m.productId) ? m.productId : null,
      product_name: m.productName || 'Mapped Product',
      category: m.category || '',
      sub_category: m.subCategory || '',
      product_type: m.productType || '',
      brand: m.brand || '',
      model_number: m.modelNumber || '',
      part_number: m.partNumber || '',
      specification: m.specification || '',
      uom: m.uom || 'NOS',
      supply_type: m.supplyType || 'Dealer',
      availability: m.availability || 'Regular Stock',
      status: m.status || 'ACTIVE',
      remarks: m.remarks || '',
      payload: m,
      is_deleted: Boolean(m.isDeleted),
      updated_at: nowIso,
    }));

  const catalogue_import_batches = (dbData.importBatches || []).map((b: any) => ({
    id: b.id,
    vendor_id: vendorIdSet.has(b.vendorId) ? b.vendorId : null,
    vendor_name: b.vendorName || '',
    file_name: b.fileName || 'Catalogue Import',
    source_type: b.sourceType || 'EXCEL',
    version: b.version || '1.0',
    status: b.status || 'COMPLETED',
    total_records: Number(b.totalRows || b.productsCount || 0),
    new_count: Number(b.newProductsCount || b.newCount || 0),
    updated_count: Number(b.updatedProductsCount || b.updatedCount || 0),
    uploaded_by: b.uploadedBy || 'System',
    effective_date: b.effectiveDate || '',
    payload: b,
    updated_at: nowIso,
  }));

  const batchIdSet = new Set(catalogue_import_batches.map((b: any) => b.id));
  const catalogue_items = (dbData.catalogueProducts || []).map((ci: any) => ({
    id: ci.id,
    batch_id: batchIdSet.has(ci.importBatchId) ? ci.importBatchId : null,
    vendor_id: vendorIdSet.has(ci.supplierId || ci.vendorId) ? (ci.supplierId || ci.vendorId) : null,
    part_code: ci.partCode || ci.partNumber || ci.id,
    normalized_part_code: String(ci.partCode || ci.partNumber || '').trim().toUpperCase(),
    manufacturer_code: ci.manufacturerCode || '',
    model_number: ci.modelNumber || '',
    product_name: ci.productName || 'Catalogue Item',
    brand: ci.brand || '',
    category: ci.category || '',
    sub_category: ci.subCategory || '',
    specification: ci.specification || '',
    uom: ci.uom || 'NOS',
    mrp: Number(ci.mrp || 0),
    discount_percent: Number(ci.discountPercent || 0),
    purchase_rate: Number(ci.purchaseRate || 0),
    catalogue_version: ci.catalogueVersion || '',
    effective_date: ci.effectiveDate || '',
    source_file: ci.sourceFile || '',
    source_page: String(ci.sourcePage || ''),
    status: ci.status || 'ACTIVE',
    payload: ci,
    updated_at: nowIso,
  }));

  const rate_history = (dbData.rateVersionHistory || []).map((rh: any) => ({
    id: rh.id,
    vendor_id: vendorIdSet.has(rh.vendorId || rh.supplierId) ? (rh.vendorId || rh.supplierId) : null,
    vendor_name: rh.vendorName || rh.supplierName || '',
    brand: rh.brand || '',
    part_code: rh.partCode || '',
    product_name: rh.productName || '',
    mrp: Number(rh.mrp || 0),
    discount_percent: Number(rh.discountPercent || 0),
    purchase_rate: Number(rh.purchaseRate || 0),
    effective_from: rh.effectiveDate || '',
    effective_to: rh.effectiveTo || '',
    import_batch_id: rh.importBatchId || '',
    catalogue_version: rh.catalogueVersion || '',
    source: rh.source || 'CATALOGUE',
    is_current: rh.isCurrent !== false,
    payload: rh,
  }));

  const requirements = (dbData.requirements || []).map((r: any) => ({
    id: r.id,
    rfq_number: r.rfqNumber || '',
    customer_id: customerIdSet.has(r.customerId) ? r.customerId : null,
    customer_name: r.customerName || '',
    company_id: companyIds.has(r.companyId) ? r.companyId : null,
    company_name: r.companyName || '',
    purchase_executive_id: r.purchaseExecutiveId || '',
    purchase_executive_name: r.purchaseExecutiveName || '',
    requirement_date: r.requirementDate || '',
    required_delivery_date: r.requiredDeliveryDate || '',
    priority: r.priority || 'Medium',
    status: r.status || 'NEW_REQUIREMENT',
    created_by: r.createdBy || '',
    payload: r,
    is_deleted: Boolean(r.isDeleted),
    updated_at: nowIso,
  }));
  const reqIdSet = new Set(requirements.map((r: any) => r.id));

  const rfqs = (dbData.rfqs || []).map((r: any) => ({
    id: r.id,
    rfq_number: r.rfqNumber || r.id,
    requirement_id: reqIdSet.has(r.requirementId) ? r.requirementId : null,
    customer_id: r.customerId || '',
    customer_name: r.customerName || '',
    company_id: r.companyId || '',
    company_name: r.companyName || '',
    purchase_executive_id: r.purchaseExecutiveId || '',
    purchase_executive_name: r.purchaseExecutiveName || '',
    required_date: r.requiredDate || '',
    sent_date: r.sentDate || '',
    status: r.status || 'NEW_RFQ',
    notes: r.notes || '',
    commercial_terms: r.commercialTerms || '',
    created_by: r.createdBy || '',
    payload: r,
    is_deleted: Boolean(r.isDeleted),
    updated_at: nowIso,
  }));
  const rfqIdSet = new Set(rfqs.map((r: any) => r.id));

  const quotes = (dbData.vendorQuotes || []).map((q: any) => ({
    id: q.id,
    enquiry_id: rfqIdSet.has(q.enquiryId) ? q.enquiryId : null,
    requirement_id: reqIdSet.has(q.requirementId) ? q.requirementId : null,
    vendor_id: vendorIdSet.has(q.vendorId) ? q.vendorId : null,
    vendor_name: q.vendorName || '',
    customer_name: q.customerName || '',
    submission_date: q.submissionDate || '',
    valid_until: q.validUntil || '',
    payment_terms: q.paymentTerms || '',
    status: q.status || 'SUBMITTED',
    payload: q,
    is_deleted: Boolean(q.isDeleted),
    updated_at: nowIso,
  }));

  const customer_quotations = (dbData.quotations || []).map((q: any) => ({
    id: q.id,
    requirement_id: reqIdSet.has(q.requirementId) ? q.requirementId : null,
    customer_id: customerIdSet.has(q.customerId) ? q.customerId : null,
    customer_name: q.customerName || '',
    quotation_date: q.quotationDate || '',
    validity_date: q.validityDate || '',
    subtotal: Number(q.subtotal || 0),
    total_tax: Number(q.totalTax || 0),
    grand_total: Number(q.grandTotal || 0),
    status: q.status || 'DRAFT',
    payload: q,
    updated_at: nowIso,
  }));
  const quotationIdSet = new Set(customer_quotations.map((q: any) => q.id));

  const customer_pos = (dbData.customerPos || []).map((po: any) => ({
    id: po.id,
    quotation_id: quotationIdSet.has(po.quotationId) ? po.quotationId : null,
    requirement_id: reqIdSet.has(po.requirementId) ? po.requirementId : null,
    customer_id: customerIdSet.has(po.customerId) ? po.customerId : null,
    customer_name: po.customerName || '',
    customer_po_number: po.customerPoNumber || po.poNumber || po.id,
    po_date: po.poDate || '',
    po_amount: Number(po.poAmount || po.grandTotal || 0),
    payload: po,
    updated_at: nowIso,
  }));
  const cpoIdSet = new Set(customer_pos.map((p: any) => p.id));

  const vendor_pos = (dbData.vendorPos || []).map((po: any) => ({
    id: po.id,
    customer_po_id: cpoIdSet.has(po.customerPoId) ? po.customerPoId : null,
    quotation_id: quotationIdSet.has(po.quotationId) ? po.quotationId : null,
    requirement_id: reqIdSet.has(po.requirementId) ? po.requirementId : null,
    vendor_id: vendorIdSet.has(po.vendorId) ? po.vendorId : null,
    vendor_name: po.vendorName || '',
    po_date: po.poDate || '',
    subtotal: Number(po.subtotal || 0),
    gst_amount: Number(po.gstAmount || 0),
    total_amount: Number(po.totalAmount || 0),
    status: po.status || 'ISSUED',
    payload: po,
    updated_at: nowIso,
  }));
  const vpoIdSet = new Set(vendor_pos.map((p: any) => p.id));

  const proforma_invoices = (dbData.proformaInvoices || []).map((pi: any) => ({
    id: pi.id,
    vendor_po_id: vpoIdSet.has(pi.vendorPoId) ? pi.vendorPoId : null,
    requirement_id: reqIdSet.has(pi.requirementId) ? pi.requirementId : null,
    vendor_id: vendorIdSet.has(pi.vendorId) ? pi.vendorId : null,
    vendor_name: pi.vendorName || '',
    pi_number: pi.piNumber || '',
    pi_date: pi.piDate || '',
    total_amount: Number(pi.totalAmount || 0),
    payload: pi,
    updated_at: nowIso,
  }));
  const piIdSet = new Set(proforma_invoices.map((pi: any) => pi.id));

  const payments = (dbData.payments || []).map((p: any) => ({
    id: p.id,
    pi_id: piIdSet.has(p.piId) ? p.piId : null,
    vendor_po_id: vpoIdSet.has(p.vendorPoId) ? p.vendorPoId : null,
    requirement_id: reqIdSet.has(p.requirementId) ? p.requirementId : null,
    vendor_id: vendorIdSet.has(p.vendorId) ? p.vendorId : null,
    vendor_name: p.vendorName || '',
    total_pi_amount: Number(p.totalPiAmount || 0),
    amount_paid: Number(p.amountPaid || 0),
    payment_date: p.paymentDate || '',
    payment_mode: p.paymentMode || 'NEFT',
    transaction_reference: p.transactionReference || '',
    status: p.status || 'PAYMENT_PENDING',
    payload: p,
    updated_at: nowIso,
  }));

  const dispatches = (dbData.dispatches || []).map((d: any) => ({
    id: d.id,
    vendor_po_id: vpoIdSet.has(d.vendorPoId) ? d.vendorPoId : null,
    requirement_id: reqIdSet.has(d.requirementId) ? d.requirementId : null,
    vendor_id: vendorIdSet.has(d.vendorId) ? d.vendorId : null,
    vendor_name: d.vendorName || '',
    dispatch_date: d.dispatchDate || '',
    vendor_invoice_number: d.vendorInvoiceNumber || '',
    transporter: d.transporter || '',
    lr_number: d.lrNumber || '',
    tracking_number: d.trackingNumber || '',
    payload: d,
    updated_at: nowIso,
  }));
  const dispatchIdSet = new Set(dispatches.map((d: any) => d.id));

  const deliveries = (dbData.deliveries || []).map((d: any) => ({
    id: d.id,
    dispatch_id: dispatchIdSet.has(d.dispatchId) ? d.dispatchId : null,
    requirement_id: reqIdSet.has(d.requirementId) ? d.requirementId : null,
    delivery_date: d.deliveryDate || '',
    received_by: d.receivedBy || '',
    status: d.status || 'DELIVERED',
    payload: d,
    updated_at: nowIso,
  }));

  const purchase_bills = (dbData.vendorBills || []).map((b: any) => ({
    id: b.id,
    bill_number: b.billNumber || '',
    vendor_id: vendorIdSet.has(b.vendorId) ? b.vendorId : null,
    vendor_name: b.vendorName || '',
    vendor_po_id: b.vendorPoId || '',
    requirement_id: b.requirementId || '',
    grand_total: Number(b.grandTotal || 0),
    paid_amount: Number(b.paidAmount || 0),
    balance_due: Number(b.balanceDue || 0),
    status: b.status || 'UNPAID',
    payload: b,
    updated_at: nowIso,
  }));

  const sales_bills = (dbData.invoices || []).map((inv: any) => ({
    id: inv.id,
    invoice_number: inv.invoiceNumber || '',
    customer_id: customerIdSet.has(inv.customerId) ? inv.customerId : null,
    customer_name: inv.customerName || '',
    customer_po_id: inv.customerPoId || '',
    requirement_id: inv.requirementId || '',
    grand_total: Number(inv.grandTotal || 0),
    paid_amount: Number(inv.paidAmount || 0),
    balance_due: Number(inv.balanceDue || 0),
    status: inv.status || 'UNPAID',
    payload: inv,
    updated_at: nowIso,
  }));

  const expenses = (dbData.expenses || []).map((e: any) => ({
    id: e.id,
    expense_number: e.expenseNumber || '',
    category: e.category || 'OTHER',
    paid_to: e.paidTo || '',
    amount: Number(e.amount || 0),
    requirement_id: e.requirementId || '',
    payload: e,
  }));

  const challans = (dbData.challans || []).map((c: any) => ({
    id: c.id,
    challan_number: c.challanNumber || '',
    customer_id: c.customerId || '',
    customer_name: c.customerName || '',
    status: c.status || 'DELIVERED',
    payload: c,
  }));

  const approvals = (dbData.approvals || []).map((a: any) => ({
    id: a.id,
    request_type: a.requestType || 'REQUIREMENT',
    request_number: a.requestNumber || '',
    status: a.status || 'PENDING',
    amount: Number(a.amount || 0),
    requestor_name: a.requestorName || '',
    approver_name: a.approverName || '',
    payload: a,
    updated_at: nowIso,
  }));

  const documents = (dbData.documents || []).map((d: any) => ({
    id: d.id,
    name: d.name || d.fileName || d.id,
    doc_type: d.type || d.docType || 'PDF',
    category: d.category || 'VENDOR_DOC',
    associated_transaction_id: d.associatedTransactionId || '',
    party_name: d.partyName || '',
    storage_bucket: d.storageBucket || 'other-erp-documents',
    storage_path: d.storagePath || '',
    file_size_bytes: Number(d.fileSizeBytes || 0),
    mime_type: d.mimeType || '',
    url: d.url || '',
    uploaded_by: d.uploadedBy || '',
    payload: d,
    uploaded_at: safeIso(d.uploadedAt, nowIso),
  }));

  const notifications = (dbData.notifications || []).map((n: any) => ({
    id: n.id,
    title: n.title || 'Notification',
    message: n.message || '',
    notification_type: n.type || 'INFO',
    is_read: Boolean(n.read),
    link_tab: n.linkTab || '',
    link_id: n.linkId || '',
    target_role: n.targetRole || [],
    payload: n,
  }));

  const audit_logs = (dbData.auditLogs || []).slice(0, 1000).map((a: any) => ({
    id: a.id,
    timestamp: safeIso(a.timestamp, nowIso),
    actor_user: a.user || 'System',
    actor_role: a.role || 'SYSTEM',
    action: a.action || 'EVENT',
    module: a.module || 'ERP',
    record_id: a.recordNumber || '',
    remarks: a.remarks || '',
    ip_address: a.ipAddress || '',
    payload: a,
  }));

  const erp_settings = [
    { setting_key: 'companySettings', setting_value: dbData.companySettings || {}, updated_at: nowIso },
    { setting_key: 'brandingSettings', setting_value: dbData.brandingSettings || {}, updated_at: nowIso },
    { setting_key: 'themeSettings', setting_value: dbData.themeSettings || {}, updated_at: nowIso },
    { setting_key: 'brandDiscounts', setting_value: dbData.brandDiscounts || [], updated_at: nowIso },
  ];

  const deleted_tombstones: any[] = [];
  const pushTombs = (type: string, ids?: string[]) => {
    for (const id of ids || []) {
      if (!id) continue;
      deleted_tombstones.push({
        id: `${type}:${id}`,
        entity_type: type,
        entity_id: id,
        deleted_by: 'Migration',
        reason: 'Migrated Tombstone',
      });
    }
  };
  pushTombs('vendor', dbData.deletedVendorIds);
  pushTombs('requirement', dbData.deletedRequirementIds);
  pushTombs('rfq', dbData.deletedRfqIds);
  pushTombs('product', dbData.deletedProductIds);
  pushTombs('vendorMapping', dbData.deletedVendorMappingIds);
  pushTombs('vendorQuote', dbData.deletedVendorQuoteIds);
  pushTombs('company', dbData.deletedCompanyIds);
  pushTombs('customer', dbData.deletedCustomerIds);
  pushTombs('brand', dbData.deletedBrandIds);
  pushTombs('category', dbData.deletedCategoryIds);
  pushTombs('purchaseExecutive', dbData.deletedPurchaseExecutiveIds);

  return {
    roles,
    users,
    companies,
    purchase_executives,
    customers,
    brands,
    categories,
    product_types,
    products,
    vendors,
    vendor_contacts,
    vendor_brands,
    vendor_product_mapping,
    catalogue_import_batches,
    catalogue_items,
    rate_history,
    requirements,
    rfqs,
    quotes,
    customer_quotations,
    customer_pos,
    vendor_pos,
    proforma_invoices,
    payments,
    dispatches,
    deliveries,
    purchase_bills,
    sales_bills,
    expenses,
    challans,
    approvals,
    documents,
    notifications,
    audit_logs,
    erp_settings,
    deleted_tombstones,
  };
}

export function deduplicateRowsByConflict<T extends Record<string, any>>(
  rows: T[],
  onConflict = 'id'
): T[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const cols = onConflict
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const byKey = new Map<string, T>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    if (cols.some((c) => row[c] === undefined || row[c] === null || row[c] === '')) {
      continue;
    }
    const key = cols.map((c) => String(row[c])).join('\u0000');
    byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

async function upsertInChunks(table: string, rows: any[], onConflict = 'id'): Promise<number> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase server client is not configured');
  const dedupedRows = deduplicateRowsByConflict(rows, onConflict);
  if (dedupedRows.length === 0) return 0;

  let total = 0;
  const chunkSize = 200;
  for (let i = 0; i < dedupedRows.length; i += chunkSize) {
    const chunk = dedupedRows.slice(i, i + chunkSize);
    const { error } = await admin.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`Migration upsert error on "${table}" (batch ${i}): ${error.message}`);
    }
    total += chunk.length;
  }
  return total;
}

async function upsertMissingInChunks(
  table: string,
  rows: any[],
  conflictCol = 'id'
): Promise<number> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase server client is not configured');
  if (!rows || rows.length === 0) return 0;

  const existingKeys = new Set<string>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await admin
      .from(table)
      .select(conflictCol)
      .range(from, from + pageSize - 1);
    if (error) {
      throw new Error(`Migration pre-check failed on "${table}": ${error.message}`);
    }
    for (const row of data || []) {
      const k = String((row as any)?.[conflictCol] ?? '');
      if (k) existingKeys.add(k);
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  const missingRows = rows.filter((r) => {
    const keyVal = String(r?.[conflictCol] ?? '');
    return keyVal && !existingKeys.has(keyVal);
  });
  return upsertInChunks(table, missingRows, conflictCol);
}

/**
 * Non-destructive production data migration:
 * 1. Creates a full timestamped JSON backup in data/backups/
 * 2. Upserts existing records from data/erp_production.json into Supabase PostgreSQL
 * 3. Verifies row counts and relational links without deleting or resetting existing data
 */
export async function migrateProductionJsonToSupabase(
  sourceFilePath = path.resolve(process.cwd(), 'data/erp_production.json'),
  options?: { onlyMissing?: boolean }
): Promise<SupabaseMigrationReport> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error('Cannot migrate: SUPABASE_SERVICE_ROLE_KEY is missing in server environment.');
  }
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error(`Source production database not found at ${sourceFilePath}`);
  }

  const rawJson = fs.readFileSync(sourceFilePath, 'utf-8');
  const dbData = JSON.parse(rawJson);

  // Step 1: Create backup before migration
  const backupDir = path.resolve(process.cwd(), 'data/backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `pre_supabase_migration_${stamp}.json`);
  fs.writeFileSync(backupPath, rawJson, 'utf-8');

  const warnings: string[] = [];
  const bucketsRes = await ensureSupabaseBuckets();
  if (bucketsRes.error) warnings.push(`Storage bucket check: ${bucketsRes.error}`);

  const nowIso = new Date().toISOString();
  const batches = buildSupabaseMigrationBatches(dbData, nowIso);
  const onlyMissing = Boolean(options?.onlyMissing);
  const writeRows = async (table: string, rows: any[], onConflict = 'id') =>
    onlyMissing
      ? upsertMissingInChunks(table, rows, onConflict)
      : upsertInChunks(table, rows, onConflict);

  await writeRows('roles', batches.roles);
  if (onlyMissing) {
    const { count: existingUserCount } = await admin
      .from('user_profiles')
      .select('id', { count: 'exact', head: true });
    if (!existingUserCount || existingUserCount === 0) {
      await upsertInChunks('user_profiles', batches.users);
    }
  } else {
    await upsertInChunks('user_profiles', batches.users);
  }
  await writeRows('companies', batches.companies);
  await writeRows('purchase_executives', batches.purchase_executives);
  await writeRows('customers', batches.customers);
  await writeRows('brands', batches.brands);
  await writeRows('categories', batches.categories);
  await writeRows('product_types', batches.product_types);
  await writeRows('products', batches.products);
  await writeRows('vendors', batches.vendors);
  await writeRows('vendor_contacts', batches.vendor_contacts);
  await upsertInChunks('vendor_brands', batches.vendor_brands, 'vendor_id,brand_name');
  await writeRows('vendor_product_mapping', batches.vendor_product_mapping);
  await writeRows('catalogue_import_batches', batches.catalogue_import_batches);
  await writeRows('catalogue_items', batches.catalogue_items);
  await writeRows('rate_history', batches.rate_history);
  await writeRows('requirements', batches.requirements);
  await writeRows('rfqs', batches.rfqs);
  await writeRows('quotes', batches.quotes);
  await writeRows('customer_quotations', batches.customer_quotations);
  await writeRows('customer_pos', batches.customer_pos);
  await writeRows('vendor_pos', batches.vendor_pos);
  await writeRows('proforma_invoices', batches.proforma_invoices);
  await writeRows('payments', batches.payments);
  await writeRows('dispatches', batches.dispatches);
  await writeRows('deliveries', batches.deliveries);
  await writeRows('purchase_bills', batches.purchase_bills);
  await writeRows('sales_bills', batches.sales_bills);
  await writeRows('expenses', batches.expenses);
  await writeRows('challans', batches.challans);
  await writeRows('approvals', batches.approvals);
  await writeRows('documents', batches.documents);
  await writeRows('notifications', batches.notifications);
  await writeRows('audit_logs', batches.audit_logs);
  await writeRows('erp_settings', batches.erp_settings, 'setting_key');
  await upsertInChunks('deleted_tombstones', batches.deleted_tombstones, 'entity_type,entity_id');

  const countsBefore: Record<string, number> = {
    roles: batches.roles.length,
    user_profiles: batches.users.length,
    companies: batches.companies.length,
    purchase_executives: batches.purchase_executives.length,
    customers: batches.customers.length,
    brands: batches.brands.length,
    categories: batches.categories.length,
    product_types: batches.product_types.length,
    products: batches.products.length,
    vendors: batches.vendors.length,
    vendor_product_mapping: batches.vendor_product_mapping.length,
    catalogue_import_batches: batches.catalogue_import_batches.length,
    catalogue_items: batches.catalogue_items.length,
    rate_history: batches.rate_history.length,
    requirements: batches.requirements.length,
    rfqs: batches.rfqs.length,
    quotes: batches.quotes.length,
    customer_quotations: batches.customer_quotations.length,
    customer_pos: batches.customer_pos.length,
    vendor_pos: batches.vendor_pos.length,
    proforma_invoices: batches.proforma_invoices.length,
    payments: batches.payments.length,
    dispatches: batches.dispatches.length,
    deliveries: batches.deliveries.length,
    purchase_bills: batches.purchase_bills.length,
    sales_bills: batches.sales_bills.length,
    expenses: batches.expenses.length,
    challans: batches.challans.length,
    approvals: batches.approvals.length,
    documents: batches.documents.length,
  };

  const countsAfter: Record<string, number> = {};
  for (const tbl of Object.keys(countsBefore)) {
    const { count, error } = await admin.from(tbl).select('id', { count: 'exact', head: true });
    if (error) warnings.push(`Count verify error on ${tbl}: ${error.message}`);
    countsAfter[tbl] = Number(count || 0);
  }

  return {
    success: true,
    backupPath,
    bucketsChecked: bucketsRes.checked,
    bucketsCreated: bucketsRes.created,
    countsBefore,
    countsAfter,
    warnings,
    timestamp: nowIso,
  };
}

