import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  buildSafeEmailDiagnostic,
  decodeGmailBase64UrlUtf8,
  extractGmailMessageContent,
  formatDiagnosticLines,
  parseEmailRequirementWithCatalogue,
  parseSpreadsheetBufferToEmailItems,
  stripHtmlToCleanText,
} from './emailRequirementPipeline';
import { BrandMasterItem, Customer, ProductItem, Vendor } from '../types';

const SAMPLE_PRODUCTS: ProductItem[] = [
  {
    id: 'PROD-SCH-10A',
    itemName: 'Schneider Electric Acti9 iC60N 10A 2 Pole MCB',
    category: 'Electrical',
    subCategory: 'MCB',
    brand: 'Schneider Electric',
    partNumber: 'A9F74210',
    modelNumber: 'iC60N-10A-2P',
    description: 'Schneider Electric Acti9 iC60N 10A 2 Pole MCB',
    specification: '10A 2 Pole 10kA C-Curve MCB',
    uom: 'NOS',
    approxRate: 485,
    hsnCode: '85362030',
    gstRate: 18,
    status: 'ACTIVE',
  },
  {
    id: 'PROD-SCH-16A-A',
    itemName: 'Schneider Electric Acti9 iC60N 16A 2 Pole MCB',
    category: 'Electrical',
    subCategory: 'MCB',
    brand: 'Schneider Electric',
    partNumber: 'A9F74216',
    modelNumber: 'iC60N-16A-2P',
    description: 'Schneider Electric Acti9 iC60N 16A 2 Pole MCB',
    specification: '16A 2 Pole 10kA C-Curve MCB',
    uom: 'NOS',
    approxRate: 510,
    hsnCode: '85362030',
    gstRate: 18,
    status: 'ACTIVE',
  },
  {
    id: 'PROD-SCH-16A-B',
    itemName: 'Schneider Electric Easy9 16A 2 Pole MCB',
    category: 'Electrical',
    subCategory: 'MCB',
    brand: 'Schneider Electric',
    partNumber: 'EZ9F76216',
    modelNumber: 'EZ9-16A-2P',
    description: 'Schneider Electric Easy9 16A 2 Pole MCB',
    specification: '16A 2 Pole 6kA C-Curve MCB',
    uom: 'NOS',
    approxRate: 340,
    hsnCode: '85362030',
    gstRate: 18,
    status: 'ACTIVE',
  },
];

const SAMPLE_BRANDS: BrandMasterItem[] = [
  {
    id: 'BR-SCH',
    name: 'Schneider Electric',
    category: 'Electrical',
    description: 'Switchgear & Automation',
    isActive: true,
    createdAt: '2026-01-01',
  },
];

const SAMPLE_VENDORS: Vendor[] = [
  {
    id: 'VEND-SCH',
    companyName: 'Apex Electrical Distributors Pvt Ltd',
    contactPerson: 'Kiran Desai',
    email: 'sales@apexelectrical.in',
    mobile: '+91 98250 11122',
    address: 'GIDC Vatva, Ahmedabad',
    city: 'Ahmedabad',
    state: 'Gujarat',
    gstin: '24AABCA1234E1Z5',
    pan: 'AABCA1234E',
    bankDetails: {
      accountName: 'Apex Electrical Distributors Pvt Ltd',
      accountNumber: '1234567890',
      bankName: 'HDFC Bank',
      ifscCode: 'HDFC0000123',
      branch: 'Ahmedabad',
    },
    paymentTerms: '30 Days Net',
    deliveryTerms: 'Ex-Works',
    status: 'ACTIVE',
    productCategories: ['Electrical'],
    materialCategories: ['Electrical'],
    brandsSupplied: ['Schneider Electric'],
    rating: 4.8,
    createdAt: '2026-01-01',
    catalogProducts: [
      {
        id: 'VP-1',
        vendorId: 'VEND-SCH',
        productName: 'Schneider Electric Acti9 iC60N 10A 2 Pole MCB',
        brand: 'Schneider Electric',
        partNumber: 'A9F74210',
        category: 'Electrical',
        description: 'Schneider Electric Acti9 iC60N 10A 2 Pole MCB',
        specification: '10A 2 Pole 10kA MCB',
        uom: 'NOS',
        keywords: ['schneider', '10a', '2 pole', 'mcb', 'a9f74210'],
        mrp: 650,
        discountPercent: 25,
        purchaseRate: 487.5,
        aiConfidence: 98,
        approvalStatus: 'APPROVED',
      },
    ],
  },
];

const SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: 'CUST-TATA',
    companyName: 'Tata Motors Limited',
    contactPerson: 'Rajesh Verma',
    email: 'procurement@tatamotors.com',
    mobile: '+91 98201 44321',
    address: 'Sanand Plant Gate 2',
    deliveryAddress: 'Sanand Plant Gate 2, Gujarat',
    city: 'Sanand',
    state: 'Gujarat',
    pincode: '382170',
    gstin: '24AAACT2727Q1Z2',
    pan: 'AAACT2727Q',
    paymentTerms: '30 Days Net',
    createdAt: '2026-01-01',
    status: 'ACTIVE',
  },
];

describe('emailRequirementPipeline', () => {
  it('recursively extracts nested Gmail MIME plain text, HTML body, UTF-8 text, and attachments', () => {
    const plainText = 'Please quote:\nSchneider 10A 2 Pole MCB - 20 Nos\n₹ Best rate please';
    const htmlText = '<div><p>Please quote:</p><p>Schneider 10A 2 Pole MCB - 20 Nos</p></div>';
    const encodeB64Url = (s: string) =>
      Buffer.from(s, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const gmailPayload = {
      id: 'gmail-msg-991',
      snippet: 'Please quote Schneider 10A 2 Pole MCB',
      payload: {
        mimeType: 'multipart/mixed',
        headers: [
          { name: 'Subject', value: 'Requirement for Schneider Electrical Material' },
          { name: 'From', value: '"Rajesh Verma" <procurement@tatamotors.com>' },
          { name: 'Date', value: 'Mon, 12 Oct 2026 10:15:00 +0530' },
        ],
        parts: [
          {
            mimeType: 'multipart/alternative',
            parts: [
              { mimeType: 'text/plain', body: { data: encodeB64Url(plainText) } },
              { mimeType: 'text/html', body: { data: encodeB64Url(htmlText) } },
            ],
          },
          {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: 'BOQ_Electrical.xlsx',
            body: { attachmentId: 'ATT-001', size: 24576 },
          },
        ],
      },
    };

    const extracted = extractGmailMessageContent(gmailPayload);
    assert.equal(extracted.messageId, 'gmail-msg-991');
    assert.equal(extracted.subject, 'Requirement for Schneider Electrical Material');
    assert.equal(extracted.senderEmail, 'procurement@tatamotors.com');
    assert.equal(extracted.senderName, 'Rajesh Verma');
    assert.ok(extracted.plainTextBody.includes('₹ Best rate please'));
    assert.ok(extracted.combinedBodyText.includes('Schneider 10A 2 Pole MCB - 20 Nos'));
    assert.equal(extracted.attachments.length, 1);
    assert.equal(extracted.attachments[0].filename, 'BOQ_Electrical.xlsx');
    assert.equal(extracted.attachments[0].attachmentId, 'ATT-001');
  });

  it('decodes base64url UTF-8 and strips HTML cleanly', () => {
    const encoded = Buffer.from('Bearing 6206 — 15 Nos', 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    assert.equal(decodeGmailBase64UrlUtf8(encoded), 'Bearing 6206 — 15 Nos');
    assert.equal(stripHtmlToCleanText('<p>Line 1<br/>Line 2 &amp; More</p>'), 'Line 1\nLine 2 & More');
  });

  it('extracts unnumbered vendor email lines, preserves verbatim email, matches single catalogue product, and flags multiple matches instead of blindly picking one', () => {
    const rawEmail = [
      'Please quote the following:',
      '',
      'Schneider 10A 2 Pole MCB - 20 Nos',
      'Schneider 16A 2 Pole MCB - 10 Nos',
    ].join('\n');

    const result = parseEmailRequirementWithCatalogue({
      rawText: rawEmail,
      subject: 'Requirement for Schneider Electrical Material',
      senderEmail: 'procurement@tatamotors.com',
      customers: SAMPLE_CUSTOMERS,
      products: SAMPLE_PRODUCTS,
      brands: SAMPLE_BRANDS,
      vendors: SAMPLE_VENDORS,
    });

    assert.equal(result.originalEmailText, rawEmail);
    assert.equal(result.matchedCustomer?.id, 'CUST-TATA');
    assert.equal(result.items.length, 2);

    // Item 1: Schneider 10A 2 Pole MCB - 20 Nos -> single exact catalogue match
    const item1 = result.items[0];
    assert.equal(item1.brand, 'Schneider Electric');
    assert.equal(item1.quantity, 20);
    assert.equal(item1.uom, 'NOS');
    assert.equal(item1.catalogueMatched, true);
    assert.equal(item1.partNumber, 'A9F74210');
    assert.equal(item1.catalogueMrp, 650);
    assert.equal(item1.catalogueDiscount, 25);
    assert.equal(item1.catalogueSupplier, 'Apex Electrical Distributors Pvt Ltd');

    // Item 2: Schneider 16A 2 Pole MCB - 10 Nos -> two Schneider 16A 2P MCBs exist (Acti9 & Easy9)
    const item2 = result.items[1];
    assert.equal(item2.brand, 'Schneider Electric');
    assert.equal(item2.quantity, 10);
    assert.equal(item2.uom, 'NOS');
    assert.equal(item2.multipleMatchesFound, true);
    assert.ok((item2.catalogueCandidates || []).length >= 2);
  });

  it('NEVER fabricates part numbers or mis-attributes subject brand for unknown brand requests like "ABC 10A MCB"', () => {
    const result = parseEmailRequirementWithCatalogue({
      rawText: 'Please quote:\nABC 10A MCB - 5 Nos',
      subject: 'Requirement for Schneider Electrical Material',
      senderEmail: 'buyer@unknowncorp.in',
      customers: SAMPLE_CUSTOMERS,
      products: SAMPLE_PRODUCTS,
      brands: SAMPLE_BRANDS,
      vendors: SAMPLE_VENDORS,
    });

    assert.equal(result.items.length, 1);
    const item = result.items[0];
    assert.equal(item.brand, 'ABC');
    assert.equal(item.quantity, 5);
    assert.equal(item.uom, 'NOS');
    assert.equal(item.partNumber, '');
    assert.equal(item.catalogueMatched, false);
    assert.ok(item.lowConfidenceFields?.includes('Part Code'));
  });

  it('extracts structured rows from Excel/CSV attachments and combines with email body', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Sr No', 'Brand', 'Product Description', 'Part Code', 'Quantity', 'UOM'],
      [1, 'Schneider Electric', 'Acti9 10A 2 Pole MCB', 'A9F74210', 25, 'Nos'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RFQ');
    const xlsxBytes = new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const attItems = parseSpreadsheetBufferToEmailItems(xlsxBytes, {
      subject: 'Electrical Material RFQ',
      products: SAMPLE_PRODUCTS,
      brands: SAMPLE_BRANDS,
      vendors: SAMPLE_VENDORS,
    });

    assert.equal(attItems.length, 1);
    assert.equal(attItems[0].partNumber, 'A9F74210');
    assert.equal(attItems[0].quantity, 25);
    assert.equal(attItems[0].uom, 'NOS');
    assert.equal(attItems[0].sourceOrigin, 'ATTACHMENT');
  });

  it('formats safe diagnostic logs without leaking secrets or tokens', () => {
    const diag = buildSafeEmailDiagnostic({
      emailReceived: true,
      messageRetrieved: true,
      subject: 'Requirement for Schneider Electrical Material',
      bodyText: 'Schneider 10A 2 Pole MCB - 20 Nos',
      attachmentCount: 1,
      attachmentsExtractedCount: 1,
      parserStarted: true,
      extractedItemCount: 1,
      parserEngine: 'DETERMINISTIC_CATALOGUE_MATCHER',
    });
    const lines = formatDiagnosticLines(diag);
    assert.deepEqual(lines, [
      'Email Received: YES',
      'Message Retrieved: YES',
      'Subject Retrieved: YES',
      'Body Retrieved: YES',
      'Attachment Retrieved: YES',
      'Parser Started: YES',
    ]);
  });
});
