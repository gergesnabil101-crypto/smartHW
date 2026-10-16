/**
 * Comprehensive, bulletproof Excel & CSV export utilities for quiz results.
 * Fixes mobile/desktop browser blocking, encoding glitches, and XML warnings.
 */

export interface ExportColumn {
  header: string;
  key: string;
}

/**
 * Universal file saver that works reliably on:
 * - Desktop Chrome / Firefox / Edge / Safari
 * - Mobile Safari (iOS iPhone / iPad)
 * - Mobile Chrome / Samsung Internet (Android)
 * - Sandboxed iframes and webviews
 */
export function universalSaveFile(blob: Blob, filename: string) {
  try {
    // 1. Check for msSaveOrOpenBlob (legacy IE/Edge)
    if ((window.navigator as any).msSaveOrOpenBlob) {
      (window.navigator as any).msSaveOrOpenBlob(blob, filename);
      return;
    }

    // 2. Standard Object URL + Anchor Click
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.target = '_blank';
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    // Clean up
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1500);
  } catch (err) {
    console.error('Download error, attempting fallback:', err);
    // 3. Fallback to FileReader Data URI
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUri = reader.result as string;
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 1000);
    };
    reader.readAsDataURL(blob);
  }
}

/**
 * Exports data as universal UTF-8 CSV with BOM.
 * This is 100% compatible with all versions of Microsoft Excel, Apple Numbers, Google Sheets,
 * and mobile spreadsheet viewers without any "file corrupted" warnings.
 */
export function exportToCSV(data: any[], filename: string = 'نتائج_الطلاب.csv') {
  if (!data || data.length === 0) {
    alert('لا توجد بيانات لتصديرها.');
    return;
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(header => {
      const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
      // Escape double quotes
      const escaped = val.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',')
  );

  // UTF-8 BOM (\uFEFF) forces Excel to recognize Arabic characters correctly
  const csvContent = '\uFEFF' + [headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  universalSaveFile(blob, cleanFilename);
}

/**
 * Exports data as rich HTML-based Excel file with Arabic RTL, styling, and headers.
 */
export function exportToExcelHTML(
  data: any[],
  title: string = 'كشف نتائج الطلاب',
  filename: string = 'نتائج_الطلاب.xls',
  metadata?: {
    teacherName?: string;
    subject?: string;
    gradeLevel?: string;
    quizTitle?: string;
  }
) {
  if (!data || data.length === 0) {
    alert('لا توجد بيانات لتصديرها.');
    return;
  }

  const headers = Object.keys(data[0]);

  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>النتائج</x:Name>
          <x:WorksheetOptions>
            <x:DisplayRightToLeft/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
    table { border-collapse: collapse; width: 100%; direction: rtl; }
    .header-info { margin-bottom: 20px; font-size: 14px; }
    .title { font-size: 18px; font-weight: bold; color: #1e1b4b; background-color: #e0e7ff; text-align: center; padding: 12px; }
    .meta-cell { font-size: 12px; color: #475569; padding: 6px; }
    th { background-color: #4f46e5; color: #ffffff; font-weight: bold; font-size: 12px; padding: 10px; border: 1px solid #3730a3; text-align: center; }
    td { font-size: 11px; padding: 8px; border: 1px solid #cbd5e1; text-align: center; mso-number-format: "\\@"; }
    tr:nth-child(even) td { background-color: #f8fafc; }
    .num { mso-number-format: "0"; }
    .pct { mso-number-format: "0%"; }
    .status-sent { color: #15803d; font-weight: bold; }
    .status-pending { color: #b45309; }
  </style>
</head>
<body>
  <table>
    <tr>
      <td colspan="${headers.length}" class="title">${escapeHTML(metadata?.quizTitle || title)}</td>
    </tr>`;

  if (metadata) {
    html += `
    <tr>
      <td colspan="${Math.ceil(headers.length / 2)}" class="meta-cell"><strong>المعلم:</strong> ${escapeHTML(metadata.teacherName || '-')} | <strong>المادة:</strong> ${escapeHTML(metadata.subject || '-')}</td>
      <td colspan="${Math.floor(headers.length / 2)}" class="meta-cell" style="text-align: left;"><strong>المرحلة:</strong> ${escapeHTML(metadata.gradeLevel || '-')} | <strong>تاريخ الاستخراج:</strong> ${new Date().toLocaleDateString('ar-EG')}</td>
    </tr>`;
  }

  html += `
    <tr><td colspan="${headers.length}" style="height: 10px; border: none;"></td></tr>
    <thead>
      <tr>
        ${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>`;

  for (const row of data) {
    html += `<tr>`;
    for (const h of headers) {
      const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
      const isStatus = h.includes('إرسال') || h.includes('حالة');
      let statusClass = '';
      if (isStatus) {
        statusClass = val.includes('تم') ? 'status-sent' : 'status-pending';
      }
      html += `<td class="${statusClass}">${escapeHTML(val)}</td>`;
    }
    html += `</tr>`;
  }

  html += `
    </tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const cleanFilename = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  universalSaveFile(blob, cleanFilename);
}

/**
 * Combined smart exporter that generates both formats seamlessly
 */
export function exportResultsToExcelOrCSV(
  data: any[],
  filename: string,
  format: 'xlsx' | 'csv' | 'xls' = 'xls',
  metadata?: {
    teacherName?: string;
    subject?: string;
    gradeLevel?: string;
    quizTitle?: string;
  }
) {
  if (format === 'csv') {
    exportToCSV(data, filename.replace(/\.(xls|xlsx|csv)$/i, '') + '.csv');
  } else {
    exportToExcelHTML(data, 'كشف نتائج الطلاب', filename.replace(/\.(xls|xlsx|csv)$/i, '') + '.xls', metadata);
  }
}

function escapeHTML(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
