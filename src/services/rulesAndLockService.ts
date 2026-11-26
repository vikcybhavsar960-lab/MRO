import {
  CustomerQuotation,
  CustomerRequirement,
  VendorQuote,
  EarningRuleCheckResult,
  CommercialLockInfo,
} from '../types';

export interface CommercialAuditSummary {
  requirementId: string;
  quotationId?: string;
  customerName: string;
  totalBuyingCost: number;
  totalSellingPrice: number;
  grossEarning: number;
  marginPercent: number;
  targetMarginPercent: number;
  isLocked: boolean;
  lockInfo?: CommercialLockInfo;
  rules: EarningRuleCheckResult[];
  totalPassed: number;
  totalFailed: number;
  totalWarnings: number;
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL_VIOLATION';
}

/**
 * Evaluate commercial rules and verify what was checked right vs not checked right
 */
export const evaluateEarningAndCommercialRules = (
  quotation: CustomerQuotation | undefined,
  requirement: CustomerRequirement | undefined,
  vendorQuotes: VendorQuote[] = [],
  targetMargin = 12 // Standard MRO Target Margin is 12%
): CommercialAuditSummary => {
  const reqId = quotation?.requirementId || requirement?.id || 'REQ-UNKNOWN';
  const custName = quotation?.customerName || requirement?.customerName || 'Customer';

  let totalSellingPrice = 0;
  let totalBuyingCost = 0;

  if (quotation && quotation.items && quotation.items.length > 0) {
    totalSellingPrice = quotation.subtotal || quotation.items.reduce((s, it) => s + it.totalTaxableAmount, 0);
    totalBuyingCost = quotation.items.reduce(
      (s, it) => s + (it.purchasePrice + (it.freightCost || 0) + (it.otherCost || 0)) * it.quantity,
      0
    );
  } else if (requirement && requirement.items) {
    // Estimations if quotation not yet created
    const linkedVQs = vendorQuotes.filter((vq) => vq.requirementId === reqId);
    totalSellingPrice = requirement.items.reduce((s, it) => s + (it.targetPrice || 500) * it.quantity, 0);
    if (linkedVQs.length > 0) {
      totalBuyingCost = linkedVQs[0].items.reduce((s, it) => s + (it.resellerPrice + (it.freight || 0)) * it.quantity, 0);
    } else {
      totalBuyingCost = totalSellingPrice * 0.88;
    }
  }

  const grossEarning = totalSellingPrice - totalBuyingCost;
  const marginPercent = totalSellingPrice > 0 ? (grossEarning / totalSellingPrice) * 100 : 0;

  const rules: EarningRuleCheckResult[] = [];

  // RULE 1: Minimum Target Profit Margin
  const marginPassed = marginPercent >= targetMargin;
  const isLoss = grossEarning < 0;
  rules.push({
    ruleId: 'RULE-MARGIN-01',
    title: 'Minimum Target Profit Margin',
    category: 'MARGIN',
    passed: marginPassed,
    severity: isLoss ? 'CRITICAL' : marginPercent < 6 ? 'CRITICAL' : 'WARNING',
    message: isLoss
      ? `CRITICAL LOSS DETECTED: Quotation yields a negative earning of -₹${Math.abs(grossEarning).toLocaleString('en-IN')}. Selling price is lower than procurement cost!`
      : marginPassed
      ? `Healthy gross margin achieved: ${marginPercent.toFixed(1)}% (Target: >= ${targetMargin}%).`
      : `NOT CHECKED RIGHT: Earning margin is ${marginPercent.toFixed(1)}%, which is below target threshold of ${targetMargin}%. Margin erosion risk.`,
    expectedValue: `>= ${targetMargin}%`,
    actualValue: `${marginPercent.toFixed(1)}% (₹${grossEarning.toLocaleString('en-IN')})`,
    earningImpactAmount: grossEarning,
  });

  // RULE 2: Under-Cost Selling Check (Item-by-item price coverage)
  let underCostItemsCount = 0;
  let underCostDeficit = 0;
  if (quotation && quotation.items) {
    quotation.items.forEach((it) => {
      const landedCostPerUnit = it.purchasePrice + (it.freightCost || 0) + (it.otherCost || 0);
      if (it.sellingUnitPrice < landedCostPerUnit) {
        underCostItemsCount++;
        underCostDeficit += (landedCostPerUnit - it.sellingUnitPrice) * it.quantity;
      }
    });
  }

  const costCoveragePassed = underCostItemsCount === 0;
  rules.push({
    ruleId: 'RULE-PRICE-02',
    title: 'Line Item Cost Coverage (No Negative Spread)',
    category: 'PRICING',
    passed: costCoveragePassed,
    severity: 'CRITICAL',
    message: costCoveragePassed
      ? 'All items are priced above vendor landed purchase cost. No negative line spreads.'
      : `NOT CHECKED RIGHT: ${underCostItemsCount} item(s) are priced below vendor landed cost! Projected loss of ₹${underCostDeficit.toLocaleString('en-IN')}.`,
    expectedValue: '0 under-cost items',
    actualValue: `${underCostItemsCount} items below cost`,
    earningImpactAmount: -underCostDeficit,
  });

  // RULE 3: GST Tax Parity (Input vs Output GST % Match)
  let taxMismatch = false;
  let taxDifferenceNote = '';
  if (quotation && quotation.items) {
    quotation.items.forEach((it) => {
      // Find matching vendor quote item if available
      const linkedVQ = vendorQuotes.find((vq) => vq.vendorId === it.selectedVendorId);
      const vqItem = linkedVQ?.items.find((vi) => vi.requirementItemId === it.requirementItemId);
      if (vqItem && vqItem.gstPercent !== it.gstPercent) {
        taxMismatch = true;
        taxDifferenceNote = `Vendor quoted ${vqItem.gstPercent}% GST for ${it.itemName}, but quotation specifies ${it.gstPercent}% GST`;
      }
    });
  }

  rules.push({
    ruleId: 'RULE-TAX-03',
    title: 'GST Input Tax Parity & ITC Reconciliation',
    category: 'TAX',
    passed: !taxMismatch,
    severity: 'WARNING',
    message: !taxMismatch
      ? 'Customer GST rates match Vendor quoted tax slabs. Full ITC set-off protected.'
      : `NOT CHECKED RIGHT: GST tax slab discrepancy detected! ${taxDifferenceNote}. Risk of blocked or unrecoverable tax credit.`,
    expectedValue: '100% Tax Slab Parity',
    actualValue: taxMismatch ? 'Tax Mismatch Detected' : 'Aligned',
  });

  // RULE 4: Working Capital & Credit Term Spread
  let termsRisk = false;
  let termsDetail = '';
  const customerTerms = quotation?.paymentTerms || requirement?.remarks || '30 Days Net';
  const custDays = customerTerms.includes('60') ? 60 : customerTerms.includes('45') ? 45 : customerTerms.includes('30') ? 30 : customerTerms.includes('Advance') ? 0 : 30;
  // Standard vendor terms typically 30 days or advance
  const vendorDays = 30;
  if (custDays > vendorDays + 15) {
    termsRisk = true;
    termsDetail = `Customer credit (${custDays} days) exceeds vendor credit (${vendorDays} days) by ${custDays - vendorDays} days`;
  }

  rules.push({
    ruleId: 'RULE-TERMS-04',
    title: 'Cash Flow & Payment Term Alignment',
    category: 'TERMS',
    passed: !termsRisk,
    severity: 'WARNING',
    message: !termsRisk
      ? `Credit terms (${customerTerms}) within acceptable working capital cycle.`
      : `NOT CHECKED RIGHT: Negative cash flow risk! ${termsDetail}. Financing interest will erode net earnings.`,
    expectedValue: `<= 15 days credit gap`,
    actualValue: `${custDays} vs ${vendorDays} days`,
  });

  // RULE 5: Freight & Landed Logistics Recovery
  let unrecoveredFreight = false;
  if (quotation && quotation.items) {
    const totalFreightCost = quotation.items.reduce((s, it) => s + (it.freightCost || 0) * it.quantity, 0);
    if (totalFreightCost > 0 && !quotation.deliveryTerms.toLowerCase().includes('freight')) {
      // Checked if margin covers freight
      if (grossEarning < totalFreightCost) {
        unrecoveredFreight = true;
      }
    }
  }

  rules.push({
    ruleId: 'RULE-FREIGHT-05',
    title: 'Freight & Logistics Cost Recovery',
    category: 'PRICING',
    passed: !unrecoveredFreight,
    severity: 'WARNING',
    message: !unrecoveredFreight
      ? 'Freight, packing, and logistics charges accounted for in commercial schedule.'
      : 'NOT CHECKED RIGHT: Incurred logistics and freight charges exceed estimated margin!',
    expectedValue: '100% Freight Recovery',
    actualValue: unrecoveredFreight ? 'Freight Unrecovered' : 'Covered',
  });

  // RULE 6: Minimum Absolute Earning Floor (Operational Cost Viability)
  const minEarningFloor = 500; // ₹500 floor
  const floorPassed = grossEarning >= minEarningFloor;
  rules.push({
    ruleId: 'RULE-FLOOR-06',
    title: 'Absolute Order Earning Floor',
    category: 'MARGIN',
    passed: floorPassed,
    severity: grossEarning <= 0 ? 'CRITICAL' : 'WARNING',
    message: floorPassed
      ? `Order gross earning of ₹${grossEarning.toLocaleString('en-IN')} covers administrative & order execution costs.`
      : `NOT CHECKED RIGHT: Low absolute earning of ₹${grossEarning.toLocaleString('en-IN')}. May not cover transaction processing overhead.`,
    expectedValue: `>= ₹${minEarningFloor}`,
    actualValue: `₹${grossEarning.toLocaleString('en-IN')}`,
    earningImpactAmount: grossEarning,
  });

  // Summary counts
  const totalPassed = rules.filter((r) => r.passed).length;
  const totalFailed = rules.filter((r) => !r.passed && r.severity === 'CRITICAL').length;
  const totalWarnings = rules.filter((r) => !r.passed && r.severity !== 'CRITICAL').length;

  const healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL_VIOLATION' =
    totalFailed > 0 ? 'CRITICAL_VIOLATION' : totalWarnings > 0 ? 'WARNING' : 'HEALTHY';

  const lockInfo = quotation?.commercialLock || requirement?.commercialLock;

  return {
    requirementId: reqId,
    quotationId: quotation?.id,
    customerName: custName,
    totalBuyingCost,
    totalSellingPrice,
    grossEarning,
    marginPercent,
    targetMarginPercent: targetMargin,
    isLocked: !!lockInfo?.isLocked,
    lockInfo,
    rules,
    totalPassed,
    totalFailed,
    totalWarnings,
    healthStatus,
  };
};

/**
 * Generate shareable verification link URL
 */
export const generateOrderVerificationUrl = (requirementId: string, quotationId?: string): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://procuremro.app';
  const url = new URL(origin);
  url.searchParams.set('verifyOrder', requirementId);
  if (quotationId) {
    url.searchParams.set('qtnId', quotationId);
  }
  url.searchParams.set('mode', 'audit');
  return url.toString();
};

/**
 * Generate formatted Mailto link for sending data through mail to check
 */
export const generateVerificationMailto = (
  summary: CommercialAuditSummary,
  recipientEmail = 'finance-auditor@client.com',
  customNote = ''
): { mailtoUrl: string; subject: string; body: string; shareUrl: string } => {
  const shareUrl = generateOrderVerificationUrl(summary.requirementId, summary.quotationId);

  const subject = `[AUDIT & VERIFICATION] Order #${summary.requirementId} Earning & Commercials (${summary.healthStatus === 'HEALTHY' ? 'PASSED' : 'CHECK REQUIRED'})`;

  const passedList = summary.rules
    .filter((r) => r.passed)
    .map((r) => `  ✓ [PASSED] ${r.title}: ${r.actualValue}`)
    .join('\n');

  const failedList = summary.rules
    .filter((r) => !r.passed)
    .map((r) => `  ✗ [NOT CHECKED RIGHT] ${r.title}: ${r.message}`)
    .join('\n');

  const lockStatusText = summary.isLocked
    ? `LOCKED & FROZEN by ${summary.lockInfo?.lockedBy || 'Commercial Auditor'} on ${summary.lockInfo?.lockedAt || 'N/A'}`
    : 'OPEN / UNLOCKED (Amendments Permitted)';

  const body = `Dear Finance & Commercial Audit Team,

Please review the commercial earning calculations and rule verification for Order #${summary.requirementId}.

--------------------------------------------------
COMMERCIAL SUMMARY:
--------------------------------------------------
Customer: ${summary.customerName}
Requirement ID: ${summary.requirementId}
Quotation ID: ${summary.quotationId || 'Pending'}
Commercial Lock Status: ${lockStatusText}

Total Customer Selling Value: ₹${summary.totalSellingPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Total Vendor Buying Cost:     ₹${summary.totalBuyingCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Projected Net Gross Earning:  ₹${summary.grossEarning.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Gross Profit Margin:          ${summary.marginPercent.toFixed(1)}% (Target: >= ${summary.targetMarginPercent}%)

Overall Audit Status: ${summary.healthStatus === 'HEALTHY' ? 'VERIFIED HEALTHY' : 'RULES FLAG DETECTED - REVIEW REQUIRED'}

--------------------------------------------------
RULES VERIFICATION SUMMARY:
Passed: ${summary.totalPassed} | Not Checked Right: ${summary.totalFailed + summary.totalWarnings}
--------------------------------------------------
RULES CHECKED RIGHT:
${passedList || '  None'}

${summary.totalFailed + summary.totalWarnings > 0 ? `RULES NOT CHECKED RIGHT (VIOLATIONS & WARNINGS):\n${failedList}\n` : ''}
${customNote ? `AUDITOR NOTE:\n"${customNote}"\n\n` : ''}--------------------------------------------------
DIRECT VERIFICATION LINK:
Click the link below to open and inspect the order, commercial schedule, or unlock/lock status in ProcureMRO:
${shareUrl}
--------------------------------------------------

Best regards,
ProcureMRO Supply Chain Systems
Commercial Audit & Margin Protection Engine`;

  const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  return {
    mailtoUrl,
    subject,
    body,
    shareUrl,
  };
};
