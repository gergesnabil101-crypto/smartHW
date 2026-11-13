import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useAuth } from '../store/AuthContext';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Loading, EmptyState, ErrorState } from '../components/Feedback';
import { listTeacherResults, batchRecalculate, reviewResult } from '../lib/services';
import type { StudentResult } from '../types';
import { colors, radius, typography } from '../theme';

export default function ResultsScreen() {
  const router = useRouter();
  const { initialized, user, profile } = useAuth();
  const { quizId } = useLocalSearchParams<{ quizId?: string }>();
  const [results, setResults] = useState<StudentResult[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [centerFilter, setCenterFilter] = useState('all');
  const [centerPickerOpen, setCenterPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recalcing, setRecalcing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await listTeacherResults();
      setResults(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل النتائج.');
      setResults([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const quizResults = useMemo(() => {
    let list = results || [];
    if (quizId) list = list.filter((r) => r.quiz_id === quizId);
    else list = [];
    return list;
  }, [results, quizId]);

  const uniqueCenters = useMemo(() => {
    const set = new Set<string>();
    quizResults.forEach((r) => {
      const name = String(r.center_name || '').trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [quizResults]);

  const filtered = useMemo(() => {
    let list = quizResults;
    if (centerFilter !== 'all') {
      list = centerFilter === '__none__'
        ? list.filter((r) => !String(r.center_name || '').trim())
        : list.filter((r) => String(r.center_name || '').trim() === centerFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      `${r.student_name} ${r.quiz_title} ${r.center_name ?? ''}`.toLowerCase().includes(q)
    );
  }, [quizResults, search, centerFilter]);

  const quizTitle = filtered[0]?.quiz_title || 'الاختبار';

  const sendWhatsApp = async (r: StudentResult) => {
    let phone = String(r.parent_phone || r.student_phone || '').trim().replace(/[^0-9+]/g, '');
    if (!phone) return Alert.alert('لا يوجد رقم', 'لا يوجد رقم هاتف ولي أمر أو طالب لهذه النتيجة.');
    if (phone.startsWith('+')) phone = phone.substring(1);
    if (phone.startsWith('01')) phone = '2' + phone;
    else if (phone.startsWith('1') && phone.length === 10) phone = '20' + phone;
    const pct = r.total ? Math.round((Number(r.score) / Number(r.total)) * 100) : 0;
    const teacherName = profile?.name || user?.displayName || '';
    const msg = `نتيجة الطالب ${r.student_name} في اختبار «${r.quiz_title || 'اختبار'}»\nالمدرس: ${teacherName}\nالدرجة: ${r.score} / ${r.total} (${pct}%)`;
    try {
      await reviewResult(String(r.id), { reviewed_and_sent: true, reviewed_and_sent_at: new Date().toISOString() }).catch(() => {});
      await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
    } catch {
      Alert.alert('خطأ', 'تعذر فتح واتساب.');
    }
  };

  const exportCsv = async () => {
    if (!filtered.length) return Alert.alert('لا توجد بيانات', 'لا توجد نتائج لتصديرها.');
    setExporting(true);
    try {
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = [
        ['اسم الطالب', 'الاختبار', 'السنتر', 'هاتف ولي الأمر', 'الدرجة', 'من', 'النسبة %', 'التاريخ'].map(esc).join(','),
        ...filtered.map((r) => [
          r.student_name,
          r.quiz_title || '',
          r.center_name || '',
          r.parent_phone || '',
          r.score,
          r.total,
          r.total ? Math.round((Number(r.score) / Number(r.total)) * 100) : 0,
          new Date(r.created_at).toLocaleString('ar-EG'),
        ].map(esc).join(',')),
      ];
      const path = `${FileSystem.cacheDirectory}results-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, '﻿' + rows.join('\n'));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'تصدير النتائج' });
      } else {
        Alert.alert('المشاركة غير متاحة', 'تم إنشاء الملف لكن مشاركة الملفات غير مدعومة على هذا الجهاز.');
      }
    } catch (e: any) {
      Alert.alert('فشل التصدير', e?.message || 'حاول مرة أخرى.');
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    if (!filtered.length) return Alert.alert('لا توجد بيانات', 'لا توجد نتائج لتصديرها.');
    setExporting(true);
    try {
      const esc = (v: unknown) =>
        String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const title = `نتائج اختبار: ${quizTitle}`;
      const rowsHtml = filtered
        .map((r, i) => {
          const pct = r.total ? Math.round((Number(r.score) / Number(r.total)) * 100) : 0;
          return `<tr>
            <td>${i + 1}</td>
            <td>${esc(r.student_name)}</td>
            <td>${esc(r.quiz_title || '')}</td>
            <td>${esc(r.center_name || '')}</td>
            <td>${esc(r.parent_phone || '')}</td>
            <td>${esc(r.score)} / ${esc(r.total)}</td>
            <td>${pct}%</td>
            <td>${esc(formatDate(r.created_at))}</td>
          </tr>`;
        })
        .join('');
      const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
        <style>
          body { font-family: sans-serif; padding: 24px; direction: rtl; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          p.sub { color: #666; font-size: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #999; padding: 6px 8px; text-align: right; }
          th { background: #f0f0f0; font-weight: bold; }
          tr:nth-child(even) td { background: #fafafa; }
        </style></head><body>
        <h1>${esc(title)}</h1>
        <p class="sub">${filtered.length} نتيجة — ${new Date().toLocaleString('ar-EG')}</p>
        <table><thead><tr>
          <th>#</th><th>اسم الطالب</th><th>الاختبار</th><th>السنتر</th><th>هاتف ولي الأمر</th><th>الدرجة</th><th>النسبة</th><th>التاريخ</th>
        </tr></thead><tbody>${rowsHtml}</tbody></table>
        </body></html>`;
      try {
        const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'تصدير النتائج PDF' });
        } else {
          await Print.printAsync({ html });
        }
      } catch (innerErr: any) {
        // Fallback: open the system print dialog — its "Save as PDF" option always
        // works even when direct file rendering is unavailable on the device.
        try {
          await Print.printAsync({ html });
        } catch {
          throw innerErr;
        }
      }
    } catch (e: any) {
      Alert.alert('فشل التصدير', `تعذر إنشاء ملف PDF.\n${e?.message || e || 'خطأ غير معروف'}`);
    } finally {
      setExporting(false);
    }
  };

  const recalc = async () => {
    if (!quizId) return;
    setRecalcing(true);
    try {
      const res = await batchRecalculate(quizId);
      Alert.alert('تم', `تمت إعادة حساب ${res.updated ?? 0} نتيجة.`);
      await load();
    } catch (e: any) {
      Alert.alert('فشل إعادة الحساب', e?.message || 'حاول مرة أخرى.');
    } finally {
      setRecalcing(false);
    }
  };

  if (!initialized) {
    return <Screen><Loading text="جاري التحميل..." /></Screen>;
  }
  if (!user) return <Redirect href="/(auth)/login" />;

  if (results === null && !error) {
    return <Screen><Loading text="جاري تحميل النتائج..." /></Screen>;
  }

  return (
    <Screen scroll={false}>
      <View style={styles.searchWrap}>
        {quizTitle ? <Text style={[typography.h3, { textAlign: 'right', marginBottom: 8 }]}>{quizTitle}</Text> : null}
        <Input placeholder="ابحث باسم الطالب..." value={search} onChangeText={setSearch} />
        <Pressable style={styles.selectBox} onPress={() => setCenterPickerOpen(true)}>
          <Text style={styles.selectLabel}>السنتر / المجموعة:</Text>
          <Text style={styles.selectValue} numberOfLines={1}>
            {centerFilter === 'all' ? 'الكل' : centerFilter === '__none__' ? 'بدون سنتر' : centerFilter}
          </Text>
          <Text style={styles.selectArrow}>▾</Text>
        </Pressable>
        <Modal visible={centerPickerOpen} transparent animationType="fade" onRequestClose={() => setCenterPickerOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCenterPickerOpen(false)}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>اختر السنتر / المجموعة</Text>
              <FlatList
                data={['all', ...uniqueCenters, '__none__']}
                keyExtractor={(c) => c}
                style={{ maxHeight: 340 }}
                renderItem={({ item }) => {
                  const label = item === 'all' ? 'الكل' : item === '__none__' ? 'بدون سنتر' : item;
                  const active = centerFilter === item;
                  return (
                    <Pressable
                      style={[styles.optionRow, active && styles.optionRowActive]}
                      onPress={() => { setCenterFilter(item); setCenterPickerOpen(false); }}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
                      {active ? <Text style={styles.optionCheck}>✓</Text> : null}
                    </Pressable>
                  );
                }}
              />
            </View>
          </Pressable>
        </Modal>
        <View style={styles.toolbarRow}>
          <Button title={exporting ? 'جاري التصدير...' : '⬇ تصدير CSV'} variant="secondary" onPress={exportCsv} loading={exporting} />
          <Button title="📄 تصدير PDF" variant="secondary" onPress={exportPdf} loading={exporting} />
          {quizId ? (
            <Button title={recalcing ? 'جاري الحساب...' : '↻ إعادة حساب الدرجات'} variant="secondary" onPress={recalc} loading={recalcing} />
          ) : null}
        </View>
      </View>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      <FlatList
        data={filtered}
        keyExtractor={(r) => String(r.id)}
        refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="لا توجد نتائج" hint="نتائج طلاب هذا الاختبار ستظهر هنا بعد تسليمهم" />}
        renderItem={({ item }) => {
          const pct = item.total ? Math.round((Number(item.score) / Number(item.total)) * 100) : 0;
          const cheatFlags = Number((item as any).left_app_count || 0) + Number((item as any).screenshot_attempts || 0);
          return (
            <Card onPress={() => router.push({ pathname: '/result/[id]', params: { id: String(item.id), quizId: item.quiz_id || '' } })}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3} numberOfLines={1}>{item.student_name}</Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {item.quiz_title || 'اختبار'} • {formatDate(item.created_at)}
                  </Text>
                  {cheatFlags > 0 ? (
                    <Text style={[typography.caption, { color: colors.danger, fontWeight: '700' }]} numberOfLines={1}>
                      ⚠️ محاولات مشبوهة: خروج ×{Number((item as any).left_app_count || 0)}{Number((item as any).screenshot_attempts) ? ` • لقطة ×${Number((item as any).screenshot_attempts)}` : ''}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.scoreBadge, pct >= 50 ? styles.scorePass : styles.scoreFail]}>
                  <Text style={styles.scoreText}>{item.score}/{item.total}</Text>
                  <Text style={styles.pctText}>{pct}%</Text>
                </View>
              </View>
              {item.parent_phone || item.student_phone ? (
                <Pressable onPress={() => sendWhatsApp(item)} style={styles.waBtn}>
                  <Text style={styles.waText}>📱 إرسال النتيجة لولي الأمر</Text>
                </Pressable>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

function formatDate(d: string | number | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  searchWrap: { padding: 16, paddingBottom: 4 },
  selectBox: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10,
  },
  selectLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  selectValue: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'right' },
  selectArrow: { fontSize: 14, color: colors.textMuted },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'right', marginBottom: 10 },
  optionRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 10, borderRadius: radius.sm },
  optionRowActive: { backgroundColor: colors.primarySoft },
  optionText: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'right', flex: 1 },
  optionTextActive: { color: colors.primary },
  optionCheck: { fontSize: 15, fontWeight: '800', color: colors.primary },
  toolbarRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  list: { padding: 16, flexGrow: 1 },
  waBtn: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, alignItems: 'flex-end' },
  waText: { fontSize: 12, fontWeight: '700', color: colors.success },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  scoreBadge: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 64 },
  scorePass: { backgroundColor: colors.successSoft },
  scoreFail: { backgroundColor: colors.dangerSoft },
  scoreText: { fontWeight: '800', fontSize: 15, color: colors.text },
  pctText: { fontSize: 11, color: colors.textMuted },
});
