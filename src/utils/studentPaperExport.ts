/**
 * Format Egyptian/International phone numbers for WhatsApp
 */
export function formatWhatsAppPhone(rawPhone: string): string {
  if (!rawPhone) return '';
  let phone = rawPhone.toString().trim().replace(/[^0-9+]/g, '');
  if (phone.startsWith('+')) {
    phone = phone.substring(1);
  }
  // Standard Egyptian mobile number starting with 01
  if (phone.startsWith('01') && phone.length === 11) {
    phone = '2' + phone;
  }
  return phone;
}

/**
 * Builds a clean, official WhatsApp message with RESULT ONLY for parent (no detailed answers)
 */
export function buildParentResultOnlyWhatsAppMessage(
  result: any,
  quiz: any,
  teacherInfo?: any
): string {
  const studentName = (result?.student_name || 'الطالب').trim();
  const quizTitle = (quiz?.title || result?.quiz_title || 'الاختبار').trim();
  
  // Comprehensive teacher name resolution
  const rawTeacherName = (
    teacherInfo?.name || 
    quiz?.teacher_name || 
    quiz?.teacherName || 
    quiz?.created_by_name ||
    result?.teacher_name || 
    result?.teacherName || 
    ''
  ).trim();
  
  const teacherName = rawTeacherName 
    ? (rawTeacherName.startsWith('أ/') || rawTeacherName.startsWith('أستاذ') ? rawTeacherName : `أ/ ${rawTeacherName}`)
    : 'معلم المادة';

  const subject = (teacherInfo?.subject || quiz?.subject || result?.subject || '').trim();
  const score = result?.score ?? 0;
  const total = result?.total ?? (quiz?.questions?.length || 0);
  const pct = Math.round((score / (total || 1)) * 100);
  const examDate = result?.created_at ? new Date(result.created_at).toLocaleDateString('ar-EG') : '';

  let rating = 'ممتاز 🌟';
  if (pct < 50) rating = 'يحتاج إلى مزيد من المتابعة والاجتهاد 📚';
  else if (pct < 75) rating = 'جيد 👍';
  else if (pct < 85) rating = 'جيد جداً 👏';

  let msg = `السلام عليكم ورحمة الله وبركاته، تحية طيبة لولي أمر الطالب/ة: ${studentName} 👋\n\n`;
  msg += `نحيطكم علماً بنتيجة نجلكم في:\n`;
  msg += `📖 *اختبار:* ${quizTitle}\n`;
  if (subject) {
    msg += `📚 *المادة:* ${subject}\n`;
    msg += `👨‍🏫 *معلم المادة:* ${teacherName}\n`;
  } else {
    msg += `👨‍🏫 *معلم المادة:* ${teacherName}\n`;
  }
  if (examDate) msg += `📅 *تاريخ الاختبار:* ${examDate}\n`;
  msg += `📊 *النتيجة:* ${score} من ${total} (${pct}%)\n`;
  msg += `🎖️ *التقدير:* ${rating}\n\n`;
  msg += `مع خالص تحيات معلم المادة (${teacherName}) وتمنياتنا للطالب بدوام التفوق والنجاح 🌟`;

  return msg;
}

/**
 * Builds a concise, clean Arabic WhatsApp message accompanying the answer sheet image or result
 */
export function buildStudentWhatsAppMessage(
  result: any,
  quiz: any,
  teacherInfo?: any,
  target: 'student' | 'parent' = 'student',
  withImage: boolean = true
): string {
  if (target === 'parent' && !withImage) {
    return buildParentResultOnlyWhatsAppMessage(result, quiz, teacherInfo);
  }

  const studentName = (result?.student_name || 'الطالب').trim();
  const quizTitle = (quiz?.title || result?.quiz_title || 'الاختبار').trim();
  
  const rawTeacherName = (
    teacherInfo?.name || 
    quiz?.teacher_name || 
    quiz?.teacherName || 
    quiz?.created_by_name ||
    result?.teacher_name || 
    result?.teacherName || 
    ''
  ).trim();

  const teacherName = rawTeacherName 
    ? (rawTeacherName.startsWith('أ/') || rawTeacherName.startsWith('أستاذ') ? rawTeacherName : `أ/ ${rawTeacherName}`)
    : 'المعلم';

  const subject = (teacherInfo?.subject || quiz?.subject || result?.subject || '').trim();
  const score = result?.score ?? 0;
  const total = result?.total ?? (quiz?.questions?.length || 0);
  const pct = Math.round((score / (total || 1)) * 100);
  const examDate = result?.created_at ? new Date(result.created_at).toLocaleDateString('ar-EG') : '';

  let rating = 'ممتاز 🌟';
  if (pct < 50) rating = 'يحتاج إلى مزيد من التركيز والمراجعة 📚';
  else if (pct < 75) rating = 'جيد 👍';
  else if (pct < 85) rating = 'جيد جداً 👏';

  if (target === 'parent') {
    let msg = `السلام عليكم ورحمة الله وبركاته، تحية طيبة لولي أمر الطالب/ة: ${studentName} 👋\n\n`;
    msg += `نحيطكم علماً بنتيجة نجلكم في:\n`;
    msg += `📖 *اختبار:* ${quizTitle}\n`;
    if (subject) msg += `📚 *المادة:* ${subject}\n`;
    msg += `👨‍🏫 *معلم المادة:* ${teacherName}\n`;
    if (examDate) msg += `📅 *تاريخ الاختبار:* ${examDate}\n`;
    msg += `📊 *النتيجة:* ${score} من ${total} (${pct}%) - ${rating}\n\n`;
    if (withImage) {
      msg += `📸 *مرفق صورة ورقة الاختبار الخاصة بنجلكم للمتابعة.*`;
    }
    return msg;
  }

  let greeting = `السلام عليكم ورحمة الله وبركاته يا ${studentName} 👋`;
  let msg = `${greeting}\n\n`;
  msg += `📖 *اختبار:* ${quizTitle}${subject ? ` (${subject})` : ''}\n`;
  msg += `👨‍🏫 *معلم المادة:* ${teacherName}\n`;
  if (examDate) msg += `📅 *التاريخ:* ${examDate}\n`;
  msg += `📊 *النتيجة:* ${score} من ${total} (${pct}%) - ${rating}\n\n`;
  if (withImage) {
    msg += `📸 *مرفق صورة ورقة الإجابة والتصحيح النموذجي لمراجعة إجاباتك بالتفصيل.*`;
  }

  return msg;
}

/**
 * Builds the standalone printable HTML template for the student paper
 */
export function buildStudentPaperHTML(
  result: any,
  quiz: any,
  teacherInfo?: any
): string {
  const studentName = result.student_name || 'طالب';
  const quizTitle = quiz?.title || result.quiz_title || 'الاختبار';
  const teacherName = teacherInfo?.name || quiz?.teacher_name || 'المعلم';
  const subject = teacherInfo?.subject || quiz?.subject || '';
  const score = result.score ?? 0;
  const total = result.total ?? 0;
  const pct = Math.round((score / (total || 1)) * 100);
  const center = result.center_name || 'العام';
  const examDate = result.created_at ? new Date(result.created_at).toLocaleString('ar-EG') : '';

  const feedbackObj = typeof result.feedback === 'string' ? JSON.parse(result.feedback || '{}') : (result.feedback || {});
  const studentAnsObj = typeof result.student_answers === 'string' ? JSON.parse(result.student_answers || '{}') : (result.student_answers || {});
  const questions = quiz?.questions || [];

  let questionsHTML = '';
  questions.forEach((q: any, idx: number) => {
    const qFeedback = feedbackObj[q.id] || {};
    const isEssay = q.type === 'essay';
    const isTrueFalse = q.type === 'true-false';
    const isMCQ = !isEssay && !isTrueFalse;
    const studentAns = qFeedback.studentAnswer !== undefined ? qFeedback.studentAnswer : studentAnsObj[q.id];

    let pointsAwarded = 0;
    let isCorrect = false;

    if (isEssay) {
      pointsAwarded = qFeedback.score !== undefined ? Number(qFeedback.score) : 0;
      isCorrect = pointsAwarded >= (q.points || 1) * 0.75;
    } else if (isTrueFalse) {
      isCorrect = String(studentAns).toLowerCase() === String(q.correctOptionIndex === 0 ? 'true' : 'false').toLowerCase();
      pointsAwarded = isCorrect ? (q.points || 1) : 0;
    } else {
      isCorrect = Number(studentAns) === Number(q.correctOptionIndex);
      pointsAwarded = isCorrect ? (q.points || 1) : 0;
    }

    let optionsHTML = '';
    if (isMCQ && Array.isArray(q.options)) {
      optionsHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">
          ${q.options.map((opt: string, optIdx: number) => {
            const isStudentSelection = studentAns !== undefined && Number(studentAns) === Number(optIdx);
            const isModelOption = Number(q.correctOptionIndex) === Number(optIdx);
            let borderStyle = '1px solid #e2e8f0';
            let bgStyle = '#ffffff';
            let label = '';

            if (isStudentSelection && isModelOption) {
              borderStyle = '2px solid #10b981';
              bgStyle = '#ecfdf5';
              label = '<span style="color:#059669; font-size:11px; font-weight:bold;">[إجابة الطالب الصحيحة ✓]</span>';
            } else if (isStudentSelection && !isModelOption) {
              borderStyle = '2px solid #ef4444';
              bgStyle = '#fef2f2';
              label = '<span style="color:#dc2626; font-size:11px; font-weight:bold;">[إجابة الطالب الخاطئة ✗]</span>';
            } else if (isModelOption) {
              borderStyle = '1.5px solid #10b981';
              bgStyle = '#f0fdf4';
              label = '<span style="color:#059669; font-size:11px; font-weight:bold;">[الإجابة النموذجية ✓]</span>';
            }

            return `
              <div style="border: ${borderStyle}; background: ${bgStyle}; padding: 8px 12px; border-radius: 8px; font-size: 13px;">
                <span style="font-weight: bold; margin-left: 6px;">${String.fromCharCode(65 + optIdx)})</span>
                <span>${opt || ''}</span>
                ${label ? `<div style="margin-top: 4px;">${label}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (isTrueFalse) {
      optionsHTML = `
        <div style="margin-top: 8px; font-size: 13px;">
          <div><strong>إجابة الطالب:</strong> <span style="color: ${isCorrect ? '#059669' : '#dc2626'}; font-weight:bold;">${studentAns === 'true' || studentAns === 0 ? 'صح (True)' : studentAns === 'false' || studentAns === 1 ? 'خطأ (False)' : 'لم يُجب'}</span></div>
          <div><strong>الإجابة الصحيحة:</strong> <span style="color: #059669; font-weight:bold;">${q.correctOptionIndex === 0 ? 'صح (True)' : 'خطأ (False)'}</span></div>
        </div>
      `;
    } else if (isEssay) {
      optionsHTML = `
        <div style="margin-top: 10px; font-size: 13px; background: #ffffff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">
          <div style="margin-bottom: 6px;"><strong>إجابة الطالب:</strong> <span style="color: #1e293b;">${studentAns || 'لا توجد إجابة مسجلة'}</span></div>
          ${q.modelAnswer ? `<div style="margin-bottom: 6px; color: #065f46; background: #ecfdf5; padding: 6px 10px; border-radius: 6px;"><strong>الإجابة النموذجية:</strong> ${q.modelAnswer}</div>` : ''}
          ${qFeedback.feedback ? `<div style="color: #4338ca; background: #eef2ff; padding: 6px 10px; border-radius: 6px;"><strong>ملاحظات التصحيح:</strong> ${qFeedback.feedback}</div>` : ''}
        </div>
      `;
    }

    const cardBg = isCorrect ? '#f0fdf4' : '#fff5f5';
    const cardBorder = isCorrect ? '#86efac' : '#fca5a5';

    questionsHTML += `
      <div style="background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px; border-bottom: 1px dashed ${cardBorder}; padding-bottom: 8px;">
          <div>
            <span style="background: #ffffff; border: 1px solid #cbd5e1; padding: 2px 8px; border-radius: 6px; font-weight: bold; font-size: 12px; margin-left: 8px;">سؤال ${idx + 1}</span>
            <span style="font-weight: bold; font-size: 14px; color: #1e293b;">${q.text || ''}</span>
          </div>
          <div style="font-weight: bold; font-size: 13px; color: ${isCorrect ? '#059669' : '#dc2626'}; white-space: nowrap; margin-right: 12px;">
            ${pointsAwarded} / ${q.points || 1} درجة
          </div>
        </div>
        ${q.image ? `<div style="text-align: center; margin: 8px 0;"><img src="${q.image}" style="max-height: 160px; max-width: 100%; border-radius: 8px; border: 1px solid #e2e8f0;" /></div>` : ''}
        ${optionsHTML}
      </div>
    `;
  });

  return `
    <div id="student-paper-export-root" dir="rtl" style="font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; color: #0f172a; padding: 24px; background: #ffffff; max-width: 850px; margin: 0 auto; box-sizing: border-box; line-height: 1.5;">
      <!-- Header Banner -->
      <div style="border: 2px solid #4f46e5; border-radius: 16px; padding: 18px 24px; background: linear-gradient(135deg, #eef2ff 0%, #ffffff 100%); margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0 0 6px 0; font-size: 22px; color: #312e81; font-weight: 800;">ورقة إجابة الطالب النموذجية</h1>
          <div style="font-size: 14px; color: #4338ca; font-weight: bold;">اختبار: ${quizTitle} ${subject ? `• مادة: ${subject}` : ''}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px;">المعلم: أ/ ${teacherName} • ${examDate}</div>
        </div>
        <div style="text-align: center; background: #ffffff; border: 2px solid #4f46e5; border-radius: 14px; padding: 10px 18px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="font-size: 11px; color: #64748b; font-weight: bold;">الدرجة الكلية</div>
          <div style="font-size: 26px; font-weight: 900; color: ${pct >= 75 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626'};">${score} / ${total}</div>
          <div style="font-size: 12px; font-weight: bold; color: #4f46e5;">(${pct}%)</div>
        </div>
      </div>

      <!-- Student Details Ribbon -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 18px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; font-size: 13px;">
        <div><span style="color: #64748b;">اسم الطالب:</span> <strong style="color: #0f172a;">${studentName}</strong></div>
        <div><span style="color: #64748b;">السنتر/المجموعة:</span> <strong style="color: #0f172a;">${center}</strong></div>
        <div><span style="color: #64748b;">رقم الهاتف:</span> <strong style="color: #0f172a;" dir="ltr">${result.student_phone || result.phone || result.parent_phone || '-'}</strong></div>
        <div><span style="color: #64748b;">إجمالي الأسئلة:</span> <strong style="color: #0f172a;">${questions.length} سؤال</strong></div>
      </div>

      <!-- Questions List -->
      <div>
        ${questionsHTML}
      </div>

      <!-- Footer -->
      <div style="margin-top: 24px; padding-top: 16px; border-top: 2px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px;">
        <p style="margin: 0 0 4px 0; font-weight: bold; color: #334155;">مع تمنيات أ/ ${teacherName} لجميع الطلاب بالتوفيق والنجاح الدائم 🌟</p>
        <p style="margin: 0; font-size: 11px;">تم استخراج هذا التقرير آلياً عبر منصة المصحح الذكي</p>
      </div>
    </div>
  `;
}

/**
 * Download Student Paper as PDF
 */
export async function downloadStudentPaperPDF(
  result: any,
  quiz: any,
  teacherInfo?: any
): Promise<void> {
  const studentName = (result.student_name || 'طالب').trim().replace(/\s+/g, '_');
  const quizTitle = (quiz?.title || result.quiz_title || 'اختبار').trim().replace(/\s+/g, '_');
  const filename = `ورقة_الطالب_${studentName}_${quizTitle}.pdf`;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '850px';
  container.innerHTML = buildStudentPaperHTML(result, quiz, teacherInfo);
  document.body.appendChild(container);

  const opt = {
    margin: [10, 10, 10, 10],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdfLib = (html2pdfModule as any).default || html2pdfModule;
    await html2pdfLib().from(container).set(opt).save();
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    throw err;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Download Student Paper as PNG Image
 */
export async function downloadStudentPaperImage(
  result: any,
  quiz: any,
  teacherInfo?: any
): Promise<void> {
  const studentName = (result.student_name || 'طالب').trim().replace(/\s+/g, '_');
  const quizTitle = (quiz?.title || result.quiz_title || 'اختبار').trim().replace(/\s+/g, '_');
  const filename = `ورقة_الطالب_${studentName}_${quizTitle}.png`;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '800px';
  container.innerHTML = buildStudentPaperHTML(result, quiz, teacherInfo);
  document.body.appendChild(container);

  try {
    const html2canvasModule = await import('html2canvas');
    const html2canvasLib = (html2canvasModule as any).default || html2canvasModule;
    const canvas = await html2canvasLib(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Failed to generate image:', err);
    throw err;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Send WhatsApp Message to Student or Parent and optionally trigger file download
 */
export async function sendWhatsAppStudentPaper(
  result: any,
  quiz: any,
  teacherInfo?: any,
  target: 'student' | 'parent' = 'student',
  downloadFormat: 'pdf' | 'image' | 'none' = 'none'
): Promise<boolean> {
  const targetPhone = target === 'student' 
    ? (result.student_phone || result.phone || result.parent_phone)
    : (result.parent_phone || result.student_phone || result.phone);

  if (!targetPhone) {
    alert(target === 'student' ? 'لم يتم تسجيل رقم هاتف خاص بالطالب.' : 'لم يتم تسجيل رقم هاتف ولي الأمر.');
    return false;
  }

  const formattedPhone = formatWhatsAppPhone(targetPhone);
  if (!formattedPhone) {
    alert('رقم الهاتف المسجل غير صالح للاستخدام في واتساب.');
    return false;
  }

  // Trigger download if requested so user can easily attach the file into the WhatsApp chat
  if (downloadFormat === 'pdf') {
    downloadStudentPaperPDF(result, quiz, teacherInfo).catch(console.error);
  } else if (downloadFormat === 'image') {
    downloadStudentPaperImage(result, quiz, teacherInfo).catch(console.error);
  }

  const message = buildStudentWhatsAppMessage(result, quiz, teacherInfo, target);
  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  return true;
}

