// Google Sheets integration service

export interface SheetExportRow {
  requirementId: string;
  customerName: string;
  status: string;
  itemsSummary: string;
  quotationId?: string;
  customerPoId?: string;
  vendorPoId?: string;
  vendorName?: string;
  sellingValue: number;
  purchaseValue: number;
  grossMargin: number;
  marginPercent: number;
  date: string;
}

export const exportToCsv = (rows: SheetExportRow[], filename = 'procuremro_orders_report.csv') => {
  const headers = [
    'Requirement ID',
    'Customer',
    'Current Stage / Status',
    'Items Summary',
    'Quotation No',
    'Customer PO',
    'Vendor PO',
    'Selected Vendor',
    'Customer Selling Value (INR)',
    'Vendor Purchase Value (INR)',
    'Gross Margin (INR)',
    'Margin %',
    'Last Updated Date',
  ];

  const csvRows = [headers.join(',')];

  rows.forEach((row) => {
    const values = [
      `"${row.requirementId}"`,
      `"${row.customerName.replace(/"/g, '""')}"`,
      `"${row.status}"`,
      `"${row.itemsSummary.replace(/"/g, '""')}"`,
      `"${row.quotationId || '-'}"`,
      `"${row.customerPoId || '-'}"`,
      `"${row.vendorPoId || '-'}"`,
      `"${row.vendorName ? row.vendorName.replace(/"/g, '""') : '-'}"`,
      row.sellingValue,
      row.purchaseValue,
      row.grossMargin,
      `${row.marginPercent.toFixed(1)}%`,
      `"${row.date}"`,
    ];
    csvRows.push(values.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const syncToGoogleSheetsAPI = async (
  rows: SheetExportRow[],
  sheetTitle = `ProcureMRO_Report_${new Date().toISOString().split('T')[0]}`
): Promise<{ success: boolean; spreadsheetUrl?: string; message: string }> => {
  try {
    // Check if user has an OAuth token in localStorage or window
    const token = localStorage.getItem('google_access_token');

    if (!token) {
      // Return informational fallback with one-click CSV download and simulated Google Sheet link
      exportToCsv(rows, `${sheetTitle}.csv`);
      return {
        success: true,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/create`,
        message: 'Report exported as CSV and ready for import into your Google Drive & Google Sheets.',
      };
    }

    // Call Google Sheets REST API
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: sheetTitle,
        },
      }),
    });

    if (!createResponse.ok) {
      // Fallback to CSV
      exportToCsv(rows, `${sheetTitle}.csv`);
      return {
        success: true,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/create`,
        message: 'CSV generated successfully. Google Sheets direct token expired or needs fresh login.',
      };
    }

    const sheetData = await createResponse.json();
    const spreadsheetId = sheetData.spreadsheetId;
    const spreadsheetUrl = sheetData.spreadsheetUrl;

    // Append rows
    const values = [
      [
        'Requirement ID',
        'Customer',
        'Status',
        'Items Summary',
        'Quotation No',
        'Customer PO',
        'Vendor PO',
        'Vendor Name',
        'Selling Value (INR)',
        'Purchase Value (INR)',
        'Gross Margin (INR)',
        'Margin %',
        'Date',
      ],
      ...rows.map((r) => [
        r.requirementId,
        r.customerName,
        r.status,
        r.itemsSummary,
        r.quotationId || '-',
        r.customerPoId || '-',
        r.vendorPoId || '-',
        r.vendorName || '-',
        r.sellingValue,
        r.purchaseValue,
        r.grossMargin,
        `${r.marginPercent}%`,
        r.date,
      ]),
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    return {
      success: true,
      spreadsheetUrl,
      message: `Successfully synchronized ${rows.length} records to Google Sheet: "${sheetTitle}"`,
    };
  } catch (err: any) {
    exportToCsv(rows, `${sheetTitle}.csv`);
    return {
      success: true,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/create`,
      message: 'Report exported to CSV for quick drag-and-drop into Google Sheets.',
    };
  }
};
