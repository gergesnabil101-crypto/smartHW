/**
 * High-quality Arabic RTL PDF exporter for quiz results.
 * Supports direct PDF download using html2pdf.js and high-res browser PDF print.
 */

export interface PDFExportOptions {
  quizTitle: string;
  teacherName?: string;
  subject?: string;
  gradeLevel?: string;
  centerName?: string;
  totalStudents: number;
  avgScore: string | number;
  avgPct: number;
  passRate: number;
  passCount: number;
  topScore: number;
  results: Array<{
    index: number;
    student_name: string;
    student_phone?: string;
    parent_phone?: string;
    center_name?: string;
    grade_level?: string;
    subject?: string;
    score: number;
    total: number;
    pct: number;
    rating: string;
    reviewed_and_sent: boolean;
    created_at?: string;
  }>;
  filename?: string;
}

export function generateResultsReportHTML(options: PDFExportOptions): string {
  const {
    quizTitle,
    teacherName,
    subject,
    gradeLevel,
    centerName,
    totalStudents,
    avgScore,
    avgPct,
    passRate,
    passCount,
    topScore,
    results
  } = options;

  const currentDate = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>كشف نتائج: ${escapeHTML(quizTitle)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      direction: rtl;
      margin: 0;
      padding: 20px;
      color: #1e293b;
      background-color: #ffffff;
      font-size: 12px;
    }

    .report-container {
      max-width: 1000px;
      margin: 0 auto;
    }

    /* Header Section */
    .report-header {
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header-title-box h1 {
      margin: 0 0 6px 0;
      font-size: 20px;
      font-weight: 800;
      color: #1e1b4b;
    }

    .header-title-box p {
      margin: 0;
      font-size: 12px;
      color: #64748b;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px 16px;
      background: #f8fafc;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      font-size: 11px;
    }

    .meta-item {
      display: flex;
      gap: 6px;
    }

    .meta-label {
      font-weight: 700;
      color: #475569;
    }

    .meta-value {
      color: #0f172a;
      font-weight: 600;
    }

    /* KPI Summary Stats Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    .kpi-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 12px;
      text-align: center;
    }

    .kpi-card.indigo { border-color: #c7d2fe; background: #eef2ff; }
    .kpi-card.emerald { border-color: #a7f3d0; background: #ecfdf5; }
    .kpi-card.amber { border-color: #fde68a; background: #fffbeb; }
    .kpi-card.blue { border-color: #bae6fd; background: #f0f9ff; }

    .kpi-title {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 4px;
    }

    .kpi-value {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }

    /* Results Table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 11px;
    }

    th {
      background-color: #4f46e5;
      color: #ffffff;
      font-weight: 700;
      padding: 8px 6px;
      text-align: center;
      border: 1px solid #4338ca;
      white-space: nowrap;
    }

    td {
      padding: 7px 6px;
      text-align: center;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    .student-name-col {
      text-align: right;
      font-weight: 700;
      color: #0f172a;
      padding-right: 10px;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
    }

    .badge-excellent { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge-very-good { background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; }
    .badge-pass { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-fail { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }

    .status-sent {
      color: #15803d;
      font-weight: 700;
      font-size: 10px;
    }

    .status-pending {
      color: #94a3b8;
      font-size: 10px;
    }

    /* Footer */
    .report-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #64748b;
    }

    @media print {
      body {
        padding: 0;
      }
      @page {
        size: A4 landscape;
        margin: 10mm;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Header -->
    <div class="report-header">
      <div class="header-title-box">
        <h1>كشف درجات ونتائج الطلاب</h1>
        <p>اختبار: <strong>${escapeHTML(quizTitle)}</strong></p>
      </div>
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">المعلم:</span>
          <span class="meta-value">${escapeHTML(teacherName || 'الأستاذ المحترم')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">المادة:</span>
          <span class="meta-value">${escapeHTML(subject || 'عام')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">المرحلة:</span>
          <span class="meta-value">${escapeHTML(gradeLevel || 'غير محدد')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">التاريخ:</span>
          <span class="meta-value">${currentDate}</span>
        </div>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card indigo">
        <div class="kpi-title">إجمالي عدد الطلاب</div>
        <div class="kpi-value">${totalStudents} طالب</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-title">متوسط الدرجات</div>
        <div class="kpi-value">${avgScore} (${avgPct}%)</div>
      </div>
      <div class="kpi-card emerald">
        <div class="kpi-title">نسبة النجاح الإجمالية</div>
        <div class="kpi-value">${passRate}% (${passCount} ناجح)</div>
      </div>
      <div class="kpi-card amber">
        <div class="kpi-title">أعلى درجة مسجلة</div>
        <div class="kpi-value">${topScore}</div>
      </div>
    </div>

    <!-- Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 35px;">م</th>
          <th style="width: 180px;">اسم الطالب</th>
          <th style="width: 110px;">هاتف الطالب</th>
          <th style="width: 110px;">هاتف ولي الأمر</th>
          <th style="width: 100px;">السنتر / المجموعة</th>
          <th style="width: 75px;">الدرجة</th>
          <th style="width: 60px;">النسبة</th>
          <th style="width: 85px;">التقدير</th>
          <th style="width: 110px;">ولي الأمر</th>
        </tr>
      </thead>
      <tbody>
        ${results.map((r) => {
          let badgeClass = 'badge-fail';
          if (r.pct >= 85) badgeClass = 'badge-excellent';
          else if (r.pct >= 75) badgeClass = 'badge-very-good';
          else if (r.pct >= 50) badgeClass = 'badge-pass';

          return `
          <tr>
            <td>${r.index}</td>
            <td class="student-name-col">${escapeHTML(r.student_name)}</td>
            <td dir="ltr">${escapeHTML(r.student_phone || '-')}</td>
            <td dir="ltr">${escapeHTML(r.parent_phone || '-')}</td>
            <td>${escapeHTML(r.center_name || 'عام')}</td>
            <td><strong>${r.score}</strong> / ${r.total}</td>
            <td><strong>${r.pct}%</strong></td>
            <td><span class="badge ${badgeClass}">${escapeHTML(r.rating)}</span></td>
            <td>
              ${r.reviewed_and_sent 
                ? '<span class="status-sent">✓ تم الإرسال</span>' 
                : '<span class="status-pending">لم يُرسل</span>'}
            </td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- Footer -->
    <div class="report-footer">
      <div>تم استخراج هذا التقرير تلقائياً بواسطة منصة مصحح الواجبات الذكي (SmartHW)</div>
      <div>الصفحة 1 من 1 • ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Downloads the results report directly as a high-quality PDF file.
 */
export async function downloadResultsPDF(options: PDFExportOptions): Promise<void> {
  const safeFilename = (options.filename || `نتائج_${options.quizTitle || 'الطلاب'}`).replace(/[\\/*?:|<>"]/g, '_') + '.pdf';
  const htmlContent = generateResultsReportHTML(options);

  // Dynamically import html2pdf.js to avoid SSR/bundle issues
  try {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = (html2pdfModule as any).default || html2pdfModule;

    // Create a temporary container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.width = '1050px';
    container.style.backgroundColor = '#ffffff';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    const opt = {
      margin: [8, 8, 8, 8],
      filename: safeFilename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        letterRendering: true 
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'landscape' 
      }
    };

    await html2pdf().set(opt).from(container).save();

    // Clean up
    setTimeout(() => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }, 1000);
  } catch (err) {
    console.error('html2pdf download failed, falling back to print window:', err);
    printResultsPDF(options);
  }
}

/**
 * Opens a print dialog formatted for saving as PDF with high vector fidelity.
 */
export function printResultsPDF(options: PDFExportOptions): void {
  const htmlContent = generateResultsReportHTML(options);
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 600);
  } else {
    // If popups blocked, render inside an invisible iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }, 600);
    }
  }
}

function escapeHTML(str?: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
