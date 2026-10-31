/**
 * Utilities for formatting quiz durations and countdown timers.
 */

export function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
    return 'غير محدد';
  }
  const s = Math.round(seconds);
  if (s < 60) {
    return s === 1 ? 'ثانية واحدة' : s === 2 ? 'ثانيتان' : `${s} ثوانٍ`;
  }
  const mins = Math.floor(s / 60);
  const remSecs = s % 60;
  
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    const hourLabel = hours === 1 ? 'ساعة واحدة' : hours === 2 ? 'ساعتان' : `${hours} ساعات`;
    if (remMins === 0) return hourLabel;
    const minLabel = remMins === 1 ? 'دقيقة' : remMins === 2 ? 'دقيقتان' : `${remMins} دقيقة`;
    return `${hourLabel} و ${minLabel}`;
  }

  const minLabel = mins === 1 ? 'دقيقة واحدة' : mins === 2 ? 'دقيقتان' : `${mins} دقيقة`;
  if (remSecs === 0) {
    return minLabel;
  }
  const secLabel = remSecs === 1 ? 'ثانية' : remSecs === 2 ? 'ثانيتان' : `${remSecs} ثانية`;
  return `${minLabel} و ${secLabel}`;
}

export function formatTimeCountdown(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}:${pad(remMins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function formatTimeLimitLabel(minutes?: number | null): string {
  if (!minutes || minutes <= 0) {
    return 'بدون توقيت محدد (مفتوح)';
  }
  if (minutes === 60) {
    return 'ساعة واحدة (60 دقيقة)';
  }
  if (minutes === 90) {
    return 'ساعة ونصف (90 دقيقة)';
  }
  if (minutes === 120) {
    return 'ساعتان (120 دقيقة)';
  }
  return `${minutes} دقيقة`;
}

/**
 * Check if a quiz link has expired based on expires_at ISO string or timestamp
 */
export function isQuizExpired(expiresAt?: string | number | null): boolean {
  if (!expiresAt) return false;
  const expDate = new Date(expiresAt);
  if (isNaN(expDate.getTime())) return false;
  return Date.now() > expDate.getTime();
}

/**
 * Get detailed expiration info and formatted Arabic labels
 */
export function getQuizExpirationInfo(expiresAt?: string | number | null): {
  isExpired: boolean;
  fullDate: string;
  relativeText: string;
  shortBadge: string;
  diffMs: number;
} | null {
  if (!expiresAt) return null;
  const expDate = new Date(expiresAt);
  if (isNaN(expDate.getTime())) return null;

  const now = Date.now();
  const diffMs = expDate.getTime() - now;
  const isExpired = diffMs <= 0;

  const fullDate = expDate.toLocaleString('ar-EG', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (isExpired) {
    return {
      isExpired: true,
      fullDate,
      relativeText: `انتهت الصلاحية منذ ${formatDuration(Math.abs(diffMs) / 1000)}`,
      shortBadge: 'انتهت الصلاحية',
      diffMs
    };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  let relativeText = '';
  if (days > 0) {
    relativeText = `متبقي ${days} يوم${remainingHours > 0 ? ` و ${remainingHours} ساعة` : ''}`;
  } else if (hours > 0) {
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    relativeText = `متبقي ${hours} ساعة${mins > 0 ? ` و ${mins} دقيقة` : ''}`;
  } else {
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    relativeText = `متبقي ${mins} دقيقة`;
  }

  return {
    isExpired: false,
    fullDate,
    relativeText,
    shortBadge: `ينتهي: ${relativeText}`,
    diffMs
  };
}

/**
 * Convert Date to datetime-local input string format (YYYY-MM-DDTHH:mm)
 */
export function toDateTimeLocalString(date: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

