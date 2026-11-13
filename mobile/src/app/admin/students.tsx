import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Loading, EmptyState, ErrorState } from '../../components/Feedback';
import { db } from '../../lib/firebase';
import { useAuth, isAdminUser } from '../../store/AuthContext';
import { colors, radius, typography } from '../../theme';

interface PlatformStudent {
  id: string;
  student_name: string;
  student_phone: string;
  parent_phone?: string;
  center_name?: string;
  grade_level?: string;
  subject?: string;
  teacher_name?: string;
  exams_count?: number;
  last_exam_date?: string;
}

type FilterKey = 'grade_level' | 'subject' | 'teacher_name';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'grade_level', label: 'المرحلة' },
  { key: 'subject', label: 'المادة' },
  { key: 'teacher_name', label: 'المعلم' },
];

/** Platform-wide student registry — mirrors the legacy web "سجلات الطلاب" panel. */
export default function AdminStudentsScreen() {
  const { initialized, user, profile } = useAuth();
  const isAdmin = isAdminUser(profile as any, user?.email);
  const [students, setStudents] = useState<PlatformStudent[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [center, setCenter] = useState<'all' | 'none' | string>('all');
  const [filters, setFilters] = useState<Record<FilterKey, string>>({ grade_level: '', subject: '', teacher_name: '' });
  const [pickerFor, setPickerFor] = useState<FilterKey | 'center' | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      // Primary source: students collection (kept in sync by the web platform / result intake)
      const snap = await getDocs(collection(db, 'students'));
      const map = new Map<string, PlatformStudent>();
      snap.forEach((d) => {
        const s = d.data() as any;
        const name = String(s.student_name || s.name || '').trim();
        const phone = String(s.student_phone || s.phone || '').trim();
        if (!name && !phone) return;
        const key = `${name}|${phone}`;
        const prev = map.get(key);
        map.set(key, {
          id: d.id,
          student_name: name,
          student_phone: phone,
          parent_phone: s.parent_phone || prev?.parent_phone,
          center_name: s.center_name || prev?.center_name,
          grade_level: s.grade_level || prev?.grade_level,
          subject: s.subject || prev?.subject,
          teacher_name: s.teacher_name || prev?.teacher_name,
          exams_count: (prev?.exams_count || 0) + Number(s.exams_count || s.exams_taken || 1),
          last_exam_date: String(s.last_exam_date || s.updated_at || s.created_at || '') > String(prev?.last_exam_date || '') ? (s.last_exam_date || s.updated_at || s.created_at) : prev?.last_exam_date,
        });
      });
      // Always merge results — students exist there even if never synced to `students`
      // (legacy app did this only when empty, which hid unsynced teachers' students)
      const registryKeys = new Set(map.keys());
      const rs = await getDocs(collection(db, 'results'));
      rs.forEach((d) => {
        const r = d.data() as any;
        const name = String(r.student_name || '').trim();
        const phone = String(r.student_phone || '').trim();
        if (!name && !phone) return;
        const key = `${name}|${phone}`;
        const prev = map.get(key);
        if (prev) {
          if (!registryKeys.has(key)) prev.exams_count = (prev.exams_count || 0) + 1;
          // Fill gaps without overwriting the authoritative registry fields
          if (!prev.teacher_name && r.teacher_name) prev.teacher_name = r.teacher_name;
          if (!prev.grade_level && r.grade_level) prev.grade_level = r.grade_level;
          if (!prev.subject && r.subject) prev.subject = r.subject;
          if (!prev.center_name && r.center_name) prev.center_name = r.center_name;
          if (!prev.parent_phone && r.parent_phone) prev.parent_phone = r.parent_phone;
          if (String(r.created_at || '') > String(prev.last_exam_date || '')) prev.last_exam_date = r.created_at;
          return;
        }
        map.set(key, {
          id: d.id,
          student_name: name,
          student_phone: phone,
          parent_phone: r.parent_phone,
          center_name: r.center_name,
          grade_level: r.grade_level,
          subject: r.subject,
          teacher_name: r.teacher_name,
          exams_count: 1,
          last_exam_date: r.created_at,
        });
      });
      setStudents(Array.from(map.values()).sort((a, b) => a.student_name.localeCompare(b.student_name, 'ar')));
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل سجلات الطلاب.');
      setStudents([]);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const unique = (key: keyof PlatformStudent) =>
    Array.from(new Set((students || []).map((s) => String(s[key] || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'ar'));

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (students || []).filter((s) => {
      if (t && !s.student_name.toLowerCase().includes(t) && !s.student_phone.includes(t) && !(s.parent_phone || '').includes(t) && !(s.center_name || '').toLowerCase().includes(t)) return false;
      if (center === 'none' && s.center_name) return false;
      if (center !== 'all' && center !== 'none' && s.center_name !== center) return false;
      for (const f of FILTERS) if (filters[f.key] && String(s[f.key] || '') !== filters[f.key]) return false;
      return true;
    });
  }, [students, search, center, filters]);

  const pickerOptions = pickerFor === 'center' ? unique('center_name') : pickerFor ? unique(pickerFor) : [];

  if (initialized && !user) return <Redirect href="/(auth)/login" />;
  if (students === null && !error) return <Screen><Loading text="جاري تحميل سجلات الطلاب..." /></Screen>;
  if (initialized && user && !isAdmin && students !== null && !error) {
    return <Screen><ErrorState message="غير مصرح — هذه الصفحة متاحة لمديري المنصة فقط." /></Screen>;
  }

  return (
    <Screen scroll={false}>
      <View style={styles.searchWrap}>
        <Input placeholder="🔍 ابحث بالاسم أو الهاتف أو السنتر..." value={search} onChangeText={setSearch} />
        {error ? <ErrorState message={error} onRetry={load} /> : null}
        <Pressable style={styles.selectBox} onPress={() => setPickerFor('center')}>
          <Text style={styles.selectLabel}>السنتر:</Text>
          <Text style={styles.selectValue} numberOfLines={1}>{center === 'all' ? 'الكل' : center === 'none' ? 'بدون سنتر' : center}</Text>
          <Text style={styles.selectArrow}>▾</Text>
        </Pressable>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} style={[styles.selectBox, { flex: 1, marginBottom: 0 }]} onPress={() => setPickerFor(f.key)}>
              <Text style={styles.selectLabel}>{f.label}:</Text>
              <Text style={styles.selectValue} numberOfLines={1}>{filters[f.key] || 'الكل'}</Text>
              <Text style={styles.selectArrow}>▾</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[typography.caption, { textAlign: 'right' }]}>{filtered.length} طالب من أصل {students?.length || 0} سجل</Text>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(s, i) => `${s.student_name}|${s.student_phone}|${i}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="لا توجد سجلات" />}
        renderItem={({ item }) => (
          <Card>
            <Text style={typography.h3}>{item.student_name || '—'}</Text>
            <Text style={typography.caption}>📱 الطالب: {item.student_phone || '—'}{item.parent_phone ? ` • 👪 ولي الأمر: ${item.parent_phone}` : ''}</Text>
            <Text style={typography.caption}>🏫 {item.center_name || 'بدون سنتر'} • {item.grade_level || '—'} • {item.subject || '—'}</Text>
            <Text style={typography.caption}>👨‍🏫 {item.teacher_name || '—'} • اختبارات: {item.exams_count || 0}{item.last_exam_date ? ` • آخر اختبار: ${new Date(item.last_exam_date).toLocaleDateString('ar-EG')}` : ''}</Text>
          </Card>
        )}
      />
      <Modal visible={!!pickerFor} transparent animationType="fade" onRequestClose={() => setPickerFor(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerFor(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pickerFor === 'center' ? 'اختر السنتر' : pickerFor === 'grade_level' ? 'اختر المرحلة' : pickerFor === 'subject' ? 'اختر المادة' : 'اختر المعلم'}
            </Text>
            <FlatList
              data={pickerFor === 'center' ? ['all', 'none', ...pickerOptions] : ['', ...pickerOptions]}
              keyExtractor={(v) => v || 'ALL'}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => {
                const label = item === 'all' ? 'الكل' : item === 'none' ? 'بدون سنتر' : item === '' ? 'الكل' : item;
                const active = pickerFor === 'center' ? center === (item === '' ? 'all' : item) : filters[pickerFor as FilterKey] === item;
                return (
                  <Pressable style={styles.optionRow} onPress={() => {
                    if (pickerFor === 'center') setCenter(item as any);
                    else if (pickerFor) setFilters((f) => ({ ...f, [pickerFor]: item }));
                    setPickerFor(null);
                  }}>
                    <Text style={styles.optionText}>{label}</Text>
                    {active ? <Text style={styles.optionCheck}>✓</Text> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { padding: 16, paddingBottom: 4 },
  list: { padding: 16, paddingTop: 8, flexGrow: 1 },
  selectBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 8 },
  selectLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  selectValue: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'right' },
  selectArrow: { fontSize: 13, color: colors.textMuted },
  filterRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'right', marginBottom: 10 },
  optionRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 10, borderRadius: radius.sm },
  optionText: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'right', flex: 1 },
  optionCheck: { fontSize: 15, fontWeight: '800', color: colors.primary },
});
